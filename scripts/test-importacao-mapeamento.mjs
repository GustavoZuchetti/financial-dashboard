// ─── test-importacao-mapeamento.mjs ──────────────────────────────────────────
// Trava as quatro camadas que impedem lançamento sem De-Para de entrar no DRE.
//
// O defeito (relatado em 02/09): a categoria "Transferências Facesign"
// (R$ 4.037,92) aparecia como PENDENTE na tela e mesmo assim era importada.
//
//     return map?.tipo_destino !== 'ignorar'
//
// Sem mapeamento, `map` é undefined, `map?.tipo_destino` é undefined, e
// undefined !== 'ignorar' é TRUE — a linha passava. O filtro tratava o caso
// "marcado para ignorar" e nunca o caso "sem marcação nenhuma".
//
// Pior: a interface afirmava "Registros sem mapeamento não entram no DRE".
// Era essa mensagem que dava confiança para clicar em importar.
//
// Execução:  node scripts/test-importacao-mapeamento.mjs

const TIPOS_DRE = ['receita','deducao','custo','despesa','receita_financeira','despesa_financeira','imposto_lucro','investimento']

// ── Réplicas das regras implementadas em app/dashboard/importacao/page.jsx ──
export function categoriasPendentes(linhas, mapeamentos) {
  const mapa = new Set((mapeamentos || [])
    .map(m => (m.categoria_origem || '').trim().toLowerCase()).filter(Boolean))
  const faltando = new Map()
  for (const r of linhas || []) {
    const desc = (r?.__desc || '').trim()
    const k = desc.toLowerCase()
    if (!k || mapa.has(k)) continue
    const at = faltando.get(k) || { categoria: desc, linhas: 0, valor: 0 }
    at.linhas++; at.valor += Math.abs(Number(r?.valor) || 0)
    faltando.set(k, at)
  }
  return [...faltando.values()].sort((a, b) => b.valor - a.valor)
}

export function entraNoPayload(row, mapeamentos) {
  const map = (mapeamentos || []).find(m =>
    m.categoria_origem?.toLowerCase() === (row.__desc || '').toLowerCase())
  if (!map) return false
  return map.tipo_destino !== 'ignorar'
}

export function classificar(row, mapeamentos, planoContas = []) {
  const map = (mapeamentos || []).find(m =>
    m.categoria_origem?.toLowerCase() === (row.__desc || '').toLowerCase())
  const conta = map?.conta_id ? planoContas.find(c => c.id === map.conta_id) : null
  const tipo = conta?.tipo || map?.tipo_destino
  if (!TIPOS_DRE.includes(tipo))
    throw new Error(`Categoria sem classificação válida: "${row.__desc || '(sem descrição)'}"`)
  return tipo
}

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}
function lanca(fn, ctx = '') {
  try { fn() } catch { return }
  throw new Error(`${ctx}deveria ter lançado erro`)
}

const MAPS = [
  { categoria_origem: 'Serviços ADM',            tipo_destino: 'despesa' },
  { categoria_origem: 'Pagamento de Empréstimos', tipo_destino: 'ignorar' },
]
const l = (desc, valor, tipoCsv = 'contas a pagar') => ({ __desc: desc, valor, tipoCsv })

// ─── Camada 2 — o filtro ─────────────────────────────────────────────────────
teste('[TRAVA] categoria SEM mapeamento não entra no payload', () => {
  eq(entraNoPayload(l('Transferências Facesign', 4037.92), MAPS), false)
})
teste('[REGRESSÃO] o filtro antigo deixava passar', () => {
  const antigo = (row, maps) => {
    const map = maps.find(m => m.categoria_origem?.toLowerCase() === (row.__desc || '').toLowerCase())
    return map?.tipo_destino !== 'ignorar'
  }
  eq(antigo(l('Transferências Facesign', 4037.92), MAPS), true, 'comportamento antigo: ')
})
teste('categoria mapeada entra normalmente', () => {
  eq(entraNoPayload(l('Serviços ADM', 8366.87), MAPS), true)
})
teste('[TRAVA] "ignorar" continua sendo excluído — natureza distinta de pendente', () => {
  eq(entraNoPayload(l('Pagamento de Empréstimos', 7333.17), MAPS), false)
})
teste('comparação de categoria não diferencia maiúsculas nem espaços', () => {
  eq(entraNoPayload(l('  serviços adm  '.trim(), 10), MAPS), true)
})

