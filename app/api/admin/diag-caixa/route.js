import { getAdmin } from '@/lib/bling-server'
import { efeitosCaixa } from '@/lib/fluxo-status'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'PH'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '829c491f23c3ded4dd58bd32')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const start = '2026-01-01', end = '2026-07-22'
  // TODAS as entidades (consolidado)
  const { data: emps } = await admin.from('empresas').select('id')
  const ids = (emps||[]).map(e=>e.id)

  // carrega todo o fluxo (paginado)
  let all = [], pg = 0
  while (pg < 20) {
    const { data } = await admin.from('fluxo_caixa')
      .select('tipo,valor,valor_liquidado,data,data_liquidacao,status,empresa_id')
      .in('empresa_id', ids).range(pg*1000, (pg+1)*1000-1)
    if (!data || !data.length) break
    all = all.concat(data); if (data.length < 1000) break; pg++
  }
  const ENTRADA = ['entrada','fluxo_entrada','receita']

  // ── LÓGICA GESTÃO: valor bruto de todos no período (por data efetiva) ──
  let gestE = 0, gestS = 0
  // ── LÓGICA OVERVIEW: efeitosCaixa no período + base anterior ──
  let ovEfeitoPeriodo = 0, ovBaseAnterior = 0
  all.forEach(f => {
    // gestão usa dataEfetiva no período
    const efeitos = efeitosCaixa(f)
    efeitos.forEach(e => {
      if (e.data >= start && e.data <= end) {
        if (ENTRADA.includes(f.tipo)) { gestE += e.valor; ovEfeitoPeriodo += e.valor }
        else { gestS += e.valor; ovEfeitoPeriodo -= e.valor }
      }
      if (e.data < start) ovBaseAnterior += ENTRADA.includes(f.tipo) ? e.valor : -e.valor
    })
  })
  // saldo inicial
  const { data: cfg } = await admin.from('empresa_config').select('valor,chave').in('empresa_id', ids).eq('chave','saldo_inicial')
  const saldoInicial = (cfg||[]).reduce((a,r)=>a+(Number(r.valor)||0),0)

  return Response.json({
    total_registros: all.length,
    GESTAO: { entradas: +gestE.toFixed(2), saidas: +gestS.toFixed(2), saldo_periodo: +(gestE-gestS).toFixed(2) },
    OVERVIEW: {
      saldo_inicial: saldoInicial,
      base_anterior_efeito: +ovBaseAnterior.toFixed(2),
      efeito_periodo: +ovEfeitoPeriodo.toFixed(2),
      caixa_final: +(saldoInicial + ovBaseAnterior + ovEfeitoPeriodo).toFixed(2),
    },
  })
}
