import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Executa DDL via Management API do Supabase (requer SUPABASE_ACCESS_TOKEN).
// Centraliza toda a criação de estrutura do banco — chamado internamente
// pelas features que precisam garantir colunas/tabelas.
async function runSQL(sql) {
  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([^.]+)\./)?.[1]
  const mgmtToken  = process.env.SUPABASE_ACCESS_TOKEN
  if (!projectRef || !mgmtToken) {
    throw new Error('SUPABASE_ACCESS_TOKEN não configurado')
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Management API (${res.status}): ${t}`)
  }
  return true
}

// DDL idempotente de toda a estrutura necessária do sistema
const SETUP_SQL = `
-- Coluna de logo na tabela de organizações
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;
`

export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Apenas Super Admin' }, { status: 403 })
  }

  try {
    await runSQL(SETUP_SQL)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
