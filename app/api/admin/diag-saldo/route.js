import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = 'c8635eeda554a12bc661589836f2bcd3'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: cfgs, error } = await admin.from('empresa_config')
    .select('empresa_id,chave,valor,updated_at').eq('chave','saldo_inicial').order('updated_at',{ascending:false})
  // colunas da tabela p/ conferir unique/onConflict
  const cols = await admin.rpc('exec_sql', {}).catch(()=>null)
  return Response.json({ erro: error?.message||null, saldos_iniciais: cfgs })
}
