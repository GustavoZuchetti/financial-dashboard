import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '2bc00545ef1e70b297e56534b446ef7f'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  // Situação dos títulos com vencimento 15/07 (os citados)
  const { data: d15 } = await admin.from('fluxo_caixa')
    .select('descricao,data,status,data_liquidacao').eq('data','2026-07-15').like('doc_ref','bling:%')
    .order('descricao').limit(10)
  // Agregado: quantos aberto/parcial vencidos ainda existem
  const hoje = new Date().toISOString().split('T')[0]
  const { count: abertosVencidos } = await admin.from('fluxo_caixa')
    .select('id',{count:'exact',head:true}).in('status',['aberto','parcial']).lt('data',hoje).like('doc_ref','bling:%')
  const { data: integ } = await admin.from('integracoes').select('ultima_sync,ultimo_resultado').eq('modulo_fluxo_ativo',true).limit(1).single()
  return Response.json({ ultima_sync: integ?.ultima_sync, ultimo_resultado: integ?.ultimo_resultado, abertos_vencidos_restantes: abertosVencidos, amostra_15_07: d15 })
}
