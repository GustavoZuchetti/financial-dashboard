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
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  // Buscar profile (service role bypassa RLS)
  const { data: profile } = await admin
    .from('profiles').select('organization_id, role').eq('id', user.id).single()

  let empresas = []

  if (profile?.organization_id) {
    const { data } = await admin
      .from('empresas').select('id, nome')
      .eq('organization_id', profile.organization_id).order('nome')
    empresas = data || []
  }

  // Fallback para usuários sem organização
  if (empresas.length === 0) {
    const { data } = await admin
      .from('empresas').select('id, nome')
      .eq('user_id', user.id).order('nome')
    empresas = data || []
  }

  return NextResponse.json({ empresas, organization_id: profile?.organization_id || null })
}
