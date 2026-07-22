import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = 'PH'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== 'fedf8f0897c37ee6e399fca2')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: emps } = await admin.from('empresas').select('id,nome,organization_id')
  const { data: pc } = await admin.from('plano_contas').select('id,nome,empresa_id,tipo')
  // contagem por empresa
  const porEmp = {}
  ;(pc||[]).forEach(c => { porEmp[c.empresa_id] = (porEmp[c.empresa_id]||0)+1 })
  const resumo = (emps||[]).map(e => ({
    empresa: e.nome, id: e.id, org: e.organization_id,
    contas_plano: porEmp[e.id] || 0,
  }))
  return Response.json({ empresas: resumo, total_plano_contas: pc?.length })
}
