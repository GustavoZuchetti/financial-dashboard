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

// ── Conferência dos LIQUIDADOS pela listagem filtrada (20/10/2026) ───────────
// O mesmo defeito, do lado dos títulos já pagos. Um pagamento excluído no
// Bling some da listagem e, como aqui já estava completo, nunca mais era
// conferido. A verificação de exclusões olhava sempre os 40–60 liquidados
// MAIS RECENTES — na FACE (2.160 pagos em 2026), só a última semana. Medido na
// conciliação do Controller contra o relatório de pagamentos do Bling:
//   · MERCADO LIVRE 26414983916 — R$ 1.805,99 em 23/07, inexistente no Bling
//   · RAPHAEL BERBEL PITTA 26317080212 — R$ 946,40 em 10/07; no Bling virou
//     dois títulos (R$ 173,53 + R$ 772,87), que também estavam aqui
//   · PLAYSTATION CURITIBA — R$ 43,90 em 17/08, em dobro aqui
// A varredura incremental não resolve: ela percorre os ~3.000 em aberto e só
// toca os pagos dos últimos dias.
//
// A correção lista no Bling os pagos e parciais dos últimos 365 dias PELA DATA
// DE PAGAMENTO (o mesmo filtro da carga histórica), 100 por página, só os ids.
// Ao fim da listagem completa, todo título pago ou parcial daqui, nesse
// período, que o Bling não devolveu vira candidato e é consultado pelo id com
// a mesma regra da fila de reconferência (decidirDestino). Existir lá com
// outra situação — um pagamento estornado, por exemplo — atualiza o título;
// 404 nos dois recursos remove.

// Fases da listagem por data de pagamento. Contas a pagar aceita uma situação
// por consulta; contas a receber aceita a lista. FONTE ÚNICA: a carga
// histórica da rota de sincronização usa as mesmas.
export const FASES_LIQUIDADOS = [
  { recurso: 'contas/receber', tipoFluxo: 'entrada', situacoes: [2, 3], filtro: 'recebimento' },
  { recurso: 'contas/pagar',   tipoFluxo: 'saida',   situacao: 2, filtro: 'pagamento' },
  { recurso: 'contas/pagar',   tipoFluxo: 'saida',   situacao: 3, filtro: 'pagamento_parcial' },
]

export function filtrosPorPagamento(fase, janela) {
  return fase.filtro === 'recebimento'
    ? { situacoes: fase.situacoes, tipoFiltroData: 'R', dataInicial: janela.inicio, dataFinal: janela.fim }
    : { situacao: fase.situacao, dataPagamentoInicial: janela.inicio, dataPagamentoFinal: janela.fim }
}

// O Bling rejeita período maior que 366 dias: hoje e os 365 anteriores.
export const DIAS_JANELA_LIQUIDADOS = 365
// Só são candidatos os liquidados daqui a mais de 45 dias do início da janela.
// A data de liquidação gravada vem do borderô (ADR-004) e pode diferir da data
// de pagamento do Bling (FGTS de 16/01 aqui, 20/02 lá): perto da borda, o
// título existiria no Bling fora da janela e viraria candidato à toa.
export const MARGEM_DIAS_LIQUIDADOS = 45
// 30 por página: o tamanho que a carga histórica usa em produção com o mesmo
// filtro. Com 100, o piloto da JB (23/10) leu ~240 dos 961 pagos e parou — a
// rodada inteira levou 3 s, menos que as ~13 páginas necessárias.
export const LIMITE_PAGINA_LIQUIDADOS = 30
// Teto de páginas por fase (12.000 títulos a 30 por página). Passar disso é
// sinal de paginação em laço: a rodada é suspensa, nunca segue comparando.
export const MAX_PAGINAS_FASE_LIQUIDADOS = 400
// Rodada manual em andamento é retomada até 3 dias; rodada concluída há menos
// de 1 dia não é repetida pela interface; o cron abre uma nova a cada 7 dias.
export const DIAS_RETOMADA_LIQUIDADOS = 3
export const HORAS_REPETICAO_MANUAL = 24
export const DIAS_RODADA_CRON = 7

