'use client'
import { useState } from 'react'

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '24px', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', color: '#6b7280', fontSize: 11, fontWeight: 600, padding: '10px 12px', borderBottom: '1px solid #1e1e2e', textTransform: 'uppercase' },
  td: { padding: '12px', borderBottom: '1px solid #1e1e2e', fontSize: 14, color: '#e5e7eb' },
  tdRight: { padding: '12px', borderBottom: '1px solid #1e1e2e', fontSize: 14, textAlign: 'right' },
  select: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 13 },
}

const meses = ['Jan 2026','Fev 2026','Mar 2026','Abr 2026']
const dados = [
  { mes: 'Jan', entradas: 780, saidas: 415, saldo: 365 },
  { mes: 'Fev', entradas: 800, saidas: 428, saldo: 372 },
  { mes: 'Mar', entradas: 820, saidas: 438, saldo: 382 },
  { mes: 'Abr', entradas: 895, saidas: 448, saldo: 447 },
]

export default function FluxoComparativo() {
  const [per1, setPer1] = useState('abr-2026')
  const [per2, setPer2] = useState('mar-2026')
  const periodos = ['jan-2026','fev-2026','mar-2026','abr-2026']

  const d1 = { entradas: 895, saidas: 448, saldo: 447, opFCF: 410, invFCF: -42, finFCF: 15 }
  const d2 = { entradas: 820, saidas: 438, saldo: 382, opFCF: 360, invFCF: -38, finFCF: 12 }

  const diff = (a, b) => {
    const v = a - b
    const pct = b !== 0 ? ((v / Math.abs(b)) * 100).toFixed(1) : '0.0'
    return { v, pct, isPos: v >= 0 }
  }

  const itens = [
    { label: 'Total Entradas', a: d1.entradas, b: d2.entradas, bom: true },
    { label: 'Total Saidas', a: d1.saidas, b: d2.saidas, bom: false },
    { label: 'Saldo Liquido', a: d1.saldo, b: d2.saldo, bom: true },
    { label: 'Fluxo Operacional', a: d1.opFCF, b: d2.opFCF, bom: true },
    { label: 'Fluxo de Investimento', a: d1.invFCF, b: d2.invFCF, bom: false },
    { label: 'Fluxo Financeiro', a: d1.finFCF, b: d2.finFCF, bom: true },
  ]

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Fluxo de Caixa Comparativo</h1>
        <p style={S.subtitle}>Comparacao de periodos do fluxo de caixa</p>
      </div>
      <div style={{display:'flex', gap:12, marginBottom:24, alignItems:'center'}}>
        <select style={S.select} value={per1} onChange={e => setPer1(e.target.value)}>
          {periodos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{color:'#6b7280'}}>vs</span>
        <select style={S.select} value={per2} onChange={e => setPer2(e.target.value)}>
          {periodos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Comparativo: {per1.toUpperCase()} vs {per2.toUpperCase()}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Item</th>
              <th style={{...S.th, textAlign:'right'}}>{per1}</th>
              <th style={{...S.th, textAlign:'right'}}>{per2}</th>
              <th style={{...S.th, textAlign:'right'}}>Dif. R$ mil</th>
              <th style={{...S.th, textAlign:'right'}}>Dif. %</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, i) => {
              const d = diff(item.a, item.b)
              const cor = item.bom ? (d.isPos ? '#3b82f6' : '#ef4444') : (d.isPos ? '#ef4444' : '#3b82f6')
              return (
                <tr key={i}>
                  <td style={{...S.td, fontWeight:600}}>{item.label}</td>
                  <td style={{...S.tdRight, color: item.a < 0 ? '#ef4444' : '#e5e7eb'}}>R$ {Math.abs(item.a)} mil</td>
                  <td style={{...S.tdRight, color:'#9ca3af'}}>R$ {Math.abs(item.b)} mil</td>
                  <td style={{...S.tdRight, color: cor, fontWeight:700}}>{d.v > 0 ? '+' : ''}{d.v} mil</td>
                  <td style={{...S.tdRight, color: cor}}>{Number(d.pct) > 0 ? '+' : ''}{d.pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Evolucao Mensal do Saldo</div>
        <div style={{display:'flex', gap:24, alignItems:'flex-end', height:160, padding:'0 8px'}}>
          {dados.map((d, i) => {
            const maxVal = Math.max(...dados.map(x => x.saldo))
            const h = Math.round((d.saldo / maxVal) * 120)
            return (
              <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8}}>
                <span style={{fontSize:12, color:'#3b82f6', fontWeight:700}}>R$ {d.saldo}</span>
                <div style={{width:'100%', height:h, background:'#3b82f6', borderRadius:'4px 4px 0 0', opacity:0.8}} />
                <span style={{fontSize:11, color:'#6b7280'}}>{d.mes}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
