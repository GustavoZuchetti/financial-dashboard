// ─── fluxo-status.js — Ciclo de vida dos títulos do fluxo de caixa ───────────
// Fonte única de verdade para situação de liquidação (padrão calcDRE).
// "Vencido" é sempre DERIVADO: status em aberto + vencimento < hoje.

export const FC_STATUS = {
  aberto:    { label: 'Em aberto', color: 'var(--fs-text-3)',  bg: 'var(--fs-hover-2)' },
  pago:      { label: 'Liquidado', color: 'var(--fs-success)', bg: 'rgba(34,197,94,0.10)' },
  parcial:   { label: 'Parcial',   color: '#f59e0b',           bg: 'rgba(245,158,11,0.10)' },
  cancelado: { label: 'Cancelado', color: 'var(--fs-text-4)',  bg: 'var(--fs-hover)' },
}

const hojeISO = () => new Date().toISOString().split('T')[0]

export const diasEntre = (aISO, bISO) =>
  Math.round((new Date(bISO + 'T00:00:00') - new Date(aISO + 'T00:00:00')) / 86400000)

// getStatusInfo(registro) →
// { situacao: 'pago'|'parcial'|'vencido'|'a_vencer'|'cancelado',
//   diasVencido, diasAteVencer, label, color, bg }
export function getStatusInfo(r, hoje = hojeISO()) {
  const status = r.status || 'aberto'
  if (status === 'pago') {
    const quando = r.data_liquidacao
      ? ` em ${r.data_liquidacao.split('-').reverse().join('/')}` : ''
    return { situacao: 'pago', diasVencido: 0, diasAteVencer: null,
             label: `Liquidado${quando}`, ...FC_STATUS.pago }
  }
  if (status === 'cancelado') {
    return { situacao: 'cancelado', diasVencido: 0, diasAteVencer: null,
             label: 'Cancelado', ...FC_STATUS.cancelado }
  }
  // aberto ou parcial: vencido é derivado do vencimento
  const venc = r.data
  const dias = venc ? diasEntre(venc, hoje) : 0
  const prefixo = status === 'parcial' ? 'Parcial · ' : ''
  if (dias > 0) {
    return { situacao: 'vencido', diasVencido: dias, diasAteVencer: null,
             label: `${prefixo}Vencido há ${dias} dia${dias > 1 ? 's' : ''}`,
             color: 'var(--fs-danger)', bg: 'rgba(239,68,68,0.10)' }
  }
  const ate = -dias
  const base = status === 'parcial' ? FC_STATUS.parcial : FC_STATUS.aberto
  return { situacao: status === 'parcial' ? 'parcial' : 'a_vencer',
           diasVencido: 0, diasAteVencer: ate,
           label: ate === 0 ? `${prefixo}Vence hoje` : `${prefixo}Vence em ${ate} dia${ate > 1 ? 's' : ''}`,
           ...base }
}

// Faixas de aging (padrão de mercado) para relatórios
export const AGING_FAIXAS = [
  { max: 15,      label: '1–15 dias' },
  { max: 30,      label: '16–30 dias' },
  { max: 60,      label: '31–60 dias' },
  { max: 90,      label: '61–90 dias' },
  { max: Infinity, label: '90+ dias' },
]
export const agingFaixa = (dias) => AGING_FAIXAS.find(f => dias <= f.max)?.label || '90+ dias'


// ─── CAIXA EFETIVO — regra canônica (definida pelo Controller em 15/07/26) ───
// · Liquidado (pago/parcela paga): entra na DATA EFETIVA do pagamento/recebimento
// · A vencer (aberto/restante futuro): entra pelo VENCIMENTO (visão de caixa futuro)
// · VENCIDO não liquidado: FORA do fluxo (não movimentou caixa) — vive na área
//   de Atrasados e nos indicadores, nunca nos saldos diários
// Retorna a lista de efeitos de caixa de um registro: [{ data, valor, aproximado }]
// (parciais geram até 2 efeitos: parte liquidada + restante a vencer)
export function efeitosCaixa(r, hoje = new Date().toISOString().split('T')[0]) {
  const st  = r.status || 'aberto'
  const v   = Math.abs(Number(r.valor) || 0)
  const liq = Math.min(Math.abs(Number(r.valor_liquidado) || 0), v)
  if (st === 'cancelado') return []
  if (st === 'pago') {
    // Fallback documentado: pago sem data_liquidacao usa o vencimento
    // (aproximação que converge a zero conforme o enriquecimento completa)
    return [{ data: r.data_liquidacao || r.data, valor: v, aproximado: !r.data_liquidacao }]
  }
  if (st === 'parcial') {
    const efeitos = []
    if (liq > 0) efeitos.push({ data: r.data_liquidacao || r.data, valor: liq, aproximado: !r.data_liquidacao })
    const restante = v - liq
    if (restante > 0 && r.data >= hoje) efeitos.push({ data: r.data, valor: restante })
    return efeitos // restante vencido: fora do fluxo
  }
  // aberto: futuro → vencimento; vencido → fora
  return r.data >= hoje ? [{ data: r.data, valor: v }] : []
}

// Data efetiva "principal" de um registro para exibição em extratos
// (null = registro fora do fluxo de caixa: vencido não liquidado / cancelado)
export function dataEfetiva(r, hoje = new Date().toISOString().split('T')[0]) {
  const ef = efeitosCaixa(r, hoje)
  return ef.length ? ef[0].data : null
}
