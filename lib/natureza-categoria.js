// ─── natureza-categoria.js — classificação de categorias ────────────────────
//
// FONTE ÚNICA da regra que decide o que entra nos KPIs operacionais.
//
// ── Onde a regra vive ───────────────────────────────────────────────────────
// Na coluna `natureza` de PLANO_CONTAS, gerida na tela do Plano de Contas.
// A resolução é em cadeia:
//
//     categoria do lançamento → categoria_mappings → conta → conta.natureza
//
// Decisão do Controller (16/09): o plano já é o cadastro central das contas;
// uma segunda tabela de classificação criaria duas fontes de verdade.
//
// ⚠️ `natureza` é ORTOGONAL a `tipo`. `tipo` define a posição no DRE;
// `natureza` define a entrada nos KPIs operacionais. Alterar natureza não
// afeta o DRE, e nenhuma tela de DRE a consulta.
//
// ⚠️ CATEGORIA SEM CONTA resolve para 'operacional'. Verificação de 16/09
// sobre 130 categorias: das 23 sem mapeamento, apenas 5 eram não-operacionais;
// as outras 18 eram despesas e receitas a mapear, somando ~R$ 2,2 milhões
// (Impostos sobre receitas, IRPJ/CSLL, Vale alimentação). Inferir
// "não mapeado = fora do KPI" inflaria o resultado operacional. Ausência de
// mapeamento significa "ainda não configurado", não "não é operacional" — a
// mesma confusão corrigida no PR #18.
//
// ── O problema ──────────────────────────────────────────────────────────────
// Medido em 11/09/2026, consolidado das três entidades, 01/01 a 12/09:
// transferências entre FACE, JAM e JB somavam 44,0% das entradas e 44,3% das
// saídas. É o mesmo dinheiro circulando dentro do grupo — consolidação elimina
// operação intragrupo, e o sistema somava as duas pontas.
//
// O Índice de Cobertura era o mais comprometido: com ~44% do mesmo valor nos
// dois lados, ele converge para 1,0 por construção matemática, não por
// desempenho. Uma operação em dificuldade pareceria equilibrada.
//
// ── As quatro naturezas ─────────────────────────────────────────────────────
// `operacional`            receita e despesa do negócio — padrão
// `transferencia_interna`  dinheiro entre entidades do grupo
// `aporte_socio`           aporte de capital, distribuição de resultados
// `emprestimo`             obtenção e pagamento de financiamento
//
// Não é um booleano "ignorar" porque os tratamentos diferem: transferência se
// anula no consolidado mas é caixa real na entidade isolada; aporte é entrada
// legítima que não é receita; empréstimo é financiamento.

export const NATUREZAS = {
  operacional:           { rotulo: 'Operacional',            kpi: true,  desc: 'Receita e despesa do negócio. Entra em todos os indicadores.' },
  transferencia_interna: { rotulo: 'Transferência interna',  kpi: false, desc: 'Dinheiro entre entidades do grupo. Anula-se no consolidado.' },
  aporte_socio:          { rotulo: 'Aporte / distribuição',  kpi: false, desc: 'Capital de sócio. É caixa, mas não é receita nem despesa.' },
  emprestimo:            { rotulo: 'Empréstimo',             kpi: false, desc: 'Financiamento. É caixa, mas não é operação.' },
}

export const NATUREZA_PADRAO = 'operacional'

// Naturezas que compõem os indicadores OPERACIONAIS (cobertura, ticket médio,
// burn rate, composição). As demais continuam no SALDO de caixa — transferência
// recebida está no banco, e excluí-la do saldo criaria divergência contra o
// extrato, o oposto de todo o trabalho de conciliação.
export const NATUREZAS_OPERACIONAIS = ['operacional']

const norm = (c) => String(c ?? '').trim().toLowerCase()

