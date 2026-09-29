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

// ─── Contrato da gravação da seleção (30/09/2026) ────────────────────────────
// Até 30/09 só o Sidebar alterava a seleção, e o evento era emitido por ele.
// Com o filtro de entidade na Gestão, uma segunda tela passou a alterá-la. A
// gravação foi para lib/selecao-entidade.js — fonte única — e estas travas
// seguem o contrato para onde ele foi.
const LIB_SEL = readFileSync(join(RAIZ, 'lib', 'selecao-entidade.js'), 'utf8')
const SIDEBAR = readFileSync(join(RAIZ, 'components', 'Sidebar.jsx'), 'utf8')
const GESTAO  = readFileSync(join(RAIZ, 'app', 'dashboard', 'fluxo-caixa', 'gestao', 'page.jsx'), 'utf8')

teste('[TRAVA] a lib emite o evento que as telas escutam', () => {
  // Sem esta emissão, todos os listeners ficariam mudos: o navegador não
  // entrega o 'storage' nativo na própria aba que gravou.
  if (!/dispatchEvent\(\s*new Event\(\s*EVENTO_SELECAO\s*\)/.test(LIB_SEL))
    throw new Error('lib/selecao-entidade não emite o evento')
  if (!/EVENTO_SELECAO\s*=\s*['"]storage['"]/.test(LIB_SEL))
    throw new Error("o evento precisa ser 'storage' — é o que as telas escutam")
  if (!/setItem\(\s*['"]empresa_ids['"]/.test(LIB_SEL) || !/setItem\(\s*['"]empresa_id['"]/.test(LIB_SEL))
    throw new Error('a lib precisa gravar empresa_ids E empresa_id')
})

teste('[TRAVA] Sidebar e Gestão gravam a seleção pela fonte única', () => {
  if (!/definirSelecaoEntidades\(/.test(SIDEBAR)) throw new Error('Sidebar não usa definirSelecaoEntidades')
  if (!/definirSelecaoEntidades\(/.test(GESTAO))  throw new Error('Gestão não usa definirSelecaoEntidades')
})

teste('[TRAVA] só a lib grava empresa_ids', () => {
  // Uma segunda gravação reintroduziria a divergência entre telas. layout.jsx
  // grava apenas 'empresa_id' — exceção documentada (inicialização e eco do
  // mesmo valor já gravado pela lib).
  const fora = []
  for (const f of arquivos(join(RAIZ, 'app')).concat(arquivos(join(RAIZ, 'components')))) {
    if (/setItem\(\s*['"]empresa_ids['"]/.test(readFileSync(f, 'utf8'))) fora.push(relative(RAIZ, f))
  }
  if (fora.length) throw new Error('gravação de empresa_ids fora da lib: ' + fora.join(', '))
})

teste('[TRAVA] o Sidebar reage a mudanças feitas por outras telas', () => {
  // Antes de 30/09 o Sidebar só lia na inicialização. Com o filtro da Gestão
  // alterando a seleção, o menu seguiria exibindo as entidades antigas.
  if (!/addEventListener\(\s*EVENTO_SELECAO/.test(SIDEBAR))
    throw new Error('Sidebar não escuta mudanças de seleção feitas por outras telas')
})

teste('[TRAVA] a Gestão recalcula as entidades a CADA troca', () => {
  // empresa_id vale 'todas' para qualquer seleção com mais de uma entidade.
  // Recalcular só quando ele muda deixava a tela exibindo três entidades depois
  // de a seleção passar para duas. `versaoSel` força o recálculo.
  // ⚠️ As outras onze telas têm o mesmo defeito — ver docs/11-pendencias.md.
  if (!/setVersaoSel\(/.test(GESTAO)) throw new Error('sem contador de versão da seleção')
  if (!/\[empresaId, isConsol, versaoSel\]/.test(GESTAO))
    throw new Error('o recálculo das entidades precisa depender de versaoSel')
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
