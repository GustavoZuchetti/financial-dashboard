export const dynamic = 'force-dynamic'
const KEY = 'e42f6bc2e4977e6be936beb3cffedfb3ea5bc40a'
async function run(t, q) {
  const r = await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  const x = await r.text(); let b; try { b = JSON.parse(x) } catch { b = x }
  return { status: r.status, body: b }
}
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const t = process.env.SUPABASE_ACCESS_TOKEN
  const out = {}
  // 1. Colunas necessárias
  out.colunas = await run(t,
    "alter table public.fluxo_caixa add column if not exists competencia date;" +
    "alter table public.lancamentos add column if not exists competencia date;" +
    "alter table public.integracoes add column if not exists contatos_cache jsonb not null default '{}'::jsonb;")
  // 2. Repara descrições corrompidas: extrai o nome do JSON; se nulo, 'Sem descrição'
  out.repara = await run(t,
    "update public.fluxo_caixa set descricao = " +
    "coalesce(nullif((regexp_match(descricao, '\"nome\":\"([^\"]+)\"'))[1], ''), 'Sem descrição') " +
    "where descricao like '{%negado%}'")
  out.conferencia = await run(t,
    "select count(*) as ainda_corrompido from public.fluxo_caixa where descricao like '{%negado%}'")
  return Response.json(out)
}
