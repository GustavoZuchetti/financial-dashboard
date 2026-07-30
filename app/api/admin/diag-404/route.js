// TEMP: investiga os títulos que retornam 404 no detalhe do Bling
import { getAdmin, ensureToken, blingGet } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request) {
  const sp = new URL(request.url).searchParams
  if (sp.get('key') !== '206bf8a102612e67028e9fe4') return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const emp = sp.get('emp')
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', emp).single()
  const integ = await ensureToken(admin, integ0)

  // mesmo filtro do enriquecimento: títulos ainda pendentes
  const { data: rows } = await admin.from('fluxo_caixa')
    .select('id,doc_ref,tipo,descricao,categoria,status,data,valor')
    .eq('empresa_id', emp).like('doc_ref','bling:%')
    .or('descricao.like.Contato *,categoria.eq.Sem categoria,competencia.is.null,and(status.eq.pago,data_liquidacao.is.null)')
    .limit(12)

  const analise = []
  for (const r of rows || []) {
    const [, tRef, id] = r.doc_ref.split(':')
    const recPrimario  = tRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
    const recAlternado = tRef === 'entrada' ? 'contas/pagar'   : 'contas/receber'
    const p1 = await blingGet(integ, `${recPrimario}/${id}`)
    let p2 = null
    if (p1.status === 404) p2 = await blingGet(integ, `${recAlternado}/${id}`)
    analise.push({
      doc_ref: r.doc_ref, tipo_banco: r.tipo, desc: (r.descricao||'').slice(0,28),
      data: r.data, valor: r.valor,
      http_primario: p1.status,
      http_alternado: p2 ? p2.status : null,
      DIAGNOSTICO: p1.status === 200 ? 'ok'
        : (p2 && p2.status === 200) ? 'TIPO INVERTIDO no doc_ref'
        : p1.status === 404 ? 'excluido no Bling (404 nos dois)' : `http ${p1.status}`,
    })
  }
  const resumo = {}
  analise.forEach(a => { resumo[a.DIAGNOSTICO] = (resumo[a.DIAGNOSTICO]||0)+1 })
  // quantos pendentes existem no total
  const { count: pendentes } = await admin.from('fluxo_caixa').select('id',{count:'exact',head:true})
    .eq('empresa_id', emp).like('doc_ref','bling:%')
    .or('descricao.like.Contato *,categoria.eq.Sem categoria,competencia.is.null,and(status.eq.pago,data_liquidacao.is.null)')
  return Response.json({ pendentes_total: pendentes, resumo, amostra: analise })
}
