// ─── test-fonte-unica-dre.mjs ────────────────────────────────────────────────
// Trava estrutural: o cálculo do DRE vive em UM lugar — `lib/dre-calc.js`.
//
// O defeito (pendência T1, documentada em 29/09/2026): `dre/page.jsx` definia a
// própria `calcDRE`, byte a byte idêntica à da lib. Hoje convergiam; na próxima
// mudança de regra, a tela principal do DRE ficaria com a regra antiga enquanto
// as demais telas passariam à nova — duas telas, o mesmo número, valores
// diferentes. Regra 1 de docs/04: nenhuma regra de negócio existe em dois lugares.
//
// Este teste é estrutural de propósito, como o `test-escopo-entidade`: varre os
// fontes, não simula React. Pega o caso de uma tela NOVA nascer com a cópia.
//
// Execução:  node scripts/test-fonte-unica-dre.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('..', import.meta.url)))
const FONTE = 'lib/dre-calc.js'

function arquivos(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '.next') continue
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) arquivos(p, acc)
    else if (['.jsx', '.js'].includes(extname(nome))) acc.push(p)
  }
  return acc
}

// Comentários não contam: o texto antigo de uma tela pode citar `function calcDRE`
// sem defini-la — e reprovaria pela documentação do código, não pelo código.
const semComentarios = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const fontes = ['app', 'components', 'lib']
  .flatMap(d => arquivos(join(RAIZ, d)))
  .map(p => ({ rel: relative(RAIZ, p).split(sep).join('/'), src: semComentarios(readFileSync(p, 'utf8')) }))

let ok = 0, falhou = 0
const testes = []
const teste = (nome, fn) => testes.push([nome, fn])

// ─── 1. Definição única ──────────────────────────────────────────────────────
teste('[TRAVA] calcDRE é definida só em lib/dre-calc.js', () => {
  const def = /\b(?:function\s+calcDRE\s*\(|(?:const|let|var)\s+calcDRE\s*=)/
  const donos = fontes.filter(f => def.test(f.src)).map(f => f.rel)
  if (donos.length !== 1 || donos[0] !== FONTE)
    throw new Error(`esperado só ${FONTE}, encontrado: ${donos.join(', ') || 'nenhum'}`)
})

// ─── 2. Quem usa, importa da fonte ───────────────────────────────────────────
teste('[TRAVA] toda tela que chama calcDRE a importa de @/lib/dre-calc', () => {
  const chama = /\bcalcDRE\s*\(/
  const importa = /import\s*\{[^}]*\bcalcDRE\b[^}]*\}\s*from\s*['"]@\/lib\/dre-calc['"]/
  const sem = fontes
    .filter(f => f.rel !== FONTE && chama.test(f.src) && !importa.test(f.src))
    .map(f => f.rel)
  if (sem.length) throw new Error(`chamam calcDRE sem importar da lib: ${sem.join(', ')}`)
})

// ─── Execução ────────────────────────────────────────────────────────────────
for (const [nome, fn] of testes) {
  try { fn(); ok++; console.log(`  ok   ${nome}`) }
  catch (e) { falhou++; console.log(`  FALHA ${nome}\n         ${e.message}`) }
}
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
