// TEMP: reconfere no Bling todos os títulos que temos como aberto/parcial e
// corrige os que já foram pagos (inclusive pagamento antecipado). Retomável.
import { getAdmin, ensureToken, blingGet, fetchBorderoData } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request) {
  const sp = new URL(request.url).searchParams
  if (sp.get('key') !== 'ff1f447d9373572452f63eba') return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const aplicar = sp.get('apply') === '1'

  const { data: emps } = await admin.from('empresas').select('id,nome')
  const nome = Object.fromEntries((emps||[]).map(e=>[e.id,e.nome]))
  const { data: integs } = await admin.from('integracoes').select('*').not('refresh_token','is',null)

  const inicio = Date.now()
  const relatorio = []
  let corrigidos = 0, conferidos = 0, somaCorrigida = 0
  for (const i0 of integs || []) {
    if (Date.now() - inicio > 45000) break
    const integ = await ensureToken(admin, i0)
    const { data: abertos } = await admin.from('fluxo_caixa')
      .select('id,doc_ref,descricao,valor,status,data,data_liquidacao')
      .eq('empresa_id', i0.empresa_id).in('status', ['aberto','parcial'])
      .like('doc_ref','bling:%').eq('origem_ausente', false).order('data')
    for (const t of abertos || []) {
      if (Date.now() - inicio > 45000) break
      const [, tRef, id] = t.doc_ref.split(':')
      const p = await blingGet(integ, `${tRef==='entrada'?'contas/receber':'contas/pagar'}/${id}`)
      if (!p.ok) continue
      conferidos++
      const d = p.body?.data
      const saldo = Number(d?.saldo), valor = Number(d?.valor ?? t.valor)
      const pagoNoBling = Number(d?.situacao) === 2 || (Number.isFinite(saldo) && saldo === 0)
      if (!pagoNoBling) continue
      let dtLiq = null
      if (Array.isArray(d?.borderos) && d.borderos.length) dtLiq = await fetchBorderoData(integ, d.borderos[d.borderos.length-1])
      const upd = { status: 'pago', data_liquidacao: dtLiq || t.data }
      relatorio.push({ empresa: nome[i0.empresa_id], desc: t.descricao, valor: t.valor,
        vencimento: t.data, pago_em: upd.data_liquidacao, era: t.status })
      somaCorrigida += Number(t.valor||0)
      if (aplicar) { await admin.from('fluxo_caixa').update(upd).eq('id', t.id); corrigidos++ }
    }
  }
  return Response.json({ modo: aplicar ? 'aplicado' : 'simulacao', conferidos,
    divergentes: relatorio.length, corrigidos, valor_total: +somaCorrigida.toFixed(2),
    detalhe: relatorio.slice(0, 25) })
}
