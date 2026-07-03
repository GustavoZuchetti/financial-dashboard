export const dynamic = 'force-dynamic'
const KEY = '552ceec5a4414d15a7b8b589299d6c2593cd20c5124c349c'
async function runSQL(token, query) {
  const r = await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const fc = await runSQL(token,
    "select left(data::text,4) as ano, count(*) as regs, min(data) as primeiro, max(data) as ultimo, " +
    "sum(case when tipo in ('entrada','fluxo_entrada','receita','receita_financeira') then abs(valor) else 0 end)::numeric(14,2) as entradas, " +
    "sum(case when tipo not in ('entrada','fluxo_entrada','receita','receita_financeira') then abs(valor) else 0 end)::numeric(14,2) as saidas " +
    "from fluxo_caixa group by 1 order by 1")
  const lanc = await runSQL(token,
    "select left(data::text,4) as ano, count(*) as regs from lancamentos group by 1 order by 1")
  return Response.json({ fluxo_caixa_por_ano: fc, lancamentos_por_ano: lanc })
}
