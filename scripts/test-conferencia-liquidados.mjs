// ─── test-conferencia-liquidados.mjs ─────────────────────────────────────────
// Trava a conferência dos liquidados pela listagem filtrada (20/10/2026).
//
// O defeito: um pagamento excluído no Bling some da listagem e, como aqui já
// estava completo, nunca mais era conferido. A verificação de exclusões olhava
// sempre os 40–60 liquidados mais recentes — na FACE, a última semana.
// Conciliação do Controller contra o relatório de pagamentos do Bling:
//   · MERCADO LIVRE 26414983916, R$ 1.805,99 em 23/07 — inexistente no Bling
//   · RAPHAEL BERBEL PITTA 26317080212, R$ 946,40 em 10/07 — virou dois títulos
//   · PLAYSTATION CURITIBA, R$ 43,90 em 17/08 — em dobro aqui
//
// Execução:  node scripts/test-conferencia-liquidados.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copia = join(raiz, 'lib', `.bling-reconferencia.liquidados.${process.pid}.mjs`)
writeFileSync(copia, readFileSync(join(raiz, 'lib', 'bling-reconferencia.js'), 'utf8'))
const limpar = () => { try { rmSync(copia, { force: true }) } catch {} }
process.on('exit', limpar)
const R = await import(pathToFileURL(copia).href)

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

const HOJE = new Date('2026-10-20T15:00:00Z')
const JANELA = R.janelaLiquidados(HOJE)
const t = (o) => ({ doc_ref: 'bling:saida:100', status: 'pago', data_liquidacao: '2026-07-23', origem_ausente: false, ...o })
const horas = (h) => new Date(HOJE.getTime() - h * 3600000).toISOString()

// ─── 1. Janela e filtros ─────────────────────────────────────────────────────
teste('janela: hoje e os 365 dias anteriores (o Bling recusa mais de 366)', () => {
  eq(JANELA, { inicio: '2025-10-20', fim: '2026-10-20' })
  const dias = (Date.parse(JANELA.fim) - Date.parse(JANELA.inicio)) / 86400000 + 1
  if (dias > 366) throw new Error(`janela de ${dias} dias`)
})
teste('[TRAVA] filtros por data de pagamento idênticos aos da carga histórica', () => {
  const j = { inicio: '2026-01-01', fim: '2026-10-20' }
  eq(R.FASES_LIQUIDADOS.map(f => R.filtrosPorPagamento(f, j)), [
    { situacoes: [2, 3], tipoFiltroData: 'R', dataInicial: j.inicio, dataFinal: j.fim },
    { situacao: 2, dataPagamentoInicial: j.inicio, dataPagamentoFinal: j.fim },
    { situacao: 3, dataPagamentoInicial: j.inicio, dataPagamentoFinal: j.fim },
  ])
  eq(R.FASES_LIQUIDADOS.map(f => f.recurso), ['contas/receber', 'contas/pagar', 'contas/pagar'])
})

// ─── 2. Avanço da listagem ───────────────────────────────────────────────────
teste('página cheia avança a página e acumula ids sem repetir', () => {
  const e = R.avancarListagem({ ...R.novaRodadaLiquidados(HOJE), vistos: ['1'] }, { ids: ['1', '2'], paginaCheia: true })
  eq([e.etapa, e.fase, e.pagina, e.vistos], ['listagem', 0, 2, ['1', '2']])
})
teste('página incompleta passa para a fase seguinte', () => {
  const e = R.avancarListagem({ ...R.novaRodadaLiquidados(HOJE), pagina: 7 }, { ids: ['9'], paginaCheia: false })
  eq([e.etapa, e.fase, e.pagina], ['listagem', 1, 1])
})
teste('[TRAVA] só compara depois da ÚLTIMA página da ÚLTIMA fase', () => {
  const ultima = R.FASES_LIQUIDADOS.length - 1
  const cheia = R.avancarListagem({ ...R.novaRodadaLiquidados(HOJE), fase: ultima }, { ids: ['1'], paginaCheia: true })
  eq(cheia.etapa, 'listagem', 'página cheia na última fase: ')
  const fim = R.avancarListagem({ ...R.novaRodadaLiquidados(HOJE), fase: ultima }, { ids: ['1'], paginaCheia: false })
  eq(fim.etapa, 'comparar')
})

