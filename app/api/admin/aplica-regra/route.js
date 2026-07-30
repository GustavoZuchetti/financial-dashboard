// TEMP: aplica a regra aos órfãos já marcados (excluídos no Bling)
import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const sp = new URL(request.url).searchParams
  if (sp.get('key') !== '498479aada5cd5c8d994b03a') return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: orfaos } = await admin.from('fluxo_caixa')
    .select('id,empresa_id,doc_ref,descricao,valor,status,data').eq('origem_ausente', true)
  const emAberto = (orfaos||[]).filter(o => ['aberto','parcial'].includes(o.status))
  const liquidados = (orfaos||[]).filter(o => !['aberto','parcial'].includes(o.status))

  if (sp.get('apply') !== '1') {
    return Response.json({ modo:'simulacao',
      total: orfaos?.length, em_aberto_seriam_removidos: emAberto.length,
      liquidados_mantidos: liquidados.length,
      detalhe_em_aberto: emAberto.map(o=>({ desc:o.descricao, valor:o.valor, venc:o.data, status:o.status })),
      detalhe_liquidados: liquidados.map(o=>({ desc:o.descricao, valor:o.valor, venc:o.data, status:o.status })) })
  }
  let removidos = 0, soma = 0
  for (const o of emAberto) {
    const { error } = await admin.from('fluxo_caixa').delete().eq('id', o.id)
    if (!error) { removidos++; soma += Number(o.valor||0)
      admin.from('audit_logs').insert({ table_name:'fluxo_caixa', record_id:o.id, action:'DELETE',
        changed_by_email:'sistema:regra-origem-excluida',
        old_data:{ doc_ref:o.doc_ref, descricao:o.descricao, valor:o.valor, status:o.status,
                   motivo:'excluído no Bling e ainda em aberto' } }).then(()=>{},()=>{})
    }
  }
  const { count: restam } = await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('origem_ausente', true)
  return Response.json({ modo:'aplicado', removidos, valor_removido: soma,
    liquidados_mantidos: liquidados.length, ainda_marcados: restam })
}
