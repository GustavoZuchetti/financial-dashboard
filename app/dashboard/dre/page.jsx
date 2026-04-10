'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Line, ComposedChart } from 'recharts'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const MOCK_WATERFALL = [
  { name: 'Receita Bruta', range: [0, 913960], value: 913960, type: 'total' },
  { name: 'Deduções', range: [828960, 913960], value: -85000, type: 'negative' },
  { name: 'Receita Líquida', range: [0, 828960], value: 828960, type: 'total' },
  { name: 'Custos Variáveis', range: [522960, 828960], value: -306000, type: 'negative' },
  { name: 'Lucro Bruto', range: [0, 522960], value: 522960, type: 'total' },
  { name: 'Despesas Fixas', range: [339960, 522960], value: -183000, type: 'negative' },
  { name: 'EBITDA', range: [0, 339960], value: 339960, type: 'total' },
  { name: 'Rec/Desp Fin', range: [339960, 357960], value: 18000, type: 'positive' },
  { name: 'Resultado Líquido', range: [0, 357960], value: 357960, type: 'total' },
  { name: 'Investimentos', range: [207960, 357960], value: -150000, type: 'negative' },
  { name: 'Resultado Final', range: [0, 207960], value: 207960, type: 'total' }
]

const MOCK_OPERACAO = [
  { name: 'Jan/26', receita: 190000, custos: 15000, margem: 175000, margemPerc: 92, ebitda: 30000, despesas: 55000, naoOp: 45000 },
  { name: 'Fev/26', receita: 230000, custos: 20000, margem: 210000, margemPerc: 91, ebitda: 40000, despesas: 60000, naoOp: 50000 },
  { name: 'Mar/26', receita: 220000, custos: 18000, margem: 202000, margemPerc: 92, ebitda: 35000, despesas: 58000, naoOp: 48000 },
  { name: 'Abr/26', receita: 260000, custos: 25000, margem: 235000, margemPerc: 90, ebitda: 50000, despesas: 70000, naoOp: 60000 }
]

const S = {
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  kpiTitle: { fontSize: '13px', color: '#9ca3af', marginBottom: '8px' },
  kpiValue: { fontSize: '22px', fontWeight: 'bold' },
  sectionTitle: { fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f3f4f6' }
}

const KPICard = ({ title, value, color = '#10b981' }) => (
  <div style={S.card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={S.kpiTitle}>{title}</div>
        <div style={{ ...S.kpiValue, color }}>{value}</div>
      </div>
      <div style={{ color: '#6b7280', fontSize: '12px' }}>ⓘ</div>
    </div>
  </div>
)

export default function DREGeral() {
  return (
    <div style={{ color: '#e5e7eb', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>DRE</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ ...S.card, padding: '8px 16px' }}>3 empresas selecionadas</div>
          <div style={{ ...S.card, padding: '8px 16px' }}>📅 01/01/2026 → 30/04/2026</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <KPICard title="Receita Bruta" value="R$ 913.960" color="#10b981" />
        <KPICard title="Margem de Contribuição" value="74,3%" color="#10b981" />
        <KPICard title="EBITDA" value="-20,0%" color="#ef4444" />
        <KPICard title="Resultado Líquido" value="-36,8%" color="#ef4444" />
        <KPICard title="Resultado Final" value="-65,4%" color="#ef4444" />
      </div>

      <div style={{ ...S.card, marginBottom: '24px' }}>
        <h2 style={S.sectionTitle}>Da Receita ao Lucro</h2>
        <div style={{ height: '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_WATERFALL} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} formatter={(v) => fmtFull(v)} />
              <Bar dataKey="range" radius={[2, 2, 0, 0]}>
                {MOCK_WATERFALL.map((entry, i) => (
                  <Cell key={i} fill={entry.type === 'total' ? '#10b981' : entry.type === 'positive' ? '#10b981' : '#ef4444'} fillOpacity={entry.type === 'total' ? 0.8 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginBottom: '24px' }}>
         <div style={S.card}>
            <h2 style={S.sectionTitle}>Operação direta ⓘ</h2>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={MOCK_OPERACAO}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={fmt} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
                  <Bar dataKey="receita" fill="#10b981" barSize={30} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="custos" fill="#ef4444" barSize={30} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="margem" fill="#0ea5e9" barSize={30} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="margemPerc" stroke="#fff" strokeWidth={2} dot={{ r: 4, fill: '#fff' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
         </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={S.card}>
          <h2 style={S.sectionTitle}>Operação indireta ⓘ</h2>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_OPERACAO}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={fmt} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
                <Bar dataKey="ebitda" fill="#8b5cf6" barSize={25} radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" fill="#3b82f6" barSize={25} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={S.card}>
          <h2 style={S.sectionTitle}>Não operacional ⓘ</h2>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_OPERACAO}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={fmt} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
                <Bar dataKey="naoOp" fill="#06b6d4" barSize={30} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