const DIA_MS = 86400000
const isoDia = (ms) => new Date(ms).toISOString().split('T')[0]

export function janelaLiquidados(agora = new Date()) {
  const fimMs = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())
  return { inicio: isoDia(fimMs - DIAS_JANELA_LIQUIDADOS * DIA_MS), fim: isoDia(fimMs) }
}

export function novaRodadaLiquidados(agora = new Date()) {
  return { etapa: 'listagem', janela: janelaLiquidados(agora), fase: 0, pagina: 1,
    vistos: [], fila: [], iniciada_em: agora.toISOString() }
}

// Etapas: 'listagem' → 'comparar' → 'fila' → 'concluida'. 'suspeita' encerra a rodada sem
// conferir ninguém (ver filaPlausivel).
const EM_CURSO = ['listagem', 'comparar', 'fila']

// O que a sincronização manual faz com a rodada salva.
//   'continuar' — rodada em curso, iniciada há até 3 dias
//   'pular'     — concluída há menos de 24 h: não repete a listagem
//   'nova'      — qualquer outro caso (nenhuma, velha, suspeita, ilegível)
export function acaoManualLiquidados(estado, agora = new Date()) {
  const ini = Date.parse(estado?.iniciada_em)
  if (!estado || !Number.isFinite(ini)) return 'nova'
  const idade = agora.getTime() - ini
  if (EM_CURSO.includes(estado.etapa)) return idade <= DIAS_RETOMADA_LIQUIDADOS * DIA_MS ? 'continuar' : 'nova'
  const fim = Date.parse(estado.concluida_em)
  if (estado.etapa === 'concluida' && Number.isFinite(fim) && agora.getTime() - fim < HORAS_REPETICAO_MANUAL * 3600000) return 'pular'
  return 'nova'
}

// O cron continua qualquer rodada em curso (sem limite de idade: ele avança
// poucas páginas por dia) e abre uma nova a cada 7 dias.
export function acaoCronLiquidados(estado, agora = new Date()) {
  if (estado && EM_CURSO.includes(estado.etapa)) return 'continuar'
  const ref = Date.parse(estado?.concluida_em || estado?.iniciada_em)
  if (!estado || !Number.isFinite(ref)) return 'nova'
  return agora.getTime() - ref >= DIAS_RODADA_CRON * DIA_MS ? 'nova' : 'pular'
}

// Avanço da listagem depois de uma página LIDA COM SUCESSO. Página com erro
// não chama esta função: o estado fica na mesma página para a próxima vez.
//
// A fase só termina com página VAZIA — nunca por página "incompleta". O piloto
// da JB (23/10) tratou uma página com menos itens que o pedido como fim da
// listagem e deixou de ler ~720 pagos. Também termina quando a página só
// repete ids já vistos: o Bling ignorando a paginação daria um laço infinito.
// Cada página fica registrada em paginas_log (fase, página, recebidos, novos)
// para diagnóstico.
export function avancarListagem(estado, { ids }) {
  const lista = (ids || []).map(String)
  const antes = new Set((estado.vistos || []).map(String))
  const novos = lista.filter(id => !antes.has(id)).length
  const paginas_log = [...(estado.paginas_log || []),
    { fase: estado.fase, pagina: estado.pagina, recebidos: lista.length, novos }]
  const base = { ...estado, paginas_log,
    vistos: vistosAtualizados({ salvos: estado.vistos, novos: lista, recomecou: false }) }
  if (lista.length > 0 && novos > 0) {
    if (estado.pagina >= MAX_PAGINAS_FASE_LIQUIDADOS)
      return { ...base, etapa: 'suspeita', motivo: `mais de ${MAX_PAGINAS_FASE_LIQUIDADOS} páginas na fase ${estado.fase}` }
    return { ...base, pagina: estado.pagina + 1 }
  }
  if (estado.fase + 1 < FASES_LIQUIDADOS.length) return { ...base, fase: estado.fase + 1, pagina: 1 }
  return { ...base, etapa: 'comparar' }
}

