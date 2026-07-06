import { NextResponse } from 'next/server'
import { getAuthProfile, ensureToken, fetchContas, mapConta, fetchDetalhe, fetchCategoriasMap, fetchContatoNome, chunk } from '@/lib/bling-server'

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
  if (!['admin', 'super_admin'].includes(profile.role))
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
    const { recurso, tipoFluxo } = FASES[fase] || FASES[0]
    // DRE precisa do DETALHE de cada título (a listagem não traz categoria) →
    // páginas menores para caber no timeout de 10s da Vercel
    const LIMITE = modulo === 'dre' ? 25 : 100
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

    // Pré-carrega De-Para de categorias (necessário para o módulo DRE)
    let mappings = null, contas = null
    if (modulo === 'dre') {
      const [m, c] = await Promise.all([
        admin.from('categoria_mappings').select('categoria_origem,tipo_destino,conta_id').eq('empresa_id', integ.empresa_id),
        admin.from('plano_contas').select('id,tipo').eq('empresa_id', integ.empresa_id),
      ])
      mappings = m.data || []; contas = c.data || []
    }

    // Enriquecimento 1: nomes de contatos ausentes (contas a pagar vem sem nome)
    const idsSemNome = [...new Set(itens
      .filter(i => !i?.contato?.nome && i?.contato?.id != null)
      .map(i => i.contato.id))].slice(0, 25)
    const nomesContato = {}
    for (const grupo of chunk(idsSemNome, 5)) {
      const nomes = await Promise.all(grupo.map(id => fetchContatoNome(integ, id)))
      grupo.forEach((id, ix) => { if (nomes[ix]) nomesContato[id] = nomes[ix] })
    }

    // Enriquecimento 2 (módulo DRE): detalhe de cada título → categoria + histórico
    let categoriasMap = {}
    let detalhes = {}
    if (modulo === 'dre') {
      categoriasMap = await fetchCategoriasMap(integ)
      for (const grupo of chunk(itens.map(i => i.id).filter(Boolean), 8)) {
        const ds = await Promise.all(grupo.map(id => fetchDetalhe(integ, recurso, id)))
        grupo.forEach((id, ix) => { if (ds[ix]) detalhes[id] = ds[ix] })
      }
    }

    const registros = [], pendencias = []
    for (const item of itens) {
      const base = modulo === 'dre' ? { ...item, ...(detalhes[item?.id] || {}) } : item
      if (base?.contato?.id != null && !base?.contato?.nome && nomesContato[base.contato.id]) {
        base.contato = { ...base.contato, nome: nomesContato[base.contato.id] }
      }
      const { registro, faltantes } = mapConta(base, { tipoFluxo, empresaId: integ.empresa_id })
      // Categoria por ID resolvida pelo mapa (detalhe traz categoria.id, não o nome)
      const catId = base?.categoria?.id
      if (catId != null && categoriasMap[catId]) registro.categoria = categoriasMap[catId]
      if (faltantes.length || !registro.doc_ref || !registro.data) {
        pendencias.push({ motivo: `campos ausentes: ${faltantes.join(',') || 'data'}`, id: registro.doc_ref })
        continue
      }
      if (modulo === 'fluxo') {
        registros.push(registro)
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
