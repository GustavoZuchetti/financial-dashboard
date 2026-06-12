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
    const { data: rows } = await admin
      .from('organizations')
      .select('*')
      .limit(10)

    const withLogo = (rows || []).find(r => r.logo_url || r.logo_url_light)
    return NextResponse.json({
      logo_url: withLogo?.logo_url || null,
      logo_url_light: withLogo?.logo_url_light || null,
    })
  } catch (_e) {
    return NextResponse.json({ logo_url: null, logo_url_light: null })
  }
}