// Candidatos: pagos e parciais do Bling daqui, liquidados dentro da janela
// (descontada a margem do início), que a listagem completa não devolveu. Mais
// antigos primeiro. Sem doc_ref do Bling nunca entra (R10.2).
export function candidatosLiquidados(titulos, vistos, janela) {
  const v = new Set((vistos || []).map(String))
  const desde = isoDia(Date.parse(`${janela.inicio}T00:00:00Z`) + MARGEM_DIAS_LIQUIDADOS * DIA_MS)
  return (titulos || [])
    .filter(t => ['pago', 'parcial'].includes(t?.status))
    .filter(t => !t?.origem_ausente)
    .filter(t => t?.data_liquidacao && t.data_liquidacao >= desde && t.data_liquidacao <= janela.fim)
    .filter(t => { const p = partesDocRef(t?.doc_ref); return p && !v.has(p.id) })
    .sort((a, b) => String(a.data_liquidacao).localeCompare(String(b.data_liquidacao))
                 || String(a.doc_ref).localeCompare(String(b.doc_ref)))
    .map(t => t.doc_ref)
}

// Trava de plausibilidade. Uma listagem que veio incompleta sem erro (o Bling
// devolvendo página vazia, um filtro ignorado) faria centenas de títulos bons
// parecerem ausentes. Acima de 5% dos liquidados do período (mínimo 20), a
// rodada é encerrada como 'suspeita' e NADA é consultado nem removido.
export function filaPlausivel(nCandidatos, nLiquidados) {
  return Number(nCandidatos) <= Math.max(20, Math.floor(Number(nLiquidados || 0) * 0.05))
}

// Diagnóstico de uma rodada suspensa: de que lado estão os candidatos e uma
// amostra deles. Fica gravado na rodada para conferir no Bling antes de
// qualquer ação — a lista inteira de ids vistos não é guardada.
export function diagnosticoSuspeita(titulos, fila, tamanhoAmostra = 20) {
  const alvo = new Set(fila || [])
  const cand = (titulos || []).filter(t => alvo.has(t?.doc_ref))
    .sort((a, b) => String(a.data_liquidacao).localeCompare(String(b.data_liquidacao))
                 || String(a.doc_ref).localeCompare(String(b.doc_ref)))
  const por_tipo = {}, por_mes = {}
  for (const t of cand) {
    const tipo = partesDocRef(t.doc_ref)?.tipoFluxo || '?'
    por_tipo[tipo] = (por_tipo[tipo] || 0) + 1
    const mes = String(t.data_liquidacao || '').slice(0, 7) || '?'
    por_mes[mes] = (por_mes[mes] || 0) + 1
  }
  return { por_tipo, por_mes,
    amostra: cand.slice(0, tamanhoAmostra).map(t => ({ doc_ref: t.doc_ref, status: t.status, data_liquidacao: t.data_liquidacao })) }
}

// Páginas e itens lidos por fase, a partir do registro da listagem.
export function resumoPaginas(log) {
  const por = {}
  for (const p of log || []) {
    const f = (por[p.fase] ||= { fase: p.fase, paginas: 0, recebidos: 0, novos: 0 })
    f.paginas++; f.recebidos += Number(p.recebidos) || 0; f.novos += Number(p.novos) || 0
  }
  return Object.values(por).sort((a, b) => a.fase - b.fase)
}

// O que a interface e o cron_resultado mostram da rodada — sem as listas de
// ids, que só interessam ao servidor.
export function resumoEstadoLiquidados(e) {
  if (!e) return null
  return { etapa: e.etapa, janela: e.janela, fase: e.fase, pagina: e.pagina,
    vistos: (e.vistos || []).length, pendentes: (e.fila || []).length,
    candidatos: e.candidatos ?? null, liquidados: e.liquidados ?? null,
    por_fase: resumoPaginas(e.paginas_log), motivo: e.motivo ?? null,
    diagnostico: e.diagnostico ? { por_tipo: e.diagnostico.por_tipo, por_mes: e.diagnostico.por_mes } : null }
}