// ─── 3. Candidatos ───────────────────────────────────────────────────────────
teste('[TRAVA] pago que a listagem não devolveu é candidato (MERCADO LIVRE)', () => {
  eq(R.candidatosLiquidados([t({ doc_ref: 'bling:saida:26414983916' })], ['1'], JANELA), ['bling:saida:26414983916'])
})
teste('[TRAVA] pago que a listagem devolveu NÃO é candidato', () => {
  eq(R.candidatosLiquidados([t({ doc_ref: 'bling:saida:26414983916' })], ['26414983916'], JANELA), [])
})
teste('título em dobro: só o que o Bling não devolveu (PLAYSTATION 17/08)', () => {
  const titulos = [t({ doc_ref: 'bling:saida:26652202409', data_liquidacao: '2026-08-17' }),
                   t({ doc_ref: 'bling:saida:26751577999', data_liquidacao: '2026-08-17' })]
  eq(R.candidatosLiquidados(titulos, ['26652202409'], JANELA), ['bling:saida:26751577999'])
})
teste('parcial também é candidato; aberto e cancelado nunca', () => {
  const titulos = [t({ doc_ref: 'bling:saida:1', status: 'parcial' }), t({ doc_ref: 'bling:saida:2', status: 'aberto' }),
                   t({ doc_ref: 'bling:saida:3', status: 'cancelado' })]
  eq(R.candidatosLiquidados(titulos, [], JANELA), ['bling:saida:1'])
})
teste('[TRAVA] sem doc_ref do Bling nunca é candidato (R10.2)', () => {
  eq(R.candidatosLiquidados([t({ doc_ref: null }), t({ doc_ref: 'csv:123' })], [], JANELA), [])
})
teste('marcado como ausente não entra', () => {
  eq(R.candidatosLiquidados([t({ origem_ausente: true })], [], JANELA), [])
})
teste('[TRAVA] margem de 45 dias no início da janela (data do borderô ≠ data de pagamento)', () => {
  const borda = t({ doc_ref: 'bling:saida:1', data_liquidacao: '2025-11-01' })
  const dentro = t({ doc_ref: 'bling:saida:2', data_liquidacao: '2025-12-04' })
  eq(R.candidatosLiquidados([borda, dentro], [], JANELA), ['bling:saida:2'])
})
teste('liquidação depois do fim da janela ou sem data não entra', () => {
  eq(R.candidatosLiquidados([t({ data_liquidacao: '2026-10-21' }), t({ doc_ref: 'bling:saida:5', data_liquidacao: null })], [], JANELA), [])
})
teste('mais antigos primeiro', () => {
  const titulos = [t({ doc_ref: 'bling:saida:2', data_liquidacao: '2026-08-17' }), t({ doc_ref: 'bling:saida:1', data_liquidacao: '2026-07-10' })]
  eq(R.candidatosLiquidados(titulos, [], JANELA), ['bling:saida:1', 'bling:saida:2'])
})

// ─── 4. Plausibilidade ───────────────────────────────────────────────────────
teste('[TRAVA] listagem incompleta não vira remoção em massa: teto de 5% (mín. 20)', () => {
  eq([R.filaPlausivel(108, 2160), R.filaPlausivel(109, 2160)], [true, false], 'FACE 2.160 pagos: ')
  eq([R.filaPlausivel(20, 51), R.filaPlausivel(21, 51)], [true, false], 'JAM 51 pagos: ')
  eq(R.filaPlausivel(2160, 2160), false, 'listagem vazia: ')
})

// ─── 5. Retomada e repetição ─────────────────────────────────────────────────
teste('manual: sem rodada, ou ilegível, abre uma nova', () => {
  eq([R.acaoManualLiquidados(null, HOJE), R.acaoManualLiquidados({ etapa: 'fila' }, HOJE)], ['nova', 'nova'])
})
teste('manual: rodada em curso até 3 dias continua — inclusive parada em "comparar"', () => {
  for (const etapa of ['listagem', 'comparar', 'fila'])
    eq(R.acaoManualLiquidados({ etapa, iniciada_em: horas(48) }, HOJE), 'continuar', `${etapa}: `)
})
teste('[TRAVA] manual: rodada em curso velha recomeça (vistos de outra janela)', () => {
  eq(R.acaoManualLiquidados({ etapa: 'listagem', iniciada_em: horas(24 * 4) }, HOJE), 'nova')
})
teste('manual: concluída há menos de 24 h não repete; depois disso, nova', () => {
  eq(R.acaoManualLiquidados({ etapa: 'concluida', iniciada_em: horas(3), concluida_em: horas(2) }, HOJE), 'pular')
  eq(R.acaoManualLiquidados({ etapa: 'concluida', iniciada_em: horas(31), concluida_em: horas(30) }, HOJE), 'nova')
})
teste('manual: rodada suspeita é refeita', () => {
  eq(R.acaoManualLiquidados({ etapa: 'suspeita', iniciada_em: horas(2), concluida_em: horas(1) }, HOJE), 'nova')
})
teste('cron: continua qualquer rodada em curso e abre nova a cada 7 dias', () => {
  eq(R.acaoCronLiquidados({ etapa: 'listagem', iniciada_em: horas(24 * 10) }, HOJE), 'continuar')
  eq(R.acaoCronLiquidados({ etapa: 'concluida', concluida_em: horas(24 * 3) }, HOJE), 'pular')
  eq(R.acaoCronLiquidados({ etapa: 'concluida', concluida_em: horas(24 * 8) }, HOJE), 'nova')
  eq(R.acaoCronLiquidados(null, HOJE), 'nova')
})
teste('resumo do estado não expõe as listas de ids', () => {
  const r = R.resumoEstadoLiquidados({ ...R.novaRodadaLiquidados(HOJE), vistos: ['1', '2'], fila: ['bling:saida:3'] })
  eq([r.vistos, r.pendentes, r.etapa], [2, 1, 'listagem'])
  if (JSON.stringify(r).includes('bling:saida')) throw new Error('doc_ref vazou no resumo')
})

