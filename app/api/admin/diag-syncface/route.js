import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = 'd7d2c33037c1daa816afa286d56eb654'
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ } = await admin.from('integracoes')
    .select('ultima_sync,ultima_sync_cron,cron_cursor,cron_resultado,ultimo_resultado').eq('empresa_id', FACE).single()
  // últimos 3 títulos gravados (por created_at)
  const { data: recentes } = await admin.from('fluxo_caixa')
    .select('created_at,descricao,data,status').eq('empresa_id', FACE)
    .order('created_at',{ascending:false}).limit(3)
  const { count: total } = await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id', FACE)
  return Response.json({
    agora: new Date().toISOString(),
    ultima_sync: integ?.ultima_sync,
    ultima_sync_cron: integ?.ultima_sync_cron,
    cron_cursor: integ?.cron_cursor,
    cron_resultado: integ?.cron_resultado,
    total_titulos: total,
    ultimos_gravados: recentes,
  })
}
