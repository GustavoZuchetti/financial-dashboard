import { NextResponse } from 'next/server'
import { getAdmin, ensureToken, fetchCategoriasMap, processarPaginaFluxo, pausa, verificarExclusoes, processarFilaReconferencia, conferirLiquidados } from '@/lib/bling-server'
import {
  ordemRodizio, diaDoAno, janelaCron, CRON_LIMITE_PAGINA, CRON_TETO_MS,
  acaoCronLiquidados, novaRodadaLiquidados, resumoEstadoLiquidados,
} from '@/lib/bling-reconferencia'

// ─── Cron diário: sincroniza o fluxo em segundo plano ───────────────────────
// Agendado em vercel.json. Cada execução: algumas páginas da listagem por
// entidade (o cursor persiste em integracoes.cron_cursor e continua no dia
// seguinte), uma fatia da fila de reconferência, uma fatia da conferência dos
// liquidados (rodada nova a cada 7 dias) e a verificação de exclusões dos
// liquidados recentes.
//
// ── Por que nunca rodou (de 15/07 a 16/10/2026) ─────────────────────────────
// A rota aceitava o header `x-vercel-cron: 1` ou `Bearer CRON_SECRET`. A
// Vercel não envia esse header — autentica o cron SÓ com
// `Authorization: Bearer <CRON_SECRET>`, e apenas quando a variável existe
// (docs: Cron Jobs › Securing cron jobs). A variável nunca foi criada: toda
// execução diária recebia 401. Nenhuma escrita às 06:00 BRT desde 14/07.
// Agora só o Bearer vale — o header e o `?key=` na URL deixavam qualquer um
// disparar a rota sem segredo nenhum.
//
// ── Orçamento de tempo ──────────────────────────────────────────────────────
// maxDuration é 60s. Antes cada página usava o prazo padrão de 32s, maior que
// a fatia de 16s por entidade: a primeira entidade consumia o tempo e a função
// podia morrer antes de gravar as outras — sempre as mesmas, porque a ordem
// era fixa. Agora a fatia é o que sobra do teto dividido pelas entidades
// restantes, a página recebe esse prazo e a ordem gira a cada dia.
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const FASES = [
  { recurso: 'contas/receber', tipoFluxo: 'entrada' },
  { recurso: 'contas/pagar',   tipoFluxo: 'saida'   },
]

export async function GET(request) {
  const segredo = process.env.CRON_SECRET
  const auth = request.headers.get('authorization') || ''
  if (!segredo || auth !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdmin()
  const { data: lidas } = await admin.from('integracoes')
    .select('*').eq('modulo_fluxo_ativo', true).not('refresh_token', 'is', null)
    .order('id', { ascending: true })
  const integs = ordemRodizio(lidas || [], diaDoAno())

  const relatorio = []
  const inicioGlobal = Date.now()

  for (let ix = 0; ix < integs.length; ix++) {
    const raw = integs[ix]
    const inicio = Date.now()
    const janela = janelaCron({ inicioGlobal, agora: inicio, entidadesRestantes: integs.length - ix })
    const r = { integracao: raw.id, empresa_id: raw.empresa_id, paginas: 0, gravados: 0, janela_ms: janela }
    if (janela < 5000) { r.interrompido = 'sem tempo nesta execução'; relatorio.push(r); continue }
    // Fatias: ~50% listagem, ~20% fila de reconferência, ~20% conferência dos
    // liquidados, o resto exclusões recentes.
    const fimListagem = inicio + Math.floor(janela * 0.5)
    const fimFila = inicio + Math.floor(janela * 0.7)
    const fimLiquidados = inicio + Math.floor(janela * 0.9)
    const fimEntidade = inicio + janela

    let integ = raw
    let { fase = 0, pagina = 1 } = raw.cron_cursor || {}
    try {
      integ = await ensureToken(admin, raw)
      const categoriasMap = await fetchCategoriasMap(integ)
      const nomesContato = { ...(integ.contatos_cache || {}) }

      while (Date.now() < fimListagem - 3000 && Date.now() - inicioGlobal < CRON_TETO_MS) {
        const { recurso, tipoFluxo } = FASES[fase] || FASES[0]
        let res
        try {
          res = await processarPaginaFluxo(admin, integ, recurso, tipoFluxo, pagina, CRON_LIMITE_PAGINA,
            categoriasMap, nomesContato, {}, { inicio: Date.now(), prazoMs: Math.max(3000, fimListagem - Date.now()) })
        } catch (e) {
          // Mantém o cursor na página que falhou para a próxima execução.
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

      // Fatia da fila de reconferência (montada pela varredura manual).
      const fila = Array.isArray(integ.reconferir) ? integ.reconferir : []
      if (fila.length && fimFila - Date.now() > 6000) {
        const { fila: restante, ...rec } = await processarFilaReconferencia(admin, integ, {
          fila, prazoMs: fimFila - Date.now(), categoriasMap, nomesContato })
        r.reconferencia = { ...rec, pendentes: restante.length }
        await admin.from('integracoes').update({ reconferir: restante }).eq('id', integ.id)
          .then(x => x, () => null)
      }

      // Conferência dos liquidados: continua a rodada em curso ou abre uma nova
      // a cada 7 dias. Poucas páginas por dia; a sincronização manual fecha a
      // rodada inteira de uma vez.
      const acaoLiq = acaoCronLiquidados(integ.conferencia_liquidados)
      if (acaoLiq !== 'pular' && fimLiquidados - Date.now() > 6000) {
        try {
          const estado = acaoLiq === 'continuar' ? integ.conferencia_liquidados : novaRodadaLiquidados()
          const { estado: novo, resumo } = await conferirLiquidados(admin, integ, {
            estado, prazoMs: fimLiquidados - Date.now(), categoriasMap, nomesContato })
          r.liquidados = { ...resumo, estado: resumoEstadoLiquidados(novo) }
          await admin.from('integracoes').update({ conferencia_liquidados: novo }).eq('id', integ.id)
            .then(x => x, () => null)
        } catch (e) { r.liquidados = { erro: String(e.message || e) } }
      }

      // Exclusões na origem dos liquidados recentes (últimos 90 dias).
      if (fimEntidade - Date.now() > 4000) {
        try {
          const d90 = new Date(); d90.setDate(d90.getDate() - 90)
          r.exclusoes = await verificarExclusoes(admin, integ, {
            desde: d90.toISOString().split('T')[0], limite: 40, prazoMs: fimEntidade - Date.now() - 1000 })
        } catch { /* verificação é complementar: não derruba a sync */ }
      }

      await admin.from('integracoes').update({
        contatos_cache: nomesContato,
        cron_cursor: { fase, pagina },
        ultima_sync_cron: new Date().toISOString(),
        ultima_sync: new Date().toISOString(),
        cron_resultado: r,
        ultimo_resultado: { ...(raw.ultimo_resultado || {}), cron: r },
        updated_at: new Date().toISOString(),
      }).eq('id', integ.id)
    } catch (e) {
      // O erro também é gravado: antes só ia para a resposta HTTP, que ninguém
      // lê, e uma execução que falhava não deixava rastro nenhum no banco.
      r.erro = String(e.message || e)
      await admin.from('integracoes').update({ cron_resultado: r, updated_at: new Date().toISOString() })
        .eq('id', raw.id).then(x => x, () => null)
    }
    relatorio.push(r)
  }
  return NextResponse.json({ executado_em: new Date().toISOString(), relatorio })
}
