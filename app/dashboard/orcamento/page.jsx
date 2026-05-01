'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()

const MOCK_ORC = [
  { conta: 'Receita Bruta', orcado: 900000, realizado: 850000 },
  { conta: 'Deducoes', orcado: -90000, realizado: -85000 },
  { conta: 'Receita Liquida', orcado: 810000, realizado: 765000 },
  { conta: 'CPV / CMV', orcado: -280000, realizado: -306000 },
  { conta: 'Lucro Bruto', orcado: 530000, realizado: 459000 },
  { conta: 'Despesas Operac.', orcado: -170000, realizado: -183000 },
  { conta: 'EBITDA', orcado: 360000, realizado: 276000 },
  { conta: 'Lucro Liquido', orcado: 250000, realizado: 153780 },
]

const MOCK_MENSAL = MESES.map(mes => ({
  mes,
  orcado: Math.round(200000 + Math.random() * 100000),
  realizado: Math.round(150000 + Math.random() * 120000),
}))

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const var_ = (r, o) => o ? (((r - o) / Math.abs(o)) * 100).toFixed(1) + '%' : '-'

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  filters: { display: 'flex', gap: 10, marginBottom: 24 },
  select: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e5e7eb', padding: '8px 12px', fontSize: 13 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  kpiCard: (c) => ({ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '16px 20px', borderLeft: `3px solid ${c}` }),
  kpiLabel: { color: '#9ca3af', fontSize: 12, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  kpiValue: { fontSize: 22, fontWeight: 800, color: '#fff' },
  kpiSub: (pos) => ({ fontSize: 12, color: pos ? '#3b82f6' : '#f87171', marginTop: 4 }),
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '20px 24px', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 4px', fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #1e1e2e', fontWeight: 600 },
  td: { padding: '10px 4px', fontSize: 13, color: '#e5e7eb', borderBottom: '1px solid #1e1e2e' },
}

export default function OrcamentoPage() {
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(ANO_ATUAL)

  const recOrc = MOCK_ORC.find(r => r.conta === 'Receita Bruta')?.orcado || 1
  const recReal = MOCK_ORC.find(r => r.conta === 'Receita Bruta')?.realizado || 0
  const llOrc = MOCK_ORC.find(r => r.conta === 'Lucro Liquido')?.orcado || 1
  const llReal = MOCK_ORC.find(r => r.conta === 'Lucro Liquido')?.realizado || 0
  const achiev = ((recReal / recOrc) * 100).toFixed(1)
  const llAchiev = ((llReal / llOrc) * 100).toFixed(1)

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Orcamento vs Realizado</h1>
        <p style={S.subtitle}>Acompanhamento do desempenho orcamentario</p>
      </div>

      <div style={S.filters}>
        <select style={S.select} value={mes} onChange={e => setMes(+e.target.value)}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select style={S.select} value={ano} onChange={e => setAno(+e.target.value)}>
          {[ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={S.kpiGrid}>
        <div style={S.kpiCard('#3b82f6')}>
          <div style={S.kpiLabel}>Receita Orcada</div>
          <div style={S.kpiValue}>{fmt(recOrc)}</div>
          <div style={S.kpiSub(true)}>Meta do periodo</div>
        </div>
        <div style={S.kpiCard('#3b82f6')}>
          <div style={S.kpiLabel}>Receita Realizada</div>
          <div style={S.kpiValue}>{fmt(recReal)}</div>
          <div style={S.kpiSub(recReal >= recOrc)}>{achiev}% da meta atingida</div>
        </div>
        <div style={S.kpiCard('#8b5cf6')}>
          <div style={S.kpiLabel}>Lucro Liq. Orcado</div>
          <div style={S.kpiValue}>{fmt(llOrc)}</div>
          <div style={S.kpiSub(true)}>Meta lucro</div>
        </div>
        <div style={S.kpiCard(llReal >= llOrc ? '#3b82f6' : '#ef4444')}>
          <div style={S.kpiLabel}>Lucro Liq. Realizado</div>
          <div style={S.kpiValue}>{fmt(llReal)}</div>
          <div style={S.kpiSub(llReal >= llOrc)}>{llAchiev}% da meta atingida</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Orcado vs Realizado Mensal</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={MOCK_MENSAL} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickFormatter={v => fmt(v)} width={75} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8 }} labelStyle={{ color: '#fff' }} formatter={v => fmtFull(v)} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="orcado" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Orcado" />
            <Bar dataKey="realizado" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Realizado" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Detalhamento por Conta - {MESES[mes - 1]}/{ano}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, textAlign: 'left' }}>Conta</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Orcado</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Realizado</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Variacao</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ORC.map((row, i) => {
              const v = parseFloat(var_(row.realizado, row.orcado))
              return (
                <tr key={i}>
                  <td style={S.td}>{row.conta}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{fmtFull(row.orcado)}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{fmtFull(row.realizado)}</td>
                  <td style={{ ...S.td, textAlign: 'right', color: v >= 0 ? '#3b82f6' : '#f87171', fontWeight: 600 }}>{var_(row.realizado, row.orcado)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
