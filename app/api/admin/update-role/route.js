import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getAdmin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key') }

const VALID_ROLES = ['super_admin', 'org_admin', 'user']

export async function POST(req) {
  const supabaseAdmin = getAdmin()
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !caller) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', caller.id).single()

  if (callerProfile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Apenas Super Admin pode alterar permissões' }, { status: 403 })
  }

  const { userId, newRole } = await req.json()
  if (!userId || !newRole) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  if (!VALID_ROLES.includes(newRole)) return NextResponse.json({ error: 'Role inválido' }, { status: 400 })

  // Impede que o super_admin remova o próprio status (evita lockout)
  if (userId === caller.id && newRole !== 'super_admin') {
    return NextResponse.json({ error: 'Você não pode remover seu próprio status de Super Admin' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('profiles').update({ role: newRole }).eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
