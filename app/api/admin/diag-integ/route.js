import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = 'af250ad4e3d93611ac0ec95ccf76694a'
const mask = (v) => v ? `${v.slice(0,6)}...${v.slice(-4)} (${v.length} chars)` : null
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integs } = await admin.from('integracoes')
    .select('id,empresa_id,client_id,client_secret,refresh_token,access_token,modulo_fluxo_ativo,modulo_dre_ativo')
  const { data: emps } = await admin.from('empresas').select('id,nome')
  const nome = Object.fromEntries((emps||[]).map(e=>[e.id,e.nome]))
  return Response.json({ integracoes: (integs||[]).map(i => ({
    empresa: nome[i.empresa_id] || i.empresa_id,
    client_id: mask(i.client_id),
    client_id_igual_secret: !!(i.client_id && i.client_id === i.client_secret),
    client_id_tem_espacos: !!(i.client_id && i.client_id !== i.client_id.trim()),
    client_id_hex_puro: !!(i.client_id && /^[0-9a-f]+$/i.test(i.client_id.trim())),
    secret: mask(i.client_secret),
    conectado: !!i.refresh_token,
    fluxo_ativo: i.modulo_fluxo_ativo,
  })) })
}