// ─── 6. Travas estruturais ───────────────────────────────────────────────────
const server = fonte('lib/bling-server.js')
teste('[TRAVA] página com erro não avança a listagem', () => {
  const fn = corpoDe(server, 'export async function conferirLiquidados')
  const m = /catch \(err\) \{([\s\S]*?)\n    \}/.exec(fn)
  if (!m) throw new Error('fetchContas sem tratamento de erro')
  if (!/return \{ estado: e, resumo \}/.test(m[1])) throw new Error('o erro da página tem de encerrar a fatia sem avançar')
  if (/avancarListagem/.test(m[1])) throw new Error('avançou a listagem depois de uma página com erro')
})
teste('[TRAVA] candidatos passam pela plausibilidade antes de virar fila', () => {
  const fn = corpoDe(server, 'export async function conferirLiquidados')
  const iPl = fn.indexOf('filaPlausivel('), iFila = fn.indexOf("etapa: 'fila'")
  if (iPl < 0 || iFila < 0 || iPl > iFila) throw new Error('a fila é montada sem a trava de plausibilidade')
})
teste('[TRAVA] remoção dos liquidados pela fila única (decidirDestino + teto + audit)', () => {
  const fn = corpoDe(server, 'export async function conferirLiquidados')
  if (!/processarFilaReconferencia\(/.test(fn)) throw new Error('não usa a fila de reconferência')
  if (!/statusAlvo:\s*\['pago', 'parcial'\]/.test(fn)) throw new Error('a fila dos liquidados precisa de statusAlvo pago/parcial')
  if (/removerTituloExcluido\(|\.delete\(\)/.test(fn)) throw new Error('remoção fora da fila única')
})
teste('[TRAVA] a fila de reconferência continua só para em aberto por padrão', () => {
  const fn = corpoDe(server, 'export async function processarFilaReconferencia')
  if (!/statusAlvo = \['aberto', 'parcial'\]/.test(fn)) throw new Error('padrão de statusAlvo mudou')
  if (!/statusAlvo\.includes\(t\.status\)/.test(fn)) throw new Error('statusAlvo não é aplicado')
})
teste('[TRAVA] título removido vai inteiro para o audit_logs', () => {
  for (const nome of ['export async function verificarExclusoes', 'export async function processarFilaReconferencia'])
    if (!/const sel = '\*'/.test(corpoDe(server, nome))) throw new Error(`${nome} lê só parte do registro`)
})
teste('[TRAVA] carga histórica usa as fases e filtros únicos', () => {
  const src = fonte('app/api/integracoes/bling/sync/route.js')
  if (!/FASES_HISTORICO = FASES_LIQUIDADOS/.test(src)) throw new Error('fases do histórico copiadas')
  if (/dataPagamentoInicial/.test(src)) throw new Error('filtro por data de pagamento duplicado na rota')
  if (!/filtrosPorPagamento\(faseAtual, janelaAtual\)/.test(src)) throw new Error('histórico sem filtrosPorPagamento')
})
teste('[TRAVA] a rota manual decide a rodada pela regra única e grava o estado', () => {
  const src = fonte('app/api/integracoes/bling/sync/route.js')
  if (!/acaoManualLiquidados\(/.test(src) || !/conferirLiquidados\(/.test(src)) throw new Error('modo conferir_liquidados incompleto')
  if (!/update\(\{ conferencia_liquidados: novo \}\)/.test(src)) throw new Error('estado da rodada não gravado')
})
teste('[TRAVA] cron confere os liquidados com prazo e pela regra do cron', () => {
  const src = fonte('app/api/cron/bling/route.js')
  if (!/conferirLiquidados\([^;]*prazoMs/.test(src)) throw new Error('cron sem prazo na conferência dos liquidados')
  if (!/acaoCronLiquidados\(/.test(src)) throw new Error('cron sem a regra de rodada')
})
teste('[TRAVA] interface só confere liquidados no incremental do Fluxo', () => {
  const src = fonte('components/IntegracoesTab.jsx')
  if (!/while \(concluido && !historico && modulo === 'fluxo'[^)]*\)[\s\S]{0,400}conferir_liquidados: true/.test(src))
    throw new Error('laço de conferir_liquidados sem a guarda do incremental do Fluxo')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
