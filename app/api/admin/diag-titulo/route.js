import { getAdmin, ensureToken, blingGet, fetchBorderoData } from '@/lib/bling-server'
import { efeitosCaixa, dataEfetiva } from '@/lib/fluxo-status'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request) {
  const sp = new URL(request.url).searchParams
  if (sp.get('key') !== '1aeffa0d834f8bc3bb56e121') return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  // procura o título de ~21.759 com vencimento ou liquidação em julho/2026
  const { data: cands } = await admin.from('fluxo_caixa')
    .select('id,empresa_id,doc_ref,descricao,tipo,valor,valor_liquidado,status,data,data_liquidacao,competencia')
    .or('data.eq.2026-07-31,data.eq.2026-07-29,data_liquidacao.eq.2026-07-29,data_liquidacao.eq.2026-07-31')
  const { data: emps } = await admin.from('empresas').select('id,nome')
  const nome = Object.fromEntries((emps||[]).map(e=>[e.id,e.nome]))

  const out = []
  for (const c of cands || []) {
    const item = {
      empresa: nome[c.empresa_id], desc: c.descricao, valor: c.valor,
      status_banco: c.status, vencimento: c.data, data_liquidacao_banco: c.data_liquidacao,
      DATA_EFETIVA_usada_no_fluxo: dataEfetiva(c),
      efeitos: efeitosCaixa(c),
    }
    // confronta com o Bling
    if (c.doc_ref?.startsWith('bling:')) {
      const [, tRef, id] = c.doc_ref.split(':')
      const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', c.empresa_id).single()
      if (integ0?.refresh_token) {
        const integ = await ensureToken(admin, integ0)
        const p = await blingGet(integ, `${tRef==='entrada'?'contas/receber':'contas/pagar'}/${id}`)
        const d = p.body?.data
        let bord = null
        if (Array.isArray(d?.borderos) && d.borderos.length) bord = await fetchBorderoData(integ, d.borderos[d.borderos.length-1])
        item.bling = { http: p.status, situacao: d?.situacao, saldo: d?.saldo, vencimento: d?.vencimento, bordero_data: bord }
      }
    }
    out.push(item)
  }
  return Response.json({ hoje: new Date().toISOString().split('T')[0], encontrados: out.length, titulos: out })
}
