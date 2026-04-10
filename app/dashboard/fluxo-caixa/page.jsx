'use client'
import { useState } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()

const MOCK_FLUXO = MESES.map((mes) => ({
  mes,
  entradas: Math.round(600000 + Math.random() * 300000),
  saidas: Math.round(400000 + Math.random() * 250000),
  saldo: 0,
})).map(d => ({ ...d, saldo: d.entradas - d.saidas }))

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const CATEGORIAS = [
  { nome: 'Recebimentos de Clientes', tipo: 'entrada', valor: 850000 },
  { nome: 'Outras Entradas', tipo: 'entrada', valor: 45000 },
  { nome: 'Fornecedores', tipo: 'saida', valor: -280000 },
  { nome: 'Folha de Pagamento', tipo: 'saida', valor: -180000 },
  { nome: 'Impostos e Tributos', tipo: 'saida', valor: -95000 },
  { nome: 'Despesas Operacionais', tipo: 'saida', valor: -75000 },
  { nome: 'Investimentos', tipo: 'saida', valor: -50000 },
]

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, background: '#12121a', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab: (a) => ({ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: a ? 600 : 400, color: a ? '#fff' : '#6b7280', background: a ? '#1e1e2e' : 'transparent', cursor: 'pointer', border: 'none' }),
  filters: { display: 'flex', gap: 10, marginBottom: 24 },
  select: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e5e7eb', padding: '8px 12px', fontSize: 13 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  kpiCard: (c) => ({ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '16px 20px', borderLeft: `3px solid ${c}` }),
  kpiLabel: { color: '#9ca3af', fontSize: 12, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  kpiValue: { fontSize: 22, fontWeight: 800, color: '#fff' },
  kpiSub: (pos) => ({ fontSize: 12, color: pos ? '#00e676' : '#f87171', marginTop: 4 }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '20px 24px', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  tr: { borderBottom: '1px solid #1e1e2e' },
  td: { padding: '10px 4px', fontSize: 13, color: '#e5e7eb' },
  badge: (t) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: t === 'entrada' ? 'rgba(0,230,118,0.1)' : 'rgba(239,68,68,0.1)', color: t === 'entrada' ? '#00e676' : '#f87171' }),
}

const TABS = ['Fluxo Geral', 'Analise', 'Projecao', 'Comparativo']

export default function FluxoCaixaPage() {
  const [tab, setTab] = useState('Fluxo Geral')
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(ANO_ATUAL)

  const totalEntradas = MOCK_FLUXO.reduce((a, d) => a + d.entradas, 0)
  const totalSaidas = MOCK_FLUXO.reduce((a, d) => a + d.saidas, 0)
  const saldoFinal = totalEntradas - totalSaidas
  const mesMock = MOCK_FLUXO[mes - 1]

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Fluxo de Caixa</h1>
        <p style={S.subtitle}>Controle de entradas e saidas do periodo</p>
      </div>

      <div style={S.tabs}>
        {TABS.map(t => <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{t}</button>)}
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
        <div style={S.kpiCard('#00e676')}>
          <div style={S.kpiLabel}>Total Entradas</div>
          <div style={S.kpiValue}>{fmt(mesMock.entradas)}</div>
          <div style={S.kpiSub(true)}>+12.5% vs mes anterior</div>
        </div>
        <div style={S.kpiCard('#ef4444')}>
          <div style={S.kpiLabel}>Total Saidas</div>
          <div style={S.kpiValue}>{fmt(mesMock.saidas)}</div>
          <div style={S.kpiSub(false)}>+5.2% vs mes anterior</div>
        </div>
        <div style={S.kpiCard(mesMock.saldo >= 0 ? '#00e676' : '#ef4444')}>
          <div style={S.kpiLabel}>Saldo do Periodo</div>
          <div style={S.kpiValue}>{fmt(mesMock.saldo)}</div>
          <div style={S.kpiSub(mesMock.saldo >= 0)}>{mesMock.saldo >= 0 ? 'Fluxo positivo' : 'Atencao: fluxo negativo'}</div>
        </div>
        <div style={S.kpiCard('#3b82f6')}>
          <div style={S.kpiLabel}>Saldo Acumulado</div>
          <div style={S.kpiValue}>{fmt(saldoFinal)}</div>
          <div style={S.kpiSub(saldoFinal >= 0)}>Acumulado {ano}</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Evolucao do Fluxo de Caixa - {ano}</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={MOCK_FLUXO}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickFormatter={v => fmt(v)} width={75} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8 }} labelStyle={{ color: '#fff' }} formatter={v => fmtFull(v)} />
            <Area type="monotone" dataKey="entradas" stroke="#00e676" fill="rgba(0,230,118,0.1)" strokeWidth={2} name="Entradas" />
            <Area type="monotone" dataKey="saidas" stroke="#ef4444" fill="rgba(239,68,68,0.1)" strokeWidth={2} name="Saidas" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Categorias - {MESES[mes - 1]}/{ano}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.td, color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', textAlign: 'left' }}>Categoria</th>
              <th style={{ ...S.td, color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', textAlign: 'center' }}>Tipo</th>
              <th style={{ ...S.td, color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIAS.map((c, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}>{c.nome}</td>
                <td style={{ ...S.td, textAlign: 'center' }}><span style={S.badge(c.tipo)}>{c.tipo}</span></td>
                <td style={{ ...S.td, textAlign: 'right', color: c.valor < 0 ? '#f87171' : '#00e676', fontWeight: 600 }}>{fmtFull(c.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
