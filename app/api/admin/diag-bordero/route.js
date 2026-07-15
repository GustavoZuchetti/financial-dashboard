import { getAdmin, ensureToken, fetchDetalhe, blingGet } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '00bf5e4a75b2a3abc16d34ee7c807794'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  // Pagos SEM data_liquidacao (o punhado teimoso)
  const { data: rows } = await admin.from('fluxo_caixa')
    .select('doc_ref,descricao,data,status,valor').eq('status','pago').is('data_liquidacao',null).like('doc_ref','bling:%').limit(4)
  const { data: integ0 } = await admin.from('integracoes').select('*').not('refresh_token','is',null).limit(1).single()
  const integ = await ensureToken(admin, integ0)
  const out = []
  for (const r of rows || []) {
    const [, tRef, id] = r.doc_ref.split(':')
    const rec = tRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
    const det = await fetchDetalhe(integ, rec, id)
    const bids = det?.borderos || []
    const borderosRaw = []
    for (const bid of bids.slice(0,2)) {
      const b = await blingGet(integ, `borderos/${bid}`)
      borderosRaw.push({ id: bid, ok: b.ok, status: b.status, body: b.body?.data || b.body })
    }
    out.push({ desc: r.descricao, venc: r.data, detalhe_situacao: det?.situacao, detalhe_borderos: bids, borderos_conteudo: borderosRaw })
  }
  return Response.json({ amostras: out })
}
