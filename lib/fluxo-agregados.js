// ─── fluxo-agregados.js — agregação de período em caixa efetivo ─────────────
//
// FONTE ÚNICA dos totais de período. Nenhuma tela pode somar `r.valor` por
// conta própria (regra canônica nº 7).
//
// ── O problema que este módulo resolve ──────────────────────────────────────
// Os KPIs de período somavam o VALOR DO TÍTULO para todo status:
//     gEntradas += Number(r.valor)
// enquanto o extrato logo abaixo, na mesma tela, usava efeitosCaixa() — o
// valor efetivamente movimentado (borderô). Duas bases a três linhas de
// distância. Consequências medidas na auditoria de 13/08:
//   · título pago de R$ 100.000 com R$ 90.000 de borderô entrava como 100.000
//     no KPI e 90.000 no extrato;
//   · título parcial entrava INTEIRO no KPI, embora só a parcela liquidada
//     tenha movimentado caixa;
//   · "Entradas do período" misturava recebimento efetivo com carteira a
//     receber, e por isso não batia com extrato bancário nenhum.
//
// ── A separação ─────────────────────────────────────────────────────────────
// REALIZADO  → houve liquidação. É o que se concilia com o extrato.
// PROJETADO  → título a vencer, posicionado pelo vencimento. Ainda não é caixa.
// Vencido não liquidado fica fora dos dois: não movimentou caixa e não vai
// movimentar na data em que está. Vive nos indicadores de atraso.
//
// A regra do número de destaque: REALIZADO é o headline. "Caixa disponível"
// que embute a receber induz leitura otimista diante de CEO e investidores.
import { efeitosCaixa, sinalDe } from './fluxo-status'

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100
const hojeISO = () => new Date().toISOString().split('T')[0]

const zero = () => ({ entradas: 0, saidas: 0, liquido: 0 })

// Agrega os efeitos de caixa de um conjunto de registros num intervalo FECHADO.
// `de` e `ate` são inclusivos; null desliga o limite.
//
// Devolve { realizado, projetado, total, aproximados, semSinal, contagem }
// onde cada bloco é { entradas, saidas, liquido }.
export function agregarPeriodo(registros, { de = null, ate = null, hoje = hojeISO() } = {}) {
  const realizado = zero(), projetado = zero()
  let aproximados = 0, semSinal = 0, contagem = 0

  for (const r of registros || []) {
    contagem++
    const s = sinalDe(r.tipo)
    // Tipo desconhecido é CONTADO e nunca somado — presumi-lo como saída
    // distorceria o caixa sem alarme nenhum.
    if (s === 0) { semSinal++; continue }

    for (const e of efeitosCaixa(r, hoje)) {
      if (de && e.data < de) continue
      if (ate && e.data > ate) continue
      if (e.aproximado) aproximados++
      const bloco = e.origem === 'realizado' ? realizado : projetado
      if (s > 0) bloco.entradas += e.valor
      else bloco.saidas += e.valor
    }
  }

  for (const b of [realizado, projetado]) {
    b.entradas = r2(b.entradas); b.saidas = r2(b.saidas)
    b.liquido = r2(b.entradas - b.saidas)
  }

  const total = {
    entradas: r2(realizado.entradas + projetado.entradas),
    saidas:   r2(realizado.saidas + projetado.saidas),
    liquido:  r2(realizado.liquido + projetado.liquido),
  }

  return { realizado, projetado, total, aproximados, semSinal, contagem }
}

// Rótulos padronizados — as telas e a exportação devem usar os mesmos termos,
// senão o Excel e a tela voltam a divergir no vocabulário mesmo batendo em valor.
export const ROTULOS = {
  realizado: 'Realizado',
  projetado: 'Projetado',
  total:     'Total',
  realizadoAjuda: 'Movimentou caixa no período: liquidações confirmadas por borderô. É o que se concilia com o extrato bancário.',
  projetadoAjuda: 'Ainda não movimentou caixa: títulos a vencer, posicionados pela data de vencimento.',
}
