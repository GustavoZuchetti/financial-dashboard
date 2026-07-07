import { NextResponse } from 'next/server'
import { getAdmin, ensureToken, fetchContas, mapConta, pausa } from '@/lib/bling-server'

// ─── Cron diário: sincroniza o fluxo (listagem) em segundo plano ─────────────
// A Vercel chama esta rota no agendamento do vercel.json, autenticando com
// Authorization: Bearer ${CRON_SECRET}. Cada execução processa páginas dentro
// de um orçamento de ~7,5s; o cursor persiste em integracoes.ultimo_resultado
// e continua na execução seguinte — em poucas execuções a base inteira é
// revarrida (situações/baixas do Bling atualizam via upsert por doc_ref).
export const dynamic = 'force-dynamic'
const FASES = [
  { recurso: 'contas/receber', tipoFluxo: 'entrada' },
  { recurso: 'contas/pagar',   tipoFluxo: 'saida'   },
]

export async function GET(request) {
  const auth = request.headers.get('authorization') || ''
  const key = new URL(request.url).searchParams.get('key')
  const ok = (process.env.CRON_SECRET && (auth === `Bearer ${process.env.CRON_SECRET}` || key === process.env.CRON_SECRET))
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const { data: integs } = await admin.from('integracoes')
    .select('*').eq('modulo_fluxo_ativo', true).not('refresh_token', 'is', null)

  const relatorio = []
  const inicio = Date.now()

  for (const raw of integs || []) {
    const r = { integracao: raw.id, paginas: 0, gravados: 0 }
    try {
      const integ = await ensureToken(admin, raw)
      let { fase = 0, pagina = 1 } = raw.ultimo_resultado?.cron_cursor || {}

      while (Date.now() - inicio < 7500) {
        const { recurso, tipoFluxo } = FASES[fase] || FASES[0]
        const itens = await fetchContas(integ, recurso, pagina, 100)
        const registros = itens
          .map(i => mapConta(i, { tipoFluxo, empresaId: integ.empresa_id }))
          .filter(m => !m.faltantes.length && m.registro.doc_ref && m.registro.data)
          .map(m => m.registro)
        if (registros.length) {
          const { error } = await admin.from('fluxo_caixa').upsert(registros, { onConflict: 'doc_ref' })
          if (!error) r.gravados += registros.length
        }
        r.paginas++
        // avanço do cursor (reinicia do zero ao completar a varredura)
        if (itens.length >= 100) pagina++
        else if (fase + 1 < FASES.length) { fase++; pagina = 1 }
        else { fase = 0; pagina = 1; r.varredura_completa = true; break }
        await pausa(250)
      }

      await admin.from('integracoes').update({
        ultima_sync: new Date().toISOString(),
        ultimo_resultado: { ...(raw.ultimo_resultado || {}), cron: r, cron_cursor: { fase, pagina } },
        updated_at: new Date().toISOString(),
      }).eq('id', integ.id)
    } catch (e) { r.erro = String(e.message || e) }
    relatorio.push(r)
  }
  return NextResponse.json({ executado_em: new Date().toISOString(), relatorio })
}
