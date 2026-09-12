// ─── test-escopo-entidade.mjs ────────────────────────────────────────────────
// Trava estrutural: toda tela que lê a entidade selecionada PRECISA reagir à
// troca dela.
//
// O defeito (verificado em produção em 11/09/2026): `fluxo-caixa/analise` lia
// `localStorage.getItem('empresa_id')` num useEffect com dependências vazias e
// nunca mais. O Sidebar grava a nova seleção e emite
// `window.dispatchEvent(new Event('storage'))`, mas a tela não escutava.
//
// Reprodução: desmarcar JAM e JB deixando só a Facesign — os valores ficavam
// BYTE A BYTE idênticos (R$ 8.450.316,44 · 2.631 transações). O usuário via o
// consolidado das três achando estar vendo uma entidade isolada, sem nenhum
// indício visual.
//
// O levantamento encontrou TRÊS telas afetadas, não uma. Em `importacao` o
// impacto era maior: ali `empresaId` não é só filtro de leitura — determina em
// qual empresa os dados são GRAVADOS.
//
// Este teste é estrutural de propósito. Não simula React: varre os fontes e
// exige o listener. É barato, roda em qualquer lugar e pega o caso de uma tela
// NOVA nascer com o mesmo defeito — que é como ele apareceu.
//
// Execução:  node scripts/test-escopo-entidade.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('..', import.meta.url)))
const TELAS = join(RAIZ, 'app', 'dashboard')
// Configurações tem seletor próprio por aba e não usa a entidade global.
const IGNORAR = new Set(['configuracoes'])

// `layout.jsx` lê a entidade apenas na INICIALIZAÇÃO, para validar a seleção
// salva e corrigi-la quando a empresa não existe mais. Não exibe dados nem
// grava por empresa — reagir à troca ali causaria laço com o próprio Sidebar,
// que é quem emite o evento. Exceção deliberada, não omissão.
const EXCECOES = new Set(['app/dashboard/layout.jsx'])

function arquivos(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) arquivos(p, acc)
    else if (['.jsx', '.js'].includes(extname(nome))) acc.push(p)
  }
  return acc
}

const LE_ENTIDADE  = /localStorage\.getItem\(\s*['"]empresa_ids?['"]\s*\)/
const ESCUTA_TROCA = /addEventListener\(\s*['"]storage['"]/

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])

teste('[TRAVA] toda tela que lê a entidade reage à troca dela', () => {
  const faltando = []
  for (const f of arquivos(TELAS)) {
    const src = readFileSync(f, 'utf8')
    if (!LE_ENTIDADE.test(src)) continue
    const rel = relative(RAIZ, f).split('\\').join('/')
    if (EXCECOES.has(rel)) continue
    if (!ESCUTA_TROCA.test(src)) faltando.push(rel)
  }
  if (faltando.length) {
    throw new Error(
      `${faltando.length} tela(s) leem a entidade sem escutar a troca:\n` +
      faltando.map(x => `           · ${x}`).join('\n') +
      `\n         Adicione um listener de 'storage' que releia empresa_id.`)
  }
})

teste('[TRAVA] telas que GRAVAM por empresa exigem entidade específica', () => {
  // Gravar com empresa_id = 'todas' criaria registro órfão, sem dono real.
  const criticas = ['app/dashboard/importacao/page.jsx', 'app/dashboard/importacao/layout/page.jsx']
  const semGuarda = []
  for (const rel of criticas) {
    const src = readFileSync(join(RAIZ, rel), 'utf8')
    if (!/!==\s*['"]todas['"]|===\s*['"]todas['"]/.test(src)) semGuarda.push(rel)
  }
  if (semGuarda.length)
    throw new Error(`sem guarda contra 'todas': ${semGuarda.join(', ')}`)
})

teste('o Sidebar emite o evento que as telas escutam', () => {
  // Sem esta emissão, todos os listeners acima ficariam mudos.
  const src = readFileSync(join(RAIZ, 'components', 'Sidebar.jsx'), 'utf8')
  if (!/dispatchEvent\(\s*new Event\(\s*['"]storage['"]/.test(src))
    throw new Error("Sidebar não emite window.dispatchEvent(new Event('storage'))")
  if (!/setItem\(\s*['"]empresa_id['"]/.test(src))
    throw new Error('Sidebar não grava empresa_id no localStorage')
})

teste('[REGRESSÃO] o padrão defeituoso é reconhecível', () => {
  // useEffect com deps vazias lendo a entidade e SEM listener — a assinatura
  // exata do defeito. Documenta o que procurar numa revisão de código.
  const defeituoso = `
    useEffect(() => {
      const savedId = localStorage.getItem('empresa_id')
      if (savedId) setEmpresaId(savedId)
    }, [])`
  const correto = defeituoso.replace('}, [])',
    `  window.addEventListener('storage', aplicar)
      return () => window.removeEventListener('storage', aplicar)
    }, [])`)
  if (ESCUTA_TROCA.test(defeituoso)) throw new Error('o padrão defeituoso não deveria casar')
  if (!ESCUTA_TROCA.test(correto))   throw new Error('o padrão correto deveria casar')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
