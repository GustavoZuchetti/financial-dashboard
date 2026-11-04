// ─── test-valor-liquidado.mjs ────────────────────────────────────────────────
// Trava a liquidação pelos borderôs (regra 2, 03/11/2026 — substitui a ADR-004).
//
// A coleta de 31/10–02/11 (diagnóstico de borderôs) mostrou que:
//  · a lista `borderos` do título vem do MAIS RECENTE para o MAIS ANTIGO, e o
//    sistema lia `borderos[length-1]` — o primeiro pagamento. FGTS pago em
//    16/01 e 20/02 ficava em 16/01; ALEXANDRE pago em quatro vezes de 24/03 a
//    16/04 ficava em 24/03;
//  · pagamento estornado sai da lista;
//  · cada borderô traz pagamentos[] com valorPago e juros, sem o id do título;
//    na baixa agrupada o item do título se reconhece por numeroDocumento ou
//    por contato e valor.
// Regra (opção A do Controller): data = pagamento mais recente; valor = soma
// do pago pelo título, com juros — o que o relatório de pagamentos do Bling
// mostra. Os exemplos abaixo são FICTÍCIOS na estrutura do JSON coletado.
//
// Execução:  node scripts/test-valor-liquidado.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

process.env.BLING_API_BASE = 'https://bling.test/Api/v3'
process.env.BLING_RATE_MIN_MS = '1'
process.env.BLING_BACKOFF_GATEWAY_MS = '1'
process.env.BLING_BACKOFF_RATE_MS = '1'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copiaRec = join(raiz, 'lib', `.bling-reconferencia.liq.${process.pid}.mjs`)
const copiaSrv = join(raiz, 'lib', `.bling-server.liq.${process.pid}.mjs`)
writeFileSync(copiaRec, readFileSync(join(raiz, 'lib', 'bling-reconferencia.js'), 'utf8'))
writeFileSync(copiaSrv, readFileSync(join(raiz, 'lib', 'bling-server.js'), 'utf8')
  .replace(/from '\.\/bling-reconferencia'/g, `from './.bling-reconferencia.liq.${process.pid}.mjs'`))
const limpar = () => { for (const f of [copiaRec, copiaSrv]) { try { rmSync(f, { force: true }) } catch {} } }
process.on('exit', limpar)
const R = await import(pathToFileURL(copiaRec).href)
const S = await import(pathToFileURL(copiaSrv).href)

const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const fonte = (rel) => semComentarios(readFileSync(join(raiz, rel), 'utf8'))
const corpoDe = (src, nome) => {
  const i = src.indexOf(nome)
  if (i < 0) throw new Error(`"${nome}" não encontrado`)
  const m = /\r?\n\}\r?\n/.exec(src.slice(i))
  return m ? src.slice(i, i + m.index + 2) : src.slice(i)
}

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}

// Fábricas fictícias na forma do JSON do Bling
const pg = (valorPago, o = {}) => ({ valorPago, juros: 0, acrescimo: 0, desconto: 0, tarifa: 0,
  numeroDocumento: '', contato: { id: 1001 }, ...o })
const bd = (id, data, pagamentos) => ({ id: String(id), ok: true, dados: { id, data, historico: 'X', pagamentos } })
const conta = (valor, o = {}) => ({ valor, saldo: 0, numeroDocumento: '', contato: { id: 1001 }, ...o })
const liq = (c, status, borderos) => R.liquidacaoDoTitulo({ conta: c, status, borderos })

