// ─── test-diagnostico-bling.mjs ──────────────────────────────────────────────
// Trava a coleta de evidência de borderôs (item 4 do Controller, 30/10/2026).
//
// A coleta existe para ver o JSON do Bling antes de mudar a regra do borderô
// (ADR-004): ordem da lista, borderô estornado, valor pago por título. Ela não
// pode ter efeito nos números — só GET no Bling e só a própria coluna
// integracoes.diagnostico_bling.
//
// Execução:  node scripts/test-diagnostico-bling.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

process.env.BLING_API_BASE = 'https://bling.test/Api/v3'
process.env.BLING_RATE_MIN_MS = '1'
process.env.BLING_BACKOFF_GATEWAY_MS = '1'
process.env.BLING_BACKOFF_RATE_MS = '1'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copiaRec = join(raiz, 'lib', `.bling-reconferencia.diag.${process.pid}.mjs`)
const copiaSrv = join(raiz, 'lib', `.bling-server.diag.${process.pid}.mjs`)
writeFileSync(copiaRec, readFileSync(join(raiz, 'lib', 'bling-reconferencia.js'), 'utf8'))
writeFileSync(copiaSrv, readFileSync(join(raiz, 'lib', 'bling-server.js'), 'utf8')
  .replace(/from '\.\/bling-reconferencia'/g, `from './.bling-reconferencia.diag.${process.pid}.mjs'`))
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

// Bling e banco simulados
let chamadas = []
function bling(respostas) {
  chamadas = []
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url)
    chamadas.push({ url: u, metodo: opts.method || 'GET' })
    const caminho = u.replace('https://bling.test/Api/v3/', '')
    const r = respostas[caminho]
    const status = r ? (r.status || 200) : 404
    return { ok: status >= 200 && status < 300, status, headers: { get: () => null },
      json: async () => (r?.body ?? {}) }
  }
}
function bancoFalso() {
  const escritas = []
  const admin = {
    from(tabela) {
      return {
        update(v) { return { eq: async () => { escritas.push({ tabela, op: 'update', v }); return { error: null } } } },
        upsert(v) { escritas.push({ tabela, op: 'upsert', v }); return Promise.resolve({ error: null }) },
        delete() { escritas.push({ tabela, op: 'delete' }); return { eq: async () => ({ error: null }) } },
        insert(v) { escritas.push({ tabela, op: 'insert', v }); return Promise.resolve({ error: null }) },
      }
    },
  }
  return { admin, escritas }
}
const integBase = { id: 'i1', empresa_id: 'e1', access_token: 't', token_expira_em: new Date(Date.now() + 3600e3).toISOString() }

// ─── 1. Regras puras ─────────────────────────────────────────────────────────
teste('pedidos: só doc_ref do Bling, sem repetir', () => {
  eq(R.pedidosDiagnostico(['bling:saida:1', 'bling:saida:1', 'csv:9', null, 'bling:entrada:2']),
    ['bling:saida:1', 'bling:entrada:2'])
})
teste('[TRAVA] no máximo 20 títulos por diagnóstico', () => {
  const muitos = Array.from({ length: 30 }, (_, i) => `bling:saida:${i}`)
  eq(R.pedidosDiagnostico(muitos).length, 20)
})
teste('ids de borderô em ids soltos ou objetos, sem repetir', () => {
  eq(R.idsBorderos({ borderos: [11, { id: 12 }, '11', { id: null }, null] }), ['11', '12'])
  eq(R.idsBorderos({}), [])
})
teste('pendentes: sem resultado ou incompleto', () => {
  const estado = { pedidos: ['bling:saida:1', 'bling:saida:2', 'bling:saida:3'],
    resultados: { 'bling:saida:1': { status: 200 }, 'bling:saida:2': { incompleto: true } } }
  eq(R.pendentesDiagnostico(estado), ['bling:saida:2', 'bling:saida:3'])
  eq(R.pendentesDiagnostico(null), [])
})

