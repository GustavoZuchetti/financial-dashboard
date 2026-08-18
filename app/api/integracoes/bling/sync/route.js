import { NextResponse } from 'next/server'
import { getAuthProfile, ensureToken, fetchContas, fetchCategoriasMap, montarRegistrosFluxo } from '@/lib/bling-server'

// POST /api/integracoes/bling/sync
// body: { integracao_id, modulo: 'fluxo'|'dre', fase?: 0|1, pagina?: number, diag?: boolean }
// Orçamento: 1 página (100 títulos) por chamada — a UI itera enquanto hasMore.
// fase 0 = contas/receber (entrada) · fase 1 = contas/pagar (saída)
// O comentário abaixo, em `const LIMITE`, já reconhecia o "timeout de 10s da
// Vercel" — mas a rota nunca declarou maxDuration, então rodava mesmo com o
// padrão de 10s enquanto o cron e o enrich usavam 60s. Com o retry de gateway
// (que espera até 20s entre tentativas), 10s era garantia de falha.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FASES = [
  { recurso: 'contas/receber', tipoFluxo: 'entrada' },
  { recurso: 'contas/pagar',   tipoFluxo: 'saida'   },
]

export async function POST(request) {
  const auth = await getAuthProfile(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin, profile } = auth
  if (!['org_admin', 'super_admin'].includes(profile.role))
    return NextResponse.json({ error: 'Apenas administradores podem sincronizar' }, { status: 403 })

  const { integracao_id, modulo = 'fluxo', fase = 0, pagina = 1, diag = false, limpar_origem_arquivo = false } = await request.json()

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

  try {
    integ = await ensureToken(admin, integ)

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
    const { recurso, tipoFluxo } = FASES[fase] || FASES[0]
    // DRE precisa do DETALHE de cada título (a listagem não traz categoria) →
    // páginas menores para caber no timeout de 10s da Vercel
    const LIMITE = 50  // muitos títulos são pulados (já completos) → página maior
    const itens = await fetchContas(integ, recurso, pagina, LIMITE)

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
    const { registros: regsFluxo } = await montarRegistrosFluxo(
      admin, integ, recurso, tipoFluxo, pagina, LIMITE, categoriasMap, nomesContato, itens)

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

    // Avanço do cursor: página cheia → próxima página; senão → próxima fase
    const cheia = itens.length >= LIMITE
    const next = cheia ? { fase, pagina: pagina + 1 } : (fase + 1 < FASES.length ? { fase: fase + 1, pagina: 1 } : null)

    const resultado = { modulo, recurso, pagina, recebidos: itens.length, gravados, pendencias: pendencias.slice(0, 20), total_pendencias: pendencias.length }
    await admin.from('integracoes').update({
      ultima_sync: new Date().toISOString(),
      ultimo_resultado: resultado,
      updated_at: new Date().toISOString(),
    }).eq('id', integ.id)

    return NextResponse.json({ ...resultado, hasMore: !!next, next })
  } catch (e) {
    console.error('Bling sync:', e)

    // ═══ Indisponibilidade temporária do Bling ≠ falha da sincronização ═══
    // 502/503/504 significam que a ORIGEM do Bling não respondeu — o cursor
    // está íntegro, os dados estão íntegros, nada foi gravado pela metade
    // (o upsert é por doc_ref e só ocorre depois da página inteira montada).
    // Devolvemos 200 pedindo que a UI REPITA A MESMA PÁGINA após uma pausa.
    // Antes, um 504 isolado na página 29 virava HTTP 502, a UI abortava o laço
    // e o trabalho das 28 páginas anteriores era descartado.
    if (e?.gateway) {
      const pagFalha = e.pagina ?? pagina
      return NextResponse.json({
        modulo,
        recurso: e.recurso || (FASES[fase] || FASES[0]).recurso,
        pagina: pagFalha,
        recebidos: 0, gravados: 0, pendencias: [], total_pendencias: 0,
        retryAvel: true,
        aguardar_ms: 8000,
        aviso: `Bling temporariamente indisponível (HTTP ${e.status}) na página ${pagFalha}. `
             + 'Nenhum dado foi perdido — a mesma página será repetida.',
        hasMore: true,
        next: { fase, pagina: pagFalha },   // MESMA página: o cursor não avança
      })
    }

    return NextResponse.json({ error: String(e.message || e) }, { status: 502 })
  }
}
