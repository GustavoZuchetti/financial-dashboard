import { getAdmin, ensureToken, fetchDetalhe, fetchBorderoData } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'PH'
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '4b603eab39d909042cc2c4f6')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', FACE).single()
  const integ = await ensureToken(admin, integ0)
  // TELEIN 26280038926 (466,90), EVOLLO 26034819001 (492,71), 6P BANK ? (374,46 venc jul)
  const ids = ['26280038926','26034819001']
  const out = []
  for (const id of ids) {
    // no banco?
    const { data: noBanco } = await admin.from('fluxo_caixa')
      .select('descricao,data,data_liquidacao,status,valor,doc_ref')
      .eq('empresa_id', FACE).like('doc_ref', `%${id}`).maybeSingle()
    // no Bling (detalhe + borderô)
    const det = await fetchDetalhe(integ, 'contas/receber', id)
    let borderoData = null
    const bids = det?.borderos || []
    if (bids.length) borderoData = await fetchBorderoData(integ, bids[bids.length-1])
    out.push({
      id, contato: det?.contato?.nome,
      bling: { vencimento: det?.vencimento, situacao: det?.situacao, dataLiquidacao_campo: det?.dataLiquidacao || det?.dataPagamento || null, bordero_qtd: bids.length, bordero_data: borderoData },
      banco: noBanco || 'AUSENTE NO BANCO',
    })
  }
  return Response.json({ titulos: out })
}
