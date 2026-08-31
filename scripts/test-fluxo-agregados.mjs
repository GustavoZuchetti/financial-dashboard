// ─── test-fluxo-agregados.mjs ────────────────────────────────────────────────
// Trava a separação REALIZADO x PROJETADO nos totais de período (Causa 1 da
// auditoria de 13/08).
//
// O defeito original: os KPIs somavam `r.valor` (valor do TÍTULO) para todo
// status, enquanto o extrato na mesma tela usava efeitosCaixa (valor do
// borderô). Um título pago de R$ 100.000 com R$ 90.000 de borderô aparecia
// como 100.000 no KPI e 90.000 no extrato.
//
// Execução:  node scripts/test-fluxo-agregados.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copias = []
const importar = async (rel) => {
  const destino = join(raiz, 'lib', `.${rel.replace(/\W/g, '_')}.teste.${process.pid}.mjs`)
  let src = readFileSync(join(raiz, 'lib', rel), 'utf8')
  src = src.replace(/from '\.\/fluxo-status'/g, `from './.fluxo_status_js.teste.${process.pid}.mjs'`)
  writeFileSync(destino, src); copias.push(destino)
  return import(pathToFileURL(destino).href)
}
const limpar = () => copias.forEach(f => { try { rmSync(f, { force: true }) } catch {} })
process.on('exit', limpar)

const FS = await importar('fluxo-status.js')
const A  = await importar('fluxo-agregados.js')

let ok = 0, falhou = 0
const testes = []
const teste = (nome, fn) => testes.push([nome, fn])
function eq(atual, esperado, ctx = '') {
  const a = JSON.stringify(atual), e = JSON.stringify(esperado)
  if (a !== e) throw new Error(`${ctx}esperado ${e}, recebido ${a}`)
}

const HOJE = '2026-08-12'
const PERIODO = { de: '2026-07-01', ate: '2026-08-31', hoje: HOJE }

// ─── 1. Origem dos efeitos ───────────────────────────────────────────────────
teste('título pago gera efeito REALIZADO', () => {
  const e = FS.efeitosCaixa({ tipo: 'entrada', valor: 100, status: 'pago', valor_liquidado: 100, data_liquidacao: '2026-07-10', data: '2026-07-05' }, HOJE)
  eq(e.map(x => x.origem), ['realizado'])
})
teste('título a vencer gera efeito PROJETADO', () => {
  const e = FS.efeitosCaixa({ tipo: 'entrada', valor: 100, status: 'aberto', data: '2026-09-10' }, HOJE)
  eq(e.map(x => x.origem), ['projetado'])
})
teste('parcial gera um de cada: liquidado realizado, restante projetado', () => {
  const e = FS.efeitosCaixa({ tipo: 'entrada', valor: 100, status: 'parcial', valor_liquidado: 30, data_liquidacao: '2026-07-10', data: '2026-09-10' }, HOJE)
  eq(e.map(x => x.origem), ['realizado', 'projetado'])
  eq(e.map(x => x.valor), [30, 70])
})
teste('vencido não liquidado não gera efeito nenhum', () => {
  eq(FS.efeitosCaixa({ tipo: 'saida', valor: 100, status: 'aberto', data: '2026-07-05' }, HOJE), [])
})

// ─── 2. A correção da Causa 1 ────────────────────────────────────────────────
teste('[TRAVA] usa o valor do BORDERÔ, não o do título', () => {
  // O caso medido na auditoria: título de 100.000, borderô de 90.000
  const regs = [{ tipo: 'entrada', valor: 100000, status: 'pago', valor_liquidado: 90000, data_liquidacao: '2026-07-10', data: '2026-07-05' }]
  const ag = A.agregarPeriodo(regs, PERIODO)
  eq(ag.realizado.entradas, 90000, 'realizado: ')
  if (ag.realizado.entradas === 100000) throw new Error('voltou a somar o valor do título')
})