// ─── 1. Data: o pagamento mais recente ───────────────────────────────────────
teste('[TRAVA] pago em duas datas: vale a mais recente (caso FGTS 16/01 + 20/02)', () => {
  // Lista como o Bling devolve: mais recente primeiro
  const r = liq(conta(1000), 'pago', [bd(3, '2026-02-20', [pg(850)]), bd(2, '2026-01-16', [pg(80)]), bd(1, '2026-01-16', [pg(70)])])
  eq([r.data, r.valor_liquidado, r.confianca, r.regra], ['2026-02-20', 1000, 'total', 2])
})
teste('[TRAVA] a data não depende da ordem da lista', () => {
  const bs = [bd(1, '2026-03-24', [pg(200)]), bd(4, '2026-04-16', [pg(500)]), bd(2, '2026-03-27', [pg(100)]), bd(3, '2026-04-10', [pg(200)])]
  eq(liq(conta(1000), 'pago', bs).data, '2026-04-16')
  eq(liq(conta(1000), 'pago', [...bs].reverse()).data, '2026-04-16')
})
teste('pago em quatro vezes soma o título (caso ALEXANDRE)', () => {
  const r = liq(conta(22000), 'pago', [bd(4, '2026-04-16', [pg(9000)]), bd(3, '2026-04-10', [pg(10000)]),
    bd(2, '2026-03-27', [pg(1000)]), bd(1, '2026-03-24', [pg(2000)])])
  eq([r.data, r.valor_liquidado, r.pagamentos.length], ['2026-04-16', 22000, 4])
})

// ─── 2. Valor: o pago real, com juros ────────────────────────────────────────
teste('[TRAVA] juros entram no valor liquidado (caso SANTANDER)', () => {
  const r = liq(conta(500), 'pago', [bd(3, '2026-02-03', [pg(320, { juros: 20 })]), bd(2, '2026-01-27', [pg(100)]), bd(1, '2026-01-16', [pg(100)])])
  eq([r.valor_liquidado, r.data, r.confianca], [520, '2026-02-03', 'total'])
})
teste('[TRAVA] baixa agrupada: o item do título pelo contato e valor (caso Receita)', () => {
  const r = liq(conta(111.11, { contato: { id: 77 } }), 'pago', [bd(9, '2026-07-31', [
    pg(109.94, { contato: { id: 77 } }), pg(284.87, { contato: { id: 77 } }),
    pg(234.75, { juros: 123.64, contato: { id: 77 } }), pg(111.11, { contato: { id: 88 } })])])
  eq([r.valor_liquidado, r.confianca], [234.75, 'total'])
})
teste('baixa agrupada: o item do título pelo número do documento (caso FGTS 2685/1)', () => {
  const r = liq(conta(1000, { numeroDocumento: '2685/1' }), 'pago', [
    bd(3, '2026-03-20', [pg(900, { numeroDocumento: '2685/1' }), pg(5000), pg(900, { numeroDocumento: '2685/3' })]),
    bd(2, '2026-01-16', [pg(60, { numeroDocumento: '2685/1' })]), bd(1, '2026-01-16', [pg(40, { numeroDocumento: '2685/1' })])])
  eq([r.valor_liquidado, r.data, r.confianca], [1000, '2026-03-20', 'total'])
})
teste('[TRAVA] parcial: soma do pago confere com valor − saldo (caso FGTS parcial)', () => {
  const r = liq(conta(7000, { saldo: 5800 }), 'parcial', [bd(2, '2026-02-20', [pg(700)]), bd(1, '2026-01-16', [pg(500)])])
  eq([r.valor_liquidado, r.data, r.confianca], [1200, '2026-02-20', 'total'])
})

