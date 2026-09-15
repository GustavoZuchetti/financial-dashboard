// ─── test-consistencia-saldo.mjs ─────────────────────────────────────────────
// Trava a consistência do saldo de caixa ENTRE TELAS.
//
// O incidente (11/09/2026): "Caixa Disponível" na Visão Geral e o saldo
// acumulado no Fluxo de Caixa exibiam a MESMA informação com resultados
// diferentes. Três causas independentes:
//
//   1. PERÍODOS PADRÃO DIFERENTES
//      fluxo-caixa abria em `${curYear - 2}-01-01` → 01/01/2024
//      overview abria em YTD                       → 01/01/2026
//      Cada tela partia de uma âncora e acumulava uma janela distintas.
//
//   2. FLUXO DE CAIXA SOMAVA O PROJETADO
//      `expandirEfeitos` descartava o campo `origem` no .map, então título a
//      vencer entrava no acumulado como se fosse caixa — o mesmo defeito que
//      a Visão Geral teve corrigido no PR #20 e que ficou vivo aqui.
//
//   3. PONTO FINAL DIFERENTE
//      Overview cortava em HOJE; Fluxo de Caixa ia até o fim do período.
//
// Corrigir UMA tela de cada vez foi o que produziu a divergência: o PR #20
// arrumou a Visão Geral e, com isso, AMPLIOU a diferença contra o Fluxo de
// Caixa. Este teste existe para que a próxima correção isolada falhe aqui.
//
// Execução:  node scripts/test-consistencia-saldo.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copias = []
const importar = async (rel) => {
  const dst = join(raiz, 'lib', `.${rel.replace(/\W/g, '_')}.teste.${process.pid}.mjs`)
  let src = readFileSync(join(raiz, 'lib', rel), 'utf8')
  src = src.replace(/from '\.\/fluxo-status'/g, `from './.fluxo_status_js.teste.${process.pid}.mjs'`)
  writeFileSync(dst, src); copias.push(dst)
  return import(pathToFileURL(dst).href)
}
const limpar = () => copias.forEach(f => { try { rmSync(f, { force: true }) } catch {} })
process.on('exit', limpar)

const FS = await importar('fluxo-status.js')
const PP = await importar('periodo-padrao.js')

const HOJE = '2026-09-11'

// ── Réplicas das duas telas, como implementadas hoje ────────────────────────
// Visão Geral: acumula por mês, corta em hoje, só realizado.
function saldoOverview({ registros, saldoBase, de, ate, hoje }) {
  const porMes = {}
  for (const f of registros) for (const e of FS.efeitosCaixa(f, hoje)) {
    if (e.data < de || e.data > ate) continue
    const m = e.data.slice(0, 7)
    if (!porMes[m]) porMes[m] = { r: 0, p: 0 }
    const s = FS.ENTRADA_TIPOS.includes(f.tipo) ? 1 : -1
    porMes[m][e.origem === 'projetado' ? 'p' : 'r'] += s * e.valor
  }
  const meses = Object.keys(porMes).sort().filter(m => m <= hoje.slice(0, 7))
  let saldo = saldoBase
  for (const m of meses) saldo += porMes[m].r
  return Math.round(saldo * 100) / 100
}

// Fluxo de Caixa: acumula por chave de data, duas séries.
function saldoFluxoCaixa({ registros, saldoBase, de, ate, hoje }) {
  const porDia = {}
  for (const f of registros) for (const e of FS.efeitosCaixa(f, hoje)) {
    if (e.data < de || e.data > ate) continue
    if (!porDia[e.data]) porDia[e.data] = { r: 0, p: 0 }
    const s = FS.ENTRADA_TIPOS.includes(f.tipo) ? 1 : -1
    porDia[e.data][e.origem === 'projetado' ? 'p' : 'r'] += s * e.valor
  }
  const dias = Object.keys(porDia).sort().filter(d => d <= hoje)
  let saldo = saldoBase
  for (const d of dias) saldo += porDia[d].r
  return Math.round(saldo * 100) / 100
}

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}

const pago   = (t, d, v) => ({ tipo: t, valor: v, data: d, status: 'pago', valor_liquidado: v, data_liquidacao: d })
const vencer = (t, d, v) => ({ tipo: t, valor: v, data: d, status: 'aberto' })

const CENARIO = [
  pago('entrada', '2026-09-02', 300000),
  pago('saida',   '2026-09-05', 180000),
  pago('saida',   '2026-09-09', 97000),
  vencer('entrada', '2026-09-28', 1540000),   // a vencer — não é caixa
  vencer('saida',   '2026-10-05', 220000),    // fora do mês
  vencer('saida',   '2026-08-20', 90000),     // vencido não liquidado
]

// ─── 1. A trava central ──────────────────────────────────────────────────────
teste('[TRAVA] Visão Geral e Fluxo de Caixa chegam ao MESMO saldo', () => {
  const { inicio, fim } = PP.mesVigente(new Date(HOJE + 'T12:00:00Z'))
  const args = { registros: CENARIO, saldoBase: 22000, de: inicio, ate: fim, hoje: HOJE }
  const a = saldoOverview(args)
  const b = saldoFluxoCaixa(args)
  eq(a, b, 'divergência entre telas: ')
  eq(a, 45000, 'saldo: ')   // 22.000 + 300.000 − 180.000 − 97.000
})