// ─── 2. Comportamento da coleta ──────────────────────────────────────────────
teste('[TRAVA] coleta detalhe e TODOS os borderôs, sem tocar em fluxo_caixa', async () => {
  bling({
    'contas/pagar/100': { body: { data: { id: 100, borderos: [7, 8] } } },
    'borderos/7': { body: { data: { id: 7, data: '2026-01-16' } } },
    'borderos/8': { body: { data: { id: 8, data: '2026-02-20' } } },
  })
  const { admin, escritas } = bancoFalso()
  const integ = { ...integBase, diagnostico_bling: { pedidos: ['bling:saida:100'] } }
  const r = await S.coletarDiagnostico(admin, integ, { prazoMs: 20000 })
  eq([r.coletados, r.pendentes], [1, 0])
  eq(chamadas.map(c => c.metodo), ['GET', 'GET', 'GET'], 'só GET no Bling: ')
  eq(escritas.map(e => `${e.tabela}:${e.op}`), ['integracoes:update'])
  const res = escritas[0].v.diagnostico_bling.resultados['bling:saida:100']
  eq(res.borderos.map(b => [b.id, b.dados.data]), [['7', '2026-01-16'], ['8', '2026-02-20']])
  eq(res.conta.id, 100)
})
teste('título que não existe no Bling vira resultado, não pendência', async () => {
  bling({})
  const { admin, escritas } = bancoFalso()
  const integ = { ...integBase, diagnostico_bling: { pedidos: ['bling:entrada:5'] } }
  const r = await S.coletarDiagnostico(admin, integ, { prazoMs: 20000 })
  eq([r.coletados, r.pendentes], [1, 0])
  eq(escritas[0].v.diagnostico_bling.resultados['bling:entrada:5'].status, 404)
})
teste('sem pedidos: não chama o Bling nem grava', async () => {
  bling({})
  const { admin, escritas } = bancoFalso()
  const r = await S.coletarDiagnostico(admin, { ...integBase, diagnostico_bling: null }, { prazoMs: 20000 })
  eq([r.coletados, r.pendentes, chamadas.length, escritas.length], [0, 0, 0, 0])
})
teste('[TRAVA] respeita o prazo: o que não cabe fica pendente', async () => {
  bling({ 'contas/pagar/1': { body: { data: { id: 1, borderos: [] } } } })
  const { admin, escritas } = bancoFalso()
  const integ = { ...integBase, diagnostico_bling: { pedidos: ['bling:saida:1', 'bling:saida:2'] } }
  const r = await S.coletarDiagnostico(admin, integ, { prazoMs: 0 })
  eq([r.coletados, r.pendentes, chamadas.length], [0, 2, 0])
  eq(escritas.length, 1)
})

// ─── 3. Travas estruturais ───────────────────────────────────────────────────
teste('[TRAVA] a coleta não referencia fluxo_caixa nem escreve no Bling', () => {
  const fn = corpoDe(fonte('lib/bling-server.js'), 'export async function coletarDiagnostico')
  if (/fluxo_caixa/.test(fn)) throw new Error('a coleta tocou em fluxo_caixa')
  if (/method:\s*'(POST|PUT|PATCH|DELETE)'/i.test(fn)) throw new Error('a coleta escreve no Bling')
  if (!/blingGet\(/.test(fn)) throw new Error('a coleta tem de usar blingGet')
  if (!/update\(\{ diagnostico_bling: novo \}\)/.test(fn)) throw new Error('a coleta só grava a própria coluna')
})
teste('[TRAVA] cron coleta só com pedidos pendentes e com prazo', () => {
  const src = fonte('app/api/cron/bling/route.js')
  if (!/if \(pendentesDiagnostico\(integ\.diagnostico_bling\)\.length\)/.test(src)) throw new Error('cron coleta sem pedidos')
  if (!/coletarDiagnostico\(admin, integ, \{ prazoMs:/.test(src)) throw new Error('cron sem prazo na coleta')
})
teste('[TRAVA] modo manual depois da autenticação e só no Fluxo', () => {
  const src = fonte('app/api/integracoes/bling/sync/route.js')
  const iAuth = src.indexOf('getAuthProfile(request)'), iModo = src.indexOf('if (coletar_diagnostico)')
  if (iAuth < 0 || iModo < 0 || iModo < iAuth) throw new Error('modo de diagnóstico fora da autenticação')
  if (!/if \(coletar_diagnostico\) \{\s*if \(modulo !== 'fluxo'\)/.test(src)) throw new Error('modo de diagnóstico fora do Fluxo')
})
teste('[TRAVA] interface só coleta no incremental do Fluxo e não derruba a sincronização', () => {
  const src = fonte('components/IntegracoesTab.jsx')
  if (!/concluido && !historico && modulo === 'fluxo' && g < 5/.test(src)) throw new Error('laço de diagnóstico sem as guardas')
  const m = /coletar_diagnostico: true[\s\S]{0,300}/.exec(src)
  if (!m || /throw/.test(m[0])) throw new Error('erro do diagnóstico não pode derrubar a sincronização')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
