// ─── test-reconferencia.mjs ──────────────────────────────────────────────────
// Trava a fila de reconferência e o cron (16/10/2026).
//
// Os defeitos:
//   · Título que sai da listagem do Bling (excluído, substituído, cancelado)
//     ficava congelado. Casos confirmados: DATAPREV 26280211663, R$ 1,34 mi a
//     receber "vencido" que fora excluído; JULIANO BASILIO 23648043154,
//     parcial de R$ 10.000 de um título excluído, contado em dobro em julho.
//   · A verificação de exclusões só alcançava os ~30 títulos em aberto de
//     vencimento MAIS DISTANTE dentro de 90 dias — nunca os vencidos.
//   · O cron nunca autenticou: a Vercel só envia Bearer CRON_SECRET, e a rota
//     dependia de um header que não existe. 401 diário de 15/07 a 16/10.
//
// Execução:  node scripts/test-reconferencia.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copia = join(raiz, 'lib', `.bling-reconferencia.teste.${process.pid}.mjs`)
writeFileSync(copia, readFileSync(join(raiz, 'lib', 'bling-reconferencia.js'), 'utf8'))
const limpar = () => { try { rmSync(copia, { force: true }) } catch {} }
process.on('exit', limpar)
const R = await import(pathToFileURL(copia).href)

// Fontes para as travas estruturais — comentários removidos: eles descrevem o
// código antigo ("aceitava o header x-vercel-cron") e reprovariam a trava.
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const fonte = (rel) => semComentarios(readFileSync(join(raiz, rel), 'utf8'))
const corpoDe = (src, nome) => {
  const i = src.indexOf(nome)
  if (i < 0) throw new Error(`"${nome}" não encontrado`)
  const m = /\r?\n\}\r?\n/.exec(src.slice(i))
  return m ? src.slice(i, i + m.index + 2) : src.slice(i)
}

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}

const t = (o) => ({ doc_ref: 'bling:saida:100', status: 'aberto', data: '2026-07-15', origem_ausente: false, ...o })

// ─── 1. Quem entra na fila ───────────────────────────────────────────────────
teste('[TRAVA] em aberto que a listagem não devolveu entra na fila (DATAPREV)', () => {
  const titulos = [t({ doc_ref: 'bling:entrada:26280211663', data: '2026-09-21' })]
  eq(R.montarFila(titulos, ['999']), ['bling:entrada:26280211663'])
})
teste('[TRAVA] parcial fora da listagem entra na fila (JULIANO 15/07)', () => {
  const titulos = [t({ doc_ref: 'bling:saida:23648043154', status: 'parcial' })]
  eq(R.montarFila(titulos, []), ['bling:saida:23648043154'])
})
teste('título que a listagem devolveu NÃO entra', () => {
  eq(R.montarFila([t({ doc_ref: 'bling:saida:100' })], ['100']), [])
})
teste('pago e cancelado não entram (não há o que conferir em aberto)', () => {
  eq(R.montarFila([t({ status: 'pago' }), t({ doc_ref: 'bling:saida:101', status: 'cancelado' })], []), [])
})
teste('[TRAVA] registro que não veio do Bling nunca entra (R10.2)', () => {
  eq(R.montarFila([t({ doc_ref: 'manual:88' }), t({ doc_ref: null })], []), [])
})
teste('origem_ausente já marcada não entra', () => {
  eq(R.montarFila([t({ origem_ausente: true })], []), [])
})
teste('[TRAVA] vencido mais antigo primeiro — o defeito antigo pegava os mais distantes', () => {
  const titulos = [
    t({ doc_ref: 'bling:saida:3', data: '2031-02-28' }),
    t({ doc_ref: 'bling:saida:1', data: '2026-06-10' }),
    t({ doc_ref: 'bling:saida:2', data: '2026-09-15' }),
  ]
  eq(R.montarFila(titulos, []), ['bling:saida:1', 'bling:saida:2', 'bling:saida:3'])
})
teste('id comparado como texto (a listagem traz número, o doc_ref traz texto)', () => {
  eq(R.idsDaPagina([{ id: 26280211663 }, { id: '42' }, { id: null }, {}]), ['26280211663', '42'])
  eq(R.montarFila([t({ doc_ref: 'bling:entrada:26280211663' })], R.idsDaPagina([{ id: 26280211663 }])), [])
})

// ─── 2. Vistos ao longo da varredura ─────────────────────────────────────────
teste('vistos acumulam entre páginas', () => {
  eq(R.vistosAtualizados({ salvos: ['1', '2'], novos: ['2', '3'], recomecou: false }), ['1', '2', '3'])
})
teste('[TRAVA] varredura que recomeça zera os vistos', () => {
  eq(R.vistosAtualizados({ salvos: ['1', '2'], novos: ['9'], recomecou: true }), ['9'])
})
teste('[TRAVA] retomada NÃO zera — senão as páginas anteriores à pausa iriam para a fila', () => {
  eq(R.varreduraRecomecou({ fase: 1, pagina: 47, retomado: true }), false)
  eq(R.varreduraRecomecou({ fase: 0, pagina: 1, retomado: true }), false)
  eq(R.varreduraRecomecou({ fase: 0, pagina: 1, retomado: false }), true)
  eq(R.varreduraRecomecou({ fase: 0, pagina: 2, retomado: false }), false)
})

