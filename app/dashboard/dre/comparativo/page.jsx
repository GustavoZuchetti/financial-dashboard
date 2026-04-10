'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)

const MOCK_WATERFALL_A = [
  { name: 'Receita Bruta', range: [0, 913960], value: 913960, type: 'total' },
  { name: 'Deduções', range: [828960, 913960], value: -85000, type: 'negative' },
  { name: 'Receita Líquida', range: [0, 828960], value: 828960, type: 'total' },
  { name: 'Custos Variáveis', range: [522960, 828960], value: -306000, type: 'negative' },
  { name: 'Lucro Bruto', range: [0, 522960], value: 522960, type: 'total' },
  { name: 'Despesas Fixas', range: [339960, 522960], value: -183000, type: 'negative' },
  { name: 'EBITDA', range: [0, 339960], value: 339960, type: 'total' },
  { name: 'Resultado Final', range: [0, 207960], value: 207960, type: 'total' }
]

const MOCK_WATERFALL_B = [
  { name: 'Receita Bruta', range: [0, 1527911], value: 1527911, type: 'total' },
  { name: 'Deduções', range: [1427911, 1527911], value: -100000, type: 'negative' },
  { name: 'Receita Líquida', range: [0, 1427911], value: 1427911, type: 'total' },
  { name: 'Custos Variáveis', range: [1127911, 1427911], value: -300000, type: 'negative' },
  { name: 'Lucro Bruto', range: [0, 1127911], value: 1127911, type: 'total' },
  { name: 'Despesas Fixas', range: [827911, 1127911], value: -300000, type: 'negative' },
  { name: 'EBITDA', range: [0, 827911], value: 827911, type: 'total' },
  { name: 'Resultado Final', range: [0, 500000], value: 500000, type: 'total' }
]

const S = {
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  kpiTitle: { fontSize: '12px', color: '#9ca3af', marginBottom: '4px' },
  kpiValue: { fontSize: '18px', fontWeight: 'bold' },
  sectionTitle: { fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', color: '#f3f4f6' }
}

const KPICard = ({ title, value, color = '#10b981' }) => (
  <div style={{ ...S.card, padding: '12px' }}>
    <div style={S.kpiTitle}>{title}</div>
    <div style={{ ...S.kpiValue, color }}>{value}</div>
  </div>
)

const DREColumn = ({ title, date, waterfallData, kpis }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div style={{ ...S.card, padding: '12px', textAlign: 'center' }}>📅 {date}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <KPICard title="Receita Bruta" value={kpis.receita} />
      <KPICard title="Margem Contribuição" value={kpis.margem} />
      <KPICard title="EBITDA" value={kpis.ebitda} color={kpis.ebitda.startsWith('-') ? '#ef4444' : '#10b981'} />
      <KPICard title="Resultado Líquido" value={kpis.resLiq} color={kpis.resLiq.startsWith('-') ? '#ef4444' : '#10b981'} />
      <KPICard title="Resultado Final" value={kpis.resFinal} color={kpis.resFinal.startsWith('-') ? '#ef4444' : '#10b981'} />
    </div>
    <div style={S.card}>
      <h3 style={S.sectionTitle}>Da Receita ao Lucro</h3>
      <div style={{ height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={fmt} />
            <Bar dataKey="range">
              {waterfallData.map((entry, i) => (
                <Cell key={i} fill={entry.type === 'total' ? '#10b981' : '#ef4444'} fillOpacity={entry.type === 'total' ? 0.8 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
)

export default function DREComparativo() {
  return (
    <div style={{ padding: '24px', color: '#e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>DRE Comparativo</h1>
        <div style={{ ...S.card, padding: '8px 16px' }}>3 empresas selecionadas</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <DREColumn 
          date="01/01/2026 → 30/04/2026" 
          waterfallData={MOCK_WATERFALL_A}
          kpis={{ receita: 'R$ 913.960', margem: '74,3%', ebitda: '-20,0%', resLiq: '-36,8%', resFinal: '-65,4%' }}
        />
        <DREColumn 
          date="01/10/2025 → 30/04/2026" 
          waterfallData={MOCK_WATERFALL_B}
          kpis={{ receita: 'R$ 1.527.911', margem: '74,9%', ebitda: '-25,7%', resLiq: '-49,3%', resFinal: '-78,3%' }}
        />
      </div>
    </div>
  )
}
