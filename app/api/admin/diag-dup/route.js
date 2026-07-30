import { getAdmin, ensureToken, blingGet } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '2b3b711c24de8a6ec5c465de')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  // os 4 registros de câmbio de 24/07 (transferência entre contas)
  const { data: regs } = await admin.from('fluxo_caixa')
    .select('id,doc_ref,descricao,categoria,tipo,valor,status,data,data_liquidacao,created_at,competencia')
    .eq('empresa_id', FACE).eq('data','2026-07-24').gte('valor', 100000).order('created_at')
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', FACE).single()
  const integ = await ensureToken(admin, integ0)
  const out = []
  for (const r of regs || []) {
    const item = { id: r.id, doc_ref: r.doc_ref, tipo: r.tipo, valor: r.valor,
                   categoria: r.categoria, status: r.status, criado_em: r.created_at }
    if (r.doc_ref?.startsWith('bling:')) {
      const [, tRef, bid] = r.doc_ref.split(':')
      item.bling_id = bid; item.doc_ref_tipo = tRef
      const p = await blingGet(integ, `${tRef==='entrada'?'contas/receber':'contas/pagar'}/${bid}`)
      const d = p.body?.data
      item.no_bling = { http: p.status, valor: d?.valor, situacao: d?.situacao,
                        vencimento: d?.vencimento, historico: (d?.historico||'').slice(0,60),
                        portador: d?.portador?.id, borderos: (d?.borderos||[]).length }
    } else { item.origem = 'SEM doc_ref bling (importação manual/arquivo?)' }
    out.push(item)
  }
  // quantos registros de transferência entre contas existem no total em julho
  const { data: transf } = await admin.from('fluxo_caixa')
    .select('doc_ref,tipo,valor,data,descricao').eq('empresa_id', FACE)
    .ilike('categoria','%Transfer%').gte('data','2026-07-01').lte('data','2026-07-31')
  return Response.json({ registros_24_07: out,
    transferencias_julho: (transf||[]).map(t=>({ dt:t.data, tipo:t.tipo, valor:t.valor, ref:t.doc_ref })) })
}
