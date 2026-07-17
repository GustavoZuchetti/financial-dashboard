// TEMP: repara registros com categoria 'Categoria {id}' buscando o nome real
import { getAdmin, ensureToken, fetchCategoriaNome } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '805a9b887a316a0d9525969c1b4710ff'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ0 } = await admin.from('integracoes').select('*').not('refresh_token','is',null).limit(1).single()
  const integ = await ensureToken(admin, integ0)
  // IDs distintos pendentes
  const { data: rows } = await admin.from('fluxo_caixa')
    .select('id,categoria').like('categoria', 'Categoria %').limit(2000)
  const ids = [...new Set((rows||[]).map(r => r.categoria.replace('Categoria ','').trim()))]
  const resolvidos = {}, naoResolvidos = []
  for (const id of ids.slice(0, 30)) {
    const nome = await fetchCategoriaNome(integ, id)
    if (nome) resolvidos[id] = nome; else naoResolvidos.push(id)
  }
  let atualizados = 0
  for (const [id, nome] of Object.entries(resolvidos)) {
    const { count } = await admin.from('fluxo_caixa')
      .update({ categoria: nome }, { count: 'exact' }).eq('categoria', `Categoria ${id}`)
    atualizados += count || 0
  }
  return Response.json({ ids_pendentes: ids.length, resolvidos, nao_resolvidos: naoResolvidos, registros_atualizados: atualizados })
}