teste('[REGRESSÃO] períodos diferentes produziam saldos diferentes', () => {
  const nosMes = saldoFluxoCaixa({ registros: CENARIO, saldoBase: 22000,
    de: '2026-09-01', ate: '2026-09-30', hoje: HOJE })
  const desde2024 = saldoFluxoCaixa({ registros: CENARIO, saldoBase: 22000,
    de: '2024-01-01', ate: '2026-12-31', hoje: HOJE })
  // Neste cenário o vencido de agosto não gera efeito, então convergem — mas a
  // JANELA é diferente, e basta um liquidado antigo para divergirem.
  const comHistorico = [...CENARIO, pago('saida', '2025-03-10', 500000)]
  const a = saldoFluxoCaixa({ registros: comHistorico, saldoBase: 22000, de: '2026-09-01', ate: '2026-09-30', hoje: HOJE })
  const b = saldoFluxoCaixa({ registros: comHistorico, saldoBase: 22000, de: '2024-01-01', ate: '2026-12-31', hoje: HOJE })
  if (a === b) throw new Error('o cenário deveria divergir com janelas diferentes')
  eq(a - b, 500000, 'diferença causada pela janela: ')
  eq(nosMes, desde2024, 'sem histórico antigo, convergem: ')
})

teste('[TRAVA] título a vencer não entra em nenhuma das duas', () => {
  const { inicio, fim } = PP.mesVigente(new Date(HOJE + 'T12:00:00Z'))
  const args = { registros: CENARIO, saldoBase: 22000, de: inicio, ate: fim, hoje: HOJE }
  const s = saldoOverview(args)
  if (s > 1000000) throw new Error('o recebível de 1,54 mi voltou para dentro do saldo')
  eq(s, saldoFluxoCaixa(args), 'telas: ')
})

teste('[TRAVA] meses futuros não entram no saldo de hoje', () => {
  const args = { registros: CENARIO, saldoBase: 22000, de: '2026-01-01', ate: '2026-12-31', hoje: HOJE }
  eq(saldoOverview(args), saldoFluxoCaixa(args), 'telas: ')
  eq(saldoOverview(args), 45000, 'outubro fica de fora: ')
})

// ─── 2. Período padrão unificado ─────────────────────────────────────────────
teste('[TRAVA] o padrão é o MÊS VIGENTE', () => {
  const { inicio, fim } = PP.mesVigente(new Date('2026-09-11T12:00:00Z'))
  eq(inicio, '2026-09-01', 'início: ')
  eq(fim,    '2026-09-30', 'fim: ')
})

teste('mês vigente atravessa virada de ano e fevereiro bissexto', () => {
  eq(PP.mesVigente(new Date('2026-12-15T12:00:00Z')), { inicio: '2026-12-01', fim: '2026-12-31' })
  eq(PP.mesVigente(new Date('2028-02-10T12:00:00Z')), { inicio: '2028-02-01', fim: '2028-02-29' })
  eq(PP.mesAnterior(new Date('2026-01-15T12:00:00Z')), { inicio: '2025-12-01', fim: '2025-12-31' })
})

teste('[REGRESSÃO] o padrão antigo puxava base incompleta', () => {
  // `${curYear - 2}-01-01` a partir de 2026 → 01/01/2024. A base só é
  // confiável desde julho/2026 (conciliação de 25/08), então o padrão
  // arrastava dois anos e meio de dados incompletos para dentro do saldo.
  const antigo = `${2026 - 2}-01-01`
  eq(antigo, '2024-01-01')
  if (antigo >= PP.mesVigente(new Date(HOJE + 'T12:00:00Z')).inicio)
    throw new Error('o padrão antigo deveria ser anterior ao mês vigente')
})

// ─── 3. Nenhuma tela com padrão próprio ──────────────────────────────────────
teste('[TRAVA] nenhuma tela inicializa período por conta própria', () => {
  const alvos = [
    'app/dashboard/fluxo-caixa/page.jsx',
    'app/dashboard/fluxo-caixa/gestao/page.jsx',
    'app/dashboard/dre/page.jsx',
    'app/dashboard/dre/analise/page.jsx',
    'app/dashboard/dre/detalhado/page.jsx',
  ]
  const ruins = []
  for (const rel of alvos) {
    const src = readFileSync(join(raiz, rel), 'utf8')
    // Padrões proibidos: ano fixo, getFullYear(),0,1 ou hoje−N dias
    if (/useState\(`\$\{[^}]*\}-01-01`\)/.test(src)) ruins.push(`${rel}: ano fixo`)
    if (/useState\(\(\) => new Date\(new Date\(\)\.getFullYear\(\),\s*0,\s*1\)/.test(src)) ruins.push(`${rel}: 1º de janeiro`)
    if (/useState\(\(\) => new Date\(Date\.now\(\) - \d+ \* 86400000\)/.test(src)) ruins.push(`${rel}: hoje menos N dias`)
    if (!/periodo-padrao/.test(src)) ruins.push(`${rel}: não importa a fonte única`)
  }
  if (ruins.length) throw new Error('telas com período próprio:\n           · ' + ruins.join('\n           · '))
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
