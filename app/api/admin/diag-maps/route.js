import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '3346e8a56c444ca1ae7cbb28')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const ORG = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const { data: emps } = await admin.from('empresas').select('id,nome').eq('organization_id', ORG)
  const ids = (emps||[]).map(e=>e.id)
  const nome = Object.fromEntries((emps||[]).map(e=>[e.id,e.nome]))
  // mapeamentos por entidade
  const { data: maps } = await admin.from('categoria_mappings').select('categoria_origem,empresa_id,tipo_destino').in('empresa_id', ids)
  const porEmp = {}
  ;(maps||[]).forEach(m => { const n=nome[m.empresa_id]; porEmp[n]=(porEmp[n]||0)+1 })
  // dedup por categoria (o que o loadMappings org-wide mostraria)
  const cats = new Set((maps||[]).map(m => (m.categoria_origem||'').toLowerCase()))
  return Response.json({ por_empresa: porEmp, categorias_unicas_no_grupo: cats.size, amostra: [...cats].slice(0,8) })
}
