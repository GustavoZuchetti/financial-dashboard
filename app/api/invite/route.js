import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Service role — seguro aqui pois roda APENAS no servidor (Node.js), nunca no browser
function getAdmin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key') }

// GET /api/invite?token=XXXX — valida o token (sem auth necessária)
export async function GET(request) {
  const supabaseAdmin = getAdmin()
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ error: 'Token ausente' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('invites')
    .select('id, email, role, organization_id, expires_at, used_at')
    .eq('token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  if (data.used_at)   return NextResponse.json({ error: 'Convite já utilizado'  }, { status: 410 })
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ error: 'Convite expirado' }, { status: 410 })

  // Retorna apenas os campos necessários (não expõe o token)
  return NextResponse.json({ email: data.email, role: data.role, organization_id: data.organization_id })
}

// POST /api/invite — aceita o convite e cria o usuário
export async function POST(request) {
  const supabaseAdmin = getAdmin()
  const { token, nome, senha } = await request.json()
  if (!token || !nome || !senha) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })

  // Buscar convite
  const { data: inv, error: invErr } = await supabaseAdmin
    .from('invites')
    .select('*')
    .eq('token', token)
    .single()

  if (invErr || !inv)      return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  if (inv.used_at)         return NextResponse.json({ error: 'Convite já utilizado'  }, { status: 410 })
  if (new Date(inv.expires_at) < new Date()) return NextResponse.json({ error: 'Convite expirado' }, { status: 410 })

  // Criar usuário via Admin API (bypassa confirmação de e-mail)
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email:              inv.email,
    password:           senha,
    email_confirm:      true, // confirma automaticamente — sem precisar de e-mail
    user_metadata:      { nome },
  })

  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  const userId = authData.user?.id
  // Criar perfil
  await supabaseAdmin.from('profiles').upsert({
    id:              userId,
    organization_id: inv.organization_id,
    role:            inv.role,
    email:           inv.email,
    nome_display:    nome,
  })

  // Marcar convite como usado
  await supabaseAdmin.from('invites').update({ used_at: new Date().toISOString() }).eq('token', token)

  return NextResponse.json({ ok: true })
}
