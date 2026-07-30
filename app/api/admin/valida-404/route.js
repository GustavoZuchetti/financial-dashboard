// TEMP: valida a nova lógica de órfãos contra os dados reais
import { getAdmin, ensureToken, blingGet } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request) {
  const sp = new URL(request.url).searchParams
  if (sp.get('key') !== '5ae7c256538a33b69260e128') return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const emp = sp.get('emp')
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', emp).single()
  const integ = await ensureToken(admin, integ0)
  const FILTRO = (q) => q.eq('empresa_id', emp).like('doc_ref','bling:%').eq('origem_ausente', false)
    .or('descricao.like.Contato *,categoria.eq.Sem categoria,competencia.is.null,and(status.eq.pago,data_liquidacao.is.null)')

  const { count: antes } = await FILTRO(admin.from('fluxo_caixa').select('id',{count:'exact',head:true}))
  const { data: rows } = await FILTRO(admin.from('fluxo_caixa').select('id,doc_ref,descricao,valor,data')).limit(30)

  const marcados = []
  for (const r of rows || []) {
    const [, tRef, id] = r.doc_ref.split(':')
    const rec = tRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
    const alt = tRef === 'entrada' ? 'contas/pagar'   : 'contas/receber'
    let p = await blingGet(integ, `${rec}/${id}`)
    if (p.status === 404) {
      const pa = await blingGet(integ, `${alt}/${id}`)
      if (pa.ok) continue // existe do outro lado — enriquecimento normal resolve
      await admin.from('fluxo_caixa').update({ origem_ausente: true }).eq('id', r.id)
      marcados.push({ doc_ref: r.doc_ref, desc: r.descricao, valor: r.valor, venc: r.data })
    }
  }
  const { count: depois } = await FILTRO(admin.from('fluxo_caixa').select('id',{count:'exact',head:true}))
  const { count: totalOrfaos } = await admin.from('fluxo_caixa')
    .select('id',{count:'exact',head:true}).eq('empresa_id', emp).eq('origem_ausente', true)
  const somaOrfaos = marcados.reduce((a,c)=>a+Number(c.valor||0),0)
  return Response.json({ pendentes_antes: antes, pendentes_depois: depois, marcados_agora: marcados.length,
    total_orfaos_entidade: totalOrfaos, valor_total_orfaos: somaOrfaos, detalhe: marcados })
}
