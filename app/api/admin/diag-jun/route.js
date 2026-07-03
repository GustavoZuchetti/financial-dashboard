export const dynamic = 'force-dynamic'
const KEY = '22932832ca5e5706eba2d5d4b10a52df84a1219a'
async function runSQL(token, query) {
  const r = await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  const t = await r.text(); let b; try { b = JSON.parse(t) } catch { b = t }
  return { status: r.status, body: b }
}
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const out = {}
  out.junho = await runSQL(token,
    "select status, count(*) regs, sum(valor)::numeric(14,2) total from public.fluxo_caixa " +
    "where data >= '2026-06-01' and data <= '2026-06-30' group by status order by status;")
  out.pagos_detalhe = await runSQL(token,
    "select data, descricao, valor, data_liquidacao from public.fluxo_caixa where status='pago' order by data;")
  out.total_geral = await runSQL(token,
    "select status, count(*) regs from public.fluxo_caixa group by status order by status;")
  return Response.json(out)
}
