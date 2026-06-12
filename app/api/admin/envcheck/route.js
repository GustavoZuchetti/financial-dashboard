import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    url_prefix: (process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING').substring(0, 30),
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    service_key_len: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length,
    has_anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    anon_len: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length,
  })
}
