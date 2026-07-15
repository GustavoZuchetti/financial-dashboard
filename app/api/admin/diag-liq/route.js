import { getAdmin, ensureToken, fetchDetalhe } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = 'e4f723354b8e2f679899e043c3d2149c'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  // Casos citados: pagamentos do dia 15/07 que já teriam sido liquidados em 10/07
  const { data: rows } = await admin.from('fluxo_caixa')
    .select('doc_ref,descricao,data,status,valor,valor_liquidado,data_liquidacao,competencia')
    .eq('data', '2026-07-15')
    .like('doc_ref', 'bling:%')
    .limit(6)
  const { data: integ0 } = await admin.from('integracoes').select('*').not('refresh_token','is',null).limit(1).single()
  const integ = await ensureToken(admin, integ0)
  const out = []
  for (const r of rows || []) {
    const [, tRef, id] = r.doc_ref.split(':')
    const rec = tRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
    const det = await fetchDetalhe(integ, rec, id)
    out.push({
      banco: { desc: r.descricao, venc: r.data, status: r.status, data_liq: r.data_liquidacao, valor: r.valor, liquidado: r.valor_liquidado },
      bling: det ? { situacao: det.situacao, vencimento: det.vencimento, dataEmissao: det.dataEmissao, saldo: det.saldo, borderos: det.borderos, historico: det.historico } : 'nulo',
    })
  }
  return Response.json({ amostras: out })
}
