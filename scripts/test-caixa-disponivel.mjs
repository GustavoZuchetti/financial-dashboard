// ─── test-caixa-disponivel.mjs ───────────────────────────────────────────────
// Trava a composição do "Caixa Disponível" e do "Runway" na Visão Geral.
//
// O defeito (verificado em produção em 11/09/2026): a Overview somava TODO
// efeito de caixa no saldo acumulado, sem separar realizado de projetado, e
// pegava o ÚLTIMO ponto da série — que num período YTD vai até dezembro.
//
//     Caixa Disponível exibido ....  R$ 1.310.000
//     A Receber · 30 dias .........  R$ 1.540.000
//     Caixa real no banco .........  R$    22.000
//
// Erro de ~60 vezes. E o Runway saía em 3,9 meses quando a autonomia real,
// com burn de R$ 334 mil/mês, era de dias.
//
// Runway é o indicador que responde "quanto tempo a empresa sobrevive".
// Errá-lo nessa margem, na primeira tela que o investidor abre, é a pior
// falha possível num painel financeiro.
//
// O campo `origem` que distingue os dois existe em efeitosCaixa desde o PR #12.
// Esta tela nunca passou a usá-lo.
//
// Execução:  node scripts/test-caixa-disponivel.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copia = join(raiz, 'lib', `.fluxo-status.teste.${process.pid}.mjs`)
writeFileSync(copia, readFileSync(join(raiz, 'lib', 'fluxo-status.js'), 'utf8'))
const limpar = () => { try { rmSync(copia, { force: true }) } catch {} }
process.on('exit', limpar)
const FS = await import(pathToFileURL(copia).href)

// ── Réplica da composição implementada em OverviewContent ───────────────────
export function comporCaixa({ registros, saldoBase, de, ate, hoje }) {
  const porMes = {}
  for (const f of registros) {
    for (const e of FS.efeitosCaixa(f, hoje)) {
      if (e.data < de || e.data > ate) continue
      const m = Number(e.data.slice(5, 7)) - 1
      if (!porMes[m]) porMes[m] = { ent: 0, sai: 0, entP: 0, saiP: 0 }
      const proj = e.origem === 'projetado'
      const entrada = FS.ENTRADA_TIPOS.includes(f.tipo)
      if (entrada) porMes[m][proj ? 'entP' : 'ent'] += e.valor
      else         porMes[m][proj ? 'saiP' : 'sai'] += e.valor
    }
  }
  const mesIni = Number(de.slice(5, 7)) - 1
  const mesFim = Number(ate.slice(5, 7)) - 1
  const mesHoje = Number(hoje.slice(5, 7)) - 1
  let saldo = saldoBase, saldoProj = saldoBase
  const serie = []
  for (let m = mesIni; m <= mesFim; m++) {
    const fc = porMes[m] || { ent: 0, sai: 0, entP: 0, saiP: 0 }
    saldo     += fc.ent - fc.sai
    saldoProj += (fc.ent + fc.entP) - (fc.sai + fc.saiP)
    serie.push({ mes: m, saldo: Math.round(saldo * 100) / 100, saldoProj: Math.round(saldoProj * 100) / 100 })
  }
  const ateHoje = serie.filter(p => p.mes <= mesHoje)
  return {
    caixa: ateHoje.length ? ateHoje[ateHoje.length - 1].saldo : saldoBase,
    caixaProjetado: serie.length ? serie[serie.length - 1].saldoProj : saldoBase,
    serie,
  }
}

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}

const HOJE = '2026-09-11'
const pago   = (tipo, d, v) => ({ tipo, valor: v, data: d, status: 'pago', valor_liquidado: v, data_liquidacao: d })
const vencer = (tipo, d, v) => ({ tipo, valor: v, data: d, status: 'aberto' })

// ─── 1. O defeito central ────────────────────────────────────────────────────
teste('[TRAVA] título a vencer NÃO entra no caixa disponível', () => {
  const r = comporCaixa({
    registros: [pago('entrada', '2026-07-10', 100), vencer('entrada', '2026-09-30', 1540)],
    saldoBase: 22, de: '2026-01-01', ate: '2026-12-31', hoje: HOJE,
  })
  eq(r.caixa, 122, 'caixa: ')
  if (r.caixa > 1000) throw new Error('voltou a somar o projetado no caixa')
})

