// TEMP: repara data_liquidacao dos pagos/parciais da JAM via borderô. Remover após uso.
import { getAdmin, ensureToken, fetchDetalhe, fetchBorderoData } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'c96c8eb90ee6468843b11b74ae02465d'
const JAM = '620c213b-213e-49ec-9bc4-48cf3c23514a'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', JAM).single()
  if (!integ0?.refresh_token) return Response.json({ error: 'JAM sem refresh_token' })
  const integ = await ensureToken(admin, integ0)

  const { data: rows } = await admin.from('fluxo_caixa')
    .select('id,doc_ref,tipo').eq('empresa_id', JAM)
    .in('status',['pago','parcial']).is('data_liquidacao',null).like('doc_ref','bling:%').limit(400)

  const inicio = Date.now()
  let reparados = 0, semBordero = 0, semData = 0, erros = 0
  const lote = rows?.length || 0
  const processa = async (r) => {
    try {
      const [, tRef, id] = r.doc_ref.split(':')
      const det = await fetchDetalhe(integ, tRef === 'entrada' ? 'contas/receber' : 'contas/pagar', id)
      const bids = det?.borderos || []
      if (!bids.length) { semBordero++; return }
      const dt = await fetchBorderoData(integ, bids[bids.length - 1])
      if (!dt || dt === '0000-00-00') { semData++; return }
      const { error } = await admin.from('fluxo_caixa').update({ data_liquidacao: dt }).eq('id', r.id)
      if (error) erros++; else reparados++
    } catch { erros++ }
  }
  // grupos de 3 em paralelo (respeita ~3 req/s do Bling) até esgotar a janela
  for (let i = 0; i < (rows?.length || 0); i += 3) {
    if (Date.now() - inicio > 45000) break
    await Promise.all(rows.slice(i, i + 3).map(processa))
  }
  const { count } = await admin.from('fluxo_caixa').select('id',{count:'exact',head:true})
    .eq('empresa_id', JAM).in('status',['pago','parcial']).is('data_liquidacao',null).like('doc_ref','bling:%')
  return Response.json({ lote, reparados, sem_bordero: semBordero, bordero_sem_data: semData, erros, restantes_total: count })
}
