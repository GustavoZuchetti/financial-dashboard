import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  // Decodificar o payload do JWT da service role key (sem verificar assinatura)
  let keyInfo = { present: !!srk, length: srk.length }
  try {
    const payload = JSON.parse(Buffer.from(srk.split('.')[1], 'base64').toString())
    keyInfo.role = payload.role
    keyInfo.ref = payload.ref
    keyInfo.iat = payload.iat
  } catch (e) {
    keyInfo.decodeError = e.message
  }

  // Testar a query com essa key
  const admin = createClient(url, srk)
  const { data: byOrg, error } = await admin
    .from('empresas').select('id, nome, organization_id')
    .eq('organization_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

  // Testar contagem total de empresas (sem filtro) — se for <3, RLS está ativo
  const { data: todas } = await admin.from('empresas').select('id')

  return NextResponse.json({
    keyInfo,
    urlConfigured: url.substring(0, 40),
    empresasPorOrg: byOrg,
    countPorOrg: byOrg?.length,
    queryError: error?.message,
    totalEmpresasVisiveis: todas?.length,
  })
}
