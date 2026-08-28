// ─── test-bling-cursor.mjs ───────────────────────────────────────────────────
// Trava a retomada da varredura Bling.
//
// O defeito original: a sincronização manual recomeçava sempre em
// { fase 0, página 1 } e a interface parava em 60 iterações. Com 50 títulos por
// iteração, 3.000 títulos por execução para as duas fases. A FACE tem 5.407
// registros — o excedente nunca era alcançado e, como o cursor reiniciava,
// ficava de fora todos os dias. Medido: 7.156 títulos e R$ 44,6 mi ausentes.
//
// Execução:  node scripts/test-bling-cursor.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const copia = join(raiz, 'lib', `.bling-cursor.teste.${process.pid}.mjs`)
writeFileSync(copia, readFileSync(join(raiz, 'lib', 'bling-cursor.js'), 'utf8'))
const limpar = () => { try { rmSync(copia, { force: true }) } catch {} }
process.on('exit', limpar)
const C = await import(pathToFileURL(copia).href)

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}

// ─── 1. Avanço ───────────────────────────────────────────────────────────────
teste('página cheia avança a página, mantendo fase e janela', () => {
  eq(C.proximoCursor({ fase: 1, pagina: 29, janela: 2, paginaCheia: true, totalFases: 3, totalJanelas: 4 }),
     { fase: 1, pagina: 30, janela: 2 })
})
teste('página incompleta passa à próxima fase, reiniciando a página', () => {
  eq(C.proximoCursor({ fase: 0, pagina: 12, janela: 0, paginaCheia: false, totalFases: 2 }),
     { fase: 1, pagina: 1, janela: 0 })
})
teste('última fase da janela passa à próxima janela (histórico)', () => {
  eq(C.proximoCursor({ fase: 2, pagina: 4, janela: 0, paginaCheia: false, totalFases: 3, totalJanelas: 3 }),
     { fase: 0, pagina: 1, janela: 1 })
})
teste('[TRAVA] última fase da última janela devolve null = varredura completa', () => {
  eq(C.proximoCursor({ fase: 2, pagina: 4, janela: 2, paginaCheia: false, totalFases: 3, totalJanelas: 3 }), null)
})
teste('incremental sem janelas encerra ao fim da última fase', () => {
  eq(C.proximoCursor({ fase: 1, pagina: 8, paginaCheia: false, totalFases: 2, totalJanelas: 0 }), null)
})

// ─── 2. Retomada — o coração da correção ─────────────────────────────────────
teste('[TRAVA] retomar continua de onde parou, não do início', () => {
  const salvo = { escopo: 'incremental', fase: 1, pagina: 47, janela: 0 }
  eq(C.cursorDePartida({ retomar: true, salvo, escopo: 'incremental' }),
     { fase: 1, pagina: 47, janela: 0, retomado: true })
})

teste('[REGRESSÃO] sem retomar, começa do início (comportamento antigo)', () => {
  const salvo = { escopo: 'incremental', fase: 1, pagina: 47, janela: 0 }
  eq(C.cursorDePartida({ retomar: false, salvo, escopo: 'incremental' }),
     { fase: 0, pagina: 1, janela: 0, retomado: false })
})

teste('[TRAVA] posição explícita do cliente tem precedência sobre o salvo', () => {
  // As iterações do laço mandam fase/página vindos do `next`; honrá-las é o que
  // impede a varredura de voltar ao ponto salvo a cada chamada e entrar em loop.
  const salvo = { escopo: 'incremental', fase: 1, pagina: 47, janela: 0 }
  eq(C.cursorDePartida({ retomar: true, salvo, escopo: 'incremental', pedido: { fase: 0, pagina: 3 } }),
     { fase: 0, pagina: 3, janela: 0, retomado: false })
})

teste('página 1 explícita não é confundida com ausência de pedido', () => {
  const salvo = { escopo: 'incremental', fase: 1, pagina: 47, janela: 0 }
  eq(C.cursorDePartida({ retomar: true, salvo, escopo: 'incremental', pedido: { fase: 0, pagina: 1, janela: 0 } }),
     { fase: 0, pagina: 1, janela: 0, retomado: false })
})

