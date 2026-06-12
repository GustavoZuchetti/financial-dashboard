import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getAdmin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key') }

export async function GET(req) {
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

  // Listar todos os usuários via admin API (sem filtro de org)
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enriquecer com dados dos perfis
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, role, organization_id, organizations(nome)')

  const profileMap = {}
  ;(profiles || []).forEach(p => { profileMap[p.id] = p })

  const enriched = users.map(u => ({
    id:           u.id,
    email:        u.email,
    confirmed:    !!u.confirmed_at,
    last_sign_in: u.last_sign_in_at,
    created_at:   u.created_at,
    role:         profileMap[u.id]?.role         ?? null,
    org_nome:     profileMap[u.id]?.organizations?.nome ?? null,
    has_profile:  !!profileMap[u.id],
  }))

  // Ordenar: sem perfil primeiro (problema), depois por último acesso
  enriched.sort((a, b) => {
    if (!a.has_profile && b.has_profile) return -1
    if (a.has_profile && !b.has_profile) return 1
    return new Date(b.last_sign_in || 0) - new Date(a.last_sign_in || 0)
  })

  return NextResponse.json({ users: enriched })
}