// ─── 3. Destino de cada título ───────────────────────────────────────────────
teste('existe no Bling → atualizar', () => {
  eq(R.decidirDestino(200), 'atualizar')
})
teste('404 nos dois recursos → remover', () => {
  eq(R.decidirDestino(404, 404), 'remover')
})
teste('existe no OUTRO recurso → descartar, não é exclusão', () => {
  eq(R.decidirDestino(404, 200), 'descartar')
})
teste('[TRAVA] falha transitória NUNCA remove', () => {
  for (const s of [401, 403, 429, 500, 502, 504, 0, undefined]) eq(R.decidirDestino(s, 404), 'manter', `HTTP ${s}: `)
  for (const s of [401, 429, 500, 504, undefined]) eq(R.decidirDestino(404, s), 'manter', `outro HTTP ${s}: `)
})
teste('[TRAVA] teto de remoções por execução', () => {
  eq(R.podeRemover(0), true)
  eq(R.podeRemover(R.MAX_REMOCOES_POR_EXECUCAO - 1), true)
  eq(R.podeRemover(R.MAX_REMOCOES_POR_EXECUCAO), false)
})
teste('doc_ref decomposto no recurso certo', () => {
  eq(R.partesDocRef('bling:entrada:7'), { tipoFluxo: 'entrada', id: '7', recurso: 'contas/receber', outroRecurso: 'contas/pagar' })
  eq(R.partesDocRef('bling:saida:8').recurso, 'contas/pagar')
  eq(R.partesDocRef('bling:dre:entrada:9'), null)
})

// ─── 4. Cron: rodízio e orçamento ────────────────────────────────────────────
teste('[TRAVA] rodízio: cada entidade é a primeira em algum dia', () => {
  const ents = ['FACE', 'JAM', 'JB']
  const primeiras = new Set([0, 1, 2].map(d => R.ordemRodizio(ents, d)[0]))
  eq(primeiras.size, 3)
  eq(R.ordemRodizio(ents, 1), ['JAM', 'JB', 'FACE'])
})
teste('fatia de tempo divide o que sobra entre as entidades restantes', () => {
  eq(R.janelaCron({ inicioGlobal: 0, agora: 0, entidadesRestantes: 3 }), Math.floor(R.CRON_TETO_MS / 3))
  eq(R.janelaCron({ inicioGlobal: 0, agora: 20000, entidadesRestantes: 1 }), R.CRON_TETO_MS - 20000)
  eq(R.janelaCron({ inicioGlobal: 0, agora: R.CRON_TETO_MS + 5000, entidadesRestantes: 2 }), 0)
})

// ─── 5. Travas estruturais ───────────────────────────────────────────────────
teste('[TRAVA] cron autentica SÓ por Bearer CRON_SECRET', () => {
  const src = fonte('app/api/cron/bling/route.js')
  if (/x-vercel-cron/.test(src)) throw new Error('voltou a aceitar o header x-vercel-cron, que a Vercel não envia e qualquer um forja')
  if (/searchParams/.test(src)) throw new Error('segredo na URL (?key=) vaza em logs')
  if (!/`Bearer \$\{segredo\}`/.test(src) || !/process\.env\.CRON_SECRET/.test(src))
    throw new Error('a comparação com Bearer CRON_SECRET sumiu')
  if (!/!segredo\s*\|\|/.test(src)) throw new Error('sem CRON_SECRET a rota tem de recusar, não aceitar')
})
teste('[TRAVA] cron passa orçamento de tempo a cada página', () => {
  const src = fonte('app/api/cron/bling/route.js')
  if (!/processarPaginaFluxo\([^;]*prazoMs/.test(src))
    throw new Error('página sem prazo usa o padrão de 32s, maior que a fatia da entidade')
  if (!/ordemRodizio\(/.test(src)) throw new Error('ordem fixa: a última entidade nunca era gravada')
})
teste('[TRAVA] DELETE de título do Bling existe num lugar só', () => {
  const src = fonte('lib/bling-server.js')
  const deletes = src.match(/from\('fluxo_caixa'\)\s*\.delete\(\)/g) || []
  eq(deletes.length, 1, 'DELETEs em fluxo_caixa: ')
  if (!/export async function removerTituloExcluido/.test(src)) throw new Error('removerTituloExcluido sumiu')
  for (const nome of ['export async function verificarExclusoes', 'export async function processarFilaReconferencia'])
    if (!/removerTituloExcluido\(/.test(corpoDe(src, nome))) throw new Error(`${nome} não usa a remoção única`)
})
teste('[TRAVA] a fila respeita o teto e só remove com 404 nos dois recursos', () => {
  const fn = corpoDe(fonte('lib/bling-server.js'), 'export async function processarFilaReconferencia')
  if (!/podeRemover\(/.test(fn)) throw new Error('sem teto de remoções')
  if (!/decidirDestino\(/.test(fn)) throw new Error('decisão de remover fora da regra única')
})
teste('[TRAVA] a sincronização só monta a fila no incremental do Fluxo', () => {
  const src = fonte('app/api/integracoes/bling/sync/route.js')
  if (!/rastreia\s*=\s*escopo === 'incremental' && modulo === 'fluxo' && !diag/.test(src))
    throw new Error('vistos/fila fora do incremental do Fluxo misturariam varreduras de outro escopo')
  if (!/montarFila\(/.test(src) || !/vistosAtualizados\(/.test(src)) throw new Error('fila não montada na varredura')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
