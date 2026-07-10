import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '783f28eda8ad14f9735775316d62fcda'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data } = await admin.from('integracoes')
    .select('id,ultima_sync,ultimo_resultado').eq('modulo_fluxo_ativo', true)
  return Response.json({ integracoes: data })
}
