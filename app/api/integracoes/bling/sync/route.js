import { NextResponse } from 'next/server'
import { getAuthProfile, ensureToken, fetchContas, mapConta, fetchDetalhe, fetchCategoriasMap, fetchContatoNome, fetchBorderoData, chunk } from '@/lib/bling-server'

// POST /api/integracoes/bling/sync
// body: { integracao_id, modulo: 'fluxo'|'dre', fase?: 0|1, pagina?: number, diag?: boolean }
// Orçamento: 1 página (100 títulos) por chamada — a UI itera enquanto hasMore.
// fase 0 = contas/receber (entrada) · fase 1 = contas/pagar (saída)
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

    // DADOS COMPLETOS NA PRÓPRIA SYNC (sem depender de enriquecimento manual):
    // busca o DETALHE de cada título → categoria.id, competencia, saldo, borderô;
    // resolve nome de categoria (mapa 1x) e de contato (cache persistente)
    const categoriasMap = await fetchCategoriasMap(integ)
    const nomesContato = { ...(integ.contatos_cache || {}) }

    // OTIMIZAÇÃO: não re-detalhar títulos já COMPLETOS no banco (nome ok,
    // categoria resolvida, competência preenchida). Só busca detalhe do que
    // falta → revarreduras seguintes ficam quase instantâneas
    const docRefs = itens.map(i => `bling:${tipoFluxo}:${i.id}`)
    const { data: existentes } = await admin.from('fluxo_caixa')
      .select('doc_ref,descricao,categoria,competencia,status,data,data_liquidacao')
      .in('doc_ref', docRefs)
    const hojeSync = new Date().toISOString().split('T')[0]
    const completo = {}
    ;(existentes || []).forEach(e => {
      const id = e.doc_ref.split(':').pop()
      const descOk = e.descricao && !/^Contato \d+$/.test(e.descricao) && e.descricao !== 'Sem descrição' && e.descricao !== 'Título Bling'
      const dadosOk = descOk && e.categoria && e.categoria !== 'Sem categoria' && !!e.competencia
      const pagoOk  = e.status !== 'pago' || !!e.data_liquidacao
      // aberto/parcial já vencido PODE ter sido pago no Bling → reconferir
      const statusPodeMudar = ['aberto','parcial'].includes(e.status) && e.data <= hojeSync
      completo[id] = dadosOk && pagoOk && !statusPodeMudar
    })
    const aDetalhar = itens.filter(i => !completo[i.id])

    const detalhes = {}
    for (const grupo of chunk(aDetalhar.map(i => i.id).filter(Boolean), 10)) {
      const ds = await Promise.all(grupo.map(id => fetchDetalhe(integ, recurso, id)))
      grupo.forEach((id, ix) => { if (ds[ix]) detalhes[id] = ds[ix] })
    }
    // Nomes de contato ausentes (só os que não estão no cache)
    const idsSemNome = [...new Set(itens
      .map(i => detalhes[i?.id]?.contato?.id ?? i?.contato?.id)
      .filter(id => id != null && !nomesContato[id]))].slice(0, 30)
    for (const grupo of chunk(idsSemNome, 5)) {
      const nomes = await Promise.all(grupo.map(id => fetchContatoNome(integ, id)))
      grupo.forEach((id, ix) => { const nm = nomes[ix]?.nome; if (nm) nomesContato[id] = nm })
    }

    const registros = [], pendencias = []
    for (const item of itens) {
      // Já completo e sem novo detalhe → não reescreve (economia de escrita)
      if (completo[item?.id] && !detalhes[item?.id]) continue
      const det = detalhes[item?.id] || {}
      const base = { ...item, ...det }
      const cid = base?.contato?.id
      if (cid != null && !base?.contato?.nome && nomesContato[cid]) {
        base.contato = { ...base.contato, nome: nomesContato[cid] }
      }
      const { registro, faltantes } = mapConta(base, { tipoFluxo, empresaId: integ.empresa_id })
      // Categoria por ID (detalhe traz categoria.id, não o nome)
      const catId = base?.categoria?.id
      if (catId != null && categoriasMap[catId]) registro.categoria = categoriasMap[catId]
      // Competência
      if (base?.competencia && base.competencia !== '0000-00-00') registro.competencia = base.competencia
      // Parcial preciso via saldo
      const sld = Number(base?.saldo)
      if (Number.isFinite(sld) && sld > 0 && sld < registro.valor) {
        registro.status = 'parcial'; registro.valor_liquidado = Number((registro.valor - sld).toFixed(2))
      }
      // Data de liquidação via borderô (só p/ pagos)
      if (registro.status === 'pago' && Array.isArray(base?.borderos) && base.borderos.length) {
        const dt = await fetchBorderoData(integ, base.borderos[base.borderos.length - 1])
        if (dt && dt !== '0000-00-00') registro.data_liquidacao = dt
      }
      if (faltantes.length || !registro.doc_ref || !registro.data) {
        pendencias.push({ motivo: `campos ausentes: ${faltantes.join(',') || 'data'}`, id: registro.doc_ref })
        continue
      }
      if (modulo === 'fluxo') {
        registros.push(registro)  // já vem completo: nome, categoria, competência, liquidação
      } else {
        // DRE: tipo derivado do De-Para de categorias (mesma regra da importação por arquivo)
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
    return NextResponse.json({ error: String(e.message || e) }, { status: 502 })
  }
}
