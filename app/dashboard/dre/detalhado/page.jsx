'use client'
import { useState } from 'react'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0 }).format(v)

const S = {
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  kpiTitle: { fontSize: '13px', color: '#9ca3af', marginBottom: '8px' },
  kpiValue: { fontSize: '22px', fontWeight: 'bold' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px' },
  th: { textAlign: 'left', color: '#9ca3af', fontSize: '11px', fontWeight: '600', padding: '12px', borderBottom: '1px solid #374151', textTransform: 'uppercase' },
  td: { padding: '12px', borderBottom: '1px solid #1f2937', fontSize: '13px' },
  rowTotal: { fontWeight: 'bold', backgroundColor: '#111827' },
  expandBtn: { cursor: 'pointer', marginRight: '8px', color: '#10b981' }
}

const KPICard = ({ title, value, color = '#10b981' }) => (
  <div style={S.card}>
    <div style={S.kpiTitle}>{title}</div>
    <div style={{ ...S.kpiValue, color }}>{value}</div>
  </div>
)

const ROWS = [
  { id: 1, name: 'RECEITA BRUTA', values: [191055, 233081, 226852, 262973], total: 913960, level: 0, type: 'pos' },
  { id: 2, name: 'RECEITA BRUTA', values: [191055, 233081, 226852, 262973], total: 913960, level: 1, type: 'pos', parentId: 1 },
  { id: 3, name: 'OUTROS RECEBIMENTOS', values: [0, 0, 0, 0], total: 0, level: 1, type: 'pos', parentId: 1 },
  { id: 4, name: 'IMPOSTOS SOBRE RECEITA', values: [-12706, -15515, -15086, -19201], total: -62508, level: 1, type: 'neg', parentId: 1 },
  { id: 5, name: 'RECEITA LÍQUIDA', values: [178349, 217566, 211766, 243772], total: 851452, level: 0, type: 'total' },
  { id: 6, name: 'CUSTOS VARIÁVEIS', values: [-42665, -40351, -47000, -42667], total: -172684, level: 0, type: 'neg' },
  { id: 7, name: 'CAC', values: [-551, -637, -630, -683], total: -2501, level: 1, type: 'neg', parentId: 6 },
  { id: 8, name: 'CSP', values: [-42115, -39714, -46371, -41985], total: -170183, level: 1, type: 'neg', parentId: 6 },
  { id: 9, name: 'LUCRO BRUTO', values: [135683, 177215, 164766, 201104], total: 678768, level: 0, type: 'total' },
  { id: 10, name: 'DESPESAS FIXAS', values: [-205377, -205408, -219991, -230494], total: -861271, level: 0, type: 'neg' }
]

export default function DREDetalhado() {
  const [expanded, setExpanded] = useState({ 1: true, 6: true })

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const visibleRows = ROWS.filter(row => !row.parentId || expanded[row.parentId])

  return (
    <div style={{ padding: '24px', color: '#e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>DRE Detalhado</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ ...S.card, padding: '8px 16px' }}>3 empresas selecionadas</div>
          <div style={{ ...S.card, padding: '8px 16px' }}>📅 01/01/2026 → 30/04/2026</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <KPICard title="Receita Bruta" value="R$ 913.960" />
        <KPICard title="Margem de Contribuição" value="74,3%" />
        <KPICard title="EBITDA" value="-20,0%" color="#ef4444" />
        <KPICard title="Resultado Líquido" value="-36,8%" color="#ef4444" />
        <KPICard title="Resultado Final" value="-65,4%" color="#ef4444" />
      </div>

      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Plano de Contas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Jan/26</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Fev/26</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Mar/26</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Abr/26</th>
                <th style={{ ...S.th, textAlign: 'right' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(row => (
                <tr key={row.id} style={row.level === 0 ? S.rowTotal : {}}>
                  <td style={{ ...S.td, paddingLeft: row.level * 24 + 12 }}>
                    {ROWS.some(r => r.parentId === row.id) && (
                      <span onClick={() => toggle(row.id)} style={S.expandBtn}>
                        {expanded[row.id] ? '▼' : '▶'}
                      </span>
                    )}
                    {row.name}
                  </td>
                  {row.values.map((v, i) => (
                    <td key={i} style={{ ...S.td, textAlign: 'right', color: v < 0 ? '#ef4444' : '#e5e7eb' }}>
                      {fmtFull(Math.abs(v))}
                    </td>
                  ))}
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 'bold', color: row.total < 0 ? '#ef4444' : '#e5e7eb' }}>
                    {fmtFull(Math.abs(row.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
