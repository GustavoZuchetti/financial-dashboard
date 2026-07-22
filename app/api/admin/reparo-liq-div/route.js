// TEMP: repara data_liquidacao DIVERGENTE do borderô (pagos da FACE). Remover após uso.
import { getAdmin, ensureToken, fetchDetalhe, fetchBorderoData } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'PH'
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  const sp = new URL(request.url).searchParams
  if (sp.get('key') !== 'cb00c14ae3950e43f0c4416d') return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', FACE).single()
  const integ = await ensureToken(admin, integ0)
  const offset = Number(sp.get('off') || 0)

  // pagos/parciais COM data_liquidacao preenchida (candidatos a divergência), paginado
  const { data: rows } = await admin.from('fluxo_caixa')
    .select('id,doc_ref,tipo,data_liquidacao')
    .eq('empresa_id', FACE).in('status',['pago','parcial'])
    .not('data_liquidacao','is',null).like('doc_ref','bling:%')
    .order('id').range(offset, offset + 299)

  const inicio = Date.now()
  let verificados = 0, corrigidos = 0, iguais = 0, semBordero = 0
  const exemplos = []
  const processa = async (r) => {
    try {
      const [, tRef, id] = r.doc_ref.split(':')
      const det = await fetchDetalhe(integ, tRef === 'entrada' ? 'contas/receber' : 'contas/pagar', id)
      const bids = det?.borderos || []
      if (!bids.length) { semBordero++; return }
      const bd = await fetchBorderoData(integ, bids[bids.length - 1])
      if (!bd || bd === '0000-00-00') { semBordero++; return }
      verificados++
      if (bd === r.data_liquidacao) { iguais++; return }
      await admin.from('fluxo_caixa').update({ data_liquidacao: bd }).eq('id', r.id)
      corrigidos++
      if (exemplos.length < 15) exemplos.push({ id, de: r.data_liquidacao, para: bd })
    } catch {}
  }
  for (let i = 0; i < (rows?.length || 0); i += 3) {
    if (Date.now() - inicio > 45000) break
    await Promise.all(rows.slice(i, i + 3).map(processa))
  }
  return Response.json({ offset, lote: rows?.length || 0, verificados, corrigidos, iguais, sem_bordero: semBordero, exemplos, proximo_off: offset + (rows?.length || 0) })
}
