// ─── bling-cursor.js — avanço e retomada do cursor de sincronização ─────────
//
// FONTE ÚNICA da posição da varredura Bling. Lógica pura, sem I/O, para poder
// ser testada — a rota e o cron apenas a consomem (regra canônica nº 7).
//
// ── O problema que este módulo resolve ──────────────────────────────────────
// A sincronização manual ("Sincronizar Fluxo agora") era ESTATELESS: toda
// execução recomeçava em { fase 0, página 1 } e a interface parava após 60
// iterações (limiteGuard). Com LIMITE = 50 títulos por iteração:
//
//     60 × 50 = 3.000 títulos por execução, no máximo — para AS DUAS fases
//
// A FACE tem 5.407 registros. Cabiam 3.000. Os outros 2.407 nunca eram
// alcançados, e como o cursor recomeçava do zero todo dia, ficavam de fora
// INDEFINIDAMENTE. Medido na conciliação de 25/08 contra 17 extratos do Bling:
// 7.156 títulos e R$ 44,6 milhões ausentes, com viés — 65% das entradas contra
// 42% das saídas, porque a fase de recebimentos roda primeiro e consome
// iterações antes de as saídas serem alcançadas.
//
// O cron já persistia cursor em integracoes.cron_cursor. A sincronização manual
// não persistia nada. Este módulo elimina essa assimetria.
//
// ── Modelo do cursor ────────────────────────────────────────────────────────
//     { escopo, fase, pagina, janela }
// `escopo` faz parte da identidade: um cursor de varredura histórica não pode
// ser retomado por uma incremental (percorrem conjuntos diferentes de fases e
// filtros). Escopo divergente = recomeçar do início.

export const CURSOR_INICIAL = { fase: 0, pagina: 1, janela: 0 }

// Avanço após processar uma página.
//   página cheia            → próxima página da mesma fase
//   página incompleta       → próxima fase (janela mantida)
//   última fase da janela   → próxima janela (só no histórico)
//   última janela           → null = varredura COMPLETA
export function proximoCursor({ fase, pagina, janela = 0, paginaCheia, totalFases, totalJanelas = 0 }) {
  if (paginaCheia) return { fase, pagina: pagina + 1, janela }
  if (fase + 1 < totalFases) return { fase: fase + 1, pagina: 1, janela }
  if (janela + 1 < totalJanelas) return { fase: 0, pagina: 1, janela: janela + 1 }
  return null
}

// Ponto de partida de uma execução.
//
// `retomar` só é honrado quando o cliente NÃO pediu uma posição explícita — as
// iterações seguintes do laço mandam fase/página vindos do `next` anterior e
// devem ser respeitadas literalmente.
export function cursorDePartida({ retomar, salvo, pedido = {}, escopo, totalJanelas = 0 }) {
  const explicito = pedido.fase != null || pedido.pagina != null || pedido.janela != null
  if (explicito) {
    return {
      fase: Number(pedido.fase) || 0,
      pagina: Number(pedido.pagina) || 1,
      janela: Number(pedido.janela) || 0,
      retomado: false,
    }
  }
  if (!retomar || !salvo) return { ...CURSOR_INICIAL, retomado: false }

  // Escopo diferente percorre outras fases e filtros: retomar seria pular dados.
  if (salvo.escopo && escopo && salvo.escopo !== escopo)
    return { ...CURSOR_INICIAL, retomado: false }

  // Janela fora do intervalo atual (o usuário mudou data_inicio, por exemplo).
  const janela = Number(salvo.janela) || 0
  if (totalJanelas > 0 && janela >= totalJanelas)
    return { ...CURSOR_INICIAL, retomado: false }

  return {
    fase: Number(salvo.fase) || 0,
    pagina: Number(salvo.pagina) || 1,
    janela,
    retomado: true,
  }
}

// O que gravar em integracoes.sync_cursor depois de processar uma página.
// Varredura completa (next === null) ZERA o cursor: a próxima execução
// recomeça do início e reprocessa o que mudou na origem.
export function cursorParaSalvar({ next, escopo }) {
  if (!next) return null
  return { escopo, fase: next.fase, pagina: next.pagina, janela: next.janela ?? 0 }
}

// Rótulo legível do progresso, usado na interface e nos logs.
export function descreverCursor({ fase, pagina, janela = 0, totalJanelas = 0, fases = [] }) {
  const nome = fases[fase]?.recurso || `fase ${fase}`
  const jan = totalJanelas > 1 ? ` · janela ${janela + 1}/${totalJanelas}` : ''
  return `${nome} · pág. ${pagina}${jan}`
}
