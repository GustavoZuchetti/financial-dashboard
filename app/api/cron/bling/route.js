import { NextResponse } from 'next/server'
import { getAdmin, ensureToken, fetchCategoriasMap, processarPaginaFluxo, pausa } from '@/lib/bling-server'

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
  // A Vercel injeta o header 'x-vercel-cron: 1' nas execuções agendadas e não
  // permite que requisições externas o forjem — é a autenticação oficial.
  // Mantemos também Bearer CRON_SECRET para disparo manual/externo opcional.
  const ehCronVercel = request.headers.get('x-vercel-cron') === '1'
  const auth = request.headers.get('authorization') || ''
  const key  = new URL(request.url).searchParams.get('key')
  const bearerOk = process.env.CRON_SECRET && (auth === `Bearer ${process.env.CRON_SECRET}` || key === process.env.CRON_SECRET)
  if (!ehCronVercel && !bearerOk) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

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
      const categoriasMap = await fetchCategoriasMap(integ)
      const nomesContato = { ...(integ.contatos_cache || {}) }

      while (Date.now() - inicio < 7500) {
        const { recurso, tipoFluxo } = FASES[fase] || FASES[0]
        const res = await processarPaginaFluxo(admin, integ, recurso, tipoFluxo, pagina, 50, categoriasMap, nomesContato)
        r.gravados += res.gravados
        r.paginas++
        if (res.paginaCheia) pagina++
        else if (fase + 1 < FASES.length) { fase++; pagina = 1 }
        else { fase = 0; pagina = 1; r.varredura_completa = true; break }
        await pausa(250)
      }

      await admin.from('integracoes').update({
        contatos_cache: nomesContato,
        ultima_sync: new Date().toISOString(),
        ultimo_resultado: { ...(raw.ultimo_resultado || {}), cron: r, cron_cursor: { fase, pagina } },
        updated_at: new Date().toISOString(),
      }).eq('id', integ.id)
    } catch (e) { r.erro = String(e.message || e) }
    relatorio.push(r)
  }
  return NextResponse.json({ executado_em: new Date().toISOString(), relatorio })
}
