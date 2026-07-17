import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '2360ac2c8da676a77a66d82a26ca88d5'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: contas } = await admin.from('plano_contas')
    .select('id,empresa_id,nome,tipo,created_at').order('nome').limit(500)
  const { data: emps } = await admin.from('empresas').select('id,nome')
  const nomeEmp = Object.fromEntries((emps||[]).map(e=>[e.id,e.nome]))
  // duplicatas DENTRO da mesma empresa
  const porChave = {}
  ;(contas||[]).forEach(c => {
    const k = `${c.empresa_id}|${c.nome}|${c.tipo}`
    porChave[k] = (porChave[k]||[]).concat(c.id)
  })
  const dupsMesmaEmpresa = Object.entries(porChave).filter(([,ids])=>ids.length>1)
    .map(([k,ids])=>({ chave:k.split('|').slice(1).join('|'), empresa:nomeEmp[k.split('|')[0]]||k.split('|')[0], qtd:ids.length, ids }))
  // distribuição por empresa
  const porEmp = {}
  ;(contas||[]).forEach(c => { const n=nomeEmp[c.empresa_id]||c.empresa_id; porEmp[n]=(porEmp[n]||0)+1 })
  // FKs que apontam para plano_contas
  const { count: lancComConta } = await admin.from('lancamentos').select('id',{count:'exact',head:true}).not('conta_id','is',null)
  const { count: mapsComConta } = await admin.from('categoria_mappings').select('id',{count:'exact',head:true}).not('conta_id','is',null)
  return Response.json({ total_contas: contas?.length, por_empresa: porEmp, duplicatas_mesma_empresa: dupsMesmaEmpresa.slice(0,15), qtd_dups: dupsMesmaEmpresa.length, fks: { lancamentos_com_conta: lancComConta, mappings_com_conta: mapsComConta } })
}
