// ─── test-saldo-abertura.mjs ─────────────────────────────────────────────────
// Trava a semântica da data de corte. O que estes testes protegem:
//   · data_corte é a ABERTURA do dia — movimentos do próprio dia contam;
//   · NADA anterior à data de corte é somado, jamais (a causa raiz do buraco
//     de milhões e da divergência entre as três telas);
//   · sem âncora, o saldo é NULO — nunca zero, nunca palpite;
//   · a âncora vigente é a de maior data_corte que não ultrapassa a data,
//     o que faz o fechamento mensal funcionar sem código novo;
//   · fechamento[n] === abertura[n+1] na conferência mensal.
//
// Execução:  node scripts/test-saldo-abertura.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// package.json não declara "type": "module" — importamos cópias .mjs fiéis dos
// fontes reais (não há reimplementação de lógica aqui). Removidas ao final.
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

await importar('fluxo-status.js')
const S = await importar('saldo-abertura.js')

let ok = 0, falhou = 0
const testes = []
const teste = (nome, fn) => testes.push([nome, fn])
function eq(atual, esperado, ctx = '') {
  const a = JSON.stringify(atual), e = JSON.stringify(esperado)
  if (a !== e) throw new Error(`${ctx}esperado ${e}, recebido ${a}`)
}

const HOJE = '2026-08-12'
// Registro liquidado: entra na data de liquidação pelo valor do borderô
const pago = (tipo, data_liquidacao, valor) =>
  ({ tipo, valor, data: data_liquidacao, status: 'pago', valor_liquidado: valor, data_liquidacao })
// Título em aberto com vencimento futuro: entra pelo vencimento
const aVencer = (tipo, data, valor) => ({ tipo, valor, data, status: 'aberto' })

const ancora = (data_corte, valor, extra = {}) =>
  ({ id: `a-${data_corte}`, empresa_id: 'e1', data_corte, valor, origem: 'extrato_bancario', ...extra })

// ─── 1. Âncora vigente ───────────────────────────────────────────────────────
const tres = [ancora('2026-01-01', 76729.38), ancora('2026-07-01', 499772), ancora('2026-04-01', 300000)]

teste('âncora vigente é a de maior data_corte que não ultrapassa a data', () => {
  eq(S.ancoraVigente(tres, '2026-07-31').data_corte, '2026-07-01')
  eq(S.ancoraVigente(tres, '2026-06-30').data_corte, '2026-04-01')
  eq(S.ancoraVigente(tres, '2026-02-15').data_corte, '2026-01-01')
})
teste('na própria data de corte, a âncora daquele dia já é a vigente', () => {
  eq(S.ancoraVigente(tres, '2026-07-01').data_corte, '2026-07-01')
})
teste('antes de qualquer âncora, não há vigente', () => {
  eq(S.ancoraVigente(tres, '2025-12-31'), null)
})

// ─── 2. Regra de silêncio ────────────────────────────────────────────────────
teste('[TRAVA] sem âncora o saldo é NULO, nunca zero', () => {
  const r = S.saldoEm({ ancoras: [], registros: [pago('saida', '2026-07-10', 500)], data: HOJE })
  eq(r.ok, false, 'ok: '); eq(r.saldo, null, 'saldo: '); eq(r.motivo, 'sem_ancora', 'motivo: ')
})

// ─── 3. O CORTE — a correção central ─────────────────────────────────────────
const comPassado = [
  pago('saida',   '2019-03-01', 8_000_000),   // base pré-corte incompleta:
  pago('entrada', '2025-11-20', 250000),      // é ela que gerava o buraco
  pago('entrada', '2026-07-05', 100000),
  pago('saida',   '2026-07-20', 40000),
]

teste('[TRAVA] movimentos anteriores à data de corte NÃO entram no saldo', () => {
  const r = S.saldoEm({ ancoras: [ancora('2026-07-01', 499772)], registros: comPassado, data: '2026-07-31', hoje: HOJE })
  eq(r.saldo, 559772, 'saldo: ')   // 499.772 + 100.000 − 40.000
})

