// ─── test-selecao-lancamentos.mjs ────────────────────────────────────────────
// Trava a seleção em lote da Gestão. A seleção alimenta EXCLUSÃO PERMANENTE —
// sem lixeira nem desfazer. Cada regra aqui impede apagar o que não se vê.
//
// Defeito original (30/09/2026): marcar lançamentos e trocar de página
// desmarcava tudo. O load() limpava a seleção, e roda a cada troca de página.
//
// O risco da correção ingênua: manter a seleção permite marcar na página 1, ir
// à 3 e excluir registros fora da tela. E o "selecionar todos" antigo, com
// seleção em outras páginas, SUBSTITUÍA a seleção em silêncio.
//
// Execução:  node scripts/test-selecao-lancamentos.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copia = join(raiz, 'lib', `.selecao-lancamentos.teste.${process.pid}.mjs`)
writeFileSync(copia, readFileSync(join(raiz, 'lib', 'selecao-lancamentos.js'), 'utf8'))
const limpar = () => { try { rmSync(copia, { force: true }) } catch {} }
process.on('exit', limpar)
const S = await import(pathToFileURL(copia).href)

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}
const ids = (set) => [...set].sort()

// 5 lançamentos, páginas de 2: [a,b] [c,d] [e]
const L = (id, valor, extra = {}) => ({ id, valor, ...extra })
const TODOS = [
  L('a', 100, { doc_ref: 'bling:saida:1' }),
  L('b', 200, { doc_ref: 'manual:1' }),
  L('c', 300, { doc_ref: 'bling:saida:2', origem_ausente: true }),
  L('d', 400),
  L('e', 500, { doc_ref: 'bling:entrada:9' }),
]
const PAG1 = ['a', 'b'], PAG2 = ['c', 'd']

// ─── R1 — sobrevive à troca de página ───────────────────────────────────────
teste('[TRAVA] a poda preserva seleções de outras páginas', () => {
  // O load() roda a cada troca de página. Antes zerava; agora apenas poda.
  const sel = new Set(['a', 'c'])
  eq(ids(S.podarSelecao(sel, TODOS)), ['a', 'c'])
})

// ─── R3 — poda ao recarregar ────────────────────────────────────────────────
teste('[TRAVA] id que saiu do conjunto filtrado é descartado', () => {
  const sel = new Set(['a', 'x-inexistente', 'c'])
  eq(ids(S.podarSelecao(sel, TODOS)), ['a', 'c'])
})
teste('conjunto vazio poda tudo', () => {
  eq(S.podarSelecao(new Set(['a']), []).size, 0)
})

// ─── R4 — "selecionar todos" só na página ───────────────────────────────────
teste('[TRAVA] selecionar todos marca a página SEM perder as outras', () => {
  const sel = new Set(['c'])                      // marcado na página 2
  eq(ids(S.alternarPagina(sel, PAG1)), ['a', 'b', 'c'])
})
teste('[TRAVA] desmarcar todos remove só a página atual', () => {
  const sel = new Set(['a', 'b', 'c'])
  eq(ids(S.alternarPagina(sel, PAG1)), ['c'])
})
teste('[REGRESSÃO] a regra antiga substituía a seleção em silêncio', () => {
  // selected.size === registros.length ? limpar : trocar pela página
  const antigo = (sel, pag) => sel.size === pag.length ? new Set() : new Set(pag)
  const sel = new Set(['c'])                      // 1 marcado na página 2
  const r = antigo(sel, PAG1)                     // 1 ≠ 2 → substitui
  eq(ids(r), ['a', 'b'], 'comportamento antigo: ')
  if (r.has('c')) throw new Error('o cenário deveria reproduzir a perda de "c"')
})
teste('[REGRESSÃO] a regra antiga DESMARCAVA quando os tamanhos coincidiam', () => {
  // Dois marcados em páginas diferentes, página de dois: 2 === 2 → limpava tudo
  const antigo = (sel, pag) => sel.size === pag.length ? new Set() : new Set(pag)
  eq(antigo(new Set(['c', 'e']), PAG1).size, 0, 'limpou seleções que nem eram da página: ')
})
teste('página parcialmente marcada: selecionar completa a página', () => {
  eq(ids(S.alternarPagina(new Set(['a']), PAG1)), ['a', 'b'])
})
teste('página vazia não altera a seleção', () => {
  eq(ids(S.alternarPagina(new Set(['c']), [])), ['c'])
})
teste('paginaToda reflete só a página, não o total', () => {
  eq(S.paginaToda(new Set(['a', 'b', 'c']), PAG1), true)
  eq(S.paginaToda(new Set(['a', 'c']), PAG1), false)
  eq(S.paginaToda(new Set(['a']), []), false, 'página vazia nunca está marcada: ')
})

// ─── R5 — a confirmação declara o que não se vê ─────────────────────────────
teste('[TRAVA] resumo declara itens fora da página atual', () => {
  const r = S.resumirSelecao(new Set(['a', 'c', 'e']), TODOS, PAG1)
  eq(r.total, 3, 'total: ')
  eq(r.foraDaPagina, 2, 'c e e estão fora da página 1: ')
  eq(r.valor, 900, 'valor: ')
})

