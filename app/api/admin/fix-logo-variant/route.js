import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
  )
}

export async function POST() {
  const admin = getAdmin()
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN
  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([^.]+)\./)?.[1]

  const results = {}

  // 1. Garantir que a coluna logo_url_light existe
  if (projectRef && mgmtToken) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url_light text;' })
    })
    results.alterTable = r.ok ? 'ok' : await r.text()
  }

  // 2. Mover logo_url → logo_url_light onde ainda não foi feito
  const { data: orgs } = await admin.from('organizations').select('id, logo_url, logo_url_light')
  results.orgs = orgs

  for (const org of (orgs || [])) {
    if (org.logo_url && !org.logo_url_light) {
      const { error } = await admin.from('organizations')
        .update({ logo_url_light: org.logo_url, logo_url: null })
        .eq('id', org.id)
      results[org.id] = error ? `erro: ${error.message}` : 'movido logo_url → logo_url_light'
    } else {
      results[org.id] = `logo_url=${org.logo_url ? 'existe' : 'null'} logo_url_light=${org.logo_url_light ? 'existe' : 'null'} (sem alteração)`
    }
  }

  return NextResponse.json(results)
}
