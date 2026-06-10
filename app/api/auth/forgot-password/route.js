import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { email, redirectTo } = await req.json()
    if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

    // Cliente server-side — sem problemas de CORS ou sessionStorage
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Por segurança, sempre retornar sucesso mesmo se o e-mail não existir
    // (evita user enumeration)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('forgot-password:', e)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
