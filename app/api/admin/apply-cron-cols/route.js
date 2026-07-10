export const dynamic = 'force-dynamic'
const KEY = '8553c52abf2e2f06f7d2b1f3f6449570'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const t = process.env.SUPABASE_ACCESS_TOKEN
  const run = async (q) => {
    const r = await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }) })
    const x = await r.text(); let b; try { b = JSON.parse(x) } catch { b = x }
    return { status: r.status, body: b }
  }
  const out = {}
  out.migracao = await run(
    "alter table public.integracoes add column if not exists cron_cursor jsonb;" +
    "alter table public.integracoes add column if not exists cron_resultado jsonb;" +
    "alter table public.integracoes add column if not exists ultima_sync_cron timestamptz;")
  out.conferencia = await run(
    "select column_name from information_schema.columns where table_name='integracoes' and column_name in ('cron_cursor','cron_resultado','ultima_sync_cron')")
  return Response.json(out)
}
