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

// A natureza vive no PLANO DE CONTAS e é resolvida em cadeia:
//     categoria → categoria_mappings → conta → conta.natureza
const CONTAS = [
  { id: 'c-transf', natureza: 'transferencia_interna' },
  { id: 'c-aporte', natureza: 'aporte_socio' },
  { id: 'c-empr',   natureza: 'emprestimo' },
  { id: 'c-rec',    natureza: 'operacional' },
]
const MAPS = [
  { categoria_origem: 'Transferência entre contas Facesign', conta_id: 'c-transf' },
  { categoria_origem: 'Transferência JB',                    conta_id: 'c-transf' },
  { categoria_origem: 'Transferência FaceSign',              conta_id: 'c-transf' },
  { categoria_origem: 'Aporte de Capital',                   conta_id: 'c-aporte' },
  { categoria_origem: 'Obtenção de Empréstimos',             conta_id: 'c-empr' },
  { categoria_origem: 'Receita de Serviços',                 conta_id: 'c-rec' },
]
const mapa = N.indexarNaturezas(MAPS, CONTAS)
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
  // 'Receita de Serviços' e 'Transferência JB' TÊM conta — saem da fila.
  // Restam as sem mapeamento, ordenadas por volume.
  const itens = [
    l('Impostos sobre receitas', 100), l('Transferência Nova', 5000),
    l('Impostos sobre receitas', 200), l('Transferência JB', 999),
    l('Receita de Serviços', 10000),
  ]
  const p = N.pendentesDeClassificacao(itens, mapa)
  eq(p.map(x => x.categoria), ['Transferência Nova', 'Impostos sobre receitas'], 'ordem: ')
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


// ─── 6. Resolução pela cadeia plano de contas ────────────────────────────────
// Verificação de 16/09 sobre 130 categorias em fluxo_caixa: 107 (82,3%) já
// existem no De-Para. A hipótese "sem mapeamento = não operacional" foi
// TESTADA E DERRUBADA: das 23 sem mapeamento, só 5 eram não-operacionais; as
// outras 18 somavam ~R$ 2,2 mi de despesa real (Impostos sobre receitas,
// IRPJ/CSLL, Vale alimentação). Inferir exclusão dali inflaria o resultado.
teste('[TRAVA] a natureza vem da CONTA, não da linha do De-Para', () => {
  eq(N.naturezaDe('Transferência JB', mapa), 'transferencia_interna')
  eq(N.naturezaDe('Receita de Serviços', mapa), 'operacional')
})

teste('[TRAVA] categoria SEM conta é operacional, nunca excluída em silêncio', () => {
  // O caso real: "Impostos sobre receitas", R$ 1.676.629, sem mapeamento.
  // Tratá-la como não-operacional tiraria despesa legítima dos indicadores.
  eq(N.naturezaDe('Impostos sobre receitas', mapa), 'operacional')
  eq(N.ehOperacional('IRPJ e CSLL - Parcelamento', mapa), true)
  eq(N.ehOperacional('Vale alimentação', mapa), true)
})

teste('[REGRESSÃO] "sem mapeamento = fora do KPI" excluiria R$ 2,2 mi de despesa', () => {
  const semMapa = [
    l('Impostos sobre receitas', 1676629), l('IRPJ e CSLL - Parcelamento', 320404),
    l('Vale alimentação', 151950), l('Dimensa', 61545), l('Rendimento de aplicação', 25181),
  ]
  const totalIndevido = semMapa.reduce((a, x) => a + x.valor, 0)
  eq(totalIndevido, 2235709, 'despesa que seria perdida: ')
  // Com a regra correta, tudo isso permanece nos indicadores
  const r = N.separarPorNatureza(semMapa, mapa)
  eq(r.totalExcluido, 0, 'nada excluído: ')
  eq(r.totalOperacional, 2235709, 'tudo operacional: ')
})

teste('conta sem natureza definida assume operacional', () => {
  const m = N.indexarNaturezas([{ categoria_origem: 'X', conta_id: 'c1' }], [{ id: 'c1' }])
  eq(N.naturezaDe('X', m), 'operacional')
})

teste('mapeamento apontando para conta inexistente não quebra', () => {
  const m = N.indexarNaturezas([{ categoria_origem: 'Y', conta_id: 'fantasma' }], CONTAS)
  eq(N.naturezaDe('Y', m), 'operacional')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
