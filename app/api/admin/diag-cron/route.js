import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '5af075dafac5bff601e37d8fed0fb26d'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: emps } = await admin.from('empresas').select('id,nome')
  const nome = Object.fromEntries((emps||[]).map(e=>[e.id,e.nome]))
  const { data: integs } = await admin.from('integracoes')
    .select('empresa_id,ultima_sync,ultima_sync_cron,cron_cursor,cron_resultado,refresh_token,token_expira,modulo_fluxo_ativo')
  // último título gravado por empresa (data de created_at mais recente)
  const porEmp = {}
  for (const i of integs||[]) {
    const { data: ult } = await admin.from('fluxo_caixa')
      .select('created_at,data,descricao').eq('empresa_id', i.empresa_id)
      .order('created_at',{ascending:false}).limit(1).maybeSingle()
    porEmp[nome[i.empresa_id]||i.empresa_id] = {
      ultima_sync_ui: i.ultima_sync,
      ultima_sync_cron: i.ultima_sync_cron,
      cron_cursor: i.cron_cursor,
      cron_resultado: i.cron_resultado,
      token_expira: i.token_expira,
      token_expirado: i.token_expira ? new Date(i.token_expira) < new Date() : null,
      tem_refresh: !!i.refresh_token,
      fluxo_ativo: i.modulo_fluxo_ativo,
      ultimo_titulo_gravado: ult?.created_at,
    }
  }
  return Response.json({ agora: new Date().toISOString(), integracoes: porEmp })
}
