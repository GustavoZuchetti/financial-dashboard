import { NextResponse } from 'next/server'
import { proximoCursor, cursorDePartida, cursorParaSalvar } from '@/lib/bling-cursor'
import { verificarExclusoes, titulosEmAbertoDoBling, processarFilaReconferencia, conferirLiquidados } from '@/lib/bling-server'
import { getAuthProfile, ensureToken, fetchContas, fetchCategoriasMap, montarRegistrosFluxo } from '@/lib/bling-server'
import {
  idsDaPagina, varreduraRecomecou, vistosAtualizados, montarFila,
  FASES_LIQUIDADOS, filtrosPorPagamento, acaoManualLiquidados, novaRodadaLiquidados, resumoEstadoLiquidados,
} from '@/lib/bling-reconferencia'

// A listagem pode precisar repetir uma página profunda após 504/timeout.
// O padrão de 10s é insuficiente para esse caminho de recuperação.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/integracoes/bling/sync
// body: { integracao_id, modulo: 'fluxo'|'dre', fase?: 0|1, pagina?: number, diag?: boolean,
//         escopo?: 'incremental'|'historico', data_inicio?: 'YYYY-MM-DD', data_fim?: 'YYYY-MM-DD' }
// Orçamento: 1 página (100 títulos) por chamada — a UI itera enquanto hasMore.
// fase 0 = contas/receber (entrada) · fase 1 = contas/pagar (saída)
// escopo historico = títulos já recebidos/pagos em janelas explícitas.
const FASES = [
  { recurso: 'contas/receber', tipoFluxo: 'entrada' },
  { recurso: 'contas/pagar',   tipoFluxo: 'saida'   },
]
// O histórico percorre pago e parcial por data de pagamento — as mesmas fases
// e filtros da conferência dos liquidados (fonte única em bling-reconferencia).
const FASES_HISTORICO = FASES_LIQUIDADOS
const MAX_DIAS_JANELA = 366

function isoUTC(d) {
  return d.toISOString().split('T')[0]
}

