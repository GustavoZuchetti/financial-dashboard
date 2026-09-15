// ─── test-natureza-categoria.mjs ─────────────────────────────────────────────
// Trava a exclusão de transferências intragrupo dos KPIs operacionais.
//
// Medido em 11/09/2026, consolidado das três entidades, 01/01 a 12/09:
//
//   Entradas · transferências   R$ 3.720.223,30   44,0%
//   Saídas   · transferências   R$ 3.360.583,35   44,3%
//   Receita de Serviços         R$ 2.659.508,01   31,5%
//
// É o mesmo dinheiro circulando entre FACE, JAM e JB. O Índice de Cobertura,
// com ~44% do mesmo valor nos dois lados, convergia para 1,0 por construção
// matemática — uma operação em dificuldade pareceria equilibrada.
//
// Execução:  node scripts/test-natureza-categoria.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copia = join(raiz, 'lib', `.natureza.teste.${process.pid}.mjs`)
writeFileSync(copia, readFileSync(join(raiz, 'lib', 'natureza-categoria.js'), 'utf8'))
const limpar = () => { try { rmSync(copia, { force: true }) } catch {} }
process.on('exit', limpar)
const N = await import(pathToFileURL(copia).href)

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}

const CLASSIF = [
  { categoria: 'Transferência entre contas Facesign', natureza: 'transferencia_interna' },
  { categoria: 'Transferência JB',                    natureza: 'transferencia_interna' },
  { categoria: 'Transferência FaceSign',              natureza: 'transferencia_interna' },
  { categoria: 'Aporte de Capital',                   natureza: 'aporte_socio' },
  { categoria: 'Obtenção de Empréstimos',             natureza: 'emprestimo' },
]
const mapa = N.indexarNaturezas(CLASSIF)
const l = (cat, v) => ({ categoria: cat, valor: v })

// ─── 1. Ausência de classificação = operacional ──────────────────────────────
teste('[TRAVA] categoria não classificada é OPERACIONAL — nada muda sem decisão', () => {
  eq(N.naturezaDe('Receita de Serviços', mapa), 'operacional')
  eq(N.ehOperacional('Categoria Nova Qualquer', mapa), true)
})

teste('comparação ignora caixa e espaços', () => {
  eq(N.naturezaDe('  transferência jb  ', mapa), 'transferencia_interna')
})

// ─── 2. O caso real ──────────────────────────────────────────────────────────
teste('[TRAVA] transferências saem dos indicadores operacionais', () => {
  const entradas = [
    l('Transferência entre contas Facesign', 2931277.98),
    l('Receita de Serviços', 2659508.01),
    l('Aporte de Capital', 1850000.00),
    l('Transferência FaceSign', 624945.32),
    l('Transferência JB', 164000.00),
    l('Obtenção de Empréstimos', 144875.10),
  ]
  const r = N.separarPorNatureza(entradas, mapa)
  eq(r.totalOperacional, 2659508.01, 'só a receita de serviços: ')
  eq(r.totalExcluido, 5715098.40, 'excluído: ')
  eq(r.porNatureza.transferencia_interna, 3720223.30, 'transferências: ')
})

teste('[TRAVA] o Índice de Cobertura deixa de convergir artificialmente', () => {
  const entradas = [l('Transferência entre contas Facesign', 3000000), l('Receita de Serviços', 500000)]
  const saidas   = [l('Transferência entre contas Facesign', 3000000), l('Salários', 800000)]
  const sem = (3000000 + 500000) / (3000000 + 800000)   // com transferências
  const com = N.separarPorNatureza(entradas, mapa).totalOperacional
            / N.separarPorNatureza(saidas, mapa).totalOperacional
  if (Math.abs(sem - 1) > 0.15) throw new Error('o cenário deveria convergir para ~1 sem a exclusão')
  eq(Number(com.toFixed(3)), 0.625, 'cobertura real: ')
  if (Math.abs(com - 1) < Math.abs(sem - 1))
    throw new Error('a exclusão deveria AFASTAR o índice de 1,0, revelando o desempenho real')
})

teste('o excluído é devolvido, não descartado — a tela precisa declarar', () => {
  const r = N.separarPorNatureza([l('Transferência JB', 164000), l('Receita de Serviços', 100)], mapa)
  eq(r.excluido.length, 1, 'itens excluídos: ')
  eq(r.excluido[0].categoria, 'Transferência JB', 'categoria: ')
})

// ─── 3. Sugestão automática ──────────────────────────────────────────────────
teste('sugere por pista de nome, em qualquer nomenclatura', () => {
  eq(N.sugerirNatureza('Transferência entre contas Facesign'), 'transferencia_interna')
  eq(N.sugerirNatureza('TRANSF. ENTRE EMPRESAS'), 'transferencia_interna')
  eq(N.sugerirNatureza('Intercompany settlement'), 'transferencia_interna')
  eq(N.sugerirNatureza('Aporte de Capital'), 'aporte_socio')
  eq(N.sugerirNatureza('Distribuição de Resultados AF'), 'aporte_socio')
  eq(N.sugerirNatureza('Pagamento de Empréstimos'), 'emprestimo')
})

teste('[TRAVA] sem pista devolve NULL, não "operacional"', () => {
  // null = sem sugestão, exige decisão humana. Devolver 'operacional' seria
  // adivinhar e aplicar em silêncio — o defeito corrigido no PR #18.
  eq(N.sugerirNatureza('Serviços ADM'), null)
  eq(N.sugerirNatureza('DATAPREV'), null)
})

// ─── 4. Fila de trabalho ─────────────────────────────────────────────────────
teste('pendentes vêm por volume decrescente, com sugestão quando houver', () => {
  const itens = [
    l('Receita de Serviços', 100), l('Transferência Nova', 5000),
    l('Receita de Serviços', 200), l('Transferência JB', 999),
  ]
  const p = N.pendentesDeClassificacao(itens, mapa)
  eq(p.map(x => x.categoria), ['Transferência Nova', 'Receita de Serviços'], 'ordem: ')
  eq(p[0].sugestao, 'transferencia_interna', 'sugestão: ')
  eq(p[1].sugestao, null, 'sem sugestão: ')
  eq(p[1].lancamentos, 2, 'agrupou: ')
})

teste('categoria já classificada sai da fila', () => {
  eq(N.pendentesDeClassificacao([l('Transferência JB', 100)], mapa).length, 0)
})

teste('linha sem categoria não vira pendência fantasma', () => {
  eq(N.pendentesDeClassificacao([{ valor: 10 }, { categoria: '  ', valor: 20 }], mapa).length, 0)
})

// ─── 5. Escopo da exclusão ───────────────────────────────────────────────────
teste('[TRAVA] só `operacional` compõe os indicadores', () => {
  eq(N.NATUREZAS_OPERACIONAIS, ['operacional'])
  for (const [k, v] of Object.entries(N.NATUREZAS)) {
    eq(v.kpi, k === 'operacional', `${k}: `)
  }
})

teste('as quatro naturezas existem e são distintas', () => {
  eq(Object.keys(N.NATUREZAS).sort(),
     ['aporte_socio', 'emprestimo', 'operacional', 'transferencia_interna'])
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
