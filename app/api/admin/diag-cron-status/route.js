import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = 'd595b59dd3d43c3ba5151c6e'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== 'd595b59dd3d43c3ba5151c6e')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integs } = await admin.from('integracoes')
    .select('empresa_id,ultima_sync,ultima_sync_cron,cron_cursor,cron_resultado,modulo_fluxo_ativo,refresh_token')
  const { data: emps } = await admin.from('empresas').select('id,nome')
  const nome = Object.fromEntries((emps||[]).map(e=>[e.id,e.nome]))
  const agora = new Date()
  return Response.json({
    agora: agora.toISOString(),
    cron_secret_configurado: !!process.env.CRON_SECRET,
    integracoes: (integs||[]).map(i => {
      const ultCron = i.ultima_sync_cron ? new Date(i.ultima_sync_cron) : null
      const ultManual = i.ultima_sync ? new Date(i.ultima_sync) : null
      return {
        empresa: nome[i.empresa_id] || i.empresa_id,
        fluxo_ativo: i.modulo_fluxo_ativo,
        tem_refresh: !!i.refresh_token,
        ultima_sync_cron: i.ultima_sync_cron,
        dias_desde_cron: ultCron ? Math.floor((agora - ultCron)/86400000) : 'nunca',
        ultima_sync_manual: i.ultima_sync,
        dias_desde_manual: ultManual ? Math.floor((agora - ultManual)/86400000) : 'nunca',
        cron_cursor: i.cron_cursor,
      }
    }),
  })
}