teste('[REGRESSÃO] somar o histórico inteiro produziria o buraco de milhões', () => {
  // Comportamento ANTIGO, para contraste: sem recorte inferior o saldo despenca
  const semCorte = S.movimentoEfetivo(comPassado, { de: null, ate: '2026-07-31', hoje: HOJE })
  eq(semCorte.liquido, -7690000, 'líquido sem corte: ')
  const comCorte = S.movimentoEfetivo(comPassado, { de: '2026-07-01', ate: '2026-07-31', hoje: HOJE })
  eq(comCorte.liquido, 60000, 'líquido com corte: ')
})

teste('excluidoPeloCorte revela exatamente o que ficou de fora', () => {
  const x = S.excluidoPeloCorte({ registros: comPassado, dataCorte: '2026-07-01', hoje: HOJE })
  eq(x.entradas, 250000, 'entradas: '); eq(x.saidas, 8000000, 'saídas: ')
  eq(x.ate, '2026-06-30', 'até: ')
})

// ─── 4. Semântica de abertura do dia ─────────────────────────────────────────
teste('[TRAVA] movimento NA data de corte conta (é abertura, não fechamento)', () => {
  const regs = [pago('entrada', '2026-07-01', 1000)]
  const r = S.saldoEm({ ancoras: [ancora('2026-07-01', 499772)], registros: regs, data: '2026-07-01', hoje: HOJE })
  eq(r.saldo, 500772, 'saldo: ')
})

teste('saldo de partida no dia do corte é a própria âncora, sem soma', () => {
  const regs = [pago('entrada', '2026-07-01', 1000)]
  const r = S.saldoDePartida({ ancoras: [ancora('2026-07-01', 499772)], registros: regs, inicioPeriodo: '2026-07-01', hoje: HOJE })
  eq(r.saldo, 499772, 'saldo: '); eq(r.liquido, 0, 'líquido: ')
})

teste('saldo de partida exclui o dia de início (ele pertence ao período)', () => {
  const regs = [pago('entrada', '2026-07-05', 100000), pago('saida', '2026-07-20', 40000)]
  const r = S.saldoDePartida({ ancoras: [ancora('2026-07-01', 499772)], registros: regs, inicioPeriodo: '2026-07-20', hoje: HOJE })
  eq(r.saldo, 599772, 'saldo: ')   // só a entrada de 05/07
})

// ─── 5. Cenário real da Facesign ─────────────────────────────────────────────
teste('julho/2026: 499.772 na abertura, 209.627 em 31/07', () => {
  const regs = [pago('entrada', '2026-07-10', 300000), pago('saida', '2026-07-25', 590145)]
  const r = S.saldoEm({ ancoras: [ancora('2026-07-01', 499772)], registros: regs, data: '2026-07-31', hoje: HOJE })
  eq(r.saldo, 209627, 'saldo: ')
  const c = S.conferir({ calculado: r.saldo, declarado: 209627 })
  eq(c.fecha, true, 'fecha: '); eq(c.diferenca, 0, 'diferença: ')
})

teste('conferir aponta a diferença quando não fecha', () => {
  eq(S.conferir({ calculado: 209627, declarado: 200000 }).diferenca, 9627)
  eq(S.conferir({ calculado: 209627, declarado: 200000 }).fecha, false)
  eq(S.conferir({ calculado: 100.004, declarado: 100, tolerancia: 0.01 }).fecha, true)
})

// ─── 6. Série diária ─────────────────────────────────────────────────────────
teste('série diária cobre TODOS os dias, inclusive os sem movimento', () => {
  const regs = [pago('saida', '2026-07-03', 200)]
  const s = S.serieDiaria({ ancoras: [ancora('2026-07-01', 1000)], registros: regs, de: '2026-07-01', ate: '2026-07-05', hoje: HOJE })
  eq(s.dias.length, 5, 'dias: ')
  eq(s.dias.map(d => d.fechamento), [1000, 1000, 800, 800, 800], 'fechamentos: ')
})

teste('série diária: abertura de cada dia é o fechamento do anterior', () => {
  const regs = [pago('entrada', '2026-07-02', 50), pago('saida', '2026-07-04', 30)]
  const s = S.serieDiaria({ ancoras: [ancora('2026-07-01', 100)], registros: regs, de: '2026-07-01', ate: '2026-07-05', hoje: HOJE })
  for (let i = 1; i < s.dias.length; i++) eq(s.dias[i].abertura, s.dias[i - 1].fechamento, `dia ${i}: `)
})

