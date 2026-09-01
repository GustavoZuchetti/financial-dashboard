// ─── test-valor-liquidado.mjs ────────────────────────────────────────────────
// Trava a composição de `valor_liquidado` em montarRegistrosFluxo.
//
// Dois cenários reais quebravam a leitura do borderô:
//
//  a) BORDERÔ COMPARTILHADO — uma guia única quita vários títulos
//     (parcelamentos da Receita Federal). O borderô traz o valor da GUIA
//     inteira. Medido em 31/07/2026: nove títulos com -1.553,63 idênticos,
//     onde o Bling tinha dezoito valores distintos.
//
//  b) MÚLTIPLOS BORDERÔS COM ESTORNO — retiradas parciais estornadas e
//     reclassificadas, título quitado integralmente depois. Lendo só o último
//     borderô pegava-se o errado. Caso ALEXANDRE FRANCISCO, título 1414/11 de
//     10/07/2026: valor 22.000, gravado como 5.000 — soma exata de três
//     retiradas parciais (2.000 + 2.000 + 1.000) que haviam sido estornadas.
//     Somar TODOS os borderôs também erraria: daria 27.000.
//
// Regra adotada: título integralmente pago na origem tem valor_liquidado igual
// ao VALOR DO TÍTULO. Nenhum borderô pode reduzi-lo.
//
// Execução:  node scripts/test-valor-liquidado.mjs

// Replica a regra aplicada em montarRegistrosFluxo, sem o I/O da API.
export function resolverLiquidado({ valor, status, saldo, borderoValorPago }) {
  let liquidado = null
  const sld = Number(saldo)
  if (Number.isFinite(sld) && sld > 0 && sld < valor) {
    status = 'parcial'
    liquidado = Number((valor - sld).toFixed(2))
  }
  const quitado = status === 'pago'
  if (['pago', 'parcial'].includes(status) && borderoValorPago != null) {
    if (!quitado && borderoValorPago && !(Number.isFinite(sld) && sld > 0)) {
      liquidado = Math.min(borderoValorPago, valor)
    }
  }
  if (quitado) liquidado = valor
  return { status, valor_liquidado: liquidado }
}

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}

// ─── 1. O caso ALEXANDRE 1414/11 ─────────────────────────────────────────────
teste('[TRAVA] título quitado ignora borderô menor que o valor (caso 1414/11)', () => {
  // Borderô devolve 5.000 (retiradas parciais estornadas); título vale 22.000
  const r = resolverLiquidado({ valor: 22000, status: 'pago', saldo: 0, borderoValorPago: 5000 })
  eq(r.valor_liquidado, 22000, 'liquidado: ')
  if (r.valor_liquidado === 5000) throw new Error('voltou a confiar no borderô')
})

teste('[REGRESSÃO] a regra antiga gravaria 5.000 no título de 22.000', () => {
  const antigo = ({ valor, borderoValorPago }) => borderoValorPago || valor
  eq(antigo({ valor: 22000, borderoValorPago: 5000 }), 5000, 'comportamento antigo: ')
})

// ─── 2. Borderô compartilhado — Receita Federal ──────────────────────────────
teste('[TRAVA] guia compartilhada não replica o valor nos títulos quitados', () => {
  // Guia de 1.553,63 quitando três parcelas distintas
  const parcelas = [582.47, 297.74, 284.87]
  const out = parcelas.map(v => resolverLiquidado({
    valor: v, status: 'pago', saldo: 0, borderoValorPago: 1553.63 }).valor_liquidado)
  eq(out, parcelas, 'cada título com o seu valor: ')
  const soma = Math.round(out.reduce((a, b) => a + b, 0) * 100) / 100
  eq(soma, 1165.08, 'soma dos títulos: ')
  if (out.every(v => v === 1553.63)) throw new Error('replicou o valor da guia')
})

// ─── 3. Parciais continuam funcionando ───────────────────────────────────────
teste('parcial com saldo informado usa valor − saldo', () => {
  const r = resolverLiquidado({ valor: 1000, status: 'aberto', saldo: 300, borderoValorPago: null })
  eq(r.status, 'parcial', 'status: '); eq(r.valor_liquidado, 700, 'liquidado: ')
})

teste('parcial sem saldo cai no borderô, limitado ao valor do título', () => {
  const r = resolverLiquidado({ valor: 1000, status: 'parcial', saldo: null, borderoValorPago: 400 })
  eq(r.valor_liquidado, 400)
})

teste('[TRAVA] borderô nunca faz o liquidado exceder o valor do título', () => {
  // Borderô compartilhado num título PARCIAL: sem o teto, o liquidado passaria
  // do próprio título e o caixa ficaria inflado.
  const r = resolverLiquidado({ valor: 1000, status: 'parcial', saldo: null, borderoValorPago: 8000 })
  eq(r.valor_liquidado, 1000)
})

teste('saldo igual ao valor não marca parcial (nada foi pago)', () => {
  const r = resolverLiquidado({ valor: 1000, status: 'aberto', saldo: 1000, borderoValorPago: null })
  eq(r.status, 'aberto', 'status: '); eq(r.valor_liquidado, null, 'liquidado: ')
})

// ─── 4. Bordas ───────────────────────────────────────────────────────────────
teste('pago sem borderô continua com o valor do título', () => {
  eq(resolverLiquidado({ valor: 350, status: 'pago', saldo: 0, borderoValorPago: null }).valor_liquidado, 350)
})

teste('aberto não recebe valor liquidado', () => {
  eq(resolverLiquidado({ valor: 900, status: 'aberto', saldo: null, borderoValorPago: null }).valor_liquidado, null)
})

teste('saldo negativo ou inválido é ignorado', () => {
  eq(resolverLiquidado({ valor: 500, status: 'pago', saldo: -10, borderoValorPago: null }).valor_liquidado, 500)
  eq(resolverLiquidado({ valor: 500, status: 'pago', saldo: 'x', borderoValorPago: null }).valor_liquidado, 500)
})

teste('[CENÁRIO] Alexandre julho: 5.000 em parciais + 22.000 integral = 27.000', () => {
  // As três retiradas são títulos PRÓPRIOS, quitados. O 1414/11 é separado.
  const parciais = [2000, 2000, 1000].map(v =>
    resolverLiquidado({ valor: v, status: 'pago', saldo: 0, borderoValorPago: v }).valor_liquidado)
  const integral = resolverLiquidado({ valor: 22000, status: 'pago', saldo: 0, borderoValorPago: 5000 }).valor_liquidado
  eq(parciais.reduce((a, b) => a + b, 0), 5000, 'soma das parciais: ')
  eq(integral, 22000, 'título integral: ')
  eq(parciais.reduce((a, b) => a + b, 0) + integral, 27000, 'total pago ao sócio: ')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
