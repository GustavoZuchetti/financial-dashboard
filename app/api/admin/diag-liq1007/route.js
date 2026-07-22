import { getAdmin, ensureToken, fetchDetalhe, fetchBorderoData, blingGet } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'PH'
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '13ab04afcf8f6eca521e83e6')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', FACE).single()
  const integ = await ensureToken(admin, integ0)

  // 1. O que o BANCO tem com data_liquidacao = 10/07 (o que aparece na Gestão nesse dia)
  const { data: banco } = await admin.from('fluxo_caixa')
    .select('descricao,valor,status,data,data_liquidacao,doc_ref')
    .eq('empresa_id', FACE).eq('tipo','entrada').eq('data_liquidacao','2026-07-10')
  const bancoIds = new Set((banco||[]).map(b => b.doc_ref.split(':').pop()))

  // 2. Busca no Bling contas a receber PAGAS e checa o borderô de cada uma;
  //    junta as que têm borderô em 10/07. Varre um range recente para não puxar tudo.
  //    Usamos vencimento como filtro amplo (jun-jul) já que a liquidação é próxima.
  let candidatos = [], pg = 1
  while (pg <= 8) {
    const r = await blingGet(integ, `contas/receber?situacoes[]=2&pagina=${pg}&limite=100`)
    const itens = r.body?.data || []
    if (!itens.length) break
    // só os que venceram de junho/2026 em diante (liquidação 10/07 tende a ter venc próximo)
    candidatos = candidatos.concat(itens.filter(c => (c.vencimento||'') >= '2026-06-01' && (c.vencimento||'') <= '2026-07-31'))
    if (itens.length < 100) break
    pg++
  }
  // checa borderô de cada candidato (limitado por tempo)
  const inicio = Date.now()
  const liquidadosEm1007 = []
  for (const c of candidatos) {
    if (Date.now() - inicio > 40000) break
    const det = await fetchDetalhe(integ, 'contas/receber', c.id)
    const bids = det?.borderos || []
    if (!bids.length) continue
    const bd = await fetchBorderoData(integ, bids[bids.length-1])
    if (bd === '2026-07-10') {
      liquidadosEm1007.push({ id:String(c.id), contato:c.contato?.nome, valor:c.valor, no_banco: bancoIds.has(String(c.id)) })
    }
  }
  const faltando = liquidadosEm1007.filter(t => !t.no_banco)
  return Response.json({
    banco_liq_1007_qtd: banco?.length,
    banco_liq_1007: banco,
    bling_liquidados_1007_qtd: liquidadosEm1007.length,
    bling_liquidados_1007: liquidadosEm1007,
    FALTANDO_no_banco: faltando,
    candidatos_verificados: candidatos.length,
  })
}
