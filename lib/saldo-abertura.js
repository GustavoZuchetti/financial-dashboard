// ─── saldo-abertura.js — Data de corte e saldo de abertura certificado ──────
//
// FONTE ÚNICA da composição de saldo de caixa. Nenhuma tela pode compor saldo
// por conta própria (regra canônica nº 7).
//
// ── O problema que este módulo resolve ──────────────────────────────────────
// A composição anterior era, em três variantes diferentes:
//     saldo = saldo_inicial_configurado + Σ (TODOS os movimentos anteriores)
// Isso conta em dobro tudo o que é anterior à data a que o saldo_inicial se
// refere — porque o saldo inicial já embute esse passado por definição. E como
// a base pré-2026 está incompleta, a soma produzia um buraco artificial de
// ordem de milhões que não é caixa nenhum. Histórico incompleto é PIOR que
// histórico nenhum: mente com aparência de precisão.
//
// ── O modelo ────────────────────────────────────────────────────────────────
// Uma ÂNCORA é um saldo certificado numa data, conferido contra extrato:
//     { empresa_id, data_corte, valor, origem, conciliado_em }
//
// SEMÂNTICA DE data_corte: é o saldo na ABERTURA daquele dia — os movimentos
// DO PRÓPRIO dia ainda contam. "Saldo inicial para 07/2026 = 499.772" grava-se
// como { data_corte: '2026-07-01', valor: 499772 }.
//
//     saldo(D) = ancora.valor + Σ efeitos com data_corte <= efeito.data <= D
//
// Nada anterior a data_corte é somado, jamais. Os lançamentos antigos seguem na
// base — são necessários para DRE por competência, comparativos e histórico —
// mas ficam FORA da composição do saldo.
//
// Várias âncoras por empresa são esperadas: a vigente para uma data é a de
// maior data_corte que não a ultrapassa. É assim que o fechamento mensal se
// encaixa sem código novo — cada fechamento insere uma linha.
//
// ── Regra de silêncio ───────────────────────────────────────────────────────
// Sem âncora aplicável, estas funções devolvem { ok: false } e saldo NULO.
// Elas NUNCA devolvem zero nem um palpite: para um Controller, ausência de
// número é informação; número errado é prejuízo.
import { efeitosCaixa, sinalDe } from './fluxo-status'

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100
const hojeISO = () => new Date().toISOString().split('T')[0]

export const ORIGENS = {
  extrato_bancario:  'Extrato bancário conciliado',
  fechamento_mensal: 'Fechamento mensal',
  saldo_migrado:     'Migrado da configuração antiga',
}

// Datas em ISO (YYYY-MM-DD) comparam-se lexicograficamente — sem fuso, sem Date
export function diaAnterior(iso) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().split('T')[0]
}
export function proximoDia(iso) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}
export const mesDe = (iso) => String(iso).slice(0, 7)
export const primeiroDiaDoMes = (ym) => `${ym}-01`

// ─── Âncora vigente para uma data ───────────────────────────────────────────
// A de maior data_corte que não ultrapassa `data`. null se não houver.
export function ancoraVigente(ancoras, data) {
  let escolhida = null
  for (const a of ancoras || []) {
    if (!a?.data_corte || a.data_corte > data) continue
    if (!escolhida || a.data_corte > escolhida.data_corte) escolhida = a
  }
  return escolhida
}

// ─── Movimento efetivo num intervalo FECHADO [de, ate] ──────────────────────
// `de` e `ate` são inclusivos. Passar null desliga aquele limite.
export function movimentoEfetivo(registros, { de = null, ate = null, hoje = hojeISO() } = {}) {
  let entradas = 0, saidas = 0, aproximados = 0, semSinal = 0
  for (const r of registros || []) {
    const s = sinalDe(r.tipo)
    if (s === 0) { semSinal++; continue }   // tipo desconhecido: contado, nunca somado
    for (const e of efeitosCaixa(r, hoje)) {
      if (de && e.data < de) continue
      if (ate && e.data > ate) continue
      if (e.aproximado) aproximados++
      if (s > 0) entradas += e.valor
      else saidas += e.valor
    }
  }
  return {
    entradas: r2(entradas),
    saidas: r2(saidas),
    liquido: r2(entradas - saidas),
    aproximados,   // efeitos sem data_liquidacao, posicionados pelo vencimento
    semSinal,      // registros de tipo não reconhecido — investigar se > 0
  }
}

// ─── Saldo ao FIM de uma data ───────────────────────────────────────────────
export function saldoEm({ ancoras, registros, data, hoje = hojeISO() }) {
  const ancora = ancoraVigente(ancoras, data)
  if (!ancora) return { ok: false, motivo: 'sem_ancora', saldo: null, ancora: null }
  const mov = movimentoEfetivo(registros, { de: ancora.data_corte, ate: data, hoje })
  return { ok: true, ancora, ...mov, saldo: r2(Number(ancora.valor) + mov.liquido) }
}

