export const dynamic = 'force-dynamic'
const KEY = '77bde6bef1bbcb316a993afcd441aeaf20eb59f5'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const run = async (q) => {
    const r = await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }) })
    const t = await r.text(); let b; try { b = JSON.parse(t) } catch { b = t }
    return b
  }
  return Response.json({
    por_ano: await run(
      "select left(data::text,4) ano, count(*) regs, " +
      "sum(case when tipo='entrada' then valor else 0 end)::numeric(14,2) entradas, " +
      "sum(case when tipo='saida' then valor else 0 end)::numeric(14,2) saidas " +
      "from fluxo_caixa group by 1 order by 1"),
    por_status: await run(
      "select status, count(*) regs, sum(valor)::numeric(14,2) total from fluxo_caixa group by 1 order by 1"),
    origem: await run(
      "select case when doc_ref is null then 'arquivo' else 'api' end origem, count(*) regs from fluxo_caixa group by 1"),
    duplicados_chave: await run(
      "select count(*) grupos_duplicados from (select empresa_id, tipo, data, valor, descricao, count(*) " +
      "from fluxo_caixa group by 1,2,3,4,5 having count(*) > 1) d"),
    sem_data_liq_pagos: await run(
      "select count(*) pagos_sem_data_liquidacao from fluxo_caixa where status='pago' and data_liquidacao is null"),
  })
}