teste('[TRAVA] parcial não entra INTEIRO no realizado', () => {
  const regs = [{ tipo: 'saida', valor: 100000, status: 'parcial', valor_liquidado: 30000, data_liquidacao: '2026-07-10', data: '2026-08-20' }]
  const ag = A.agregarPeriodo(regs, PERIODO)
  eq(ag.realizado.saidas, 30000, 'realizado: ')
  eq(ag.projetado.saidas, 70000, 'projetado: ')
})

teste('realizado e projetado não se misturam, e o total é a soma', () => {
  const regs = [
    { tipo: 'entrada', valor: 500, status: 'pago', valor_liquidado: 500, data_liquidacao: '2026-07-10', data: '2026-07-05' },
    { tipo: 'entrada', valor: 300, status: 'aberto', data: '2026-08-20' },
    { tipo: 'saida',   valor: 200, status: 'pago', valor_liquidado: 200, data_liquidacao: '2026-07-15', data: '2026-07-15' },
    { tipo: 'saida',   valor: 100, status: 'aberto', data: '2026-08-25' },
  ]
  const ag = A.agregarPeriodo(regs, PERIODO)
  eq(ag.realizado, { entradas: 500, saidas: 200, liquido: 300 }, 'realizado: ')
  eq(ag.projetado, { entradas: 300, saidas: 100, liquido: 200 }, 'projetado: ')
  eq(ag.total,     { entradas: 800, saidas: 300, liquido: 500 }, 'total: ')
})

teste('[TRAVA] vencido não liquidado fica fora de realizado E de projetado', () => {
  // Não movimentou caixa e não vai movimentar na data em que está.
  const regs = [{ tipo: 'saida', valor: 90000, status: 'aberto', data: '2026-07-05' }]
  const ag = A.agregarPeriodo(regs, PERIODO)
  eq(ag.realizado.saidas, 0, 'realizado: '); eq(ag.projetado.saidas, 0, 'projetado: ')
  eq(ag.contagem, 1, 'contagem: ')   // continua contado como registro
})

// ─── 3. Recorte de período ───────────────────────────────────────────────────
teste('efeito fora do intervalo é ignorado, mesmo com o título dentro', () => {
  // Vence em julho mas foi pago em setembro: o caixa é de setembro
  const regs = [{ tipo: 'entrada', valor: 100, status: 'pago', valor_liquidado: 100, data_liquidacao: '2026-09-15', data: '2026-07-20' }]
  eq(A.agregarPeriodo(regs, PERIODO).realizado.entradas, 0, 'entradas: ')
  eq(A.agregarPeriodo(regs, { de: '2026-09-01', ate: '2026-09-30', hoje: HOJE }).realizado.entradas, 100, 'setembro: ')
})

teste('limites do intervalo são inclusivos nas duas pontas', () => {
  const mk = (d) => ({ tipo: 'entrada', valor: 10, status: 'pago', valor_liquidado: 10, data_liquidacao: d, data: d })
  const ag = A.agregarPeriodo([mk('2026-07-01'), mk('2026-08-31')], PERIODO)
  eq(ag.realizado.entradas, 20)
})

// ─── 4. Sinalizações ─────────────────────────────────────────────────────────
teste('pago sem data de liquidação é contado como aproximado', () => {
  const regs = [{ tipo: 'entrada', valor: 100, status: 'pago', valor_liquidado: 100, data: '2026-07-10' }]
  const ag = A.agregarPeriodo(regs, PERIODO)
  eq(ag.aproximados, 1, 'aproximados: '); eq(ag.realizado.entradas, 100, 'entradas: ')
})

teste('tipo desconhecido é contado e nunca somado', () => {
  const regs = [{ tipo: 'aporte_socio', valor: 5000, status: 'pago', valor_liquidado: 5000, data_liquidacao: '2026-07-10', data: '2026-07-10' }]
  const ag = A.agregarPeriodo(regs, PERIODO)
  eq(ag.semSinal, 1, 'semSinal: ')
  eq(ag.total, { entradas: 0, saidas: 0, liquido: 0 }, 'total: ')
})