teste('série diária atravessa a virada do mês corretamente', () => {
  const regs = [pago('saida', '2026-07-31', 10), pago('saida', '2026-08-01', 5)]
  const s = S.serieDiaria({ ancoras: [ancora('2026-07-30', 100)], registros: regs, de: '2026-07-30', ate: '2026-08-02', hoje: HOJE })
  eq(s.dias.map(d => d.data), ['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02'], 'datas: ')
  eq(s.fechamento, 85, 'fechamento: ')
})

// ─── 7. Conferência mensal ───────────────────────────────────────────────────
teste('[TRAVA] fechamento de um mês é a abertura do seguinte', () => {
  const regs = [pago('entrada', '2026-07-10', 500), pago('saida', '2026-08-05', 200), pago('saida', '2026-09-01', 50)]
  const m = S.resumoMensal({ ancoras: [ancora('2026-07-01', 1000)], registros: regs, de: '2026-07-01', ate: '2026-09-30', hoje: HOJE })
  eq(m.meses.map(x => x.mes), ['2026-07', '2026-08', '2026-09'], 'meses: ')
  for (let i = 1; i < m.meses.length; i++) eq(m.meses[i].abertura, m.meses[i - 1].fechamento, `mês ${i}: `)
  eq(m.meses[0].fechamento, 1500, 'jul: '); eq(m.meses[2].fechamento, 1250, 'set: ')
})

// ─── 8. Integração com a regra de caixa efetivo ──────────────────────────────
teste('vencido não liquidado fica FORA do saldo (não movimentou caixa)', () => {
  const regs = [aVencer('saida', '2026-07-05', 900)]   // vencimento passado, em aberto
  const r = S.saldoEm({ ancoras: [ancora('2026-07-01', 1000)], registros: regs, data: '2026-07-31', hoje: HOJE })
  eq(r.saldo, 1000, 'saldo: ')
})

teste('a vencer futuro entra pelo vencimento (visão de caixa projetado)', () => {
  const regs = [aVencer('saida', '2026-09-10', 900)]
  const r = S.saldoEm({ ancoras: [ancora('2026-07-01', 1000)], registros: regs, data: '2026-09-30', hoje: HOJE })
  eq(r.saldo, 100, 'saldo: ')
})

teste('tipo desconhecido é CONTADO e nunca somado', () => {
  const regs = [{ tipo: 'aporte_socio', valor: 500, data: '2026-07-10', status: 'pago', valor_liquidado: 500, data_liquidacao: '2026-07-10' }]
  const r = S.saldoEm({ ancoras: [ancora('2026-07-01', 1000)], registros: regs, data: '2026-07-31', hoje: HOJE })
  eq(r.saldo, 1000, 'saldo: '); eq(r.semSinal, 1, 'semSinal: ')
})

// ─── 9. Consolidação — o consolidado é soma, nunca âncora única ──────────────
const grupo = (fa, ja, jb) => [
  { empresa_id: 'face', nome: 'FACE', ancoras: fa },
  { empresa_id: 'jam',  nome: 'JAM',  ancoras: ja },
  { empresa_id: 'jb',   nome: 'JB',   ancoras: jb },
]

teste('consolidado é a soma das âncoras vigentes por entidade', () => {
  const c = S.consolidarAncoras({
    entidades: grupo([ancora('2026-07-01', 380000)], [ancora('2026-07-01', 89772)], [ancora('2026-07-01', 30000)]),
    data: '2026-07-01',
  })
  eq(c.ok, true, 'ok: '); eq(c.total, 499772, 'total: ')
})

teste('[TRAVA] uma entidade sem âncora anula o consolidado inteiro', () => {
  // Consolidado parcial subestima o caixa — nunca pode chegar a investidor
  const c = S.consolidarAncoras({
    entidades: grupo([ancora('2026-07-01', 380000)], [], [ancora('2026-07-01', 30000)]),
    data: '2026-07-01',
  })
  eq(c.ok, false, 'ok: '); eq(c.total, null, 'total: ')
  eq(c.faltando.map(f => f.nome), ['JAM'], 'faltando: ')
})

