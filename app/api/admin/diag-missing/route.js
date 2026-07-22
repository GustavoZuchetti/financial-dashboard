import { getAdmin, ensureToken, blingGet } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'c9410b16d87e2ab38f97c1f152bc002b'
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', FACE).single()
  const integ = await ensureToken(admin, integ0)

  // 1. O que o BANCO tem vencendo em 10/07 (entradas)
  const { data: banco } = await admin.from('fluxo_caixa')
    .select('doc_ref,descricao,data,valor,status,tipo').eq('empresa_id', FACE)
    .eq('tipo','entrada').eq('data','2026-07-10')
  // 2. O que o BLING tem — contas a receber com vencimento 10/07
  let blingContas = [], pg = 1
  while (pg <= 10) {
    const r = await blingGet(integ, `contas/receber?dataVencimentoInicial=2026-07-10&dataVencimentoFinal=2026-07-10&pagina=${pg}&limite=100`)
    const itens = r.body?.data || []
    if (!itens.length) break
    blingContas = blingContas.concat(itens.map(c => ({ id:c.id, contato:c.contato?.nome, venc:c.vencimento, valor:c.valor, situacao:c.situacao })))
    if (itens.length < 100) break
    pg++
  }
  // doc_refs no banco (set) para cruzar
  const idsNoBanco = new Set((banco||[]).map(b => b.doc_ref.split(':').pop()))
  const faltando = blingContas.filter(c => !idsNoBanco.has(String(c.id)))
  return Response.json({
    banco_qtd: banco?.length, banco: banco,
    bling_qtd: blingContas.length, bling: blingContas,
    FALTANDO_no_banco: faltando,
  })
}
