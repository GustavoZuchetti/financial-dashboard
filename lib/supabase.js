import { createClient } from '@supabase/supabase-js'

// Placeholders válidos para o build (quando env vars não estão disponíveis
// na fase de prerendering). Em runtime, as variáveis reais são usadas.
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signOut() {
  await supabase.auth.signOut()
}

// Busca TODOS os registros de uma query, paginando de 1000 em 1000.
// Necessário porque o PostgREST do Supabase limita cada resposta a 1000 linhas,
// ignorando .range() acima desse teto. Sem isso, datasets >1000 perdem registros.
export async function fetchAll(queryBuilder) {
  const PAGE = 1000
  let all = []
  let page = 0
  while (true) {
    const { data, error } = await queryBuilder.range(page * PAGE, (page + 1) * PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    page++
    if (page > 50) break // trava de segurança: máx 50 mil registros
  }
  return all
}

// ─── Resolução de entidades (empresas) para filtro/consolidação ──────────────
// Cache em memória dos IDs de empresa da organização do usuário logado.
// IMPORTANTE: busca por organization_id (modelo multi-tenant), NÃO por user_id
// — empresas criadas via admin portal têm user_id nulo e seriam ignoradas.
let _orgEmpresaIdsCache = null

export async function getOrgEmpresaIds() {
  if (_orgEmpresaIdsCache) return _orgEmpresaIdsCache
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return []
  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', session.user.id).single()
  let ids = []
  if (profile?.organization_id) {
    const { data } = await supabase
      .from('empresas').select('id').eq('organization_id', profile.organization_id)
    ids = (data || []).map(e => e.id)
  }
  // Fallback legado: empresas vinculadas por user_id
  if (ids.length === 0) {
    const { data } = await supabase.from('empresas').select('id').eq('user_id', session.user.id)
    ids = (data || []).map(e => e.id)
  }
  _orgEmpresaIdsCache = ids
  return ids
}

export function clearEmpresaIdsCache() { _orgEmpresaIdsCache = null }

// Lê a seleção atual de entidades do localStorage de forma uniforme.
// Retorna sempre um array de IDs já resolvido (pronto para .in('empresa_id', ...)).
// - 'empresa_ids' (JSON array) tem prioridade quando presente (multi-seleção)
// - senão usa 'empresa_id' (string única ou 'todas')
export async function getSelectedEntidadeIds() {
  if (typeof window === 'undefined') return []
  let multi = null
  try {
    const raw = localStorage.getItem('empresa_ids')
    if (raw) multi = JSON.parse(raw)
  } catch (_) { multi = null }
  if (Array.isArray(multi) && multi.length) {
    const todas = await getOrgEmpresaIds()
    // SEGURANÇA (defesa em profundidade): localStorage é controlado pelo usuário.
    // Descarta qualquer ID que não pertença à organização — impede que uma
    // seleção manipulada consulte dados de outra organização pelo cliente.
    if (todas.length) {
      const valid = multi.filter(id => todas.includes(id))
      if (!valid.length) return todas
      if (valid.length >= todas.length) return todas
      return valid
    }
    return multi
  }
  const single = localStorage.getItem('empresa_id')
  const resolved = await resolveEntidadeIds(single)
  // Mesma validação para seleção única
  if (resolved.length === 1) {
    const todas = await getOrgEmpresaIds()
    if (todas.length && !todas.includes(resolved[0])) return todas
  }
  return resolved
}

// Resolve o valor do seletor de entidade para uma lista de IDs a filtrar.
// Aceita: 'todas' → todas as entidades da org;
//         array de IDs (multi-seleção) → esses IDs;
//         id único (string) → [id].
export async function resolveEntidadeIds(selecao) {
  if (selecao === 'todas' || selecao == null || selecao === '') {
    return await getOrgEmpresaIds()
  }
  if (Array.isArray(selecao)) {
    // Lista de IDs marcados; se vazia, cai para todas
    return selecao.length ? selecao : await getOrgEmpresaIds()
  }
  return [selecao]
}
