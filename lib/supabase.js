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
