import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Verifica se a tabela org_settings existe tentando consultá-la.
// Se não existir, retorna instrução para o usuário (não dá para criar
// tabela via JS client — requer SQL Editor).
export async function GET(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { error: tableErr } = await supabaseAdmin
    .from('org_settings').select('organization_id').limit(1)

  // PGRST205 = tabela não encontrada
  const tableExists = !tableErr || tableErr.code !== 'PGRST205'

  return NextResponse.json({ tableExists })
}
