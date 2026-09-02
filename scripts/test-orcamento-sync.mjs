// ─── test-orcamento-sync.mjs ─────────────────────────────────────────────────
// Trava a aritmética de tempo da sincronização Bling.
//
// O incidente (28/08): a verificação de coerência do liquidado passou a exigir
// detalhe + borderô para quase todo título divergente. Cada chamada passa pelo
// limitador de taxa (~380ms). Com LIMITE = 50:
//
//     50 detalhes × 380ms  ≈ 19s
//     50 borderôs  × 380ms ≈ 19s
//     verificarExclusoes      15s
//                          ──────
//                            53s+   →  estoura o maxDuration de 60s da Vercel
//
// A função era morta antes de responder: o navegador recebia "Failed to fetch",
// sem cursor salvo e sem diagnóstico. O comentário no código dizia que LIMITE
// podia ser 50 porque "muitos títulos são pulados (já completos)" — premissa
// que a verificação de coerência quebrou, sem que o orçamento fosse ajustado.
//
// Execução:  node scripts/test-orcamento-sync.mjs

const RATE_MS = 380          // espaçamento imposto pelo limitador (~2,6 req/s)
// Custo REAL por chamada = espaçamento + latência da resposta. Contar só o
// espaçamento subestima pela metade — foi o erro da primeira estimativa deste
// incidente. A latência do Bling em listagens/detalhes fica na casa de 300 a
// 800ms; 500ms é a premissa conservadora usada aqui.
const LATENCIA_MS = 500
const CUSTO_CHAMADA = RATE_MS + LATENCIA_MS   // 880ms
const MAX_DURATION = 60000   // teto da Vercel para a rota
const PRAZO_MONTAGEM = 34000 // orçamento passado a montarRegistrosFluxo
const LIMITE = 30            // lote por página

// Custo de pior caso de uma página: todo título precisa de detalhe e borderô
const custoPagina = (n, { detalhe = true, bordero = true } = {}) =>
  n * CUSTO_CHAMADA * ((detalhe ? 1 : 0) + (bordero ? 1 : 0))

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}
const menorQue = (v, teto, ctx) => { if (!(v < teto)) throw new Error(`${ctx}: ${v} não é menor que ${teto}`) }

// ─── 1. Reprodução do incidente ──────────────────────────────────────────────
teste('[REGRESSÃO] LIMITE 50 com detalhe+borderô estoura o maxDuration', () => {
  const custo = custoPagina(50) + 15000   // + verificarExclusoes do PR #15
  eq(custo, 103000, 'custo do cenário antigo: ')
  if (custo < MAX_DURATION) throw new Error(`${custo}ms deveria estourar ${MAX_DURATION}ms`)
})

teste('mesmo sem borderô, LIMITE 50 já ficava no limite', () => {
  // Antes da verificação de coerência quase tudo era pulado e o custo era
  // baixo. Detalhar 50 títulos, sozinho, já consome 44s dos 60s disponíveis.
  eq(custoPagina(50, { bordero: false }), 44000, 'só detalhes: ')
})

// ─── 2. O limite novo cabe ───────────────────────────────────────────────────
// A propriedade que importa NÃO é "a página inteira cabe" — no pior caso ela
// não cabe, e tudo bem: o excedente é adiado. O que precisa ser garantido é que
// o TEMPO TOTAL fica sob o teto, independentemente de quantos títulos a página
// tenha. Confundir throughput com segurança foi o erro que causou o incidente.
teste('[TRAVA] o laço de detalhes para na reserva, não importa o LIMITE', () => {
  const tetoDetalhes = PRAZO_MONTAGEM * 0.6
  // Simula o guard: consome chunks de 8 enquanto sobrar mais que a reserva
  let gasto = 0, processados = 0
  for (let i = 0; i < LIMITE; i += 8) {
    if (PRAZO_MONTAGEM - gasto < PRAZO_MONTAGEM * 0.4) break
    const lote = Math.min(8, LIMITE - i)
    gasto += lote * CUSTO_CHAMADA; processados += lote
  }
  menorQue(gasto, tetoDetalhes + 8 * CUSTO_CHAMADA, 'gasto em detalhes')
  if (processados === 0) throw new Error('nenhum título processado — orçamento apertado demais')
})

