// ─── test-exclusoes-alvos.mjs ────────────────────────────────────────────────
// Trava a regra de seleção de alvos da verificação de exclusões na origem.
//
// Histórico da regra:
//   28/08 — caso TELEFONICA/JAM: a rotina filtrava só por
//           .gte('data_liquidacao', desde). Em Postgres, comparação com NULL é
//           FALSA: título EM ABERTO nunca era conferido. Corrigido acrescentando
//           um segundo grupo, "em aberto pelo vencimento".
//   16/10 — esse segundo grupo pegava os ~30 em aberto de vencimento MAIS
//           DISTANTE dentro de 90 dias (parcelas de 2031, que existem) e nunca
//           os vencidos que haviam sumido do Bling: DATAPREV R$ 1,34 mi,
//           JULIANO 15/07. Os em aberto e parciais saíram DAQUI e foram para a
//           fila de reconferência, montada com o que a listagem de fato não
//           devolveu, sem janela de datas — ver test-reconferencia.mjs.
//
// Estes testes exercitam a REGRA de elegibilidade, não o I/O. A função real
// consulta o Supabase; aqui replicamos o predicado que ela aplica, e uma trava
// estrutural confere que a réplica continua igual ao código.
//
// Execução:  node scripts/test-exclusoes-alvos.mjs
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Predicado equivalente à consulta de verificarExclusoes(): liquidados recentes
export function elegivel(t, desde) {
  if (t.origem_ausente) return false
  if (!String(t.doc_ref || '').startsWith('bling:')) return false
  return !!(t.data_liquidacao && t.data_liquidacao >= desde)
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

teste('[TRAVA] em aberto NÃO é alvo daqui — vai para a fila de reconferência', () => {
  // O caso TELEFONICA continua coberto, agora pela fila (test-reconferencia):
  // a fila confere o em aberto que sumiu da listagem, sem janela de datas.
  eq(elegivel(t({ status: 'aberto', data_liquidacao: null, data: '2026-07-22' }), DESDE), false)
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

teste('cancelado sem liquidação não é alvo', () => {
  eq(elegivel(t({ status: 'cancelado', data_liquidacao: null, data: '2026-07-22' }), DESDE), false)
})

teste('[TRAVA] a réplica bate com o código de verificarExclusoes', () => {
  const src = readFileSync(join(raiz, 'lib', 'bling-server.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const i = src.indexOf('export async function verificarExclusoes')
  const m = /\r?\n\}\r?\n/.exec(src.slice(i))
  const fn = src.slice(i, i + m.index)
  if (!/\.gte\('data_liquidacao', desde\)/.test(fn)) throw new Error('grupo dos liquidados mudou sem atualizar a réplica')
  if (/\.in\('status', \['aberto', 'parcial'\]\)/.test(fn))
    throw new Error('verificarExclusoes voltou a selecionar em aberto — duplica a fila e reintroduz o defeito de 16/10')
  if (!/\.eq\('origem_ausente', false\)/.test(fn) || !/\.like\('doc_ref', 'bling:%'\)/.test(fn))
    throw new Error('filtros de origem sumiram da consulta')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
