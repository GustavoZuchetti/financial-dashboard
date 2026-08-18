// ─── test-bling-resiliencia.mjs ──────────────────────────────────────────────
// Testa a correção do HTTP 504 em contas/pagar (Cloudflare "Error 504: Gateway
// time-out" — a origem do Bling não respondeu dentro do tempo permitido).
//
// O que estes testes travam:
//   · fetchContas passa por blingGet (limitador + retry + timeout) e não mais
//     por `fetch` cru — era a única chamada do projeto fora do caminho comum;
//   · um 504 numa página profunda NÃO aborta mais a sincronização: o lote é
//     dividido pela metade, preservando exatamente o mesmo offset;
//   · quando a falha persiste, o erro carrega .gateway/.status/.pagina e a
//     PÁGINA REPORTADA É A DO CURSOR DE QUEM CHAMOU — nunca a sub-página, que
//     corromperia a paginação da sincronização.
//
// Execução:  node scripts/test-bling-resiliencia.mjs
//
// NOTA DE INFRAESTRUTURA: o package.json não declara "type": "module", então
// lib/bling-server.js não pode ser importado diretamente por um .mjs. O teste
// copia o arquivo para um .mjs temporário em lib/ e importa a CÓPIA FIEL do fonte
// — não há reimplementação da lógica aqui.
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Backoff e limitador em 1 ms: os testes exercitam a LÓGICA de repetição,
// não a temporização (essa é calibrada por env em produção).
process.env.BLING_RATE_MIN_MS       = '1'
process.env.BLING_BACKOFF_GATEWAY_MS = '1'
process.env.BLING_BACKOFF_RATE_MS    = '1'

// A cópia fica DENTRO de lib/ (e não em /tmp) para que a resolução de
// node_modules encontre @supabase/supabase-js. Removida ao final.
const copia = join(raiz, 'lib', `.bling-server.teste.${process.pid}.mjs`)
writeFileSync(copia, readFileSync(join(raiz, 'lib', 'bling-server.js'), 'utf8'))
const limpar = () => { try { rmSync(copia, { force: true }) } catch {} }
process.on('exit', limpar); process.on('uncaughtException', (e) => { limpar(); throw e })
const { fetchContas, blingGet, ehGateway } = await import(pathToFileURL(copia).href)

// ─── Micro-framework ─────────────────────────────────────────────────────────
let ok = 0, falhou = 0
const testes = []
const teste = (nome, fn) => testes.push([nome, fn])
function eq(atual, esperado, ctx = '') {
  const a = JSON.stringify(atual), e = JSON.stringify(esperado)
  if (a !== e) throw new Error(`${ctx}esperado ${e}, recebido ${a}`)
}

// ─── Bling falso ─────────────────────────────────────────────────────────────
// respostas: (url) => { status, data } | { demora: ms }
const integ = { access_token: 'tk-teste' }
let chamadas = []
function instalarBling(responder) {
  chamadas = []
  globalThis.fetch = async (url, opts = {}) => {
    chamadas.push(String(url))
    const r = responder(String(url), chamadas.length)
    if (r.demora) {
      // Simula origem pendurada: respeita o AbortController de blingGet
      await new Promise((res, rej) => {
        const t = setTimeout(res, r.demora)
        opts.signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')) })
      })
    }
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: () => null },
      json: async () => ({ data: r.data ?? [] }),
    }
  }
}
const params = (url) => Object.fromEntries(new URL(url).searchParams)
const lote = (n, prefixo = 'x') => Array.from({ length: n }, (_, i) => ({ id: `${prefixo}${i}` }))

// ─── 1. Classificação de gateway ─────────────────────────────────────────────
teste('504/502/503/522 são erro de gateway', () => {
  for (const s of [502, 503, 504, 520, 522, 524]) if (!ehGateway(s)) throw new Error(`${s} deveria ser gateway`)
})
teste('429 e 500 NÃO são gateway (backoff curto, não longo)', () => {
  for (const s of [429, 500, 200, 401]) if (ehGateway(s)) throw new Error(`${s} não deveria ser gateway`)
})

// ─── 2. blingGet ─────────────────────────────────────────────────────────────
teste('blingGet: sucesso na primeira tentativa faz 1 chamada', async () => {
  instalarBling(() => ({ status: 200, data: [{ id: 1 }] }))
  const r = await blingGet(integ, 'contas/pagar?pagina=1')
  eq(r.ok, true, 'ok: '); eq(chamadas.length, 1, 'chamadas: ')
})

teste('blingGet: 504 duas vezes e depois 200 → repete e devolve os dados', async () => {
  instalarBling((_u, n) => (n <= 2 ? { status: 504 } : { status: 200, data: [{ id: 7 }] }))
  const r = await blingGet(integ, 'contas/pagar?pagina=29')
  eq(r.ok, true, 'ok: '); eq(chamadas.length, 3, 'chamadas: ')
})

teste('blingGet: 504 persistente esgota as tentativas e marca gateway', async () => {
  instalarBling(() => ({ status: 504 }))
  const r = await blingGet(integ, 'contas/pagar?pagina=29')
  eq(r.ok, false, 'ok: '); eq(r.status, 504, 'status: ')
  eq(r.gateway, true, 'gateway: '); eq(chamadas.length, 4, 'tentativas: ')
})

teste('blingGet: origem pendurada é abortada pelo timeout e vira 504', async () => {
  instalarBling(() => ({ demora: 5000, status: 200 }))
  const r = await blingGet(integ, 'contas/pagar?pagina=29', { tentativas: 2, timeoutMs: 30 })
  eq(r.ok, false, 'ok: '); eq(r.status, 504, 'status: '); eq(r.gateway, true, 'gateway: ')
})

