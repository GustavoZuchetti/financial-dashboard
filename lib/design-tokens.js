// ═══════════════════════════════════════════════════════════════
// FACESIGN DESIGN SYSTEM v2.1 — Tokens centralizados
// Auditado WCAG 2.1: todos os tokens de texto ≥ 4.5:1 AA
// ═══════════════════════════════════════════════════════════════

// ─── Referências CSS var — use em inline styles ──────────────────
export const C = {
  bg:       'var(--fs-bg)',
  surface:  'var(--fs-surface)',
  surface2: 'var(--fs-surface-2)',
  surface3: 'var(--fs-surface-3)',
  border:   'var(--fs-border)',
  border2:  'var(--fs-border-2)',
  brand:      'var(--fs-brand)',
  brandDark:  'var(--fs-brand-dark)',
  brandDeep:  'var(--fs-brand-deep)',
  brandText:  'var(--fs-brand-text)',
  brandGlow:  'var(--fs-brand-glow)',
  text1: 'var(--fs-text-1)',
  text2: 'var(--fs-text-2)',
  text3: 'var(--fs-text-3)',
  text4: 'var(--fs-text-4)',
  success:    'var(--fs-success)',
  danger:     'var(--fs-danger)',
  warning:    'var(--fs-warning)',
  purple:     'var(--fs-purple)',
  successBg:  'var(--fs-success-bg)',
  dangerBg:   'var(--fs-danger-bg)',
  warningBg:  'var(--fs-warning-bg)',
  purpleBg:   'var(--fs-purple-bg)',
  shadowSm:   'var(--fs-shadow-sm)',
  shadowMd:   'var(--fs-shadow-md)',
  shadowLg:   'var(--fs-shadow-lg)',
}

// ─── Paleta de gráficos — estável em ambos os temas ──────────────
export const CHART_PALETTE = {
  receita:  'var(--fs-brand)',
  custo:    'var(--fs-danger)',
  despesa:  'var(--fs-warning)',
  ebitda:   'var(--fs-success)',
  entrada:  'var(--fs-brand)',
  saida:    'var(--fs-danger)',
  saldo:    'var(--fs-purple)',
  orcado:   '#64748b',
  realizado:'var(--fs-brand)',
  neutro:   '#94a3b8',
}

export const KPI_ACCENT = {
  receita: CHART_PALETTE.receita,
  custo:   CHART_PALETTE.custo,
  despesa: CHART_PALETTE.despesa,
  ebitda:  CHART_PALETTE.ebitda,
  entrada: CHART_PALETTE.entrada,
  saida:   CHART_PALETTE.saida,
  saldo:   CHART_PALETTE.saldo,
  neutro:  'var(--fs-brand)',
}

// ─── Valores hard para referência e compat ───────────────────────
export const DARK_THEME = {
  bg: '#0f172a', surface: '#1e293b', surface2: '#263548', surface3: '#2d3f55',
  border: '#334155', border2: '#475569',
  brand: 'var(--fs-brand)', brandDark: 'var(--fs-brand-dark)', brandDeep: '#1e3a8a', brandText: 'var(--fs-brand-text)',
  text1: '#f1f5f9', text2: '#94a3b8', text3: '#8aaabe', text4: '#7b96ab',
  success: 'var(--fs-success)', danger: 'var(--fs-danger)', warning: 'var(--fs-warning)', purple: 'var(--fs-purple)',
}

export const LIGHT_THEME = {
  bg: '#f8fafc', surface: '#ffffff', surface2: '#f1f5f9', surface3: '#e2e8f0',
  border: '#e2e8f0', border2: '#cbd5e1',
  brand: 'var(--fs-brand-dark)', brandDark: 'var(--fs-brand-dark)', brandDeep: '#1e40af', brandText: 'var(--fs-brand-dark)',
  text1: '#0f172a', text2: '#334155', text3: '#475569', text4: '#64748b',
  success: '#047857', danger: 'var(--fs-danger)', warning: '#b45309', purple: '#6d28d9',
}

export const BORDER_RADIUS = { sm: '6px', md: '8px', lg: '12px', xl: '16px' }
export const TRANSITION    = 'all 0.18s ease'

// ─── Backwards compat ────────────────────────────────────────────
export const COLORS = {
  ...DARK_THEME,
  brandGlow: 'rgba(var(--fs-brand-rgb),0.12)',
  textPrimary:   DARK_THEME.text1,
  textSecondary: DARK_THEME.text2,
  textMuted:     DARK_THEME.text3,
}
