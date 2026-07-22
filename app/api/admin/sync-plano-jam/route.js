import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'PH'
const MASTER = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
const JAM = '620c213b-213e-49ec-9bc4-48cf3c23514a'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== 'c038ba3b929099ffd4c4a5c1')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  // limpa o registro de teste anterior e recomeça limpo na JAM
  const { data: master } = await admin.from('plano_contas')
    .select('codigo,nome,tipo,descricao,pai_id,organization_id').eq('empresa_id', MASTER)
  const { data: destAtual } = await admin.from('plano_contas').select('codigo').eq('empresa_id', JAM)
  const jaTem = new Set((destAtual || []).map(c => c.codigo))
  let inseridos = 0, erros = []
  for (const mc of master || []) {
    if (jaTem.has(mc.codigo)) continue
    const { error } = await admin.from('plano_contas').insert([{
      codigo: mc.codigo, nome: mc.nome, tipo: mc.tipo, descricao: mc.descricao,
      pai_id: null, empresa_id: JAM, organization_id: mc.organization_id,
    }])
    if (error) erros.push(error.message); else inseridos++
  }
  const { count } = await admin.from('plano_contas').select('id',{count:'exact',head:true}).eq('empresa_id', JAM)
  return Response.json({ master_qtd: master?.length, inseridos, erros: erros.slice(0,3), jam_total_agora: count })
}
