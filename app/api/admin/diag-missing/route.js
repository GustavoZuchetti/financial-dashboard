import { getAdmin, ensureToken, blingGet } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'PH'
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '8e3ab0e124e5f46779f921c4')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', FACE).single()
  const integ = await ensureToken(admin, integ0)

  // Só os que vencem exatamente 10/07/2026 no Bling
  let bling = [], pg = 1
  while (pg <= 5) {
    const r = await blingGet(integ, `contas/receber?dataVencimentoInicial=2026-07-10&dataVencimentoFinal=2026-07-10&pagina=${pg}&limite=100`)
    const itens = r.body?.data || []
    if (!itens.length) break
    bling = bling.concat(itens.map(c => ({ id:String(c.id), contato:c.contato?.nome, valor:c.valor, situacao:c.situacao })))
    if (itens.length < 100) break
    pg++
  }
  const { data: banco } = await admin.from('fluxo_caixa')
    .select('doc_ref,descricao,valor,status').eq('empresa_id', FACE).eq('tipo','entrada').eq('data','2026-07-10')
  const idsBanco = new Set((banco||[]).map(b => b.doc_ref.split(':').pop()))
  const faltando = bling.filter(c => !idsBanco.has(c.id))
  return Response.json({
    bling_10_07_qtd: bling.length,
    banco_10_07_qtd: banco?.length,
    FALTANDO: faltando,
    bling_todos: bling,
  })
}
