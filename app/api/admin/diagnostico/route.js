import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const results = {}

  // 1. Verificar variáveis de ambiente
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY

  results.env = {
    supabase_url:      url  ? `${url.substring(0,30)}...` : 'AUSENTE',
    anon_key:          anon ? `${anon.substring(0,20)}...` : 'AUSENTE',
    service_role_key:  svc  ? `${svc.substring(0,20)}...` : 'AUSENTE',
  }

  if (!url || !anon) {
    return NextResponse.json({ ok: false, results, error: 'Variáveis de ambiente ausentes' })
  }

  // 2. Testar conexão com cliente anon
  try {
    const supabase = createClient(url, anon)
    const { error } = await supabase.from('profiles').select('id').limit(1)
    results.anon_connection = error ? `ERRO: ${error.message}` : 'OK'
  } catch(e) { results.anon_connection = `EXCEPTION: ${e.message}` }

  // 3. Testar conexão com service role
  if (svc) {
    try {
      const admin = createClient(url, svc)
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 1 })
      results.admin_connection = error ? `ERRO: ${error.message}` : `OK — ${data?.users?.length ?? 0} user(s) visível(is)`
    } catch(e) { results.admin_connection = `EXCEPTION: ${e.message}` }
  } else {
    results.admin_connection = 'PULADO — service role key ausente'
  }

  // 4. Testar generateLink
  if (svc) {
    try {
      const admin = createClient(url, svc)
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 5 })
      if (data?.users?.length > 0) {
        const testEmail = data.users[0].email
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email: testEmail,
          options: { redirectTo: 'https://financial-dashboard-omega-six.vercel.app/auth/reset-password' }
        })
        results.generate_link = linkErr
          ? `ERRO: ${linkErr.message}`
          : `OK — link gerado para ${testEmail}`
      }
    } catch(e) { results.generate_link = `EXCEPTION: ${e.message}` }
  }

  return NextResponse.json({ ok: true, results })
}