function criarJanelas(inicio, fim) {
  const ini = new Date(`${inicio}T00:00:00Z`)
  const ultimo = new Date(`${fim}T00:00:00Z`)
  if (!Number.isFinite(ini.getTime()) || !Number.isFinite(ultimo.getTime()) || ini > ultimo) return []
  const janelas = []
  let cursor = ini
  while (cursor <= ultimo) {
    const limite = new Date(cursor)
    limite.setUTCDate(limite.getUTCDate() + MAX_DIAS_JANELA - 1)
    const fimJanela = limite < ultimo ? limite : ultimo
    janelas.push({ inicio: isoUTC(cursor), fim: isoUTC(fimJanela) })
    cursor = new Date(fimJanela)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return janelas
}

export async function POST(request) {
  const auth = await getAuthProfile(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin, profile } = auth
  if (!['org_admin', 'super_admin'].includes(profile.role))
    return NextResponse.json({ error: 'Apenas administradores podem sincronizar' }, { status: 403 })

  const {
    integracao_id, modulo = 'fluxo', fase: faseReq, pagina: pagReq, janela: janReq, diag = false,
    limpar_origem_arquivo = false, escopo = 'incremental', retomar = false,
    reconferir = false, conferir_liquidados = false,
    data_inicio = '2023-01-01',
    data_fim = new Date().toISOString().split('T')[0],
  } = await request.json()

  let { data: integ } = await admin.from('integracoes')
    .select('*').eq('id', integracao_id).eq('organization_id', profile.organization_id).single()
  if (!integ) return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 })

  // Trava dupla: liberação da administração + módulo ativo na integração
  const { data: org } = await admin.from('organizations')
    .select('api_dre_liberado, api_fluxo_liberado').eq('id', profile.organization_id).single()
  const liberado = modulo === 'dre' ? org?.api_dre_liberado : org?.api_fluxo_liberado
  const ativo    = modulo === 'dre' ? integ.modulo_dre_ativo : integ.modulo_fluxo_ativo
  if (!liberado) return NextResponse.json({ error: 'Módulo não liberado pela administração' }, { status: 403 })
  if (!ativo)    return NextResponse.json({ error: 'Módulo não está ativo nesta integração' }, { status: 400 })

  const T0 = Date.now()

  // ── MODO RECONFERÊNCIA ────────────────────────────────────────────────
  // Depois da varredura completa, a interface chama este modo em laço até a
  // fila zerar: só consulta, pelo id, os títulos em aberto que a listagem não
  // devolveu. Não toca na listagem nem no cursor. Ver lib/bling-reconferencia.js.
  if (reconferir) {
    if (modulo !== 'fluxo') return NextResponse.json({ error: 'Reconferência só existe no Fluxo' }, { status: 400 })
    try {
      integ = await ensureToken(admin, integ)
      const fila = Array.isArray(integ.reconferir) ? integ.reconferir : []
      if (!fila.length) return NextResponse.json({ reconferencia: null, reconferir_pendentes: 0, hasMore: false })
      const categoriasMap = await fetchCategoriasMap(integ)
      const nomesContato = { ...(integ.contatos_cache || {}) }
      const rec = await processarFilaReconferencia(admin, integ, {
        fila, prazoMs: 40000 - (Date.now() - T0), categoriasMap, nomesContato })
      await admin.from('integracoes').update({ reconferir: rec.fila }).eq('id', integ.id)
      const { fila: restante, ...reconferencia } = rec
      return NextResponse.json({ reconferencia, reconferir_pendentes: restante.length, hasMore: false })
    } catch (e) {
      console.error('Bling reconferência:', e)
      return NextResponse.json({ error: String(e.message || e) }, { status: 502 })
    }
  }

  // ── MODO CONFERÊNCIA DOS LIQUIDADOS ───────────────────────────────────
  // Depois da reconferência, a interface chama este modo em laço até a
  // rodada fechar: lista no Bling os pagos dos últimos 365 dias por data de
  // pagamento, compara com os daqui e confere pelo id o que não apareceu.
  // Não toca no cursor da varredura. Ver lib/bling-reconferencia.js.
  if (conferir_liquidados) {
    if (modulo !== 'fluxo') return NextResponse.json({ error: 'Conferência dos liquidados só existe no Fluxo' }, { status: 400 })
    try {
      integ = await ensureToken(admin, integ)
      const salvo = integ.conferencia_liquidados
      const acao = acaoManualLiquidados(salvo)
      if (acao === 'pular') return NextResponse.json({ liquidados: null, liquidados_estado: resumoEstadoLiquidados(salvo), hasMore: false })
      const estado = acao === 'continuar' ? salvo : novaRodadaLiquidados()
      const categoriasMap = await fetchCategoriasMap(integ)
      const nomesContato = { ...(integ.contatos_cache || {}) }
      const { estado: novo, resumo } = await conferirLiquidados(admin, integ, {
        estado, prazoMs: 40000 - (Date.now() - T0), categoriasMap, nomesContato })
      const { error } = await admin.from('integracoes').update({ conferencia_liquidados: novo }).eq('id', integ.id)
      // Sem a coluna (migração 20261020 não aplicada) a rodada não avança:
      // devolver erro evita que a interface repita a mesma fatia em laço.
      if (error) return NextResponse.json({ error: `Conferência dos liquidados não gravada: ${error.message}` }, { status: 500 })
      return NextResponse.json({ liquidados: resumo, liquidados_estado: resumoEstadoLiquidados(novo), hasMore: false })
    } catch (e) {
      console.error('Bling conferência dos liquidados:', e)
      return NextResponse.json({ error: String(e.message || e) }, { status: 502 })
    }
  }

  // Cursor resolvido ANTES do try: o bloco catch precisa enxergar fase,
  // pagina e janela para devolver a resposta de repeticao. Declaradas
  // dentro do try, elas nao existiam no catch e o proprio tratador de erro
  // lancava 'fase is not defined' - a recuperacao do 504 nunca funcionava.
  const fasesAtivas = escopo === 'historico' && modulo === 'fluxo' ? FASES_HISTORICO : FASES

  // ── RETOMADA DO CURSOR ────────────────────────────────────────────────
  // A sincronização manual era estateless: recomeçava sempre em
  // { fase 0, pagina 1 } e a UI parava no limiteGuard. Com 50 títulos por
  // iteração, a varredura nunca alcançava o fim numa base de milhares de
  // títulos, e os mesmos registros ficavam de fora todos os dias.
  // Agora a posição persiste em integracoes.sync_cursor. Ver lib/bling-cursor.js.
  const janelasPre = escopo === 'historico' && modulo === 'fluxo'
    ? criarJanelas(data_inicio, data_fim) : []
  const partida = cursorDePartida({
    retomar, salvo: integ.sync_cursor, escopo,
    pedido: { fase: faseReq, pagina: pagReq, janela: janReq },
    totalJanelas: janelasPre.length,
  })
  const fase = partida.fase, pagina = partida.pagina, janela = partida.janela

  // Setup idempotente das colunas na largada (fase 0, pág 1)
  if (fase === 0 && pagina === 1 && !diag && process.env.SUPABASE_ACCESS_TOKEN) {
    await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query:
        'alter table public.fluxo_caixa add column if not exists competencia date;' +
        'alter table public.lancamentos add column if not exists competencia date;' +
        "alter table public.integracoes add column if not exists contatos_cache jsonb not null default '{}'::jsonb;" }),
    }).catch(() => null)
  }

  try {
    integ = await ensureToken(admin, integ)

    const faseAtual = fasesAtivas[fase] || fasesAtivas[0]
    const { recurso, tipoFluxo } = faseAtual
    // DRE precisa do DETALHE de cada título (a listagem não traz categoria) →
    // páginas menores para caber no timeout de 10s da Vercel
    // Lote por página. Era 50 partindo da premissa de que "muitos títulos são
    // pulados (já completos)". A verificação de coerência do liquidado quebrou
    // essa premissa: quase todo título divergente passou a exigir detalhe +
    // borderô, ~760ms cada pelo limitador de taxa. Com 50 a função estourava o
    // maxDuration de 60s e morria sem resposta ("Failed to fetch").
    // 30 mantém a página produtiva dentro do orçamento; o que não couber é
    // adiado e retomado pelo cursor.
    const LIMITE = Number(process.env.BLING_LIMITE_PAGINA) || 30

    // O Bling rejeita períodos de filtro superiores a 366 dias. O backfill
    // percorre janelas consecutivas e mantém a janela no cursor do cliente.
    const janelas = janelasPre
    const janelaAtual = janelas[janela]
    if (escopo === 'historico' && modulo === 'fluxo' && !janelaAtual)
      return NextResponse.json({ error: 'Janela histórica inválida', janela, total_janelas: janelas.length }, { status: 400 })

    const filtrosHistorico = escopo === 'historico' && modulo === 'fluxo'
      ? filtrosPorPagamento(faseAtual, janelaAtual)
      : {}
    const itens = await fetchContas(integ, recurso, pagina, LIMITE, filtrosHistorico)

    // Substituição opcional (1ª chamada): remove registros de origem ARQUIVO
    // (doc_ref nulo) da entidade — evita duplicidade título CSV × título API
    if (limpar_origem_arquivo && fase === 0 && pagina === 1 && !diag) {
      const tabelaLimpa = modulo === 'fluxo' ? 'fluxo_caixa' : 'lancamentos'
      await admin.from(tabelaLimpa).delete().eq('empresa_id', integ.empresa_id).is('doc_ref', null)
    }

    // Modo diagnóstico: devolve amostra bruta SEM gravar — calibração do mapeamento
    if (diag) {
      return NextResponse.json({
        diag: true, recurso, pagina, recebidos: itens.length,
        amostra: itens.slice(0, 2),
      })
    }

    // De-Para de categorias (módulo DRE)
    let mappings = null, contas = null
    if (modulo === 'dre') {
      const [m, c] = await Promise.all([
        admin.from('categoria_mappings').select('categoria_origem,tipo_destino,conta_id').eq('empresa_id', integ.empresa_id),
        admin.from('plano_contas').select('id,tipo').eq('empresa_id', integ.empresa_id),
      ])
      mappings = m.data || []; contas = c.data || []
    }

    // DADOS COMPLETOS via núcleo compartilhado (mesma lógica do cron) —
    // elimina a duplicação que causou divergências de critério
    const categoriasMap = await fetchCategoriasMap(integ)
    const nomesContato = { ...(integ.contatos_cache || {}) }
    const { registros: regsFluxo, adiados } = await montarRegistrosFluxo(
      admin, integ, recurso, tipoFluxo, pagina, LIMITE, categoriasMap, nomesContato, itens, filtrosHistorico,
      { inicio: T0, prazoMs: 34000 })

    const registros = [], pendencias = []
    if (modulo === 'fluxo') {
      registros.push(...regsFluxo)   // já vêm completos
    } else {
      // DRE: reaproveita os registros de fluxo e aplica o De-Para de categorias
      for (const registro of regsFluxo) {
        const regra = mappings.find(mp => (mp.categoria_origem || '').trim().toLowerCase() === registro.categoria.trim().toLowerCase())
        const contaVinc = regra?.conta_id ? contas.find(ct => ct.id === regra.conta_id) : null
        const tipo = contaVinc?.tipo || regra?.tipo_destino
        if (!tipo || tipo === 'ignorar') {
          pendencias.push({ motivo: `categoria sem De-Para: ${registro.categoria}`, id: registro.doc_ref })
          continue
        }
        registros.push({
          empresa_id: registro.empresa_id, doc_ref: registro.doc_ref.replace('bling:', 'bling:dre:'),
          tipo, valor: registro.valor, data: registro.data,
          descricao: registro.descricao, categoria: registro.categoria,
          conta_id: regra?.conta_id || null,
        })
      }
    }

    // Persiste o cache de nomes para as próximas páginas/execuções
    await admin.from('integracoes').update({ contatos_cache: nomesContato }).eq('id', integ.id)

    let gravados = 0
    if (registros.length) {
      const tabela = modulo === 'fluxo' ? 'fluxo_caixa' : 'lancamentos'
      const { error, count } = await admin.from(tabela)
        .upsert(registros, { onConflict: 'doc_ref', count: 'exact' })
      if (error) throw new Error(`Upsert ${tabela}: ${error.message}`)
      gravados = count ?? registros.length
    }

    // Avanço do cursor — lógica única em lib/bling-cursor.js
    const cheia = itens.length >= LIMITE
    const next = proximoCursor({
      fase, pagina, janela, paginaCheia: cheia,
      totalFases: fasesAtivas.length,
      totalJanelas: escopo === 'historico' && modulo === 'fluxo' ? janelas.length : 0,
    })

    const resultado = {
      modulo, recurso, pagina, fase, escopo,
      janela: escopo === 'historico' ? { indice: janela, total: janelas.length, inicio: janelaAtual.inicio, fim: janelaAtual.fim } : null,
      filtro_data: escopo === 'historico' ? faseAtual.filtro : null,
      recebidos: itens.length, gravados, adiados: adiados || 0,
      retomado: partida.retomado,
      pendencias: pendencias.slice(0, 20), total_pendencias: pendencias.length,
    }

    // ── VISTOS E FILA DE RECONFERÊNCIA (incremental do Fluxo) ─────────────
    // Os ids devolvidos pela listagem são acumulados durante a varredura. Ao
    // fechá-la, os títulos em aberto que NÃO apareceram vão para a fila e
    // começam a ser conferidos pelo id; a interface continua o resto no modo
    // `reconferir`. Ver lib/bling-reconferencia.js — casos DATAPREV e JULIANO.
    const rastreia = escopo === 'incremental' && modulo === 'fluxo' && !diag
    let vistos = null, fila = null, reconferencia = null
    if (rastreia) {
      vistos = vistosAtualizados({
        salvos: integ.sync_vistos, novos: idsDaPagina(itens),
        recomecou: varreduraRecomecou({ fase, pagina, retomado: partida.retomado }),
      })
      if (!next) {
        try {
          fila = montarFila(await titulosEmAbertoDoBling(admin, integ.empresa_id), vistos)
          const folga = 40000 - (Date.now() - T0)
          if (fila.length && folga > 10000) {
            const { fila: restanteFila, ...rec } = await processarFilaReconferencia(admin, integ, {
              fila, prazoMs: Math.min(20000, folga - 5000), categoriasMap, nomesContato })
            fila = restanteFila
            reconferencia = rec
          }
        } catch (e) {
          // A fila é complementar: falha aqui não derruba a varredura, e a
          // fila anterior é preservada (não é sobrescrita com null).
          console.error('Bling fila de reconferência:', e)
          fila = null
        }
      }
    }

    // ── EXCLUSÕES NA ORIGEM, ao FECHAR a varredura ────────────────────────
    // Desde 16/10/2026 cobre só os LIQUIDADOS recentes; os em aberto que somem
    // da listagem vão para a fila de reconferência acima.
    // A sincronização é upsert-only: título excluído no Bling apenas some da
    // listagem e fica órfão na nossa base. Esta verificação só era chamada pelo
    // cron diário — e o Controller sincroniza manualmente, então na prática
    // nunca rodava. Resultado: títulos em aberto apagados no Bling há tempos
    // continuavam inflando "A Pagar" (caso TELEFONICA/JAM).
    // Roda apenas no fim da varredura (next === null) para não competir com a
    // paginação pelo orçamento de tempo da função.
    // Só roda se sobrar folga real na função — é verificação complementar e
    // não pode ser a causa de um estouro de tempo.
    let exclusoes = null
    const restante = 48000 - (Date.now() - T0)
    if (!next && !diag && restante > 8000) {
      try {
        const d90 = new Date(); d90.setDate(d90.getDate() - 90)
        exclusoes = await verificarExclusoes(admin, integ, {
          desde: d90.toISOString().split('T')[0], limite: 60,
          prazoMs: Math.min(12000, restante - 3000) })
      } catch { /* complementar: nunca derruba a sincronização */ }
    }

    // Persistir a posição: é isto que permite a próxima execução CONTINUAR em
    // vez de recomeçar. next === null significa varredura completa e zera o
    // cursor, para que a rodada seguinte reprocesse o que mudou na origem.
    if (!diag) {
      await admin.from('integracoes').update({
        ultima_sync: new Date().toISOString(),
        ultimo_resultado: resultado,
        sync_cursor: cursorParaSalvar({ next, escopo }),
        ...(next ? {} : { ultima_varredura_completa: new Date().toISOString() }),
        updated_at: new Date().toISOString(),
      }).eq('id', integ.id).then(r => r, () => null)
    }
    // Colunas da reconferência numa gravação SEPARADA: se a migração
    // 20261016_reconferencia ainda não tiver sido aplicada, só esta falha — o
    // cursor acima continua sendo salvo e a varredura segue funcionando.
    if (rastreia) {
      await admin.from('integracoes').update({
        sync_vistos: next ? vistos : null,
        ...(fila ? { reconferir: fila } : {}),
      }).eq('id', integ.id).then(r => r, () => null)
    }

    return NextResponse.json({
      ...resultado, exclusoes, reconferencia,
      reconferir_pendentes: fila ? fila.length : undefined,
      hasMore: !!next, next,
    })
  } catch (e) {
    console.error('Bling sync:', e)

    // Indisponibilidade temporária da origem não é uma falha de cursor. A UI
    // repete a MESMA fase/página após uma pausa; nada é descartado nem avançado.
    if (e?.gateway) {
      const pagFalha = e.pagina ?? pagina
      const fasesFalha = escopo === 'historico' && modulo === 'fluxo' ? FASES_HISTORICO : FASES
      const faseFalha = fasesFalha?.[fase] || FASES[0]
      return NextResponse.json({
        modulo,
        recurso: e.recurso || faseFalha.recurso,
        fase,
        pagina: pagFalha,
        janela: escopo === 'historico' && modulo === 'fluxo'
          ? { indice: janela, total: criarJanelas(data_inicio, data_fim).length }
          : null,
        recebidos: 0,
        gravados: 0,
        pendencias: [],
        total_pendencias: 0,
        retryAvel: true,
        aguardar_ms: 8_000,
        aviso: `Bling temporariamente indisponível (HTTP ${e.status}) na página ${pagFalha}. A mesma página será repetida.`,
        hasMore: true,
        next: { fase, pagina: pagFalha, janela },
      })
    }

    return NextResponse.json({ error: String(e.message || e) }, { status: 502 })
  }
}
