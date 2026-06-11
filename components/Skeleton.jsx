'use client'

// ─── Bloco base de skeleton (usa .fs-shimmer do globals.css) ────────────────
export function Skel({ w = '100%', h = 16, r = 6, style = {} }) {
  return (
    <div
      className="fs-shimmer"
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  )
}

// ─── Skeleton de cards de KPI (Overview, DRE) ───────────────────────────────
export function KpiCardsSkeleton({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 16, marginBottom: 24 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 12, padding: '20px' }}>
          <Skel w="50%" h={12} style={{ marginBottom: 14 }} />
          <Skel w="75%" h={26} style={{ marginBottom: 10 }} />
          <Skel w="40%" h={11} />
        </div>
      ))}
    </div>
  )
}

// ─── Skeleton de tabela (DRE, Fluxo, Orçamento) ─────────────────────────────
export function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <div style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 12, padding: 20 }}>
      {/* header */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--fs-border)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skel key={i} w={i === 0 ? '30%' : '16%'} h={12} />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 16, marginBottom: 14, alignItems: 'center' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skel key={c} w={c === 0 ? '30%' : '16%'} h={14} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Skeleton de gráfico ────────────────────────────────────────────────────
export function ChartSkeleton({ height = 320 }) {
  return (
    <div style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 12, padding: 24 }}>
      <Skel w="40%" h={16} style={{ marginBottom: 24 }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skel key={i} w="100%" h={`${30 + Math.abs(Math.sin(i)) * 60}%`} r={4} />
        ))}
      </div>
    </div>
  )
}

// ─── Skeleton genérico de página ────────────────────────────────────────────
export function PageSkeleton() {
  return (
    <div>
      <Skel w="280px" h={26} style={{ marginBottom: 8 }} />
      <Skel w="380px" h={14} style={{ marginBottom: 28 }} />
      <KpiCardsSkeleton />
      <TableSkeleton />
    </div>
  )
}
