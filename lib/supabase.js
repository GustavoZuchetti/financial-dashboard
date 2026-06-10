import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// sessionStorage: sessão persiste enquanto a aba estiver aberta (sobrevive a refresh).
// Ao fechar a aba ou abrir nova janela, a sessão é perdida — login obrigatório.
// Mais seguro que localStorage (sem persistência entre sessões do navegador).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    autoRefreshToken: true,
    detectSessionInUrl: true, // necessário para capturar token do link de recuperação de senha
  },
})

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signOut() {
  await supabase.auth.signOut()
}
