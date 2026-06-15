import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
  )
}

// A imagem logo-dark.png está no /public do projeto — acessível como arquivo estático.
// Apenas atualiza o banco para apontar para essa URL. Rápido, sem timeout.
export async function POST(request) {
  const admin = getAdmin()
  const host = request.headers.get('host') || 'financial-dashboard-omega-six.vercel.app'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const logoUrl = `${protocol}://${host}/logo-dark.png?v=${Date.now()}`

  const { error } = await admin
    .from('organizations')
    .update({ logo_url: logoUrl })
    .eq('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, logo_url: logoUrl })
}