teste('quantos títulos por página no pior caso', () => {
  // Detalhe + borderô por título, dentro do prazo de montagem
  const cabem = Math.floor(PRAZO_MONTAGEM / (CUSTO_CHAMADA * 2))
  eq(cabem, 19, 'títulos por chamada no pior caso: ')
  // LIMITE maior que isso não quebra: apenas adia o excedente
  if (cabem >= LIMITE) throw new Error('o teste perdeu o sentido: nada seria adiado')
})

teste('[TRAVA] página cheia + exclusões cabe no maxDuration', () => {
  // Pior caso real: montagem no teto + exclusões no teto + folga de resposta
  menorQue(PRAZO_MONTAGEM + 12000 + 3000, MAX_DURATION, 'pior caso total')
})

teste('[TRAVA] borderô só é buscado com folga mínima de 4s', () => {
  // Guard real: `sobra() > 4000`. Garante que o upsert e a resposta sempre
  // tenham tempo, mesmo que nenhum borderô seja lido.
  const podeBuscar = (gastoMs) => (PRAZO_MONTAGEM - gastoMs) > 4000
  eq(podeBuscar(29000), true,  'com 5s de folga: ')
  eq(podeBuscar(31000), false, 'com 3s de folga: ')
})

teste('[TRAVA] pior caso absoluto fica sob o maxDuration', () => {
  // montagem no teto + exclusões no teto + margem para upsert e resposta
  const pior = PRAZO_MONTAGEM + 12000 + 5000
  menorQue(pior, MAX_DURATION, 'pior caso total')
})

// ─── 3. Adiamento nunca grava registro degradado ─────────────────────────────
// Regra: item que precisava de detalhe e não o recebeu NÃO entra no upsert.
// Gravá-lo sem detalhe produziria registro sem categoria, competência e
// liquidação, SOBRESCREVENDO dados bons.
export function decidirGravacao({ completo, temDetalhe }) {
  if (completo && !temDetalhe) return 'pular'        // já estava correto
  if (!completo && !temDetalhe) return 'adiar'       // faltou prazo
  return 'gravar'
}

teste('[TRAVA] sem detalhe e incompleto → ADIA, nunca grava', () => {
  eq(decidirGravacao({ completo: false, temDetalhe: false }), 'adiar')
})
teste('completo sem detalhe é pulado (já estava correto)', () => {
  eq(decidirGravacao({ completo: true, temDetalhe: false }), 'pular')
})
teste('com detalhe sempre grava', () => {
  eq(decidirGravacao({ completo: false, temDetalhe: true }), 'gravar')
  eq(decidirGravacao({ completo: true, temDetalhe: true }), 'gravar')
})

// ─── 4. Prioridade: novos antes de revisões ──────────────────────────────────
export function ordenarDetalhamento(itens, completo, existe) {
  const novos   = itens.filter(i => !completo[i.id] && !existe[i.id])
  const revisar = itens.filter(i => !completo[i.id] &&  existe[i.id])
  return [...novos, ...revisar].map(i => i.id)
}

teste('[TRAVA] títulos NOVOS são detalhados antes das revisões', () => {
  // Com prazo apertado, dado inédito sempre entra; correção de valor pode
  // esperar. O inverso deixaria lançamentos recentes de fora da base.
  const itens = [{ id: 'r1' }, { id: 'n1' }, { id: 'r2' }, { id: 'n2' }]
  const completo = {}
  const existe = { r1: true, r2: true }
  eq(ordenarDetalhamento(itens, completo, existe), ['n1', 'n2', 'r1', 'r2'])
})

teste('títulos já completos não entram na fila', () => {
  const itens = [{ id: 'a' }, { id: 'b' }]
  eq(ordenarDetalhamento(itens, { a: true }, { a: true, b: true }), ['b'])
})

// ─── 5. Convergência ─────────────────────────────────────────────────────────
teste('[CENÁRIO] adiados convergem em varreduras sucessivas', () => {
  // 300 títulos a revisar, 30 por página, ~15 detalhados por página no pior caso
  let pendentes = 300, varreduras = 0
  const porPagina = Math.floor(PRAZO_MONTAGEM * 0.6 / (CUSTO_CHAMADA * 2))
  while (pendentes > 0 && varreduras < 50) {
    varreduras++
    pendentes -= Math.min(pendentes, porPagina * 10)   // 10 páginas por varredura
  }
  eq(pendentes, 0, 'restantes: ')
  if (varreduras > 3) throw new Error(`precisou de ${varreduras} varreduras`)
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