// ─── Saldo de partida de um período ─────────────────────────────────────────
// Posição na ABERTURA de `inicioPeriodo`: movimentos DO dia de início pertencem
// ao período, não à partida. Se inicioPeriodo === data_corte, a partida é a
// própria âncora — sem nenhum movimento somado.
export function saldoDePartida({ ancoras, registros, inicioPeriodo, hoje = hojeISO() }) {
  const ancora = ancoraVigente(ancoras, inicioPeriodo)
  if (!ancora) return { ok: false, motivo: 'sem_ancora', saldo: null, ancora: null }
  const ate = diaAnterior(inicioPeriodo)
  if (ate < ancora.data_corte) {
    return { ok: true, ancora, entradas: 0, saidas: 0, liquido: 0, aproximados: 0, semSinal: 0,
             saldo: r2(ancora.valor) }
  }
  const mov = movimentoEfetivo(registros, { de: ancora.data_corte, ate, hoje })
  return { ok: true, ancora, ...mov, saldo: r2(Number(ancora.valor) + mov.liquido) }
}

// ─── Série diária — base da conferência dia a dia ───────────────────────────
// Devolve um item POR DIA do intervalo, inclusive dias sem movimento (o saldo
// precisa ser contínuo para bater com o extrato, que também tem dias parados).
export function serieDiaria({ ancoras, registros, de, ate, hoje = hojeISO() }) {
  const partida = saldoDePartida({ ancoras, registros, inicioPeriodo: de, hoje })
  if (!partida.ok) return { ok: false, motivo: partida.motivo, abertura: null, dias: [] }

  const porDia = {}
  for (const r of registros || []) {
    const s = sinalDe(r.tipo)
    if (s === 0) continue
    for (const e of efeitosCaixa(r, hoje)) {
      if (e.data < de || e.data > ate) continue
      if (!porDia[e.data]) porDia[e.data] = { entradas: 0, saidas: 0, itens: 0 }
      if (s > 0) porDia[e.data].entradas += e.valor
      else porDia[e.data].saidas += e.valor
      porDia[e.data].itens++
    }
  }

  const dias = []
  let saldo = partida.saldo
  for (let d = de; d <= ate; d = proximoDia(d)) {
    const m = porDia[d] || { entradas: 0, saidas: 0, itens: 0 }
    const liquido = r2(m.entradas - m.saidas)
    const abertura = saldo
    saldo = r2(saldo + liquido)
    dias.push({ data: d, abertura, entradas: r2(m.entradas), saidas: r2(m.saidas),
                liquido, fechamento: saldo, itens: m.itens })
    if (dias.length > 3660) break   // guarda: 10 anos
  }
  return { ok: true, ancora: partida.ancora, abertura: partida.saldo,
           fechamento: saldo, dias }
}

// ─── Resumo mensal — base da conferência mês a mês ──────────────────────────
// Cada mês amarra com o seguinte: fechamento[n] === abertura[n+1].
export function resumoMensal({ ancoras, registros, de, ate, hoje = hojeISO() }) {
  const serie = serieDiaria({ ancoras, registros, de, ate, hoje })
  if (!serie.ok) return { ok: false, motivo: serie.motivo, meses: [] }

  const meses = []
  for (const d of serie.dias) {
    const ym = mesDe(d.data)
    let m = meses[meses.length - 1]
    if (!m || m.mes !== ym) {
      m = { mes: ym, abertura: d.abertura, entradas: 0, saidas: 0, liquido: 0,
            fechamento: d.fechamento, itens: 0 }
      meses.push(m)
    }
    m.entradas = r2(m.entradas + d.entradas)
    m.saidas   = r2(m.saidas + d.saidas)
    m.liquido  = r2(m.entradas - m.saidas)
    m.fechamento = d.fechamento
    m.itens += d.itens
  }
  return { ok: true, ancora: serie.ancora, meses }
}

// ─── Amarração contra um valor declarado (extrato / relatório oficial) ──────
// tolerancia em reais: 0 exige fechamento ao centavo.
export function conferir({ calculado, declarado, tolerancia = 0 }) {
  if (calculado == null || declarado == null || declarado === '') {
    return { ok: false, motivo: 'valor_ausente', diferenca: null, fecha: false }
  }
  const diferenca = r2(Number(calculado) - Number(declarado))
  return { ok: true, diferenca, fecha: Math.abs(diferenca) <= tolerancia }
}

// ─── Diagnóstico: o que o corte está EXCLUINDO ──────────────────────────────
// Mostra explicitamente o volume anterior à âncora que deixa de ser somado.
// É o número que prova ao Controller que o corte não escondeu caixa real —
// e o que revela um corte mal escolhido (excluir R$ 8 M de 2026 seria erro).
export function excluidoPeloCorte({ registros, dataCorte, hoje = hojeISO() }) {
  const mov = movimentoEfetivo(registros, { de: null, ate: diaAnterior(dataCorte), hoje })
  return { ...mov, ate: diaAnterior(dataCorte) }
}

// ─── Leitura de valor monetário digitado por humano ─────────────────────────
export function normalizarValor(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null
  let s = String(v ?? '').trim().replace(/\s|R\$/g, '')
  if (!s) return null
  const temVirgula = s.includes(','), temPonto = s.includes('.')
  if (temVirgula && temPonto) {
    // O separador decimal é o ÚLTIMO a aparecer; o outro é milhar
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (temVirgula) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (temPonto) {
    // "499.772" é ambíguo: aqui vale a convenção brasileira de MILHAR quando há
    // exatamente 3 dígitos após o ponto e nenhum outro separador decimal.
    const partes = s.split('.')
    if (partes.length > 2 || (partes[1] || '').length === 3) s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}
