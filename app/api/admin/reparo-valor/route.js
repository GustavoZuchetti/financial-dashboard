// TEMP: reconfere valor/vencimento/valor pago dos títulos liquidados recentes
import { getAdmin, ensureToken, blingGet, fetchBordero } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request) {
  const sp = new URL(request.url).searchParams
  if (sp.get('key') !== '4a78ae31361e293a5c772ff4') return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const aplicar = sp.get('apply') === '1'
  const desde = sp.get('desde') || '2026-06-01'
  const { data: integs } = await admin.from('integracoes').select('*').not('refresh_token','is',null)
  const inicio = Date.now()
  const divergencias = []
  let conferidos = 0, corrigidos = 0
  for (const i0 of integs || []) {
    if (Date.now() - inicio > 44000) break
    const integ = await ensureToken(admin, i0)
    const { data: pagos } = await admin.from('fluxo_caixa')
      .select('id,doc_ref,descricao,valor,valor_liquidado,data,data_liquidacao')
      .eq('empresa_id', i0.empresa_id).eq('status','pago').like('doc_ref','bling:%')
      .eq('origem_ausente', false).is('valor_liquidado', null)
      .gte('data_liquidacao', desde).order('data_liquidacao', { ascending: false }).limit(400)
    for (const t of pagos || []) {
      if (Date.now() - inicio > 44000) break
      const [, tRef, id] = t.doc_ref.split(':')
      const p = await blingGet(integ, `${tRef==='entrada'?'contas/receber':'contas/pagar'}/${id}`)
      if (!p.ok) continue
      conferidos++
      const d = p.body?.data
      const upd = {}
      const vBling = Math.abs(Number(d?.valor) || 0)
      if (vBling > 0 && Math.abs(vBling - Math.abs(Number(t.valor)||0)) >= 0.01) upd.valor = vBling
      if (d?.vencimento && d.vencimento !== t.data) upd.data = d.vencimento
      let pago = null
      if (Array.isArray(d?.borderos) && d.borderos.length) {
        const b = await fetchBordero(integ, d.borderos[d.borderos.length-1])
        if (b.valorPago) { pago = b.valorPago; upd.valor_liquidado = b.valorPago }
        if (b.data && b.data !== t.data_liquidacao) upd.data_liquidacao = b.data
      }
      if (Object.keys(upd).length) {
        divergencias.push({ desc: t.descricao, nosso_valor: t.valor, bling_valor: vBling,
                            pago_real: pago, venc_antes: t.data, venc_bling: d?.vencimento })
        if (aplicar) { await admin.from('fluxo_caixa').update(upd).eq('id', t.id); corrigidos++ }
      }
    }
  }
  const soma = divergencias.reduce((a,c)=>a+Math.abs((c.pago_real||c.bling_valor||0)-(c.nosso_valor||0)),0)
  return Response.json({ modo: aplicar?'aplicado':'simulacao', conferidos,
    divergentes: divergencias.length, corrigidos, diferenca_absoluta: +soma.toFixed(2),
    detalhe: divergencias.slice(0,20) })
}