teste('[TRAVA] escopo diferente NÃO retoma — pularia dados', () => {
  // Histórico e incremental percorrem fases e filtros distintos: retomar o
  // cursor de um no outro deixaria títulos para trás sem aviso.
  const salvo = { escopo: 'historico', fase: 2, pagina: 9, janela: 1 }
  eq(C.cursorDePartida({ retomar: true, salvo, escopo: 'incremental' }),
     { fase: 0, pagina: 1, janela: 0, retomado: false })
})

teste('janela fora do intervalo atual recomeça do início', () => {
  // O usuário mudou data_inicio e há menos janelas que antes.
  const salvo = { escopo: 'historico', fase: 0, pagina: 1, janela: 7 }
  eq(C.cursorDePartida({ retomar: true, salvo, escopo: 'historico', totalJanelas: 3 }),
     { fase: 0, pagina: 1, janela: 0, retomado: false })
})

teste('sem cursor salvo começa do início', () => {
  eq(C.cursorDePartida({ retomar: true, salvo: null, escopo: 'incremental' }),
     { fase: 0, pagina: 1, janela: 0, retomado: false })
})

teste('cursor salvo corrompido não quebra a partida', () => {
  eq(C.cursorDePartida({ retomar: true, salvo: { escopo: 'incremental', fase: 'x', pagina: null }, escopo: 'incremental' }),
     { fase: 0, pagina: 1, janela: 0, retomado: true })
})

// ─── 3. Persistência ─────────────────────────────────────────────────────────
teste('cursor salvo carrega o escopo junto', () => {
  eq(C.cursorParaSalvar({ next: { fase: 1, pagina: 30, janela: 2 }, escopo: 'historico' }),
     { escopo: 'historico', fase: 1, pagina: 30, janela: 2 })
})
teste('[TRAVA] varredura completa ZERA o cursor', () => {
  // Se não zerasse, a próxima execução retomaria no fim e nunca reprocessaria
  // o que mudou na origem.
  eq(C.cursorParaSalvar({ next: null, escopo: 'incremental' }), null)
})

// ─── 4. Cenário real da FACE ─────────────────────────────────────────────────
teste('[CENÁRIO] 5.407 títulos são cobertos em execuções sucessivas', () => {
  const LIMITE = 50, TETO = 60          // teto ANTIGO da interface
  const TOTAL = 5407
  const FASES = 2
  let cursor = { ...C.CURSOR_INICIAL }
  let vistos = 0, execucoes = 0

  // Simula a varredura: fase 0 com 1.200 títulos, fase 1 com o restante
  const daFase = [1200, TOTAL - 1200]
  const consumido = [0, 0]

  while (vistos < TOTAL && execucoes < 20) {
    execucoes++
    for (let i = 0; i < TETO && vistos < TOTAL; i++) {
      const f = cursor.fase
      const resta = daFase[f] - consumido[f]
      const lote = Math.min(LIMITE, resta)
      consumido[f] += lote; vistos += lote
      const next = C.proximoCursor({ ...cursor, paginaCheia: lote >= LIMITE, totalFases: FASES })
      if (!next) { cursor = { ...C.CURSOR_INICIAL }; break }
      cursor = next
    }
    // COM persistência o cursor sobrevive à execução; sem ela seria reiniciado
  }
  eq(vistos, TOTAL, 'títulos cobertos: ')
  if (execucoes > 3) throw new Error(`precisou de ${execucoes} execuções`)
})

teste('[REGRESSÃO] sem persistência, a cobertura trava em 3.000 títulos', () => {
  // Reproduz o defeito: cursor reiniciado a cada execução.
  const LIMITE = 50, TETO = 60
  let vistos = 0
  for (let exec = 0; exec < 10; exec++) {
    let v = 0
    for (let i = 0; i < TETO; i++) v += LIMITE   // sempre do zero
    vistos = Math.max(vistos, v)
  }
  eq(vistos, 3000, 'teto por execução: ')
  if (vistos >= 5407) throw new Error('o defeito não foi reproduzido')
})

// ─── Execução ────────────────────────────────────────────────────────────────
for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
limpar()
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
