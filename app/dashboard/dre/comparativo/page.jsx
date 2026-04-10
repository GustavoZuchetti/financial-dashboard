'use client'
import { useState } from 'react'

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  filters: { display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' },
  select: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 13 },
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '24px', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', color: '#6b7280', fontSize: 11, fontWeight: 600, padding: '10px 12px', borderBottom: '1px solid #1e1e2e', textTransform: 'uppercase' },
  td: { padding: '12px', borderBottom: '1px solid #1e1e2e', fontSize: 14, color: '#e5e7eb' },
  tdRight: { padding: '12px', borderBottom: '1px solid #1e1e2e', fontSize: 14, textAlign: 'right' },
  bold: { fontWeight: 700, color: '#fff' },
}

const dados = [
  { conta: 'Receita Bruta', p1: 850, p2: 785, tipo: 'pos' },
  { conta: 'Deducoes', p1: -85, p2: -79, tipo: 'neg' },
  { conta: 'Receita Liquida', p1: 765, p2: 706, tipo: 'total' },
  { conta: 'CPV / CMV', p1: -306, p2: -282, tipo: 'neg' },
  { conta: 'Lucro Bruto', p1: 459, p2: 424, tipo: 'total' },
  { conta: 'Despesas Operacionais', p1: -183, p2: -170, tipo: 'neg' },
  { conta: 'EBITDA', p1: 276, p2: 254, tipo: 'total' },
  { conta: 'D&A', p1: -41, p2: -38, tipo: 'neg' },
  { conta: 'EBIT', p1: 235, p2: 216, tipo: 'total' },
  { conta: 'Resultado Financeiro', p1: -27, p2: -25, tipo: 'neg' },
  { conta: 'Lucro Antes IR', p1: 208, p2: 191, tipo: 'total' },
  { conta: 'IR / CSLL', p1: -42, p2: -38, tipo: 'neg' },
  { conta: 'Lucro Liquido', p1: 166, p2: 153, tipo: 'lucro' },
]

export default function DREComparativo() {
  const [per1, setPer1] = useState('abr-2026')
  const [per2, setPer2] = useState('mar-2026')

  const periodos = ['jan-2026','fev-2026','mar-2026','abr-2026','mai-2026','jun-2026']

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>DRE Comparativo</h1>
        <p style={S.subtitle}>Comparacao entre periodos</p>
      </div>
      <div style={S.filters}>
        <select style={S.select} value={per1} onChange={e => setPer1(e.target.value)}>
          {periodos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{color:'#6b7280'}}>vs</span>
        <select style={S.select} value={per2} onChange={e => setPer2(e.target.value)}>
          {periodos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>Comparativo DRE - {per1.toUpperCase()} vs {per2.toUpperCase()}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Conta</th>
              <th style={{...S.th, textAlign:'right'}}>{per1}</th>
              <th style={{...S.th, textAlign:'right'}}>{per2}</th>
              <th style={{...S.th, textAlign:'right'}}>Variacao R$</th>
              <th style={{...S.th, textAlign:'right'}}>Variacao %</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d, i) => {
              const isTotal = d.tipo === 'total' || d.tipo === 'lucro'
              const varR = d.p1 - d.p2
              const varPct = d.p2 !== 0 ? ((varR / Math.abs(d.p2)) * 100).toFixed(1) : '0.0'
              const isPos = d.tipo === 'neg' ? varR <= 0 : varR >= 0
              return (
                <tr key={i}>
                  <td style={{...S.td, ...(isTotal ? S.bold : {})}}>{d.conta}</td>
                  <td style={{...S.tdRight, ...(isTotal ? S.bold : {}), color: d.tipo === 'lucro' ? '#00e676' : d.p1 < 0 ? '#ef4444' : '#e5e7eb'}}>
                    R$ {Math.abs(d.p1).toLocaleString('pt-BR')} mil
                  </td>
                  <td style={{...S.tdRight, color: d.p2 < 0 ? '#ef4444' : '#9ca3af'}}>
                    R$ {Math.abs(d.p2).toLocaleString('pt-BR')} mil
                  </td>
                  <td style={{...S.tdRight, color: isPos ? '#00e676' : '#ef4444'}}>
                    {varR > 0 ? '+' : ''}{varR.toLocaleString('pt-BR')} mil
                  </td>
                  <td style={{...S.tdRight, color: isPos ? '#00e676' : '#ef4444'}}>
                    {Number(varPct) > 0 ? '+' : ''}{varPct}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
