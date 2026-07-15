// TEMP: aplica a migração 20260715_orcamento_modulo — remover após uso
import { readFileSync } from 'fs'
import { join } from 'path'
export const dynamic = 'force-dynamic'
const KEY = 'df6f79b60080aaa73d6a4832c92073f6'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260715_orcamento_modulo.sql'), 'utf8')
  const r = await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const x = await r.text(); let b; try { b = JSON.parse(x) } catch { b = x }
  const conf = await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "select column_name from information_schema.columns where table_name='orcamentos' and column_name='modulo'" }),
  })
  const cx = await conf.text(); let cb; try { cb = JSON.parse(cx) } catch { cb = cx }
  return Response.json({ migracao: { status: r.status, body: b }, conferencia: { status: conf.status, body: cb } })
}
