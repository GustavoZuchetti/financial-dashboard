import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
  )
}

// Endpoint público: retorna APENAS a logo_url (nenhum dado sensível).
// Necessário porque o RLS bloqueia SELECT anônimo em organizations,
// e a tela de login precisa exibir a logo antes da autenticação.
export async function GET() {
  try {
    const admin = getAdmin()
    const { data } = await admin
      .from('organizations')
      .select('logo_url')
      .not('logo_url', 'is', null)
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ logo_url: data?.logo_url || null })
  } catch (_e) {
    return NextResponse.json({ logo_url: null })
  }
}