// ─── 3. Quando não dá para confiar ───────────────────────────────────────────
teste('[TRAVA] guia inteira nunca vira o liquidado do título (motivo da ADR-004)', () => {
  // Agrupada sem número e sem item com o valor do título: não identificável
  const r = liq(conta(582.47, { contato: { id: 77 } }), 'pago', [bd(9, '2026-07-31', [
    pg(1000, { contato: { id: 77 } }), pg(553.63, { contato: { id: 77 } })])])
  eq([r.valor_liquidado, r.confianca], [582.47, 'fallback'])
  if (r.valor_liquidado === 1553.63) throw new Error('voltou a gravar a guia inteira')
})
teste('[TRAVA] pagamentos que não fecham com o título: valor do título (caso 1414/11)', () => {
  // 22.000 pagos + 5.000 de retiradas que não deveriam estar ali → principal 27.000
  const r = liq(conta(22000), 'pago', [bd(2, '2026-07-10', [pg(22000)]), bd(1, '2026-07-01', [pg(5000)])])
  eq([r.valor_liquidado, r.confianca], [22000, 'fallback'])
  if (!/27000/.test(r.motivo)) throw new Error('motivo sem a divergência')
})
teste('[TRAVA] borderô não lido: regra 1, sem marcar o título como conferido', () => {
  const r = liq(conta(1000), 'pago', [bd(2, '2026-02-20', [pg(900)]), { id: '1', ok: false, dados: null }])
  eq([r.regra, r.confianca, r.valor_liquidado], [1, 'leitura_incompleta', 1000])
})
teste('sem borderô: valor do título, regra 2', () => {
  eq(liq(conta(300), 'pago', []).valor_liquidado, 300)
  eq(liq(conta(300), 'pago', []).confianca, 'sem_bordero')
})
teste('principal do item desconta juros, acréscimo e tarifa e soma o desconto', () => {
  eq(R.principalDoPagamento(pg(130, { juros: 20, acrescimo: 5, tarifa: 2, desconto: 7 })), 110)
})

// ─── 4. Coerência e releitura ────────────────────────────────────────────────
teste('[TRAVA] pago pela regra 2 pode ter liquidado MAIOR (juros), nunca menor', () => {
  eq(S.liquidadoCoerente({ status: 'pago', valor: 500, valor_liquidado: 520, regra_liquidacao: 2 }), true)
  eq(S.liquidadoCoerente({ status: 'pago', valor: 500, valor_liquidado: 480, regra_liquidacao: 2 }), false)
})
teste('[TRAVA] sem a regra 2, liquidado maior é a guia replicada: incoerente', () => {
  eq(S.liquidadoCoerente({ status: 'pago', valor: 582.47, valor_liquidado: 1553.63 }), false)
  eq(S.liquidadoCoerente({ status: 'pago', valor: 22000, valor_liquidado: 22000 }), true)
})
teste('parcial e aberto seguem a regra de antes', () => {
  eq(S.liquidadoCoerente({ status: 'parcial', valor: 1000, valor_liquidado: 300 }), true)
  eq(S.liquidadoCoerente({ status: 'parcial', valor: 1000, valor_liquidado: 1000 }), false)
  eq(S.liquidadoCoerente({ status: 'aberto', valor: 900, valor_liquidado: null }), true)
})
teste('[TRAVA] pago lido pela regra antiga é relido; pela regra 2, não', () => {
  const base = { descricao: 'FORNECEDOR X', categoria: 'Y', competencia: '2026-01-01', status: 'pago',
    data_liquidacao: '2026-01-16', valor: 1000, valor_liquidado: 1000 }
  eq(S.tituloCompleto(base), false, 'regra antiga: ')
  eq(S.tituloCompleto({ ...base, regra_liquidacao: 2 }), true, 'regra 2: ')
})