teste('cancelado não gera efeito', () => {
  const regs = [{ tipo: 'saida', valor: 1000, status: 'cancelado', data: '2026-07-10' }]
  eq(A.agregarPeriodo(regs, PERIODO).total, { entradas: 0, saidas: 0, liquido: 0 })
})

teste('lista vazia devolve zeros, não NaN', () => {
  const ag = A.agregarPeriodo([], PERIODO)
  eq(ag.total, { entradas: 0, saidas: 0, liquido: 0 }); eq(ag.contagem, 0)
})


// ─── 5. Coerência do saldo final entre períodos ──────────────────────────────
// A revisão do Controller em 28/08 apontou: ao trocar o período, o saldo de
// partida muda e o número final parecia inconsistente. A partida DEVE mudar
// (é a âncora rolada até a véspera), mas o SALDO FINAL numa mesma data-fim tem
// de ser idêntico, qualquer que seja a data de início. É o teste que prova a
// composição — e que falhava enquanto os KPIs somavam valor de título e a
// partida usava caixa efetivo.
teste('[TRAVA] saldo final é o mesmo, comece o período onde começar', () => {
  const regs = [
    { tipo: 'entrada', valor: 500, status: 'pago', valor_liquidado: 500, data_liquidacao: '2026-07-10', data: '2026-07-05' },
    { tipo: 'saida',   valor: 800, status: 'pago', valor_liquidado: 800, data_liquidacao: '2026-07-20', data: '2026-07-20' },
    { tipo: 'entrada', valor: 300, status: 'pago', valor_liquidado: 300, data_liquidacao: '2026-08-11', data: '2026-08-11' },
    { tipo: 'saida',   valor: 150, status: 'pago', valor_liquidado: 150, data_liquidacao: '2026-08-12', data: '2026-08-12' },
  ]
  const ANCORA = 1000

  // Período A: 01/07 a 31/08 — partida é a própria âncora
  const agA = A.agregarPeriodo(regs, { de: '2026-07-01', ate: '2026-08-31', hoje: HOJE })
  const finalA = ANCORA + agA.realizado.liquido

  // Período B: 01/08 a 31/08 — partida = âncora + movimento de julho
  const julho = A.agregarPeriodo(regs, { de: '2026-07-01', ate: '2026-07-31', hoje: HOJE })
  const partidaB = ANCORA + julho.realizado.liquido
  const agB = A.agregarPeriodo(regs, { de: '2026-08-01', ate: '2026-08-31', hoje: HOJE })
  const finalB = partidaB + agB.realizado.liquido

  eq(finalA, 850, 'final jul-ago: ')
  eq(finalB, 850, 'final ago: ')
  eq(finalA, finalB, 'coerência entre períodos: ')
})

teste('[REGRESSÃO] misturar valor de título com borderô quebra a coerência', () => {
  // Reproduz o defeito: um título pago de 1.000 com borderô de 900. Somando o
  // valor do TÍTULO no período e o valor do BORDERÔ na partida, os dois
  // caminhos divergem exatamente na diferença — 100.
  const reg = { tipo: 'saida', valor: 1000, status: 'pago', valor_liquidado: 900, data_liquidacao: '2026-07-10', data: '2026-07-10' }
  const efetivo = A.agregarPeriodo([reg], { de: '2026-07-01', ate: '2026-07-31', hoje: HOJE }).realizado.saidas
  const porTitulo = Number(reg.valor)          // base ANTIGA dos KPIs
  eq(efetivo, 900, 'base correta: ')
  eq(porTitulo - efetivo, 100, 'divergência que o defeito produzia: ')
})

// ─── Execução ────────────────────────────────────────────────────────────────
for (const [nome, fn] of testes) {
  try { await fn(); ok++; console.log(`  ok   ${nome}`) }
  catch (e) { falhou++; console.log(`  FALHA ${nome}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
