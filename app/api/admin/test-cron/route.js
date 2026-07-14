// Rota de TESTE do cron — executa a MESMA lógica com chave embutida, para
// validar a mecânica independente da variável CRON_SECRET. Remover após uso.
import { getAdmin, ensureToken, fetchContas, mapConta, fetchDetalhe, fetchCategoriasMap, fetchContatoNome, fetchBorderoData, chunk, pausa } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '79448c6554c8724251db97cd889eb8fd67e48f99'
const FASES = [
  { recurso: 'contas/receber', tipoFluxo: 'entrada' },
  { recurso: 'contas/pagar',   tipoFluxo: 'saida'   },
]
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: integs } = await admin.from('integracoes')
    .select('*').eq('modulo_fluxo_ativo', true).not('refresh_token', 'is', null)
  const diag = { integracoes_elegiveis: (integs || []).length, relatorio: [] }
  const inicio = Date.now()
  for (const raw of integs || []) {
    const r = { id: raw.id, empresa_id: raw.empresa_id, paginas: 0, gravados: 0, cursor_inicial: raw.cron_cursor || null }
    try {
      const integ = await ensureToken(admin, raw)
      let { fase = 0, pagina = 1 } = raw.cron_cursor || {}
      const categoriasMap = await fetchCategoriasMap(integ)
      const nomesContato = { ...(integ.contatos_cache || {}) }
      while (Date.now() - inicio < 7000) {
        const { recurso, tipoFluxo } = FASES[fase] || FASES[0]
        const itens = await fetchContas(integ, recurso, pagina, 50)
        // Pular já completos
        const docRefs = itens.map(i => `bling:${tipoFluxo}:${i.id}`)
        const { data: existentes } = await admin.from('fluxo_caixa')
          .select('doc_ref,descricao,categoria,competencia,status,data_liquidacao').in('doc_ref', docRefs)
        const completo = {}
        ;(existentes || []).forEach(e => {
          const id = e.doc_ref.split(':').pop()
          const descOk = e.descricao && !/^Contato \d+$/.test(e.descricao) && e.descricao !== 'Sem descrição' && e.descricao !== 'Título Bling'
          completo[id] = descOk && e.categoria && e.categoria !== 'Sem categoria' && !!e.competencia && (e.status !== 'pago' || !!e.data_liquidacao)
        })
        const aDetalhar = itens.filter(i => !completo[i.id])
        const detalhes = {}
        for (const grupo of chunk(aDetalhar.map(i => i.id).filter(Boolean), 8)) {
          const ds = await Promise.all(grupo.map(id => fetchDetalhe(integ, recurso, id)))
          grupo.forEach((id, ix) => { if (ds[ix]) detalhes[id] = ds[ix] })
        }
        const registros = []
        for (const item of itens) {
          if (completo[item?.id] && !detalhes[item?.id]) continue
          const det = detalhes[item?.id] || {}
          const base = { ...item, ...det }
          const cid = base?.contato?.id
          if (cid != null && !base?.contato?.nome) {
            if (nomesContato[cid] === undefined) { const rc = await fetchContatoNome(integ, cid); nomesContato[cid] = rc.nome }
            if (nomesContato[cid]) base.contato = { ...base.contato, nome: nomesContato[cid] }
          }
          const { registro, faltantes } = mapConta(base, { tipoFluxo, empresaId: integ.empresa_id })
          if (faltantes.length || !registro.doc_ref || !registro.data) continue
          const catId = base?.categoria?.id
          if (catId != null && categoriasMap[catId]) registro.categoria = categoriasMap[catId]
          if (base?.competencia && base.competencia !== '0000-00-00') registro.competencia = base.competencia
          const sld = Number(base?.saldo)
          if (Number.isFinite(sld) && sld > 0 && sld < registro.valor) { registro.status = 'parcial'; registro.valor_liquidado = Number((registro.valor - sld).toFixed(2)) }
          if (registro.status === 'pago' && Array.isArray(base?.borderos) && base.borderos.length) {
            const dt = await fetchBorderoData(integ, base.borderos[base.borderos.length - 1]); if (dt && dt !== '0000-00-00') registro.data_liquidacao = dt
          }
          registros.push(registro)
        }
        if (registros.length) {
          const { error } = await admin.from('fluxo_caixa').upsert(registros, { onConflict: 'doc_ref' })
          if (!error) r.gravados += registros.length
        }
        r.paginas++
        if (itens.length >= 50) pagina++
        else if (fase + 1 < FASES.length) { fase++; pagina = 1 }
        else { fase = 0; pagina = 1; r.varredura_completa = true; break }
        await pausa(250)
      }
      const { error: errUpd } = await admin.from('integracoes').update({
        contatos_cache: nomesContato,
        ultima_sync: new Date().toISOString(),      // visível na UI ("Última sincronização")
        ultima_sync_cron: new Date().toISOString(),
        cron_cursor: { fase, pagina },
        cron_resultado: r,
      }).eq('id', integ.id)
      r.erro_gravacao = errUpd?.message || null
      // Releitura: o que REALMENTE ficou no banco após o update
      const { data: relido, error: errSel } = await admin.from('integracoes')
        .select('cron_cursor').eq('id', integ.id).single()
      r.cursor_relido_do_banco = errSel ? ('ERRO: ' + errSel.message) : (relido?.cron_cursor ?? null)
      r.cursor_final = { fase, pagina }
    } catch (e) { r.erro = String(e.message || e) }
    diag.relatorio.push(r)
  }
  return Response.json(diag)
}
