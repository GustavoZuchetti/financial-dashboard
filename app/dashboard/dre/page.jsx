'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()

const MOCK_DRE = [
  { conta: 'Receita Bruta', valor: 850000, tipo: 'receita' },
  { conta: 'Deducoes de Receita', valor: -85000, tipo: 'deducao' },
  { conta: 'Receita Liquida', valor: 765000, tipo: 'subtotal' },
  { conta: 'CPV / CMV', valor: -306000, tipo: 'custo' },
  { conta: 'Lucro Bruto', valor: 459000, tipo: 'subtotal' },
  { conta: 'Despesas Operacionais', valor: -183000, tipo: 'despesa' },
  { conta: 'EBITDA', valor: 276000, tipo: 'subtotal' },
  { conta: 'Depreciacao', valor: -18000, tipo: 'despesa' },
  { conta: 'EBIT', valor: 258000, tipo: 'subtotal' },
  { conta: 'Resultado Financeiro', valor: -25000, tipo: 'financeiro' },
  { conta: 'Lucro Antes IR', valor: 233000, tipo: 'subtotal' },
  { conta: 'IRPJ / CSLL', valor: -79220, tipo: 'imposto' },
  { conta: 'Lucro Liquido', valor: 153780, tipo: 'resultado' },
]

const MOCK_MENSAL = MESES.map((mes, i) => ({
  mes,
  receita: Math.round(700000 + Math.random() * 300000),
  lucro: Math.round(100000 + Math.random() * 150000),
}))

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtPct = (v, base) => base ? ((v / base) * 100).toFixed(1) + '%' : '-'

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, background: '#12121a', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab: (active) => ({ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#fff' : '#6b7280', background: active ? '#1e1e2e' : 'transparent', cursor: 'pointer', border: 'none' }),
  filters: { display: 'flex', gap: 10, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' },
  select: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e5e7eb', padding: '8px 12px', fontSize: 13 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  kpiCard: (color) => ({ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '16px 20px', borderLeft: `3px solid ${color}` }),
  kpiLabel: { color: '#9ca3af', fontSize: 12, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  kpiValue: { fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 },
  kpiDelta: (pos) => ({ fontSize: 12, color: pos ? '#00e676' : '#f87171', marginTop: 4 }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '20px 24px' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  tr: (tipo) => ({ background: tipo === 'subtotal' || tipo === 'resultado' ? 'rgba(0,230,118,0.05)' : 'transparent' }),
  td: (bold) => ({ padding: '8px 4px', fontSize: 13, color: '#e5e7eb', borderBottom: '1px solid #1e1e2e', fontWeight: bold ? 700 : 400 }),
  tdRight: (v, bold) => ({ padding: '8px 4px', fontSize: 13, color: v < 0 ? '#f87171' : v > 0 ? '#e5e7eb' : '#6b7280', textAlign: 'right', fontWeight: bold ? 700 : 400, borderBottom: '1px solid #1e1e2e' }),
}

const TABS = ['DRE Geral', 'DRE Detalhado', 'Analise', 'Comparativo']

export default function DrePage() {
  const [tab, setTab] = useState('DRE Geral')
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(ANO_ATUAL)

  const receitaBruta = MOCK_DRE.find(r => r.conta === 'Receita Bruta')?.valor || 1
  const lucroLiquido = MOCK_DRE.find(r => r.conta === 'Lucro Liquido')?.valor || 0
  const ebitda = MOCK_DRE.find(r => r.conta === 'EBITDA')?.valor || 0
  const lucroBruto = MOCK_DRE.find(r => r.conta === 'Lucro Bruto')?.valor || 0

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>DRE - Demonstracao do Resultado</h1>
        <p style={S.subtitle}>Analise financeira completa do periodo selecionado</p>
      </div>

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div style={S.filters}>
        <select style={S.select} value={mes} onChange={e => setMes(+e.target.value)}>
          {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select style={S.select} value={ano} onChange={e => setAno(+e.target.value)}>
          {[ANO_ATUAL, ANO_ATUAL-1, ANO_ATUAL-2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div style={S.kpiGrid}>
        <div style={S.kpiCard('#00e676')}>
          <div style={S.kpiLabel}>Receita Bruta</div>
          <div style={S.kpiValue}>{fmt(receitaBruta)}</div>
          <div style={S.kpiDelta(true)}>+8.3% vs mes anterior</div>
        </div>
        <div style={S.kpiCard('#3b82f6')}>
          <div style={S.kpiLabel}>Lucro Bruto</div>
          <div style={S.kpiValue}>{fmt(lucroBruto)}</div>
          <div style={S.kpiDelta(true)}>Margem: {fmtPct(lucroBruto, receitaBruta)}</div>
        </div>
        <div style={S.kpiCard('#8b5cf6')}>
          <div style={S.kpiLabel}>EBITDA</div>
          <div style={S.kpiValue}>{fmt(ebitda)}</div>
          <div style={S.kpiDelta(true)}>Margem: {fmtPct(ebitda, receitaBruta)}</div>
        </div>
        <div style={S.kpiCard(lucroLiquido >= 0 ? '#00e676' : '#ef4444')}>
          <div style={S.kpiLabel}>Lucro Liquido</div>
          <div style={S.kpiValue}>{fmt(lucroLiquido)}</div>
          <div style={S.kpiDelta(lucroLiquido >= 0)}>Margem: {fmtPct(lucroLiquido, receitaBruta)}</div>
        </div>
      </div>

      {/* Graficos */}
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardTitle}>Receita x Lucro Mensal</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MOCK_MENSAL} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickFormatter={v => fmt(v)} width={70} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8 }} labelStyle={{ color: '#fff' }} formatter={v => fmtFull(v)} />
              <Bar dataKey="receita" fill="#3b82f6" radius={[4,4,0,0]} name="Receita" />
              <Bar dataKey="lucro" fill="#00e676" radius={[4,4,0,0]} name="Lucro" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Evolucao do Lucro Liquido</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={MOCK_MENSAL}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickFormatter={v => fmt(v)} width={70} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8 }} labelStyle={{ color: '#fff' }} formatter={v => fmtFull(v)} />
              <Line type="monotone" dataKey="lucro" stroke="#00e676" strokeWidth={2} dot={{ fill: '#00e676', r: 3 }} name="Lucro" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela DRE */}
      <div style={S.card}>
        <div style={S.cardTitle}>Demonstracao do Resultado - {MESES[mes-1]}/{ano}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.td(true), color: '#9ca3af', textAlign: 'left', fontSize: 12, textTransform: 'uppercase' }}>Conta</th>
              <th style={{ ...S.td(true), color: '#9ca3af', textAlign: 'right', fontSize: 12, textTransform: 'uppercase' }}>Valor</th>
              <th style={{ ...S.td(true), color: '#9ca3af', textAlign: 'right', fontSize: 12, textTransform: 'uppercase' }}>AV%</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_DRE.map((row, i) => (
              <tr key={i} style={S.tr(row.tipo)}>
                <td style={S.td(row.tipo === 'subtotal' || row.tipo === 'resultado')}>
                  {row.tipo === 'subtotal' || row.tipo === 'resultado' ? row.conta : <span style={{ color: '#9ca3af' }}>&nbsp;&nbsp;&nbsp;{row.conta}</span>}
                </td>
                <td style={S.tdRight(row.valor, row.tipo === 'subtotal' || row.tipo === 'resultado')}>{fmtFull(row.valor)}</td>
                <td style={{ ...S.tdRight(row.valor, false), color: '#6b7280' }}>{fmtPct(Math.abs(row.valor), receitaBruta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