// ─── 5. Núcleo da sincronização, com Bling e banco simulados ─────────────────
teste('[TRAVA] montarRegistrosFluxo: data mais recente, juros e borderô agrupado lido UMA vez', async () => {
  const chamadas = []
  const resp = {
    'contas/pagar/11': { id: 11, valor: 100, saldo: 0, situacao: 2, vencimento: '2026-01-10', competencia: '2026-01-01',
      contato: { id: 5, nome: 'GUIA A' }, categoria: { id: 9 }, borderos: [900, 800], numeroDocumento: '' },
    'contas/pagar/12': { id: 12, valor: 50, saldo: 0, situacao: 2, vencimento: '2026-01-10', competencia: '2026-01-01',
      contato: { id: 5, nome: 'GUIA A' }, categoria: { id: 9 }, borderos: [900], numeroDocumento: '' },
    'borderos/900': { id: 900, data: '2026-02-20', pagamentos: [
      { valorPago: 70, juros: 10, acrescimo: 0, desconto: 0, tarifa: 0, numeroDocumento: 'A1', contato: { id: 5 } },
      { valorPago: 55, juros: 5, acrescimo: 0, desconto: 0, tarifa: 0, numeroDocumento: '', contato: { id: 5 } }] },
    'borderos/800': { id: 800, data: '2026-01-16', pagamentos: [
      { valorPago: 40, juros: 0, acrescimo: 0, desconto: 0, tarifa: 0, numeroDocumento: '', contato: { id: 5 } }] },
  }
  resp['contas/pagar/11'].numeroDocumento = 'A1'
  globalThis.fetch = async (url) => {
    const caminho = String(url).replace('https://bling.test/Api/v3/', '')
    chamadas.push(caminho)
    const d = resp[caminho]
    return { ok: !!d, status: d ? 200 : 404, headers: { get: () => null }, json: async () => ({ data: d }) }
  }
  const admin = { from: () => ({ select: () => ({ in: async () => ({ data: [] }) }) }) }
  const integ = { id: 'i', empresa_id: 'e', access_token: 't', token_expira_em: new Date(Date.now() + 3600e3).toISOString() }
  const itens = [{ id: 11, situacao: 2, valor: 100, vencimento: '2026-01-10' }, { id: 12, situacao: 2, valor: 50, vencimento: '2026-01-10' }]
  const { registros } = await S.montarRegistrosFluxo(admin, integ, 'contas/pagar', 'saida', 1, 30, { 9: 'Encargos' }, {}, itens, {}, { prazoMs: 30000 })
  const por = Object.fromEntries(registros.map(r => [r.doc_ref, r]))
  // Título 11: 900 (item A1, 70 com 10 de juros) + 800 (40) → principal 100, pago 110, último 20/02
  eq([por['bling:saida:11'].data_liquidacao, por['bling:saida:11'].valor_liquidado, por['bling:saida:11'].regra_liquidacao],
    ['2026-02-20', 110, 2], 'título 11: ')
  // Título 12: só o 900, item sem número com principal 50 → pago 55
  eq([por['bling:saida:12'].data_liquidacao, por['bling:saida:12'].valor_liquidado], ['2026-02-20', 55], 'título 12: ')
  eq(chamadas.filter(c => c === 'borderos/900').length, 1, 'leituras do borderô agrupado: ')
})

// ─── 6. Travas estruturais ───────────────────────────────────────────────────
teste('[TRAVA] ninguém mais lê o borderô pela posição na lista', () => {
  for (const rel of ['lib/bling-server.js', 'app/api/integracoes/bling/enrich/route.js', 'app/api/integracoes/bling/sync/route.js', 'app/api/cron/bling/route.js'])
    if (/borderos\s*\[[^\]]*length\s*-\s*1\s*\]/.test(fonte(rel))) throw new Error(`${rel} lê borderos[length-1]`)
})
teste('[TRAVA] soma da guia inteira (fetchBordero) não existe mais', () => {
  if (/function fetchBordero/.test(fonte('lib/bling-server.js'))) throw new Error('fetchBordero voltou')
})
teste('[TRAVA] sincronização e enriquecimento usam a liquidação única', () => {
  if (!/liquidarTitulo\(integ, base, registro\.status, cacheBorderos\)/.test(fonte('lib/bling-server.js'))) throw new Error('montarRegistrosFluxo fora da regra única')
  if (!/liquidarTitulo\(integ, det, stLiq, cacheBorderos\)/.test(fonte('app/api/integracoes/bling/enrich/route.js'))) throw new Error('enriquecimento fora da regra única')
})
teste('[TRAVA] sem prazo para ler todos os borderôs, o título é adiado', () => {
  const fn = corpoDe(fonte('lib/bling-server.js'), 'export async function montarRegistrosFluxo')
  const iAd = fn.indexOf('if (nB && sobra() <'), iLq = fn.indexOf('liquidarTitulo(')
  if (iAd < 0 || iLq < 0 || iAd > iLq) throw new Error('liquidação sem verificação de prazo antes')
  if (!/\{ adiados\+\+; continue \}/.test(fn.slice(iAd, iLq))) throw new Error('falta de prazo tem de adiar o título')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
