import { getAdmin, ensureToken, fetchDetalhe } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '899d2a6ccc834cf87769adbaf9ff6f2e'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const JAM = '620c213b-213e-49ec-9bc4-48cf3c23514a'

  // Volumetria e saúde dos dados da JAM
  const { count: total } = await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id', JAM)
  const { count: catCruas } = await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id', JAM).like('categoria','Categoria %')
  const { count: pagosSemData } = await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id', JAM).in('status',['pago','parcial']).is('data_liquidacao',null)
  const { count: semDescricao } = await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id', JAM).or('descricao.is.null,descricao.eq.Sem descrição')
  const { count: abertosVencidos } = await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id', JAM).in('status',['aberto','parcial']).lt('data', new Date().toISOString().split('T')[0])

  // Distribuição por status e tipo
  const { data: amostra } = await admin.from('fluxo_caixa')
    .select('descricao,categoria,tipo,status,data,data_liquidacao,valor').eq('empresa_id', JAM)
    .order('data',{ascending:false}).limit(8)

  // Cross-check: 3 títulos pagos — banco vs Bling
  const { data: paraChecar } = await admin.from('fluxo_caixa')
    .select('doc_ref,descricao,status,data_liquidacao').eq('empresa_id', JAM).eq('status','pago').like('doc_ref','bling:%').limit(3)
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', JAM).single()
  let crossCheck = []
  if (integ0?.refresh_token) {
    const integ = await ensureToken(admin, integ0)
    for (const r of paraChecar || []) {
      const [, tRef, id] = r.doc_ref.split(':')
      const det = await fetchDetalhe(integ, tRef==='entrada'?'contas/receber':'contas/pagar', id)
      crossCheck.push({ desc: r.descricao, banco_status: r.status, banco_liq: r.data_liquidacao, bling_situacao: det?.situacao, bling_saldo: det?.saldo })
    }
  }
  return Response.json({ total, saude: { categorias_cruas: catCruas, pagos_sem_data_liq: pagosSemData, sem_descricao: semDescricao, abertos_vencidos: abertosVencidos }, amostra_recente: amostra, cross_check_bling: crossCheck })
}