teste('consolidação sinaliza âncoras ainda não certificadas', () => {
  const c = S.consolidarAncoras({
    entidades: grupo(
      [ancora('2026-07-01', 380000, { conciliado_em: '2026-08-12T10:00:00Z' })],
      [ancora('2026-07-01', 89772)],
      [ancora('2026-07-01', 30000, { conciliado_em: '2026-08-12T10:00:00Z' })]),
    data: '2026-07-01',
  })
  eq(c.naoCertificadas, ['JAM'], 'não certificadas: ')
})

teste('a soma das entidades tem de bater com o consolidado declarado', () => {
  const c = S.consolidarAncoras({
    entidades: grupo([ancora('2026-07-01', 380000)], [ancora('2026-07-01', 80000)], [ancora('2026-07-01', 30000)]),
    data: '2026-07-01',
  })
  const check = S.conferir({ calculado: c.total, declarado: 499772 })
  eq(check.fecha, false, 'fecha: '); eq(check.diferenca, -9772, 'diferença: ')
})

teste('saldo consolidado numa data soma os saldos por entidade', () => {
  const ents = [
    { empresa_id: 'face', nome: 'FACE', ancoras: [ancora('2026-07-01', 380000)],
      registros: [pago('saida', '2026-07-15', 200000)] },
    { empresa_id: 'jam', nome: 'JAM', ancoras: [ancora('2026-07-01', 89772)],
      registros: [pago('saida', '2026-07-18', 70000)] },
    { empresa_id: 'jb', nome: 'JB', ancoras: [ancora('2026-07-01', 30000)],
      registros: [pago('saida', '2026-07-22', 20145)] },
  ]
  const r = S.saldoConsolidadoEm({ entidades: ents, data: '2026-07-31', hoje: HOJE })
  eq(r.ok, true, 'ok: '); eq(r.saldo, 209627, 'saldo: ')
  eq(S.conferir({ calculado: r.saldo, declarado: 209627 }).fecha, true, 'fecha com o extrato: ')
})

teste('[TRAVA] saldo consolidado é NULO se qualquer entidade não tiver âncora', () => {
  const ents = [
    { empresa_id: 'face', nome: 'FACE', ancoras: [ancora('2026-07-01', 380000)], registros: [] },
    { empresa_id: 'jam',  nome: 'JAM',  ancoras: [], registros: [pago('saida', '2026-07-18', 70000)] },
  ]
  const r = S.saldoConsolidadoEm({ entidades: ents, data: '2026-07-31', hoje: HOJE })
  eq(r.ok, false, 'ok: '); eq(r.saldo, null, 'saldo: ')
  eq(r.faltando.map(f => f.nome), ['JAM'], 'faltando: ')
})

// ─── 10. Saldo de partida consolidado — o que as três telas consomem ─────────
teste('saldo de partida consolidado soma as âncoras e o movimento até a véspera', () => {
  const ents = [
    { empresa_id: 'face', nome: 'FACE', ancoras: [ancora('2026-01-01', 60000)],
      registros: [pago('entrada', '2026-03-10', 20000)] },
    { empresa_id: 'jam', nome: 'JAM', ancoras: [ancora('2026-01-01', 10000)],
      registros: [pago('saida', '2026-02-05', 4000)] },
  ]
  const r = S.saldoDePartidaConsolidado({ entidades: ents, inicioPeriodo: '2026-07-01', hoje: HOJE })
  eq(r.ok, true, 'ok: '); eq(r.saldo, 86000, 'saldo: ')
})

teste('[TRAVA] partida consolidada é NULA se uma entidade não tiver âncora', () => {
  const ents = [
    { empresa_id: 'face', nome: 'FACE', ancoras: [ancora('2026-01-01', 60000)], registros: [] },
    { empresa_id: 'jb',   nome: 'JB',   ancoras: [], registros: [] },
  ]
  const r = S.saldoDePartidaConsolidado({ entidades: ents, inicioPeriodo: '2026-07-01', hoje: HOJE })
  eq(r.ok, false, 'ok: '); eq(r.saldo, null, 'saldo: ')
  eq(r.faltando.map(f => f.nome), ['JB'], 'faltando: ')
})

