import { NextResponse } from 'next/server'
import { getAuthProfile, ensureToken, fetchDetalhe, fetchCategoriasMap, fetchContatoNome, fetchBorderoData, chunk, pausa, blingGet } from '@/lib/bling-server'

// POST /api/integracoes/bling/enrich — enriquecimento retomável dos títulos
// sincronizados: nome do contato, categoria, competência, data de liquidação
// (via borderô) e detecção precisa de parciais (campo saldo).
// body: { integracao_id, setup?: boolean }
// Processa LOTE pequeno por chamada (timeout Vercel 10s); a UI itera até
// restantes = 0. O filtro de "precisa enriquecer" torna o job retomável.
const LOTE = 12

export async function POST(request) {
  const auth = await getAuthProfile(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin, profile } = auth
  if (!['admin', 'super_admin'].includes(profile.role))
    return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })

  const { integracao_id, setup = false } = await request.json()
  let { data: integ } = await admin.from('integracoes')
    .select('*').eq('id', integracao_id).eq('organization_id', profile.organization_id).single()
  if (!integ) return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 })

  // Setup (1ª chamada): garante as colunas de competência via Management API
  if (setup && process.env.SUPABASE_ACCESS_TOKEN) {
    await fetch('https://api.supabase.com/v1/projects/wbrjdehmauaincgtcjrk/database/query', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query:
        'alter table public.fluxo_caixa add column if not exists competencia date;' +
        'alter table public.lancamentos add column if not exists competencia date;' }),
    }).catch(() => null)
  }

  const FILTRO = (q) => q
    .eq('empresa_id', integ.empresa_id)
    .like('doc_ref', 'bling:%')
    .or('descricao.like.Contato %,categoria.eq.Sem categoria,competencia.is.null,and(status.eq.pago,data_liquidacao.is.null)')

  try {
    integ = await ensureToken(admin, integ)

    const { data: rows } = await FILTRO(
      admin.from('fluxo_caixa').select('id,doc_ref,tipo,valor,status,descricao,categoria')
    ).order('data', { ascending: false }).limit(LOTE)

    if (!rows?.length) {
      return NextResponse.json({ processados: 0, restantes: 0, concluido: true })
    }

    const categoriasMap = await fetchCategoriasMap(integ)
    const nomesCache = {}
    let escopoContatosOk = true
    let processados = 0, erros = 0

    for (const grupo of chunk(rows, 3)) {
      await Promise.all(grupo.map(async (row) => {
        try {
          const [, tipoRef, blingId] = row.doc_ref.split(':')
          const recurso = tipoRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
          const det = await fetchDetalhe(integ, recurso, blingId)
          if (!det) { erros++; return }

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
          const descRica = nome || det?.historico || null
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
            if (error) { erros++; return }
          }
          processados++
        } catch { erros++ }
      }))
      await pausa(500) // respeito ao rate limit do Bling
    }

    // Sonda: se tudo falhou, capturar o HTTP real de UMA consulta de detalhe
    let sonda = null
    if (processados === 0 && erros > 0 && rows[0]) {
      const [, tRef, bId] = rows[0].doc_ref.split(':')
      const rc = tRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
      const probe = await blingGet(integ, `${rc}/${bId}`)
      sonda = { http: probe.status, corpo: JSON.stringify(probe.body || '').slice(0, 180) }
    }

    const { count: restantes } = await FILTRO(
      admin.from('fluxo_caixa').select('id', { count: 'exact', head: true })
    )

    return NextResponse.json({
      sonda,
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
