import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '77146eb95e544bde35cbee7b'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  try {
    const { data: integs, error } = await admin.from('integracoes').select('*')
    if (error) return Response.json({ erro_select: error.message })
    const { data: emps } = await admin.from('empresas').select('id,nome')
    const nome = Object.fromEntries((emps||[]).map(e=>[e.id,e.nome]))
    const cols = integs?.[0] ? Object.keys(integs[0]) : []
    const out = {}
    for (const i of integs||[]) {
      const { data: ult } = await admin.from('fluxo_caixa')
        .select('created_at').eq('empresa_id', i.empresa_id)
        .order('created_at',{ascending:false}).limit(1).maybeSingle()
      out[nome[i.empresa_id]||i.empresa_id] = {
        ultima_sync: i.ultima_sync ?? null,
        ultima_sync_cron: i.ultima_sync_cron ?? null,
        cron_cursor: i.cron_cursor ?? null,
        cron_resultado: i.cron_resultado ?? i.ultimo_resultado ?? null,
        expira: i.token_expira ?? i.expires_at ?? i.token_expires_at ?? null,
        tem_refresh: !!i.refresh_token,
        fluxo_ativo: i.modulo_fluxo_ativo ?? null,
        ultimo_titulo: ult?.created_at ?? null,
      }
    }
    return Response.json({ agora: new Date().toISOString(), colunas: cols, integracoes: out })
  } catch (e) { return Response.json({ erro: String(e) }) }
}
