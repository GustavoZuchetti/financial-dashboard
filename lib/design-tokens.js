export const COLORS = {
  bg:       '#0f172a',
  surface:  '#1e293b',
  surface2: '#263548',
  surface3: '#2d3f55',
  border:   '#334155',
  border2:  '#475569',
  brand:    '#3b82f6',
  brandDark:'#2563eb',
  brandGlow:'rgba(59,130,246,0.15)',
  success:  '#10b981',
  danger:   '#ef4444',
  warning:  '#f59e0b',
  purple:   '#8b5cf6',
  textPrimary:   '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted:     '#64748b',
}

export const CHART_PALETTE = {
  receita:  '#3b82f6',
  custo:    '#ef4444',
  despesa:  '#f59e0b',
  ebitda:   '#10b981',
  entrada:  '#3b82f6',
  saida:    '#ef4444',
  saldo:    '#8b5cf6',
  orcado:   '#475569',
  realizado:'#3b82f6',
  neutro:   '#64748b',
}

export const KPI_ACCENT = {
  receita: CHART_PALETTE.receita,
  custo:   CHART_PALETTE.custo,
  despesa: CHART_PALETTE.despesa,
  ebitda:  CHART_PALETTE.ebitda,
  entrada: CHART_PALETTE.entrada,
  saida:   CHART_PALETTE.saida,
  saldo:   CHART_PALETTE.saldo,
  neutro:  COLORS.brand,
}

export const BORDER_RADIUS = { sm: '6px', md: '8px', lg: '12px', xl: '16px' }
export const TRANSITION    = 'all 0.18s ease'
