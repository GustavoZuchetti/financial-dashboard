import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
  )
}

export async function GET(request) {
  const admin = getAdmin()
  const out = {}

  // 1. Token e usuário
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '')
  out.hasToken = !!token
  if (!token) return NextResponse.json({ ...out, error: 'sem token' })

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  out.authError = authErr?.message || null
  out.userId = user?.id || null
  out.userEmail = user?.email || null
  if (!user) return NextResponse.json(out)

  // 2. Profile do usuário
  const { data: profile, error: profErr } = await admin
    .from('profiles').select('*').eq('id', user.id).single()
  out.profileError = profErr?.message || null
  out.profile = profile || null

  // 3. Todas as organizations
  const { data: orgs } = await admin.from('organizations').select('id, nome')
  out.organizations = orgs || []

  // 4. Todas as empresas (sem filtro)
  const { data: allEmpresas } = await admin.from('empresas').select('id, nome, organization_id, user_id')
  out.allEmpresas = allEmpresas || []

  // 5. Empresas filtradas pela org do profile
  if (profile?.organization_id) {
    const { data: orgEmpresas } = await admin
      .from('empresas').select('id, nome').eq('organization_id', profile.organization_id)
    out.empresasByOrg = orgEmpresas || []
  }

  return NextResponse.json(out)
}
