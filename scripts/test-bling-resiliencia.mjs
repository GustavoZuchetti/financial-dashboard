import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

process.env.BLING_API_BASE = 'https://bling.test/Api/v3'
process.env.BLING_RATE_MIN_MS = '1'
process.env.BLING_BACKOFF_GATEWAY_MS = '1'
process.env.BLING_BACKOFF_RATE_MS = '1'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copy = join(root, 'lib', `.bling-server.test.${process.pid}.mjs`)
writeFileSync(copy, readFileSync(join(root, 'lib', 'bling-server.js'), 'utf8'))
const cleanup = () => { try { rmSync(copy, { force: true }) } catch {} }
process.on('exit', cleanup)

const { fetchContas, blingGet, ehGateway } = await import(pathToFileURL(copy).href)
const integ = { access_token: 'test-token' }
let calls = []
const query = url => Object.fromEntries(new URL(url).searchParams)
const batch = (size, prefix = 'x') => Array.from({ length: size }, (_, i) => ({ id: `${prefix}${i}` }))
const install = responder => {
  calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push(String(url))
    const answer = responder(String(url), calls.length)
    if (answer.delay) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, answer.delay)
        options.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')) })
      })
    }
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      headers: { get: () => null },
      json: async () => ({ data: answer.data ?? [] }),
    }
  }
}
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const assertEqual = (actual, expected, message) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`)
}

const tests = []
const test = (name, fn) => tests.push([name, fn])
test('gateway classification', () => {
  for (const status of [502, 503, 504, 520, 522, 524]) assert(ehGateway(status), `${status} deveria ser gateway`)
  for (const status of [200, 401, 429, 500]) assert(!ehGateway(status), `${status} não deveria ser gateway`)
})
test('filters are preserved in the list request', async () => {
  install(() => ({ status: 200, data: batch(1) }))
  await fetchContas(integ, 'contas/receber', 3, 50, { situacoes: [2, 3], tipoFiltroData: 'R', dataInicial: '2026-01-01', dataFinal: '2026-03-31' })
  const params = new URL(calls[0]).searchParams
  assertEqual(params.get('situacoes[]'), '2', 'primeira situação')
  assertEqual(params.getAll('situacoes[]'), ['2', '3'], 'situações')
  assertEqual(params.get('tipoFiltroData'), 'R', 'tipo filtro')
  assertEqual(params.get('dataInicial'), '2026-01-01', 'data inicial')
  assertEqual(params.get('dataFinal'), '2026-03-31', 'data final')
})
test('persistent 504 splits page 29/50 into exact pages 57/58/25', async () => {
  install(url => {
    const params = query(url)
    if (params.limite === '50') return { status: 504 }
    return { status: 200, data: batch(25, `p${params.pagina}-`) }
  })
  const items = await fetchContas(integ, 'contas/pagar', 29, 50, { situacao: 2, dataPagamentoInicial: '2026-01-01' })
  assertEqual(items.length, 50, 'quantidade')
  const subpages = calls.map(query).filter(p => p.limite === '25').map(p => p.pagina)
  assertEqual(subpages, ['57', '58'], 'subpáginas')
  assert(calls.every(url => new URL(url).searchParams.get('situacao') === '2'), 'filtro situacao perdido')
})
test('timeout becomes retryable gateway', async () => {
  install(() => ({ status: 200, delay: 50 }))
  const result = await blingGet(integ, 'contas/pagar?pagina=1', { tentativas: 2, timeoutMs: 2 })
  assertEqual(result.status, 504, 'status de timeout')
  assertEqual(result.gateway, true, 'gateway de timeout')
})
test('cursor error reports original page and limit', async () => {
  install(() => ({ status: 504 }))
  try {
    await fetchContas(integ, 'contas/pagar', 29, 50)
    throw new Error('deveria lançar')
  } catch (error) {
    assertEqual({ gateway: error.gateway, status: error.status, pagina: error.pagina, limite: error.limite }, { gateway: true, status: 504, pagina: 29, limite: 50 }, 'erro do cursor')
  }
})

let passed = 0
for (const [name, fn] of tests) {
  try { await fn(); passed++; console.log(`ok ${name}`) }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1 }
}
cleanup()
console.log(`${passed}/${tests.length} testes passaram`)
