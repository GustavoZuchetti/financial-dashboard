import { getAdmin, ensureToken, blingGet } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '06606ae27e2f5c0162b69ced')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: t } = await admin.from('fluxo_caixa')
    .select('*').ilike('descricao','%FLASH%').gte('data','2026-07-25').lte('data','2026-08-05').maybeSingle()
  if (!t) return Response.json({ erro: 'titulo nao encontrado' })
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', t.empresa_id).single()
  const integ = await ensureToken(admin, integ0)
  const [, tRef, id] = t.doc_ref.split(':')
  const p = await blingGet(integ, `${tRef==='entrada'?'contas/receber':'contas/pagar'}/${id}`)
  const d = p.body?.data
  // borderô COMPLETO (não só a data) — aqui moram juros/multa/desconto e o valor pago
  let bordero = null
  if (Array.isArray(d?.borderos) && d.borderos.length) {
    const b = await blingGet(integ, `borderos/${d.borderos[d.borderos.length-1]}`)
    bordero = b.body?.data || b.body
  }
  return Response.json({
    NO_BANCO: { desc: t.descricao, valor: t.valor, valor_liquidado: t.valor_liquidado,
                status: t.status, venc: t.data, liq: t.data_liquidacao },
    NO_BLING_titulo: { valor: d?.valor, saldo: d?.saldo, situacao: d?.situacao, vencimento: d?.vencimento },
    NO_BLING_bordero: bordero,
  })
}
