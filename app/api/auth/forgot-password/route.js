import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getAdmin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key') }

export async function POST(req) {
  try {
    const { email, redirectTo } = await req.json()
    if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

    // Verificar se o usuário existe
    const { data: { users }, error: listErr } = await getAdmin().auth.admin.listUsers()
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

    const user = users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())

    // Segurança: não revelar se e-mail existe ou não
    if (!user) return NextResponse.json({ ok: true, method: 'none' })

    // Gerar link de recuperação direto via admin API (sem depender de SMTP)
    const { data, error } = await getAdmin().auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
      options: { redirectTo },
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      method: 'link',
      link: data.properties?.action_link,
      email: user.email,
    })
  } catch (e) {
    console.error('forgot-password error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
