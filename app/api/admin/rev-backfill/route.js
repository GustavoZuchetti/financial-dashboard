export const dynamic = 'force-dynamic'
const KEY = '42f73c2427c3b3d37a98b371e41e2f3e8e55aba7'
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
  // Reverter o backfill equivocado: os 8 'pago' são, na verdade, os títulos
  // 'Atrasada' do Bling — devem voltar a 'aberto' (vencidos, não pagos)
  out.reversao = await runSQL(token,
    "update public.fluxo_caixa set status='aberto', data_liquidacao=null, valor_liquidado=null " +
    "where status='pago';")
  out.conferencia = await runSQL(token,
    "select status, count(*) regs from public.fluxo_caixa group by status order by status;")
  return Response.json(out)
}
