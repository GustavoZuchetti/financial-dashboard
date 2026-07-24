import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== 'ca2844b66ea4ab8f9815dd3f')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: amostra } = await admin.from('orcamentos').select('*').limit(1)
  const { count } = await admin.from('orcamentos').select('id',{count:'exact',head:true})
  const { data: porEmp } = await admin.from('orcamentos').select('empresa_id,ano,mes,modulo').limit(200)
  const emp = {}
  ;(porEmp||[]).forEach(o => { emp[o.empresa_id] = (emp[o.empresa_id]||0)+1 })
  return Response.json({ colunas: amostra?.[0] ? Object.keys(amostra[0]) : 'tabela vazia', total: count, por_empresa: emp, amostra: amostra?.[0] })
}
