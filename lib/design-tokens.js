// ─── Facesign Design System — Tokens Centralizados ─────────────────────────────
// Todos os módulos devem importar daqui. NUNCA usar cores hardcoded nos componentes.

export const COLORS = {
  // Backgrounds
  bg:       '#080810',
  surface:  '#0f0f18',
  surface2: '#12121a',
  surface3: '#1a1a2e',
  // Borders
  border:   '#1e1e2e',
  border2:  '#2a2a3e',
  // Brand
  brand:    '#3b82f6',
  brandDark:'#1d4ed8',
  brandGlow:'rgba(59,130,246,0.15)',
  // Semânticas
  success:  '#10b981',
  danger:   '#ef4444',
  warning:  '#f59e0b',
  purple:   '#8b5cf6',
  // Texto
  textPrimary:   '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted:     '#475569',
}

// Paleta unificada de gráficos — usar em TODOS os módulos
export const CHART_PALETTE = {
  receita:  '#3b82f6',
  custo:    '#ef4444',
  despesa:  '#f59e0b',
  ebitda:   '#10b981',
  entrada:  '#3b82f6',
  saida:    '#ef4444',
  saldo:    '#8b5cf6',
  orcado:   '#334155',
  realizado:'#3b82f6',
  neutro:   '#475569',
}

// Acento de cor por tipo de KPI
export const KPI_ACCENT = {
  receita:  CHART_PALETTE.receita,
  custo:    CHART_PALETTE.custo,
  despesa:  CHART_PALETTE.despesa,
  ebitda:   CHART_PALETTE.ebitda,
  entrada:  CHART_PALETTE.entrada,
  saida:    CHART_PALETTE.saida,
  saldo:    CHART_PALETTE.saldo,
  neutro:   COLORS.brand,
}

// Ícones SVG para sidebar (paths apenas, sem wrapper)
export const SIDEBAR_ICONS = {
  dre:         'M3 3h18v4H3zm0 7h18v4H3zm0 7h18v4H3z',
  orcamento:   'M2 2h20v2H2zm4 6h12v2H6zm-4 6h20v2H2zm4 6h12v2H6z',
  fluxo:       'M22 12h-4l-3 9L9 3l-3 9H2',
  ciclo:       'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z',
  plano:       'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  importacao:  'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  config:      'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
}

export const BORDER_RADIUS = { sm: '6px', md: '8px', lg: '12px', xl: '16px' }
export const TRANSITION    = 'all 0.18s ease'
