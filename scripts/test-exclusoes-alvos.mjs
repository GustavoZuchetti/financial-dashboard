// ─── test-exclusoes-alvos.mjs ────────────────────────────────────────────────
// Trava a regra de seleção de alvos da verificação de exclusões na origem.
//
// O defeito (relatado em 28/08 — TELEFONICA/JAM): a rotina filtrava por
//     .gte('data_liquidacao', desde)
// Em Postgres, comparação com NULL é FALSA. Título EM ABERTO não tem data de
// liquidação, então nunca era conferido — e um título em aberto excluído no
// Bling ficava na base PARA SEMPRE, inflando "A Pagar" e o projetado.
//
// Estes testes exercitam a REGRA de elegibilidade, não o I/O. A função real
// consulta o Supabase; aqui replicamos o predicado que ela aplica, e a trava
// existe para que qualquer alteração no filtro tenha de passar por aqui.
//
// Execução:  node scripts/test-exclusoes-alvos.mjs

// Predicado equivalente ao das duas consultas de verificarExclusoes()
export function elegivel(t, desde) {
  if (t.origem_ausente) return false
  if (!String(t.doc_ref || '').startsWith('bling:')) return false
  // Grupo 1 — liquidados recentes, pela data de liquidação
  if (t.data_liquidacao && t.data_liquidacao >= desde) return true
  // Grupo 2 — em aberto e parciais, pelo vencimento
  if (['aberto', 'parcial'].includes(t.status) && t.data && t.data >= desde) return true
  return false
}

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}

const DESDE = '2026-06-01'
const t = (o) => ({ doc_ref: 'bling:saida:123', origem_ausente: false, status: 'pago',
                    data: '2026-07-10', data_liquidacao: null, ...o })

teste('liquidado dentro da janela é verificado', () => {
  eq(elegivel(t({ data_liquidacao: '2026-07-15' }), DESDE), true)
})
teste('liquidado antes da janela fica fora', () => {
  eq(elegivel(t({ data_liquidacao: '2026-01-10' }), DESDE), false)
})

teste('[TRAVA] título EM ABERTO é verificado (o caso TELEFONICA)', () => {
  // Sem esta regra, um em aberto apagado no Bling permanece na base para sempre
  eq(elegivel(t({ status: 'aberto', data_liquidacao: null, data: '2026-07-22' }), DESDE), true)
})

teste('[TRAVA] parcial sem data de liquidação é verificado', () => {
  eq(elegivel(t({ status: 'parcial', data_liquidacao: null, data: '2026-08-01' }), DESDE), true)
})

teste('[REGRESSÃO] o filtro antigo deixava em aberto de fora', () => {
  // Reproduz o predicado anterior — só data_liquidacao >= desde
  const antigo = (x) => !!(x.data_liquidacao && x.data_liquidacao >= DESDE)
  const emAberto = t({ status: 'aberto', data_liquidacao: null, data: '2026-07-22' })
  eq(antigo(emAberto), false, 'filtro antigo: ')
  eq(elegivel(emAberto, DESDE), true, 'filtro novo: ')
})

teste('em aberto com vencimento antigo fica fora da janela', () => {
  eq(elegivel(t({ status: 'aberto', data_liquidacao: null, data: '2025-03-01' }), DESDE), false)
})

teste('parcial JÁ liquidado entra pelo grupo dos liquidados', () => {
  eq(elegivel(t({ status: 'parcial', data_liquidacao: '2026-07-30', data: '2026-09-10' }), DESDE), true)
})

teste('registro não originado do Bling nunca é alvo', () => {
  // Lançamento manual ou importado por planilha não pode ser removido por
  // "não existe no Bling" — ele nunca existiu lá.
  eq(elegivel(t({ doc_ref: 'manual:88', data_liquidacao: '2026-07-15' }), DESDE), false)
  eq(elegivel(t({ doc_ref: null, status: 'aberto', data: '2026-07-22' }), DESDE), false)
})

teste('[TRAVA] origem_ausente já marcada não é reprocessada', () => {
  eq(elegivel(t({ origem_ausente: true, data_liquidacao: '2026-07-15' }), DESDE), false)
})

teste('cancelado não entra pelo grupo de em aberto', () => {
  eq(elegivel(t({ status: 'cancelado', data_liquidacao: null, data: '2026-07-22' }), DESDE), false)
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