// Índice categoria → natureza, montado a partir do De-Para e do plano de
// contas. Ausência significa `operacional`.
//
//   mapeamentos  [{ categoria_origem, conta_id }]
//   contas       [{ id, natureza }]
export function indexarNaturezas(mapeamentos, contas) {
  const porConta = new Map()
  for (const c of contas || []) if (c?.id) porConta.set(c.id, c.natureza || NATUREZA_PADRAO)

  const mapa = new Map()
  for (const m of mapeamentos || []) {
    const k = norm(m?.categoria_origem ?? m?.categoria)
    if (!k) continue
    // Aceita tanto a forma nova (via conta) quanto natureza direta na linha,
    // o que mantém os testes e eventuais chamadas legadas funcionando.
    const nat = m?.natureza || (m?.conta_id ? porConta.get(m.conta_id) : null)
    if (nat) mapa.set(k, nat)
  }
  return mapa
}

export function naturezaDe(categoria, mapa) {
  if (!mapa) return NATUREZA_PADRAO
  const get = mapa instanceof Map ? (k) => mapa.get(k) : (k) => mapa[k]
  return get(norm(categoria)) || NATUREZA_PADRAO
}

export function ehOperacional(categoria, mapa) {
  return NATUREZAS_OPERACIONAIS.includes(naturezaDe(categoria, mapa))
}

// Separa uma lista em operacional e excluído, com o total de cada natureza.
// Devolver o excluído — em vez de simplesmente filtrar — é deliberado: a tela
// precisa DECLARAR o que tirou. Número filtrado sem declarar o filtro é a mesma
// armadilha do "Registros sem mapeamento não entram no DRE", onde a interface
// afirmava algo que o cálculo não fazia.
export function separarPorNatureza(itens, mapa, campoCategoria = 'categoria') {
  const operacional = [], excluido = []
  const porNatureza = {}
  for (const i of itens || []) {
    const nat = naturezaDe(i?.[campoCategoria], mapa)
    const v = Math.abs(Number(i?.valor) || 0)
    porNatureza[nat] = (porNatureza[nat] || 0) + v
    if (NATUREZAS_OPERACIONAIS.includes(nat)) operacional.push(i)
    else excluido.push(i)
  }
  const r2 = (x) => Math.round(x * 100) / 100
  for (const k of Object.keys(porNatureza)) porNatureza[k] = r2(porNatureza[k])
  return {
    operacional, excluido,
    totalOperacional: r2(operacional.reduce((a, i) => a + Math.abs(Number(i?.valor) || 0), 0)),
    totalExcluido:    r2(excluido.reduce((a, i) => a + Math.abs(Number(i?.valor) || 0), 0)),
    porNatureza,
  }
}

// ── Sugestão automática, NUNCA aplicada sozinha ─────────────────────────────
// Pré-marca o que parece transferência, aporte ou empréstimo para que o usuário
// confirme. Adivinhar e aplicar em silêncio foi exatamente o defeito corrigido
// no PR #18, onde categoria sem De-Para entrava classificada por heurística.
const PISTAS = [
  [/transfer|transf\.|entre contas|intercompany|intragrupo/i, 'transferencia_interna'],
  [/aporte|distribui[cç][aã]o de resultado|retirada de s[oó]cio|capital social/i, 'aporte_socio'],
  [/empr[eé]stimo|financiamento|mútuo|mutuo/i, 'emprestimo'],
]

export function sugerirNatureza(categoria) {
  const c = String(categoria ?? '')
  for (const [re, nat] of PISTAS) if (re.test(c)) return nat
  return null   // null = sem sugestão; NÃO é o mesmo que 'operacional'
}

// Fila de trabalho: categorias sem classificação, por volume decrescente.
// Com 20 ou 30 classificações o grosso do volume é coberto.
export function pendentesDeClassificacao(itens, mapa, campoCategoria = 'categoria') {
  const agg = new Map()
  for (const i of itens || []) {
    const cat = String(i?.[campoCategoria] ?? '').trim()
    if (!cat) continue
    const k = norm(cat)
    const jaTem = mapa instanceof Map ? mapa.has(k) : Object.prototype.hasOwnProperty.call(mapa || {}, k)
    if (jaTem) continue
    const at = agg.get(k) || { categoria: cat, lancamentos: 0, valor: 0, sugestao: sugerirNatureza(cat) }
    at.lancamentos++; at.valor += Math.abs(Number(i?.valor) || 0)
    agg.set(k, at)
  }
  return [...agg.values()]
    .map(x => ({ ...x, valor: Math.round(x.valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor)
}
