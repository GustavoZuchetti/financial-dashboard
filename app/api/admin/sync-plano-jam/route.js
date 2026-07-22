// TEMP: propaga o plano de contas do master (FACE) para JAM (e qualquer entidade
// da org sem plano). Remover após uso.
import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'PH'
const ORG = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const MASTER = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7' // FACE
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '7322bfed95941fc32d0b9163')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  // pega user_id de um registro master p/ satisfazer NOT NULL, se houver
  const { data: masterContas } = await admin.from('plano_contas')
    .select('codigo,nome,tipo,descricao,user_id').eq('empresa_id', MASTER)
  const { data: emps } = await admin.from('empresas').select('id,nome').eq('organization_id', ORG)
  const alvos = (emps || []).filter(e => e.id !== MASTER)
  const rel = []
  for (const e of alvos) {
    const { data: dest } = await admin.from('plano_contas').select('id,codigo').eq('empresa_id', e.id)
    const porCodigo = Object.fromEntries((dest || []).map(c => [c.codigo, c.id]))
    let inseridos = 0, atualizados = 0
    for (const mc of masterContas || []) {
      if (porCodigo[mc.codigo]) {
        await admin.from('plano_contas').update({ nome: mc.nome, tipo: mc.tipo, descricao: mc.descricao }).eq('id', porCodigo[mc.codigo])
        atualizados++
      } else {
        const { error } = await admin.from('plano_contas').insert([{ codigo: mc.codigo, nome: mc.nome, tipo: mc.tipo, descricao: mc.descricao, empresa_id: e.id, user_id: mc.user_id }])
        if (!error) inseridos++
      }
    }
    const { count } = await admin.from('plano_contas').select('id',{count:'exact',head:true}).eq('empresa_id', e.id)
    rel.push({ empresa: e.nome, inseridos, atualizados, total_agora: count })
  }
  return Response.json({ master_contas: masterContas?.length, resultado: rel })
}
