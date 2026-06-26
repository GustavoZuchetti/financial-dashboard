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
  const { data: { user } } = await admin.auth.getUser(token)

  const { data: profile } = await admin
    .from('profiles').select('organization_id').eq('id', user.id).single()

  const orgFromProfile = profile?.organization_id
  const orgLiteral = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

  // Comparar os dois byte a byte
  const comparacao = {
    profileValue: JSON.stringify(orgFromProfile),
    profileLength: orgFromProfile?.length,
    literalLength: orgLiteral.length,
    saoIguais: orgFromProfile === orgLiteral,
    charCodes: orgFromProfile ? [...orgFromProfile].map(c => c.charCodeAt(0)).join(',') : null,
  }

  // Query com o valor do profile
  const { data: comProfile } = await admin.from('empresas').select('id,nome').eq('organization_id', orgFromProfile).order('nome')
  // Query com o literal
  const { data: comLiteral } = await admin.from('empresas').select('id,nome').eq('organization_id', orgLiteral).order('nome')

  return NextResponse.json({
    comparacao,
    countComProfile: comProfile?.length,
    countComLiteral: comLiteral?.length,
  })
}
