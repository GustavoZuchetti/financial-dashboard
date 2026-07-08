import { NextResponse } from 'next/server'
import { getAuthProfile, ensureToken, fetchDetalhe, fetchCategoriasMap, fetchContatoNome, fetchBorderoData, chunk, pausa, blingGet } from '@/lib/bling-server'

// POST /api/integracoes/bling/enrich — enriquecimento retomável dos títulos
// sincronizados: nome do contato, categoria, competência, data de liquidação
// (via borderô) e detecção precisa de parciais (campo saldo).
// body: { integracao_id, setup?: boolean }
// Processa LOTE pequeno por chamada (timeout Vercel 10s); a UI itera até
// restantes = 0. O filtro de "precisa enriquecer" torna o job retomável.
const LOTE = 80           // máximo buscado por chamada
const ORCAMENTO_MS = 8000 // processa até estourar o orçamento (timeout Vercel 10s)

export async function POST(request) {
  const auth = await getAuthProfile(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin, profile } = auth
  if (!['org_admin', 'super_admin'].includes(profile.role))
    return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })

  const { integracao_id, setup = false } = await request.json()
  let { data: integ } = await admin.from('integracoes')
    .select('*').eq('id', integracao_id).eq('organization_id', profile.organization_id).single()
  if (!integ) return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 })

  // Setup (1ª chamada): garante colunas de competência e o cache de contatos
  if (setup && process.env.SUPABASE_ACCESS_TOKEN) {
    await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query:
        'alter table public.fluxo_caixa add column if not exists competencia date;' +
        'alter table public.lancamentos add column if not exists competencia date;' +
        "alter table public.integracoes add column if not exists contatos_cache jsonb not null default '{}'::jsonb;" }),
    }).catch(() => null)
  }

  const FILTRO = (q) => q
    .eq('empresa_id', integ.empresa_id)
    .like('doc_ref', 'bling:%')
    .or('descricao.like.Contato *,categoria.eq.Sem categoria,competencia.is.null,and(status.eq.pago,data_liquidacao.is.null)')

  try {
    integ = await ensureToken(admin, integ)

    const { data: rows } = await FILTRO(
      admin.from('fluxo_caixa').select('id,doc_ref,tipo,valor,status,descricao,categoria')
    ).order('data', { ascending: false }).limit(LOTE)

    if (!rows?.length) {
      return NextResponse.json({ processados: 0, restantes: 0, concluido: true })
    }

    const categoriasMap = await fetchCategoriasMap(integ)
    // Cache PERSISTENTE de nomes (sobrevive entre chamadas — grande ganho de
    // velocidade: fornecedores recorrentes só são consultados uma vez)
    const nomesCache = { ...(integ.contatos_cache || {}) }
    let escopoContatosOk = true
    let processados = 0, erros = 0
    const amostrasErro = []
    const motivos = {}  // { classe: contagem }
    const registraErro = (classe, doc, extra) => {
      motivos[classe] = (motivos[classe] || 0) + 1
      if (amostrasErro.length < 5) amostrasErro.push({ classe, doc, ...extra })
    }
    const inicio = Date.now()

    for (const grupo of chunk(rows, 6)) {
      if (Date.now() - inicio > ORCAMENTO_MS) break // orçamento de tempo
      await Promise.all(grupo.map(async (row) => {
        try {
          const [, tipoRef, blingId] = row.doc_ref.split(':')
          const recurso = tipoRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
          const probe = await blingGet(integ, `${recurso}/${blingId}`)
          const det = probe.ok ? (probe.body?.data || null) : null
          if (!det) {
            erros++
            registraErro(`detalhe_http_${probe.status}`, row.doc_ref, { corpo: JSON.stringify(probe.body || '').slice(0, 120) })
            return
          }

          const upd = {}

          // Nome do contato (exige escopo Contatos; 403 → mantém e reporta)
          let nome = det?.contato?.nome || null
          const cid = det?.contato?.id
          if (!nome && cid != null && escopoContatosOk) {
            if (nomesCache[cid] === undefined) {
              const rc = await fetchContatoNome(integ, cid)
              if (rc.negado) escopoContatosOk = false // 403 real — escopo faltando
              nomesCache[cid] = rc.nome
            }
            nome = nomesCache[cid]
          }
          const descRica = (typeof nome === 'string' && nome.trim()) ? nome.trim()
                             : (typeof det?.historico === 'string' && det.historico.trim() ? det.historico.trim() : null)
          if (descRica) upd.descricao = descRica

          // Categoria (id → nome do cadastro)
          const catId = det?.categoria?.id
          if (catId != null) upd.categoria = categoriasMap[catId] || `Categoria ${catId}`

          // Competência
          if (det?.competencia && det.competencia !== '0000-00-00') upd.competencia = det.competencia

          // Parcial preciso via saldo: 0 < saldo < valor
          const saldo = Number(det?.saldo)
          const valor = Number(det?.valor ?? row.valor)
          if (Number.isFinite(saldo) && saldo > 0 && saldo < valor) {
            upd.status = 'parcial'
            upd.valor_liquidado = Number((valor - saldo).toFixed(2))
          }

          // Data de liquidação (borderô) — apenas para pagos sem data
          if (row.status === 'pago' && Array.isArray(det?.borderos) && det.borderos.length) {
            const dt = await fetchBorderoData(integ, det.borderos[det.borderos.length - 1])
            if (dt && dt !== '0000-00-00') upd.data_liquidacao = dt
          }

          if (Object.keys(upd).length) {
            const { error } = await admin.from('fluxo_caixa').update(upd).eq('id', row.id)
            if (error) { erros++; registraErro('update_db', row.doc_ref, { msg: error.message.slice(0, 120) }); return }
          }
          processados++
        } catch (e) { erros++; registraErro('excecao', row.doc_ref, { msg: String(e.message || e).slice(0, 120) }) }
      }))
      await pausa(250) // respeito ao rate limit do Bling
    }

    // Sonda: se tudo falhou, capturar o HTTP real de UMA consulta de detalhe
    let sonda = null
    if (processados === 0 && erros > 0 && rows[0]) {
      const [, tRef, bId] = rows[0].doc_ref.split(':')
      const rc = tRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
      const probe = await blingGet(integ, `${rc}/${bId}`)
      sonda = { http: probe.status, corpo: JSON.stringify(probe.body || '').slice(0, 180) }
    }

    // Persiste o cache de nomes para as próximas chamadas
    await admin.from('integracoes').update({ contatos_cache: nomesCache, updated_at: new Date().toISOString() }).eq('id', integ.id)

    const { count: restantes } = await FILTRO(
      admin.from('fluxo_caixa').select('id', { count: 'exact', head: true })
    )

    return NextResponse.json({
      sonda,
      motivos_erro: motivos,
      amostras_erro: amostrasErro,
      processados, erros,
      restantes: restantes ?? 0,
      concluido: (restantes ?? 0) === 0,
      escopo_contatos: escopoContatosOk ? 'ok' : 'FALTANDO — habilite o escopo Contatos no app Bling para os nomes',
    })
  } catch (e) {
    console.error('Bling enrich:', e)
    return NextResponse.json({ error: String(e.message || e) }, { status: 502 })
  }
}
