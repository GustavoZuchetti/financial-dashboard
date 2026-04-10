'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell, Legend } from 'recharts'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)

const MOCK_FLUXO = [
  { name: 'Jan/26', entradas: 210000, saidas: 380000, saldo: -170000 },
  { name: 'Fev/26', entradas: 225000, saidas: 375000, saldo: -150000 },
  { name: 'Mar/26', entradas: 240000, saidas: 410000, saldo: -170000 },
  { name: 'Abr/26', entradas: 15000, saidas: 50000, saldo: -35000 }
]

const S = {
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  kpiTitle: { fontSize: '14px', color: '#9ca3af', marginBottom: '8px' },
  kpiValue: { fontSize: '24px', fontWeight: 'bold' },
  sectionTitle: { fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#f3f4f6' }
}

const KPICard = ({ title, value, color = '#10b981' }) => (
  <div style={S.card}>
    <div style={S.kpiTitle}>{title}</div>
    <div style={{ ...S.kpiValue, color }}>{value}</div>
  </div>
)

export default function FluxoCaixaGeral() {
  return (
    <div style={{ padding: '24px', color: '#e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Fluxo de Caixa</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
           <div style={{ ...S.card, padding: '8px 16px' }}>3 empresas selecionadas</div>
           <div style={{ ...S.card, padding: '8px 16px' }}>📅 01/01/2026 → 30/04/2026</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <KPICard title="Recebido" value="R$ 666.550" color="#10b981" />
        <KPICard title="Pago" value="R$ 1.175.115" color="#ef4444" />
        <KPICard title="A Receber em Atraso" value="R$ 0" color="#9ca3af" />
        <KPICard title="A Pagar em Atraso" value="R$ 0" color="#9ca3af" />
      </div>

      <div style={S.card}>
        <h2 style={S.sectionTitle}>Fluxo de caixa ⓘ</h2>
        <div style={{ height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={MOCK_FLUXO}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={fmt} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
              <Legend verticalAlign="bottom" height={36}/>
              <Bar dataKey="entradas" fill="#10b981" barSize={40} radius={[4, 4, 0, 0]} name="Entradas" />
              <Bar dataKey="saidas" fill="#ef4444" barSize={40} radius={[4, 4, 0, 0]} name="Saídas" />
              <Line type="monotone" dataKey="saldo" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 6, fill: '#8b5cf6' }} name="Saldo" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
