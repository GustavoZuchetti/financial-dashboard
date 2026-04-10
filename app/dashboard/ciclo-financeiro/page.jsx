'use client'
import { useState } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtDias = (v) => `${v} dias`

const CICLOS = [
  { label: 'Prazo Medio de Recebimento (PMR)', valor: 28, ideal: 30, icon: '📥', cor: '#00e676' },
  { label: 'Prazo Medio de Pagamento (PMP)', valor: 35, ideal: 30, icon: '📤', cor: '#3b82f6' },
  { label: 'Prazo Medio de Estoque (PME)', valor: 22, ideal: 20, icon: '📦', cor: '#8b5cf6' },
  { label: 'Ciclo Operacional', valor: 50, ideal: 50, icon: '🔄', cor: '#f59e0b' },
  { label: 'Ciclo Financeiro (CCL)', valor: 15, ideal: 20, icon: '💰', cor: '#00e676' },
]

const MOCK_HIST = [
  { mes: 'Out', pmr: 32, pmp: 30, pme: 25 },
  { mes: 'Nov', pmr: 30, pmp: 32, pme: 23 },
  { mes: 'Dez', pmr: 29, pmp: 33, pme: 22 },
  { mes: 'Jan', pmr: 31, pmp: 34, pme: 24 },
  { mes: 'Fev', pmr: 28, pmp: 35, pme: 21 },
  { mes: 'Mar', pmr: 27, pmp: 36, pme: 22 },
  { mes: 'Abr', pmr: 28, pmp: 35, pme: 22 },
]

const RADAR_DATA = [
  { subject: 'PMR', A: 28, ideal: 30 },
  { subject: 'PMP', A: 35, ideal: 30 },
  { subject: 'PME', A: 22, ideal: 20 },
  { subject: 'C.Oper.', A: 50, ideal: 50 },
  { subject: 'C.Fin.', A: 15, ideal: 20 },
]

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 },
  kpiCard: (c) => ({ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '20px', borderTop: `3px solid ${c}` }),
  kpiIcon: { fontSize: 24, marginBottom: 8 },
  kpiLabel: { color: '#9ca3af', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  kpiValue: { fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 4 },
  kpiIdeal: { fontSize: 12, color: '#6b7280' },
  progressWrap: { marginTop: 10, background: '#1e1e2e', borderRadius: 99, height: 6 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '20px 24px', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 },
  badge: (ok) => ({ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: ok ? 'rgba(0,230,118,0.1)' : 'rgba(245,158,11,0.1)', color: ok ? '#00e676' : '#f59e0b' }),
}

export default function CicloFinanceiroPage() {
  const [periodo, setPeriodo] = useState('6M')

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Ciclo Financeiro</h1>
        <p style={S.subtitle}>Analise dos prazos medios e ciclo de caixa da empresa</p>
      </div>

      {/* KPI Cards */}
      <div style={S.kpiGrid}>
        {CICLOS.map((c, i) => {
          const pct = Math.min((c.ideal / Math.max(c.valor, c.ideal)) * 100, 100)
          const ok = c.label.includes('Pagamento') ? c.valor >= c.ideal : c.valor <= c.ideal
          return (
            <div key={i} style={S.kpiCard(c.cor)}>
              <div style={S.kpiIcon}>{c.icon}</div>
              <div style={S.kpiLabel}>{c.label}</div>
              <div style={S.kpiValue}>{fmtDias(c.valor)}</div>
              <div style={S.kpiIdeal}>Ideal: {fmtDias(c.ideal)}</div>
              <div style={S.progressWrap}>
                <div style={{ height: 6, borderRadius: 99, background: c.cor, width: `${pct}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={S.badge(ok)}>{ok ? 'dentro do ideal' : 'acima do ideal'}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Graficos */}
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardTitle}>Historico dos Prazos (ultimos 7 meses)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MOCK_HIST} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickFormatter={v => v + 'd'} width={40} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8 }} labelStyle={{ color: '#fff' }} formatter={(v, n) => [v + ' dias', n.toUpperCase()]} />
              <Bar dataKey="pmr" fill="#00e676" radius={[4,4,0,0]} name="PMR" />
              <Bar dataKey="pmp" fill="#3b82f6" radius={[4,4,0,0]} name="PMP" />
              <Bar dataKey="pme" fill="#8b5cf6" radius={[4,4,0,0]} name="PME" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Radar - Desempenho dos Indicadores</div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="#1e1e2e" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Radar name="Atual" dataKey="A" stroke="#00e676" fill="rgba(0,230,118,0.15)" strokeWidth={2} />
              <Radar name="Ideal" dataKey="ideal" stroke="#3b82f6" fill="rgba(59,130,246,0.1)" strokeWidth={2} strokeDasharray="4 4" />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8 }} formatter={(v) => [v + ' dias']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resumo */}
      <div style={S.card}>
        <div style={S.cardTitle}>Resumo do Ciclo de Caixa</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div style={{ background: '#0a0a0f', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>CICLO OPERACIONAL</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#f59e0b' }}>50 dias</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>PMR (28) + PME (22)</div>
          </div>
          <div style={{ background: '#0a0a0f', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>PRAZO DE PAGAMENTO</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#3b82f6' }}>35 dias</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>5 dias acima do ideal</div>
          </div>
          <div style={{ background: '#0a0a0f', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>CICLO FINANCEIRO</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#00e676' }}>15 dias</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>Ciclo Oper. (50) - PMP (35)</div>
          </div>
        </div>
      </div>
    </div>
  )
}
