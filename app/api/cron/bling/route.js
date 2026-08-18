import { NextResponse } from 'next/server'
import { getAdmin, ensureToken, fetchCategoriasMap, processarPaginaFluxo, pausa, verificarExclusoes } from '@/lib/bling-server'

// ─── Cron diário: sincroniza o fluxo (listagem) em segundo plano ─────────────
// A Vercel chama esta rota no agendamento do vercel.json, autenticando com
// Authorization: Bearer ${CRON_SECRET}. Cada execução processa páginas dentro
// de um orçamento de ~7,5s; o cursor persiste em integracoes.ultimo_resultado
// e continua na execução seguinte — em poucas execuções a base inteira é
// revarrida (situações/baixas do Bling atualizam via upsert por doc_ref).
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const FASES = [
  { recurso: 'contas/receber', tipoFluxo: 'entrada' },
  { recurso: 'contas/pagar',   tipoFluxo: 'saida'   },
]

export async function GET(request) {
  // A Vercel injeta o header 'x-vercel-cron: 1' nas execuções agendadas e não
  // permite que requisições externas o forjem — é a autenticação oficial.
  // Mantemos também Bearer CRON_SECRET para disparo manual/externo opcional.
  const ehCronVercel = request.headers.get('x-vercel-cron') === '1'
  const auth = request.headers.get('authorization') || ''
  const key  = new URL(request.url).searchParams.get('key')
  const bearerOk = process.env.CRON_SECRET && (auth === `Bearer ${process.env.CRON_SECRET}` || key === process.env.CRON_SECRET)
  if (!ehCronVercel && !bearerOk) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = getAdmin()

  // (Colunas dedicadas do cron já criadas pela migração 20260710 — não é
  // preciso recriá-las a cada execução.)
  const { data: integs } = await admin.from('integracoes')
    .select('*').eq('modulo_fluxo_ativo', true).not('refresh_token', 'is', null)

  const relatorio = []
  const inicioGlobal = Date.now()
  const nEnt = (integs || []).length || 1
  const janelaPorEnt = Math.min(24000, Math.floor(50000 / nEnt))  // ms por entidade

  for (const raw of integs || []) {
    const inicio = Date.now()
    const r = { integracao: raw.id, paginas: 0, gravados: 0 }
    try {
      const integ = await ensureToken(admin, raw)
      let { fase = 0, pagina = 1 } = raw.cron_cursor || {}
      const categoriasMap = await fetchCategoriasMap(integ)
      const nomesContato = { ...(integ.contatos_cache || {}) }

      while (Date.now() - inicio < janelaPorEnt && Date.now() - inicioGlobal < 55000) {
        const { recurso, tipoFluxo } = FASES[fase] || FASES[0]
        let res
        try {
          res = await processarPaginaFluxo(admin, integ, recurso, tipoFluxo, pagina, 50, categoriasMap, nomesContato)
        } catch (e) {
          // Indisponibilidade do Bling: encerra a janela desta entidade SEM
          // abortar, para que o cursor seja persistido logo abaixo e a próxima
          // execução retome exatamente nesta página. Antes o erro subia direto
          // ao catch externo, que fica ANTES do update do cron_cursor — e todo
          // o avanço da execução era perdido.
          if (e?.gateway) { r.interrompido = `Bling indisponível (HTTP ${e.status}) na página ${e.pagina ?? pagina}`; break }
          throw e
        }
        r.gravados += res.gravados
        r.paginas++
        if (res.paginaCheia) pagina++
        else if (fase + 1 < FASES.length) { fase++; pagina = 1 }
        else { fase = 0; pagina = 1; r.varredura_completa = true; break }
        await pausa(250)
      }

      // Persistir o cursor na COLUNA cron_cursor (que é de onde ele é LIDO na
      // próxima execução) e marcar ultima_sync_cron — antes o cursor ia só
      // dentro de ultimo_resultado e nunca era relido, deixando o cron preso
      // na mesma página final vazia (FACE travada em {fase:1,pagina:50}).
      // Fatia diária de verificação de exclusões na origem (últimos 90 dias)
      try {
        const d90 = new Date(); d90.setDate(d90.getDate() - 90)
        r.exclusoes = await verificarExclusoes(admin, integ, {
          desde: d90.toISOString().split('T')[0], limite: 40, prazoMs: 8000 })
      } catch { /* verificação é complementar: não derruba a sync */ }

      await admin.from('integracoes').update({
        contatos_cache: nomesContato,
        cron_cursor: { fase, pagina },
        ultima_sync_cron: new Date().toISOString(),
        ultima_sync: new Date().toISOString(),
        cron_resultado: r,
        ultimo_resultado: { ...(raw.ultimo_resultado || {}), cron: r },
        updated_at: new Date().toISOString(),
      }).eq('id', integ.id)
    } catch (e) { r.erro = String(e.message || e) }
    relatorio.push(r)
  }
  return NextResponse.json({ executado_em: new Date().toISOString(), relatorio })
}
