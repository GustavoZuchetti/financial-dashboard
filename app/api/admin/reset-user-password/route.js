import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getAdmin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key') }

function generatePassword() {
  const lower   = 'abcdefghjkmnpqrstuvwxyz'
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const digits  = '23456789'
  const special = '!@#$'
  const all     = lower + upper + digits + special
  let pwd = ''
  pwd += lower[Math.floor(Math.random() * lower.length)]
  pwd += upper[Math.floor(Math.random() * upper.length)]
  pwd += digits[Math.floor(Math.random() * digits.length)]
  pwd += special[Math.floor(Math.random() * special.length)]
  for (let i = 0; i < 8; i++) pwd += all[Math.floor(Math.random() * all.length)]
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}

export async function POST(req) {
  const supabaseAdmin = getAdmin()
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !caller) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', caller.id).single()

  if (callerProfile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Acesso negado — apenas Super Admin' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })

  if (userId === caller.id) {
    return NextResponse.json({ error: 'Use a seção Perfil para alterar sua própria senha' }, { status: 400 })
  }

  const newPassword = generatePassword()
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, email: data.user?.email, password: newPassword })
}
