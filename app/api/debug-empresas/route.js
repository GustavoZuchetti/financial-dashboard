import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', user.id).single()

  // Método A: filtro no banco
  const { data: comEq } = await admin.from('empresas').select('id,nome').eq('organization_id', profile.organization_id)
  // Método B: buscar todas e filtrar em JS
  const { data: todas } = await admin.from('empresas').select('id,nome,organization_id')
  const filtradoJS = (todas || []).filter(e => e.organization_id === profile.organization_id)
  // Método C: usar .in() em vez de .eq()
  const { data: comIn } = await admin.from('empresas').select('id,nome').in('organization_id', [profile.organization_id])

  return NextResponse.json({
    metodoA_eq: comEq?.map(e=>e.nome),
    metodoB_todas_e_filtra_js: filtradoJS.map(e=>e.nome),
    metodoB_totalNoBanco: todas?.length,
    metodoC_in: comIn?.map(e=>e.nome),
  })
}
