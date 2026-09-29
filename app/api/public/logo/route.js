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

// Endpoint público: retorna APENAS a logo (nenhum dado sensível).
// Necessário porque o RLS bloqueia SELECT anônimo em organizations, e as telas
// anteriores à autenticação (login, redefinir senha) precisam exibir a logo.
//
// ⚠️ LIMITAÇÃO MULTI-TENANT: antes do login não se sabe de qual organização é o
// usuário. Esta rota devolve a logo da primeira organização que tiver uma.
// Até 30/09 a consulta era `.select('*').limit(10)` SEM ordenação — resultado
// indefinido: com mais de uma organização com logo, a tela de login podia
// alternar entre marcas. Agora a ordem é determinística (por id) e só as
// colunas da logo são lidas. Login com marca por organização é evolução — ver
// docs/11-pendencias.md.
//
// A tela de CONVITE não usa esta rota: o convite identifica a organização, e
// /api/invite devolve a logo exata de quem convidou.
export async function GET() {
  try {
    const admin = getAdmin()
    // Filtro feito em JavaScript, não no PostgREST: consultas parametrizadas no
    // serverless da Vercel já devolveram resultados inconsistentes nesta base
    // (ver docs/02-arquitetura.md). A tabela é pequena; não há ganho em arriscar.
    const { data: rows } = await admin
      .from('organizations')
      .select('id, logo_url, logo_url_light')
      .order('id', { ascending: true })

    const withLogo = (rows || []).find(r => r.logo_url || r.logo_url_light)
    return NextResponse.json({
      logo_url: withLogo?.logo_url || null,
      logo_url_light: withLogo?.logo_url_light || null,
    })
  } catch (_e) {
    return NextResponse.json({ logo_url: null, logo_url_light: null })
  }
}
