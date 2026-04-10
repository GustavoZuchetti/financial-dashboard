'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Cell } from 'recharts'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const ANO_ATUAL = new Date().getFullYear()

const MOCK_WATERFALL = [
  { name: 'Receita Bruta', value: 913960, start: 0, end: 913960, type: 'positive' },
  { name: 'Deduções', value: -85000, start: 913960, end: 828960, type: 'negative' },
  { name: 'Receita Líquida', value: 828960, start: 0, end: 828960, type: 'total' },
  { name: 'Custos Variáveis', value: -306000, start: 828960, end: 522960, type: 'negative' },
  { name: 'Lucro Bruto', value: 522960, start: 0, end: 522960, type: 'total' },
  { name: 'Despesas Fixas', value: -183000, start: 522960, end: 339960, type: 'negative' },
  { name: 'EBITDA', value: 339960, start: 0, end: 339960, type: 'total' },
  { name: 'Receitas Financeiras', value: 45000, start: 339960, end: 384960, type: 'positive' },
  { name: 'Despesas Financeiras', value: -27000, start: 384960, end: 357960, type: 'negative' },
  { name: 'Resultado Líquido', value: 357960, start: 0, end: 357960, type: 'total' },
  { name: 'Investimentos', value: -150000, start: 357960, end: 207960, type: 'negative' },
  { name: 'Resultado Final', value: 207960, start: 0, end: 207960, type: 'total' }
]

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const S = {
  page: { color: '#e5e7eb' },
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  kpiTitle: { fontSize: '14px', color: '#9ca3af', marginBottom: '8px' },
  kpiValue: { fontSize: '24px', fontWeight: 'bold' },
  kpiSub: { fontSize: '12px', marginTop: '4px' },
  sectionTitle: { fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }
}

const KPICard = ({ title, value, sub, color = '#10b981' }) => (
  <div style={S.card}>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div>
        <div style={S.kpiTitle}>{title}</div>
        <div style={{ ...S.kpiValue, color }}>{value}</div>
        <div style={{ ...S.kpiSub, color: sub?.startsWith('+') ? '#10b981' : '#ef4444' }}>{sub}</div>
      </div>
      <div style={{ color: '#9ca3af', cursor: 'help' }}>ⓘ</div>
    </div>
  </div>
)

export default function DREGeral() {
  const [empresa, setEmpresa] = useState('3 empresas selecionadas')
  
  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>DRE</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ ...S.card, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <span>{empresa}</span>
          </div>
          <div style={{ ...S.card, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <span>📅 01/01/2026 → 30/04/2026</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <KPICard title="Receita Bruta" value="R$ 913.960" sub="" color="#10b981" />
        <KPICard title="Margem de Contribuição" value="74,3%" sub="" color="#10b981" />
        <KPICard title="EBITDA" value="-20,0%" sub="" color="#ef4444" />
        <KPICard title="Resultado Líquido" value="-36,8%" sub="" color="#ef4444" />
        <KPICard title="Resultado Final" value="-65,4%" sub="" color="#ef4444" />
      </div>

      <div style={{ ...S.card, marginBottom: '32px' }}>
        <h2 style={S.sectionTitle}>Da Receita ao Lucro</h2>
        <div style={{ height: '400px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_WATERFALL} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(v, name, props) => [fmtFull(props.payload.value), 'Valor']}
              />
              <Bar dataKey="end" radius={[4, 4, 0, 0]}>
                {MOCK_WATERFALL.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.type === 'total' ? '#6b7280' : entry.type === 'positive' ? '#10b981' : '#ef4444'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div style={S.card}>
          <h2 style={S.sectionTitle}>Operação direta ⓘ</h2>
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563' }}>
            [Gráfico de barras mensais: Receita, Custo, Margem]
          </div>
        </div>
        <div style={S.card}>
          <h2 style={S.sectionTitle}>Operação indireta ⓘ</h2>
           <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563' }}>
            [Gráfico de barras mensais: EBITDA, Despesas]
          </div>
        </div>
      </div>
    </div>
  )
}
