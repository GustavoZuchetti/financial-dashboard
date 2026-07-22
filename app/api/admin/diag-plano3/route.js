import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '85169c5f458d677239b2c477')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const JAM = '620c213b-213e-49ec-9bc4-48cf3c23514a'
  const JB = '3b2a547d-45a0-42ab-b989-793a251c9672'
  const { data: jam } = await admin.from('plano_contas').select('nome,tipo').eq('empresa_id', JAM).order('nome')
  const { count: jbCount } = await admin.from('plano_contas').select('id',{count:'exact',head:true}).eq('empresa_id', JB)
  return Response.json({ jam_total: jam?.length, jam_contas: (jam||[]).map(c=>c.nome), jb_total: jbCount })
}
