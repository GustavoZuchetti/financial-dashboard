// ─── bling-reconferencia.js — títulos que a listagem do Bling deixou de devolver ─
//
// FONTE ÚNICA da regra que decide quais títulos em aberto precisam ser
// conferidos um a um no Bling, e o que fazer com a resposta. Lógica pura, sem
// I/O, para poder ser testada — a rota de sincronização e o cron apenas a
// consomem (regra canônica nº 1 de docs/04).
//
// ── O problema que este módulo resolve ──────────────────────────────────────
// A sincronização percorre a LISTAGEM do Bling. Título que sai da listagem —
// excluído, substituído por outro, cancelado — simplesmente deixa de aparecer,
// e o que já estava gravado aqui fica congelado para sempre. Medido em
// 16/10/2026, nas últimas varreduras completas: 165 títulos em aberto ou
// parciais que nenhuma varredura revisitou (FACE R$ 2,3 mi). Dois confirmados
// com o Controller:
//
//   · DATAPREV 26280211663 — R$ 1.335.639,20 a receber, vencido em 21/09.
//     Excluído no Bling e substituído; seguia aqui como "a receber vencido".
//   · JULIANO BASILIO 23648043154 — R$ 22.000, vencido em 15/07, PARCIAL com
//     R$ 10.000 liquidados. Excluído e substituído pelo título de 10/07; os
//     R$ 10.000 contavam em dobro no caixa de julho.
//
// A verificação de exclusões existente não os alcançava: olhava só títulos com
// vencimento nos últimos 90 dias e, dentro disso, os ~30 de vencimento MAIS
// DISTANTE (parcelas de 2031), nunca os vencidos.
//
// ── A correção ──────────────────────────────────────────────────────────────
// A varredura manual guarda os ids que a listagem devolveu. Ao terminar, todo
// título em aberto ou parcial que NÃO apareceu entra numa fila, do vencimento
// mais antigo para o mais novo, e é consultado no Bling pelo id:
//   existe        → atualiza com o que o Bling diz (pago, cancelado, novo valor)
//   404 nos dois  → excluído na origem: remove, com registro em audit_logs
//   outro erro    → continua na fila; nunca remove por falha transitória

// Teto de remoções por execução. Uma remoção é irreversível sem o audit_logs;
// um 404 falso em massa (API instável, credencial trocada) não pode apagar
// dezenas de títulos de uma vez. O que passar do teto fica para a próxima.
export const MAX_REMOCOES_POR_EXECUCAO = 15

const RE_DOC_BLING = /^bling:(entrada|saida):(.+)$/

// Partes de um doc_ref do Bling, ou null se o registro não veio do Bling.
export function partesDocRef(docRef) {
  const m = RE_DOC_BLING.exec(String(docRef || ''))
  if (!m) return null
  const tipoFluxo = m[1]
  return {
    tipoFluxo,
    id: m[2],
    recurso: tipoFluxo === 'entrada' ? 'contas/receber' : 'contas/pagar',
    outroRecurso: tipoFluxo === 'entrada' ? 'contas/pagar' : 'contas/receber',
  }
}

// Ids de uma página da listagem, como texto.
export function idsDaPagina(itens) {
  return (itens || []).map(i => i?.id).filter(id => id != null && id !== '').map(String)
}

// A varredura recomeça quando parte de { fase 0, página 1 } sem retomar um
// cursor salvo. Só aí o conjunto de vistos é zerado — numa retomada ele
// continua, senão os títulos das páginas anteriores à interrupção seriam
// tomados por "fora da listagem".
export function varreduraRecomecou({ fase, pagina, retomado }) {
  return Number(fase) === 0 && Number(pagina) === 1 && !retomado
}

// Conjunto de ids vistos na varredura em curso.
export function vistosAtualizados({ salvos, novos, recomecou }) {
  const base = recomecou || !Array.isArray(salvos) ? [] : salvos
  const s = new Set(base.map(String))
  for (const id of novos || []) s.add(String(id))
  return [...s]
}

// Fila de reconferência: títulos do Bling em aberto ou parciais, não marcados
// como ausentes, que a varredura completa não viu. Vencimento mais antigo
// primeiro — são os que mais distorcem "atrasados" e o caixa.
// Registro sem doc_ref do Bling nunca entra (R10.2: não pode ser removido por
// "não existir lá", porque nunca existiu).
export function montarFila(titulos, vistos) {
  const v = new Set((vistos || []).map(String))
  return (titulos || [])
    .filter(t => ['aberto', 'parcial'].includes(t?.status))
    .filter(t => !t?.origem_ausente)
    .filter(t => {
      const p = partesDocRef(t?.doc_ref)
      return p && !v.has(p.id)
    })
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || ''))
                 || String(a.doc_ref).localeCompare(String(b.doc_ref)))
    .map(t => t.doc_ref)
}

// Destino de um título depois de consultado pelo id.
//   statusProprio: HTTP do GET no recurso do título (receber ou pagar)
//   statusOutro:   HTTP do GET no outro recurso, consultado só após um 404
//
//   'atualizar' — existe: grava o que o Bling diz
//   'remover'   — 404 nos dois recursos: excluído na origem
//   'descartar' — existe no OUTRO recurso: não é exclusão, sai da fila
//   'manter'    — qualquer outra resposta: falha transitória, fica na fila
export function decidirDestino(statusProprio, statusOutro) {
  const ok = (s) => Number(s) >= 200 && Number(s) < 300
  if (ok(statusProprio)) return 'atualizar'
  if (Number(statusProprio) !== 404) return 'manter'
  if (Number(statusOutro) === 404) return 'remover'
  if (ok(statusOutro)) return 'descartar'
  return 'manter'
}

export function podeRemover(removidosNaExecucao) {
  return Number(removidosNaExecucao) < MAX_REMOCOES_POR_EXECUCAO
}

// ── Cron ────────────────────────────────────────────────────────────────────
// Teto de trabalho por execução. O maxDuration da rota é 60s; a margem cobre a
// gravação final de cada entidade.
export const CRON_TETO_MS = 50000
export const CRON_LIMITE_PAGINA = 30

// Rodízio diário da ordem das entidades. Com a ordem fixa, quem ficava por
// último dependia de sobrar tempo depois das outras — e, se a função fosse
// morta aos 60s, nunca era gravada.
export function ordemRodizio(lista, dia) {
  const n = (lista || []).length
  if (!n) return []
  const k = ((Number(dia) % n) + n) % n
  return [...lista.slice(k), ...lista.slice(0, k)]
}

export function diaDoAno(d = new Date()) {
  const ini = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.floor((d.getTime() - ini) / 86400000)
}

// Fatia de tempo de uma entidade: o que sobra do teto, dividido igualmente
// entre ela e as que ainda faltam.
export function janelaCron({ inicioGlobal, agora, entidadesRestantes }) {
  const sobra = CRON_TETO_MS - (Number(agora) - Number(inicioGlobal))
  return Math.max(0, Math.floor(sobra / Math.max(1, Number(entidadesRestantes) || 1)))
}
