import { getAdmin, ensureToken, fetchDetalhe } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = 'b1967779267d4b239cb1d22513d2d6bacf0efbbd'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integ0 } = await admin.from('integracoes').select('*').not('refresh_token','is',null).limit(1).single()
  if (!integ0) return Response.json({ error: 'sem integração conectada' }, { status: 404 })
  const integ = await ensureToken(admin, integ0)
  const out = {}
  // Um título pago e um aberto de cada recurso, direto do banco
  for (const [rec, pref] of [['contas/pagar','bling:saida:'],['contas/receber','bling:entrada:']]) {
    const { data: rows } = await admin.from('fluxo_caixa')
      .select('doc_ref,status,descricao').like('doc_ref', pref + '%').limit(400)
    const pago = rows?.find(r => r.status === 'pago')
    const aberto = rows?.find(r => r.status === 'aberto')
    out[rec] = {}
    for (const [rot, row] of [['pago', pago], ['aberto', aberto]]) {
      if (!row) { out[rec][rot] = 'nenhum no banco'; continue }
      const id = row.doc_ref.split(':').pop()
      out[rec][rot] = { id, detalhe: await fetchDetalhe(integ, rec, id) }
    }
  }
  // Teste de escopo de contatos (causa provável dos nomes ausentes)
  const { data: semNome } = await admin.from('fluxo_caixa')
    .select('descricao').like('descricao', 'Contato %').limit(1).single()
  if (semNome) {
    const cid = semNome.descricao.replace('Contato ', '').trim()
    const r = await fetch('https://api.bling.com.br/Api/v3/contatos/' + cid, {
      headers: { 'Authorization': 'Bearer ' + integ.access_token, 'Accept': 'application/json' } })
    out.teste_contatos = { id: cid, http: r.status, body: (await r.text()).slice(0, 300) }
  }
  return Response.json(out)
}
