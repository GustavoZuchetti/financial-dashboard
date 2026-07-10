import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = 'd1c1aec777f574153068d925a3b2fcbf'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  // Ler TODAS as colunas relevantes + verificar se as colunas existem
  const { data, error } = await admin.from('integracoes')
    .select('id,cron_cursor,cron_resultado,ultima_sync_cron').eq('modulo_fluxo_ativo', true)
  return Response.json({ erro_leitura: error?.message || null, dados: data })
}
