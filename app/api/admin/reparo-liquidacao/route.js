// TEMP: repara data_liquidacao de pagos/parciais sem data, buscando o borderô
// direto (não depende da varredura de páginas alcançá-los). Remover após uso.
import { getAdmin, ensureToken, fetchDetalhe, fetchBorderoData } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '69970fefebac55910b1fdf68afa70cbb'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ0 } = await admin.from('integracoes').select('*').not('refresh_token','is',null).limit(1).single()
  const integ = await ensureToken(admin, integ0)

  // Lote de pagos/parciais sem data_liquidacao
  const { data: rows } = await admin.from('fluxo_caixa')
    .select('id,doc_ref,tipo').in('status',['pago','parcial']).is('data_liquidacao',null)
    .like('doc_ref','bling:%').limit(60)

  const inicio = Date.now()
  let reparados = 0, semBordero = 0, semData = 0, erros = 0
  const restantesAntes = rows?.length || 0
  for (const r of rows || []) {
    if (Date.now() - inicio > 8000) break
    try {
      const [, tRef, id] = r.doc_ref.split(':')
      const rec = tRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
      const det = await fetchDetalhe(integ, rec, id)
      const bids = det?.borderos || []
      if (!bids.length) { semBordero++; continue }
      const dt = await fetchBorderoData(integ, bids[bids.length - 1])
      if (!dt || dt === '0000-00-00') { semData++; continue }
      const { error } = await admin.from('fluxo_caixa').update({ data_liquidacao: dt }).eq('id', r.id)
      if (error) erros++; else reparados++
    } catch { erros++ }
  }
  // Quantos ainda restam no total
  const { count } = await admin.from('fluxo_caixa')
    .select('id',{count:'exact',head:true}).in('status',['pago','parcial']).is('data_liquidacao',null).like('doc_ref','bling:%')
  return Response.json({ lote: restantesAntes, reparados, sem_bordero: semBordero, bordero_sem_data: semData, erros, restantes_total: count })
}