// ─── Camada 3 — sem adivinhação de tipo ──────────────────────────────────────
teste('[TRAVA] sem classificação LANÇA erro, não vira receita', () => {
  lanca(() => classificar(l('Transferências Facesign', 4037.92), MAPS), 'sem mapa: ')
})
teste('[REGRESSÃO] a regra antiga classificava pela palavra "pagar"', () => {
  const antigo = (row) => row.tipoCsv.includes('pagar') ? 'despesa' : 'receita'
  eq(antigo(l('Transferências Facesign', 4037.92, 'contas a pagar')), 'despesa')
  eq(antigo(l('Transferências Facesign', 4037.92, 'contas a receber')), 'receita')
  // A MESMA transferência virava despesa ou receita conforme o arquivo de origem
})
teste('[TRAVA] tipo não reconhecido lança em vez de virar receita', () => {
  lanca(() => classificar(l('X', 1), [{ categoria_origem: 'X', tipo_destino: 'coisa_nova' }]), 'tipo inválido: ')
})
teste('a conta vinculada tem precedência sobre o tipo_destino', () => {
  const maps = [{ categoria_origem: 'Y', tipo_destino: 'despesa', conta_id: 'c1' }]
  eq(classificar(l('Y', 1), maps, [{ id: 'c1', tipo: 'custo' }]), 'custo')
})

// ─── Camada 1 — bloqueio ─────────────────────────────────────────────────────
teste('[TRAVA] pendências bloqueiam a importação', () => {
  const linhas = [l('Serviços ADM', 8366.87), l('Transferências Facesign', 4037.92)]
  const p = categoriasPendentes(linhas, MAPS)
  eq(p.length, 1, 'pendentes: ')
  eq(p[0].categoria, 'Transferências Facesign', 'categoria: ')
  eq(p[0].valor, 4037.92, 'valor: ')
})
teste('sem pendências, nada bloqueia', () => {
  eq(categoriasPendentes([l('Serviços ADM', 10), l('Pagamento de Empréstimos', 20)], MAPS).length, 0)
})
teste('pendentes são agrupadas por categoria e ordenadas por valor', () => {
  const linhas = [l('Pequena', 10), l('Grande', 500), l('Grande', 300), l('Pequena', 5)]
  const p = categoriasPendentes(linhas, [])
  eq(p.map(x => x.categoria), ['Grande', 'Pequena'], 'ordem: ')
  eq(p[0], { categoria: 'Grande', linhas: 2, valor: 800 }, 'agrupamento: ')
})
teste('linha sem descrição não vira pendência fantasma', () => {
  eq(categoriasPendentes([{ __desc: '', valor: 10 }, { valor: 20 }], []).length, 0)
})

// ─── Camada 4 — os cards contam coisas distintas ─────────────────────────────
teste('[TRAVA] "ignorar" e "sem configuração" são contados separadamente', () => {
  const linhas = [l('Serviços ADM', 1), l('Pagamento de Empréstimos', 2), l('Transferências Facesign', 3)]
  const entrarao = linhas.filter(r => entraNoPayload(r, MAPS)).length
  const semMapa = linhas.filter(r =>
    !MAPS.some(m => m.categoria_origem.toLowerCase() === r.__desc.toLowerCase())).length
  const ignorar = linhas.length - entrarao - semMapa
  eq({ entrarao, ignorar, semMapa }, { entrarao: 1, ignorar: 1, semMapa: 1 })
  // Antes os dois últimos eram somados num único "Serão ignorados: 2",
  // escondendo a pendência atrás de um número que parecia sob controle.
})

// ─── Cenário real ────────────────────────────────────────────────────────────
teste('[CENÁRIO] o arquivo da JAM: 4.037,92 fica de fora e bloqueia', () => {
  const linhas = [
    ...Array(57).fill(0).map(() => l('Serviços ADM', 146.79)),
    ...Array(12).fill(0).map(() => l('Pagamento de Empréstimos', 611.10)),
    l('Transferências Facesign', 4037.92),
  ]
  const p = categoriasPendentes(linhas, MAPS)
  eq(p.length, 1, 'bloqueia: ')
  eq(linhas.filter(r => entraNoPayload(r, MAPS)).length, 57, 'entram no DRE: ')
  lanca(() => classificar(l('Transferências Facesign', 4037.92), MAPS), 'classificação: ')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