teste('blingGet: 401 não é repetido (erro de credencial, não de carga)', async () => {
  instalarBling(() => ({ status: 401 }))
  const r = await blingGet(integ, 'contas/pagar?pagina=1')
  eq(r.ok, false, 'ok: '); eq(chamadas.length, 1, 'chamadas: ')
})

// ─── 3. fetchContas — caminho feliz ──────────────────────────────────────────
teste('fetchContas: devolve os itens da página', async () => {
  instalarBling(() => ({ status: 200, data: lote(50) }))
  const itens = await fetchContas(integ, 'contas/pagar', 29, 50)
  eq(itens.length, 50, 'itens: ')
  eq(params(chamadas[0]), { pagina: '29', limite: '50' }, 'query: ')
})

// ─── 4. A correção do 504 — degradação de lote ───────────────────────────────
teste('fetchContas: 504 em p29/50 divide em p57 e p58 com limite 25', async () => {
  instalarBling((url) => {
    const p = params(url)
    if (p.limite === '50') return { status: 504 }
    return { status: 200, data: lote(25, `p${p.pagina}-`) }
  })
  const itens = await fetchContas(integ, 'contas/pagar', 29, 50)
  eq(itens.length, 50, 'total: ')
  const subs = chamadas.map(params).filter(p => p.limite === '25').map(p => p.pagina)
  eq(subs, ['57', '58'], 'sub-páginas: ')
})

teste('a divisão preserva o offset EXATO (nenhum registro pulado ou repetido)', () => {
  // offset(N, L) === offset(2N−1, L/2)  e  offset(N,L)+L/2 === offset(2N, L/2)
  for (let L = 20; L <= 200; L += 2) {
    for (let N = 1; N <= 60; N++) {
      const base = (N - 1) * L
      eq((2 * N - 1 - 1) * (L / 2), base, `L=${L} N=${N} 1ª metade: `)
      eq((2 * N - 1) * (L / 2), base + L / 2, `L=${L} N=${N} 2ª metade: `)
    }
  }
})

teste('fetchContas: primeira metade incompleta não busca a segunda (fim dos dados)', async () => {
  instalarBling((url) => {
    const p = params(url)
    if (p.limite === '50') return { status: 504 }
    return { status: 200, data: lote(11) }   // < 25 → acabou
  })
  const itens = await fetchContas(integ, 'contas/pagar', 29, 50)
  eq(itens.length, 11, 'itens: ')
  eq(chamadas.map(params).filter(p => p.limite === '25').length, 1, 'sub-chamadas: ')
})

// ─── 5. Erro tagueado — integridade do cursor ────────────────────────────────
teste('fetchContas: 504 total lança erro com gateway/status/pagina', async () => {
  instalarBling(() => ({ status: 504 }))
  try {
    await fetchContas(integ, 'contas/pagar', 29, 50)
    throw new Error('deveria ter lançado')
  } catch (e) {
    eq(e.gateway, true, 'gateway: '); eq(e.status, 504, 'status: ')
    eq(e.pagina, 29, 'pagina: '); eq(e.recurso, 'contas/pagar', 'recurso: ')
    if (!/504/.test(e.message)) throw new Error('mensagem sem o status')
  }
})

teste('[TRAVA] a página reportada é a do CURSOR, nunca a sub-página', async () => {
  // Sem esta garantia, a rota devolveria next.pagina = 57 e a sincronização
  // saltaria da página 29 para a 57 com limite 50 — perdendo ~1.400 títulos.
  instalarBling(() => ({ status: 504 }))
  try {
    await fetchContas(integ, 'contas/pagar', 29, 50)
    throw new Error('deveria ter lançado')
  } catch (e) {
    if (e.pagina === 57 || e.pagina === 58) throw new Error(`vazou a sub-página ${e.pagina}`)
    eq(e.pagina, 29, 'pagina: '); eq(e.limite, 50, 'limite: ')
  }
})

teste('fetchContas: erro que NÃO é de gateway não divide o lote', async () => {
  instalarBling(() => ({ status: 401 }))
  try {
    await fetchContas(integ, 'contas/pagar', 29, 50)
    throw new Error('deveria ter lançado')
  } catch (e) {
    eq(e.gateway, false, 'gateway: '); eq(e.pagina, 29, 'pagina: ')
    eq(chamadas.map(params).some(p => p.limite === '25'), false, 'dividiu indevidamente: ')
  }
})

teste('fetchContas: lote ímpar não é dividido (offset não fecharia)', async () => {
  instalarBling(() => ({ status: 504 }))
  try { await fetchContas(integ, 'contas/pagar', 3, 25) } catch { /* esperado */ }
  eq(chamadas.map(params).every(p => p.limite === '25'), true, 'dividiu lote ímpar: ')
})

teste('[REGRESSÃO] fetchContas não usa mais fetch cru — todas as chamadas retentam', async () => {
  // O defeito original: `fetch` direto, sem retry. Uma única chamada e falha.
  // Se alguém reintroduzir o fetch cru, chamadas.length volta a 1 e isto falha.
  instalarBling(() => ({ status: 504 }))
  try { await fetchContas(integ, 'contas/pagar', 1, 100) } catch { /* esperado */ }
  if (chamadas.length < 4) throw new Error(`sem retry: apenas ${chamadas.length} chamada(s)`)
})

// ─── Execução ────────────────────────────────────────────────────────────────
const fetchOriginal = globalThis.fetch
for (const [nome, fn] of testes) {
  try { await fn(); ok++; console.log(`  ok   ${nome}`) }
  catch (e) { falhou++; console.log(`  FALHA ${nome}\n         ${e.message}`) }
}
globalThis.fetch = fetchOriginal
limpar()

console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
