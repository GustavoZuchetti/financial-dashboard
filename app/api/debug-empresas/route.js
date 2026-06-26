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
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '')
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ step: 'auth', authErr: authErr?.message, hasUser: !!user })

  const { data: profile, error: pErr } = await admin
    .from('profiles').select('organization_id, role').eq('id', user.id).single()

  const orgId = profile?.organization_id
  const { data: byOrg, error: oErr } = await admin
    .from('empresas').select('id, nome').eq('organization_id', orgId).order('nome')

  return NextResponse.json({
    userId: user.id,
    profile,
    profileErr: pErr?.message,
    orgIdUsado: orgId,
    empresasPorOrg: byOrg,
    empresasErr: oErr?.message,
    countPorOrg: byOrg?.length,
  })
}
