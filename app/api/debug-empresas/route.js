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
  if (authErr || !user) return NextResponse.json({ step: 'auth', err: authErr?.message })

  // EXATAMENTE como my-empresas faz
  const { data: profile, error: pErr } = await admin
    .from('profiles').select('organization_id, role').eq('id', user.id).single()

  let empresas = []
  let caminhoUsado = 'nenhum'
  if (profile?.organization_id) {
    const { data, error } = await admin
      .from('empresas').select('id, nome')
      .eq('organization_id', profile.organization_id).order('nome')
    empresas = data || []
    caminhoUsado = 'por organization_id: ' + profile.organization_id + ' (count=' + empresas.length + (error ? ' ERRO:'+error.message : '') + ')'
  }
  if (empresas.length === 0) {
    const { data } = await admin.from('empresas').select('id, nome').eq('user_id', user.id).order('nome')
    empresas = data || []
    caminhoUsado += ' | fallback user_id (count=' + empresas.length + ')'
  }

  return NextResponse.json({
    userIdDoToken: user.id,
    profileEncontrado: profile,
    profileErro: pErr?.message,
    caminhoUsado,
    empresasFinal: empresas.map(e => e.nome),
    count: empresas.length,
  })
}
