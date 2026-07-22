import { getAdmin, ensureToken, fetchDetalhe, fetchBorderoData, blingGet } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'PH'
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '41493a7b4d23e862ea63a5c1')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', FACE).single()
  const integ = await ensureToken(admin, integ0)

  // Todos os EVOLLO no Bling (varre situações pagas)
  let evollos = [], pg = 1
  while (pg <= 12) {
    const r = await blingGet(integ, `contas/receber?pagina=${pg}&limite=100`)
    const itens = r.body?.data || []
    if (!itens.length) break
    evollos = evollos.concat(itens.filter(c => (c.contato?.nome||'').toUpperCase().includes('EVOLLO')))
    if (itens.length < 100) break
    pg++
  }
  // detalha cada EVOLLO: vencimento, valor, situação, borderô
  const det = []
  for (const e of evollos) {
    const d = await fetchDetalhe(integ, 'contas/receber', e.id)
    let bd = null; const bids = d?.borderos || []
    if (bids.length) bd = await fetchBorderoData(integ, bids[bids.length-1])
    det.push({ id:String(e.id), venc:e.vencimento, valor:e.valor, situacao:e.situacao, bordero: bd })
  }
  // o que o banco tem de EVOLLO
  const { data: banco } = await admin.from('fluxo_caixa')
    .select('valor,data,data_liquidacao,status,doc_ref').eq('empresa_id', FACE).ilike('descricao','%EVOLLO%')
  return Response.json({ bling_evollo: det, banco_evollo: banco })
}
