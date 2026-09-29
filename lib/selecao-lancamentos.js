// ─── selecao-lancamentos.js — seleção em lote na Gestão ─────────────────────
//
// Lógica pura, sem React, para ser testável. A seleção alimenta a EXCLUSÃO
// PERMANENTE em lote — não há lixeira nem desfazer. Por isso cada regra aqui
// existe para impedir que se apague algo que o usuário não está vendo.
//
// ── O defeito original (relatado em 30/09/2026) ─────────────────────────────
// Marcar lançamentos e trocar de página desmarcava tudo: a paginação roda
// dentro do load(), e o load() limpava a seleção a cada execução.
//
// ── O risco da correção ingênua ─────────────────────────────────────────────
// Manter a seleção entre páginas permite marcar na página 1, ir à 3 e excluir
// registros fora da tela. As regras abaixo tornam isso visível e controlado.
//
// REGRAS
//   R1  a seleção SOBREVIVE à troca de página
//   R2  a seleção ZERA quando qualquer filtro muda — período, tipo, situação,
//       busca, entidade. Senão seria possível excluir itens fora do filtro
//   R3  a seleção é PODADA ao recarregar: id que saiu do conjunto filtrado
//       deixa de estar selecionado
//   R4  "selecionar todos" age SÓ na página atual. A versão anterior comparava
//       o total selecionado com o tamanho da página e, com seleção em outras
//       páginas, SUBSTITUÍA a seleção em silêncio
//   R5  a confirmação declara quantos itens estão fora da página e quantos a
//       sincronização vai recriar

// Lançamento originado da API do Bling. A próxima sincronização o recria —
// excluí-lo localmente não o remove de fato.
export const ehDoBling = (r) => String(r?.doc_ref || '').startsWith('bling:')

// R3 — mantém apenas os ids que continuam no conjunto filtrado
export function podarSelecao(selecionados, filtrados) {
  const presentes = new Set((filtrados || []).map(r => r.id))
  const podada = new Set()
  for (const id of selecionados || []) if (presentes.has(id)) podada.add(id)
  return podada
}

// R4 — alterna a seleção da PÁGINA ATUAL, preservando as demais
export function alternarPagina(selecionados, idsPagina) {
  const s = new Set(selecionados || [])
  const ids = idsPagina || []
  if (!ids.length) return s
  const todosMarcados = ids.every(id => s.has(id))
  for (const id of ids) todosMarcados ? s.delete(id) : s.add(id)
  return s
}

export function paginaToda(selecionados, idsPagina) {
  const ids = idsPagina || []
  return ids.length > 0 && ids.every(id => (selecionados || new Set()).has(id))
}

// R5 — o que a confirmação precisa declarar antes de apagar
export function resumirSelecao(selecionados, filtrados, idsPagina) {
  const sel = selecionados || new Set()
  const naPagina = new Set(idsPagina || [])
  const itens = (filtrados || []).filter(r => sel.has(r.id))
  let valor = 0, foraDaPagina = 0, recriados = 0, definitivos = 0
  for (const r of itens) {
    valor += Math.abs(Number(r.valor) || 0)
    if (!naPagina.has(r.id)) foraDaPagina++
    // Do Bling e ainda ativo na origem → a sincronização recria.
    // Do Bling mas já excluído na origem, ou manual → some de fato.
    if (ehDoBling(r) && !r.origem_ausente) recriados++
    else definitivos++
  }
  return {
    total: itens.length,
    valor: Math.round(valor * 100) / 100,
    foraDaPagina, recriados, definitivos,
    ids: itens.map(r => r.id),   // só ids presentes no filtro — defesa final
  }
}