teste('[REGRESSÃO] somando tudo, o caixa inflava (o defeito real)', () => {
  // Reproduz: todo efeito no mesmo balde + último ponto da série
  const regs = [pago('entrada', '2026-07-10', 100), vencer('entrada', '2026-09-30', 1540)]
  let total = 22
  for (const f of regs) for (const e of FS.efeitosCaixa(f, HOJE)) total += e.valor
  eq(total, 1662, 'comportamento antigo: ')
})

teste('o projetado continua visível, em campo próprio', () => {
  const r = comporCaixa({
    registros: [pago('entrada', '2026-07-10', 100), vencer('entrada', '2026-09-30', 1540)],
    saldoBase: 22, de: '2026-01-01', ate: '2026-12-31', hoje: HOJE,
  })
  eq(r.caixaProjetado, 1662, 'projeção do período: ')
})

// ─── 2. Recorte temporal ─────────────────────────────────────────────────────
teste('[TRAVA] meses FUTUROS do período não entram no caixa de hoje', () => {
  // YTD vai até dezembro; o caixa é a posição de HOJE (setembro)
  const r = comporCaixa({
    registros: [pago('saida', '2026-11-20', 500)],   // liquidado em novembro
    saldoBase: 1000, de: '2026-01-01', ate: '2026-12-31', hoje: HOJE,
  })
  eq(r.caixa, 1000, 'caixa em setembro: ')
  eq(r.caixaProjetado, 500, 'projeção até dezembro: ')
})

teste('vencido não liquidado fica fora dos dois', () => {
  const r = comporCaixa({
    registros: [vencer('saida', '2026-07-05', 900)],   // venceu e não pagou
    saldoBase: 1000, de: '2026-01-01', ate: '2026-12-31', hoje: HOJE,
  })
  eq(r.caixa, 1000, 'caixa: '); eq(r.caixaProjetado, 1000, 'projeção: ')
})

// ─── 3. Runway ───────────────────────────────────────────────────────────────
export const runway = (caixa, burn) => (burn > 0 && caixa > 0) ? caixa / burn : null
export const rotulo = (r) => r == null ? '—' : (r < 1 ? `${Math.round(r * 30)} dias` : `${r.toFixed(1)} meses`)

teste('[TRAVA] runway sobre o caixa REAL, não sobre o inflado', () => {
  const burn = 334100
  eq(rotulo(runway(1310000, burn)), '3.9 meses', 'com caixa inflado: ')
  eq(rotulo(runway(22000, burn)),   '2 dias',    'com caixa real: ')
})

teste('runway abaixo de um mês é expresso em DIAS', () => {
  // "0.1 meses" não comunica urgência; "2 dias" comunica
  eq(rotulo(runway(22000, 334100)), '2 dias')
  eq(rotulo(runway(400000, 334100)), '1.2 meses')
})

teste('caixa negativo ou burn zero não produz runway', () => {
  eq(runway(-5000, 334100), null, 'caixa negativo: ')
  eq(runway(22000, 0), null, 'sem burn: ')
})

// ─── 4. Cenário real da Facesign ─────────────────────────────────────────────
teste('[CENÁRIO] o caso medido em 11/09', () => {
  // Âncora consolidada + um recebimento realizado + a receber de 30 dias
  const r = comporCaixa({
    registros: [
      pago('entrada', '2026-08-15', 300000),
      pago('saida',   '2026-08-20', 299978),
      vencer('entrada', '2026-09-25', 1540000),   // A Receber · 30 dias
    ],
    saldoBase: 22000, de: '2026-01-01', ate: '2026-12-31', hoje: HOJE,
  })
  eq(r.caixa, 22022, 'caixa disponível: ')
  eq(r.caixaProjetado, 1562022, 'projeção: ')
  if (r.caixa > 100000) throw new Error('o recebível voltou para dentro do caixa')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
