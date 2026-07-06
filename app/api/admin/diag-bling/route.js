import { getAdmin, ensureToken, fetchContas, BLING } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '3ed1ffb516efc99c0fc787b548845c21a4e18b27'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integs } = await admin.from('integracoes').select('*').not('refresh_token', 'is', null)
  if (!integs?.length) return Response.json({ error: 'nenhuma integração conectada' }, { status: 404 })
  const out = { urls: BLING, integracoes: [] }
  for (const raw of integs) {
    const item = { integracao_id: raw.id, empresa_id: raw.empresa_id }
    try {
      const integ = await ensureToken(admin, raw)
      item.token = 'ok (renovado se necessário)'
      for (const rec of ['contas/receber', 'contas/pagar']) {
        try {
          const itens = await fetchContas(integ, rec, 1, 2)
          item[rec] = { recebidos: itens.length, amostra: itens }
        } catch (e) { item[rec] = { erro: String(e.message || e) } }
      }
    } catch (e) { item.token = 'ERRO: ' + String(e.message || e) }
    out.integracoes.push(item)
  }
  return Response.json(out)
}