teste('[TRAVA] cada entidade usa a PRÓPRIA âncora, nunca a de outra', () => {
  // Se as âncoras vazassem entre entidades, FACE aplicaria a de JAM e o total
  // continuaria "certo" por acaso — este teste separa os movimentos para pegar isso
  const ents = [
    { empresa_id: 'face', nome: 'FACE', ancoras: [ancora('2026-06-01', 1000)],
      registros: [pago('saida', '2026-05-15', 999999)] },   // ANTES do corte da FACE: ignorado
    { empresa_id: 'jam', nome: 'JAM', ancoras: [ancora('2026-05-01', 500)],
      registros: [pago('saida', '2026-05-15', 100)] },      // DEPOIS do corte da JAM: conta
  ]
  const r = S.saldoDePartidaConsolidado({ entidades: ents, inicioPeriodo: '2026-07-01', hoje: HOJE })
  eq(r.saldo, 1400, 'saldo: ')   // 1000 + (500 − 100)
})

teste('agruparPorEmpresa separa os registros de uma consulta única', () => {
  const regs = [
    { empresa_id: 'a', tipo: 'entrada', valor: 1, data: '2026-07-01', status: 'aberto' },
    { empresa_id: 'b', tipo: 'saida',   valor: 2, data: '2026-07-01', status: 'aberto' },
    { empresa_id: 'a', tipo: 'saida',   valor: 3, data: '2026-07-01', status: 'aberto' },
    { tipo: 'saida', valor: 4, data: '2026-07-01', status: 'aberto' },   // sem empresa_id: descartado
  ]
  const m = S.agruparPorEmpresa(regs)
  eq(Object.keys(m).sort(), ['a', 'b'], 'chaves: ')
  eq(m.a.length, 2, 'a: '); eq(m.b.length, 1, 'b: ')
})

teste('montarEntidades entrega âncoras e registros já separados por entidade', () => {
  const ents = S.montarEntidades({
    empIds: ['a', 'b'],
    nomes: { a: 'FACE', b: 'JAM' },
    ancoras: [ancora('2026-07-01', 100), { ...ancora('2026-07-01', 200), empresa_id: 'a' }],
    registros: [{ empresa_id: 'a', tipo: 'entrada', valor: 5, data: '2026-07-02', status: 'aberto' }],
  })
  eq(ents.map(e => e.nome), ['FACE', 'JAM'], 'nomes: ')
  eq(ents[0].ancoras.length, 1, 'âncoras de a: ')
  eq(ents[0].registros.length, 1, 'registros de a: ')
  eq(ents[1].registros.length, 0, 'registros de b: ')
})

// ─── 11. Leitura de valor digitado ───────────────────────────────────────────
teste('normalizarValor lê o formato brasileiro sem inverter milhar e decimal', () => {
  eq(S.normalizarValor('499.772,00'), 499772)
  eq(S.normalizarValor('R$ 1.234.567,89'), 1234567.89)
  eq(S.normalizarValor('499772.38'), 499772.38)
  eq(S.normalizarValor('499.772'), 499772)      // convenção BR de milhar
  eq(S.normalizarValor('209627'), 209627)
  eq(S.normalizarValor('-1.500,50'), -1500.5)
  eq(S.normalizarValor(499772.38), 499772.38)
  eq(S.normalizarValor(''), null)
  eq(S.normalizarValor('abc'), null)
})

// ─── 12. Datas ───────────────────────────────────────────────────────────────
teste('diaAnterior e proximoDia atravessam mês, ano e ano bissexto', () => {
  eq(S.diaAnterior('2026-08-01'), '2026-07-31')
  eq(S.diaAnterior('2026-01-01'), '2025-12-31')
  eq(S.proximoDia('2026-02-28'), '2026-03-01')
  eq(S.proximoDia('2028-02-28'), '2028-02-29')   // bissexto
  eq(S.proximoDia('2026-12-31'), '2027-01-01')
})

// ─── Execução ────────────────────────────────────────────────────────────────
for (const [nome, fn] of testes) {
  try { await fn(); ok++; console.log(`  ok   ${nome}`) }
  catch (e) { falhou++; console.log(`  FALHA ${nome}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
