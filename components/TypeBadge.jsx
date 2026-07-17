'use client'

// ─── Item 7 — Badges semânticas por tipo de lançamento ─────────────────────────
const BADGE_CONFIG = {
  receita:  { label: '↑ Receita',   bg: 'rgba(var(--fs-brand-rgb),0.15)',  color: 'var(--fs-brand-text)', border: 'rgba(var(--fs-brand-rgb),0.3)'  },
  custo:    { label: '↓ Custo',     bg: 'rgba(var(--fs-danger-rgb),0.15)',   color: '#fca5a5', border: 'rgba(var(--fs-danger-rgb),0.3)'   },
  despesa:  { label: '↓ Despesa',   bg: 'rgba(var(--fs-warning-rgb),0.15)',  color: '#fcd34d', border: 'rgba(var(--fs-warning-rgb),0.3)'  },
  entrada:  { label: '↑ Entrada',   bg: 'rgba(var(--fs-success-rgb),0.15)',  color: '#6ee7b7', border: 'rgba(var(--fs-success-rgb),0.3)'  },
  saida:    { label: '↓ Saída',     bg: 'rgba(var(--fs-danger-rgb),0.15)',   color: '#fca5a5', border: 'rgba(var(--fs-danger-rgb),0.3)'   },
  ativo:    { label: '◈ Ativo',     bg: 'rgba(var(--fs-purple-rgb),0.15)',  color: '#c4b5fd', border: 'rgba(var(--fs-purple-rgb),0.3)'  },
  passivo:  { label: '◈ Passivo',   bg: 'rgba(var(--fs-warning-rgb),0.15)',  color: '#fcd34d', border: 'rgba(var(--fs-warning-rgb),0.3)'  },
  favoravel:{ label: '✓ F',         bg: 'rgba(var(--fs-success-rgb),0.12)',  color: 'var(--fs-success)', border: 'rgba(var(--fs-success-rgb),0.3)'  },
  desfavor: { label: '✗ D',         bg: 'rgba(var(--fs-danger-rgb),0.12)',   color: 'var(--fs-danger)', border: 'rgba(var(--fs-danger-rgb),0.3)'   },
}

export default function TypeBadge({ type, size = 'sm', customLabel }) {
  const cfg = BADGE_CONFIG[type] || { label: type, bg: 'rgba(100,100,100,0.15)', color: 'var(--fs-text-2)', border: 'rgba(100,100,100,0.3)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      borderRadius: 20,
      padding: size === 'lg' ? '4px 12px' : '2px 8px',
      fontSize: size === 'lg' ? 12 : 10,
      fontWeight: 700,
      letterSpacing: '0.3px',
      whiteSpace: 'nowrap',
    }}>
      {customLabel || cfg.label}
    </span>
  )
}

// Badge de F/D direto para uso no DRE
export function FDBadge({ favorable, size = 'sm' }) {
  if (favorable === null || favorable === undefined) return <span style={{ color: 'var(--fs-text-4)', fontSize: 11 }}>—</span>
  return <TypeBadge type={favorable ? 'favoravel' : 'desfavor'} size={size} />
}
