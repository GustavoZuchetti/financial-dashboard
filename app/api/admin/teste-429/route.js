// TEMP: valida contra a API REAL do Bling que o limitador eliminou os 429.
// Reproduz a rajada do enriquecimento (6 títulos em paralelo × 3 chamadas).
import { getAdmin, ensureToken, blingGet } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request) {
  const sp = new URL(request.url).searchParams
  if (sp.get('key') !== 'fbbb9b4edb1f6bd0fdcc827b') return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const emp = sp.get('emp') // empresa_id
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', emp).single()
  if (!integ0?.refresh_token) return Response.json({ error: 'integração sem token' })
  const integ = await ensureToken(admin, integ0)

  // 18 títulos reais dessa entidade
  const { data: rows } = await admin.from('fluxo_caixa')
    .select('doc_ref').eq('empresa_id', emp).like('doc_ref','bling:%').limit(18)

  const t0 = Date.now()
  const status = {}
  await Promise.all((rows||[]).map(async (r) => {
    const [, tRef, id] = r.doc_ref.split(':')
    const rec = tRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
    const resp = await blingGet(integ, `${rec}/${id}`)
    status[resp.status] = (status[resp.status] || 0) + 1
  }))
  const dur = (Date.now() - t0) / 1000
  const total = Object.values(status).reduce((a,b)=>a+b,0)
  return Response.json({
    chamadas: total,
    duracao_s: +dur.toFixed(2),
    taxa_req_s: +(total/dur).toFixed(2),
    status_http: status,
    HTTP_429: status['429'] || 0,
    veredito: (status['429'] || 0) === 0 ? 'SEM 429 — limitador funcionando' : 'AINDA HÁ 429',
  })
}
