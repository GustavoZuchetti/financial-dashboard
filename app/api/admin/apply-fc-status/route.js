export const dynamic = 'force-dynamic'
const KEY = '95ab56d7c3976e11a4843306251635237e8d6e26e30f8ccd'
async function runSQL(token, query) {
  const r = await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }) })
  const t = await r.text(); let b; try { b = JSON.parse(t) } catch { b = t }
  return { ok: r.ok, status: r.status, body: b }
}
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const out = {}
  out.migracao = await runSQL(token,
    "alter table public.fluxo_caixa add column if not exists status text not null default 'aberto';" +
    "alter table public.fluxo_caixa add column if not exists data_liquidacao date;" +
    "alter table public.fluxo_caixa add column if not exists valor_liquidado numeric;" +
    "alter table public.fluxo_caixa add column if not exists doc_ref text;" +
    "alter table public.fluxo_caixa add column if not exists data_emissao date;" +
    "alter table public.fluxo_caixa drop constraint if exists fc_status_check;" +
    "alter table public.fluxo_caixa add constraint fc_status_check check (status in ('aberto','pago','parcial','cancelado'));" +
    "create index if not exists idx_fc_emp_status_data on public.fluxo_caixa (empresa_id, status, data);")
  out.backfill = await runSQL(token,
    "update public.fluxo_caixa set status='pago', data_liquidacao=data, valor_liquidado=valor " +
    "where data < current_date and status='aberto' and data_liquidacao is null " +
    "and not exists (select 1 from public.fluxo_caixa where data_liquidacao is not null);")
  out.resumo = await runSQL(token,
    "select status, count(*) as regs, min(data) as de, max(data) as ate from public.fluxo_caixa group by status order by status;")
  return Response.json(out)
}
