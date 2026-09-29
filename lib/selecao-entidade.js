// ─── selecao-entidade.js — alteração da seleção de entidades ────────────────
//
// FONTE ÚNICA da GRAVAÇÃO da seleção. A leitura validada continua em
// getSelectedEntidadeIds() (lib/supabase.js), que descarta IDs de outra
// organização — esta lib não substitui aquela validação.
//
// ── Por que existe ──────────────────────────────────────────────────────────
// Até 30/09/2026 só o Sidebar alterava a seleção. Com o filtro de entidade na
// Gestão, uma segunda tela passou a alterá-la. Duplicar a lógica de gravação
// seria o padrão que produziu quase todas as divergências desta base.
//
// O CONTRATO — qualquer mudança aqui quebra as telas silenciosamente:
//   empresa_ids  JSON com a lista de IDs selecionados
//   empresa_id   o ID único, ou 'todas' quando mais de um
//   evento       window.dispatchEvent(new Event('storage'))
//
// O evento é obrigatório: o navegador não entrega o 'storage' nativo na
// própria aba que gravou. Sem ele, nenhuma tela reage (ver PR #19).

export const EVENTO_SELECAO = 'storage'

export function lerSelecaoBruta() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('empresa_ids')
    const ids = raw ? JSON.parse(raw) : null
    if (Array.isArray(ids) && ids.length) return ids
  } catch { /* JSON corrompido: cai no legado */ }
  const unico = localStorage.getItem('empresa_id')
  return unico && unico !== 'todas' ? [unico] : []
}

// Grava a seleção e notifica todas as telas. Nunca grava lista vazia: sem
// entidade selecionada as telas não têm o que exibir.
export function definirSelecaoEntidades(ids) {
  if (typeof window === 'undefined') return null
  const lista = [...new Set((ids || []).filter(Boolean))]
  if (!lista.length) return null
  const valorUnico = lista.length === 1 ? lista[0] : 'todas'
  localStorage.setItem('empresa_ids', JSON.stringify(lista))
  localStorage.setItem('empresa_id', valorUnico)
  window.dispatchEvent(new Event(EVENTO_SELECAO))
  return valorUnico
}
