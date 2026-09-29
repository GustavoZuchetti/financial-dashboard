// ─── test-selecao-entidade.mjs ───────────────────────────────────────────────
// Trava o contrato de gravação da seleção de entidades e a identidade visual
// das telas de acesso. Ambos entregues em 30/09/2026.
//
// A seleção é lida por DOZE telas. Um desvio no formato gravado — chave,
// valor 'todas', evento — as quebra todas em silêncio.
//
// Execução:  node scripts/test-selecao-entidade.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ── Navegador simulado: localStorage + window.dispatchEvent ─────────────────
const store = new Map()
const eventos = []
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
}
globalThis.window = { dispatchEvent: e => { eventos.push(e.type); return true } }
globalThis.Event = class { constructor(t) { this.type = t } }
const reset = () => { store.clear(); eventos.length = 0 }

const copia = join(raiz, 'lib', `.selecao-entidade.teste.${process.pid}.mjs`)
writeFileSync(copia, readFileSync(join(raiz, 'lib', 'selecao-entidade.js'), 'utf8'))
const limpar = () => { try { rmSync(copia, { force: true }) } catch {} }
process.on('exit', limpar)
const E = await import(pathToFileURL(copia).href)

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}

// ─── Contrato de gravação ────────────────────────────────────────────────────
teste('[TRAVA] uma entidade: empresa_id é o próprio id', () => {
  reset()
  eq(E.definirSelecaoEntidades(['face']), 'face')
  eq(store.get('empresa_id'), 'face')
  eq(JSON.parse(store.get('empresa_ids')), ['face'])
})

teste("[TRAVA] várias entidades: empresa_id é 'todas'", () => {
  // As doze telas decidem consolidado × individual por este valor.
  reset()
  eq(E.definirSelecaoEntidades(['face', 'jam']), 'todas')
  eq(store.get('empresa_id'), 'todas')
  eq(JSON.parse(store.get('empresa_ids')), ['face', 'jam'])
})

teste("[TRAVA] toda gravação emite o evento 'storage'", () => {
  // O navegador não entrega o 'storage' nativo na própria aba. Sem este evento
  // sintético, nenhuma tela reage à troca.
  reset()
  E.definirSelecaoEntidades(['face'])
  eq(eventos, ['storage'])
})

teste('[TRAVA] lista vazia não grava nem emite', () => {
  // Sem entidade selecionada as telas não têm o que exibir.
  reset()
  store.set('empresa_id', 'face')
  eq(E.definirSelecaoEntidades([]), null)
  eq(store.get('empresa_id'), 'face', 'seleção anterior preservada: ')
  eq(eventos, [], 'nenhum evento: ')
})

teste('duplicatas e vazios são descartados', () => {
  reset()
  eq(E.definirSelecaoEntidades(['face', 'face', '', null, 'jam']), 'todas')
  eq(JSON.parse(store.get('empresa_ids')), ['face', 'jam'])
})

teste("duplicata de um só id resolve para seleção única, não 'todas'", () => {
  reset()
  eq(E.definirSelecaoEntidades(['face', 'face']), 'face')
})

// ─── Leitura ─────────────────────────────────────────────────────────────────
teste('lê a lista gravada', () => {
  reset(); store.set('empresa_ids', '["a","b"]')
  eq(E.lerSelecaoBruta(), ['a', 'b'])
})
teste('cai no empresa_id legado quando não há lista', () => {
  reset(); store.set('empresa_id', 'face')
  eq(E.lerSelecaoBruta(), ['face'])
})
teste("'todas' legado sem lista devolve vazio — quem chama expande", () => {
  // O Sidebar expande para todas as entidades da organização; a lib não
  // conhece a organização e não deve adivinhar.
  reset(); store.set('empresa_id', 'todas')
  eq(E.lerSelecaoBruta(), [])
})
teste('JSON corrompido não quebra a leitura', () => {
  reset(); store.set('empresa_ids', '{quebrado'); store.set('empresa_id', 'face')
  eq(E.lerSelecaoBruta(), ['face'])
})

// ─── Identidade visual das telas de acesso ───────────────────────────────────
const ler = (rel) => readFileSync(join(raiz, rel), 'utf8')
// Remove comentários antes de procurar padrões proibidos. Os comentários deste
// projeto DESCREVEM o código antigo ("antes era .select('*')") — sem isto o
// teste reprovaria pela documentação, e a saída fácil seria apagá-la.
const semComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

teste('[TRAVA] telas de acesso não exibem "FS" fixo como padrão', () => {
  // Até 30/09 exibiam um "FS" fixo ignorando a logo cadastrada. O fallback só
  // pode existir dentro do componente, para organização sem logo.
  for (const rel of ['app/aceitar-convite/page.jsx', 'app/auth/reset-password/page.jsx']) {
    const src = semComentarios(ler(rel))
    if (/>FS</.test(src)) throw new Error(`${rel} voltou a exibir "FS" fixo`)
    if (!/LogoAcesso/.test(src)) throw new Error(`${rel} não usa o componente de logo`)
  }
})

teste('[TRAVA] o convite exibe a logo da organização QUE CONVIDOU', () => {
  if (!/invite\?\.org\?\.logo_url/.test(ler('app/aceitar-convite/page.jsx')))
    throw new Error('o convite deveria usar a logo da organização do convite')
  const api = ler('app/api/invite/route.js')
  if (!/\.from\('organizations'\)[\s\S]{0,120}\.eq\('id', data\.organization_id\)/.test(api))
    throw new Error('/api/invite precisa buscar a organização pelo organization_id do convite')
})

teste('[TRAVA] o endpoint público de logo é determinístico', () => {
  // Antes: .select('*').limit(10) SEM ordem — resultado indefinido; com mais de
  // uma organização com logo, o login podia alternar entre marcas.
  const src = semComentarios(ler('app/api/public/logo/route.js'))
  if (!/\.order\('id'/.test(src)) throw new Error('consulta sem ordenação — resultado indefinido')
  if (/\.select\('\*'\)/.test(src)) throw new Error("select('*') lê colunas desnecessárias de organizations")
})

teste('[TRAVA] o modo Apresentação do DRE não fixa o nome "Facesign"', () => {
  // Um usuário de outra organização apresentando o próprio DRE via "Facesign".
  const src = ler('app/dashboard/dre/page.jsx')
  if (/>FS<\/div>\s*\n\s*<div>\s*\n\s*<div[^>]*>Facesign /.test(src))
    throw new Error('Apresentação do DRE voltou a fixar a marca Facesign')
  if (!/const \{ org: orgApres \} = useOrg\(\)/.test(src))
    throw new Error('Apresentação precisa da organização efetiva — respeita o "ver como"')
})

teste('[TRAVA] LogoAcesso reaproveita o cache do login', () => {
  // Chave errada = o "FS" pisca antes da logo carregar. A chave foi conferida
  // contra app/page.jsx em 30/09.
  const login = ler('app/page.jsx').match(/LOGO_CACHE_KEY = '([^']+)'/)?.[1]
  const comp  = ler('components/LogoAcesso.jsx').match(/const CACHE = '([^']+)'/)?.[1]
  if (!login || !comp) throw new Error('chave de cache não encontrada')
  eq(comp, login, 'LogoAcesso e login precisam da mesma chave: ')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