teste('[TRAVA] separa o que a sincronização recria do que some de fato', () => {
  // a: Bling ativo → recriado · b: manual → definitivo
  // c: Bling excluído na origem → NÃO volta, é definitivo
  // d: sem doc_ref → definitivo · e: Bling ativo → recriado
  const r = S.resumirSelecao(new Set(['a', 'b', 'c', 'd', 'e']), TODOS, PAG1)
  eq(r.recriados, 2, 'recriados: ')
  eq(r.definitivos, 3, 'definitivos: ')
})

teste('[TRAVA] Bling excluído na origem conta como DEFINITIVO', () => {
  // É o motivo de a exclusão não ser bloqueada: títulos marcados origem_ausente
  // não voltam na sincronização, e removê-los é um caso legítimo.
  const r = S.resumirSelecao(new Set(['c']), TODOS, PAG2)
  eq([r.recriados, r.definitivos], [0, 1])
})

teste('[TRAVA] ids enviados à exclusão são só os presentes no filtro', () => {
  // Defesa final: um id no Set que não está no conjunto filtrado nunca vai
  // para o DELETE — mesmo que a poda tenha falhado por algum motivo.
  const r = S.resumirSelecao(new Set(['a', 'fantasma', 'c']), TODOS, PAG1)
  eq(r.ids.sort(), ['a', 'c'])
})

teste('seleção vazia devolve zeros, não NaN', () => {
  eq(S.resumirSelecao(new Set(), TODOS, PAG1),
    { total: 0, valor: 0, foraDaPagina: 0, recriados: 0, definitivos: 0, ids: [] })
})

teste('valor usa módulo — saídas negativas não reduzem o total', () => {
  const r = S.resumirSelecao(new Set(['x', 'y']), [L('x', -150), L('y', 50)], ['x', 'y'])
  eq(r.valor, 200)
})

// ─── Cenário ─────────────────────────────────────────────────────────────────
teste('[CENÁRIO] marca na página 1, vai à 2, marca mais, confirma', () => {
  let sel = new Set()
  sel = S.alternarPagina(sel, PAG1)             // marca a página 1 inteira
  sel = S.podarSelecao(sel, TODOS)              // troca de página → load() → poda
  sel.add('d')                                  // marca um item na página 2
  const r = S.resumirSelecao(sel, TODOS, PAG2)  // confirma estando na página 2
  eq(r.total, 3, 'total: ')
  eq(r.foraDaPagina, 2, 'a e b não estão à vista: ')
  eq(r.valor, 700, 'valor: ')
})


// ─── Travas estruturais na Gestão ────────────────────────────────────────────
// A lib pode estar perfeita e a tela voltar a zerar a seleção. Estas verificam
// o USO da lib no componente.
const G = readFileSync(join(raiz, 'app', 'dashboard', 'fluxo-caixa', 'gestao', 'page.jsx'), 'utf8')

teste('[TRAVA] o load() não zera a seleção — o defeito original', () => {
  // setRegistros(...) seguido de setSelected(new Set()) era exatamente o bug.
  if (/setRegistros\([^)]*\)\)\s*\n\s*setSelected\(new Set\(\)\)/.test(G))
    throw new Error('o load() voltou a zerar a seleção a cada troca de página')
  if (!/setSelected\(prev => podarSelecao\(prev, visiveis\)\)/.test(G))
    throw new Error('o load() precisa PODAR a seleção, não zerar')
})

teste('[TRAVA] a seleção zera com os filtros, mas NÃO com a página', () => {
  const m = G.match(/useEffect\(\(\) => \{ setSelected\(new Set\(\)\) \},\s*\[([^\]]*)\]\)/)
  if (!m) throw new Error('efeito que zera a seleção ao mudar filtro não encontrado')
  const deps = m[1].split(',').map(x => x.trim())
  for (const f of ['startDate', 'endDate', 'tipoFiltro', 'statusFiltro', 'busca', 'empIdsSel'])
    if (!deps.includes(f)) throw new Error(`a seleção precisa zerar quando "${f}" muda`)
  if (deps.includes('page')) throw new Error('"page" nas dependências reintroduz o defeito original')
})

teste('[TRAVA] a exclusão envia só ids do conjunto filtrado', () => {
  if (!/const ids = resumoSel\.ids/.test(G))
    throw new Error('a exclusão precisa usar resumoSel.ids, nunca o Set cru')
  if (/const ids = \[\.\.\.selected\]/.test(G))
    throw new Error('exclusão voltou a usar o Set cru da seleção')
})

teste('[TRAVA] "selecionar todos" usa a lógica por página', () => {
  if (!/alternarPagina\(prev, registros\.map/.test(G))
    throw new Error('toggleAll precisa usar alternarPagina')
  if (/selected\.size === registros\.length/.test(G))
    throw new Error('comparação que substituía a seleção em silêncio voltou')
})

teste('[TRAVA] a confirmação recebe o resumo', () => {
  if (!/resumo=\{resumoSel\}/.test(G)) throw new Error('BulkModal sem o resumo da seleção')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
