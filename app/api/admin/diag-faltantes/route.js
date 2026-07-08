import { getAdmin, ensureToken, fetchDetalhe, fetchCategoriasMap } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '902bef306c0613ff0da9efea12a4840259cb32e9'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ0 } = await admin.from('integracoes').select('*').not('refresh_token','is',null).limit(1).single()
  const integ = await ensureToken(admin, integ0)
  const out = { cache_contatos: Object.keys(integ.contatos_cache || {}).length }

  // Amostra: registros ainda "Sem categoria" ou "Contato XXXX"
  const { data: pend } = await admin.from('fluxo_caixa')
    .select('doc_ref,descricao,categoria,competencia,status,data_liquidacao')
    .or('categoria.eq.Sem categoria,descricao.like.Contato *')
    .like('doc_ref','bling:%').limit(4)

  const catMap = await fetchCategoriasMap(integ)
  out.total_categorias_no_bling = Object.keys(catMap).length
  out.amostras = []
  for (const r of pend || []) {
    const [, tRef, id] = r.doc_ref.split(':')
    const rec = tRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
    const det = await fetchDetalhe(integ, rec, id)
    out.amostras.push({
      banco: { descricao: r.descricao, categoria: r.categoria, competencia: r.competencia, status: r.status, data_liq: r.data_liquidacao },
      detalhe_bling: det ? {
        categoria: det.categoria, categoria_nome_resolvido: det.categoria?.id ? catMap[det.categoria.id] : null,
        contato: det.contato, competencia: det.competencia, situacao: det.situacao,
        borderos: det.borderos, historico: det.historico,
      } : 'detalhe nulo (erro na busca)',
    })
  }
  // Contagem de pendências reais
  const { count } = await admin.from('fluxo_caixa')
    .select('id', { count: 'exact', head: true })
    .or('categoria.eq.Sem categoria,descricao.like.Contato *,competencia.is.null')
    .like('doc_ref','bling:%')
  out.total_pendentes = count
  return Response.json(out)
}
