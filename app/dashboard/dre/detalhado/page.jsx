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
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', color: '#6b7280', fontSize: 11, fontWeight: 600, padding: '10px 12px', borderBottom: '1px solid #1e1e2e', textTransform: 'uppercase' },
  td: { padding: '12px', borderBottom: '1px solid #1e1e2e', fontSize: 14, color: '#e5e7eb' },
  tdRight: { padding: '12px', borderBottom: '1px solid #1e1e2e', fontSize: 14, color: '#e5e7eb', textAlign: 'right' },
  tdNeg: { padding: '12px', borderBottom: '1px solid #1e1e2e', fontSize: 14, color: '#ef4444', textAlign: 'right' },
  tdPos: { padding: '12px', borderBottom: '1px solid #1e1e2e', fontSize: 14, color: '#00e676', textAlign: 'right' },
  bold: { fontWeight: 700, color: '#fff' },
}

const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const contas = [
  { nome: 'Receita Bruta', valores: [780,800,820,850,870,890,860,840,880,910,930,950], tipo: 'pos', nivel: 1 },
  { nome: 'Deducoes de Receita', valores: [-78,-80,-82,-85,-87,-89,-86,-84,-88,-91,-93,-95], tipo: 'neg', nivel: 2 },
  { nome: 'Receita Liquida', valores: [702,720,738,765,783,801,774,756,792,819,837,855], tipo: 'total', nivel: 1 },
  { nome: 'CPV / CMV', valores: [-281,-288,-295,-306,-313,-320,-309,-302,-317,-328,-335,-342], tipo: 'neg', nivel: 2 },
  { nome: 'Lucro Bruto', valores: [421,432,443,459,470,481,465,454,475,491,502,513], tipo: 'total', nivel: 1 },
  { nome: 'Despesas Operacionais', valores: [-168,-173,-178,-183,-188,-193,-187,-182,-190,-197,-202,-207], tipo: 'neg', nivel: 2 },
  { nome: 'EBITDA', valores: [253,259,265,276,282,288,278,272,285,294,300,306], tipo: 'total', nivel: 1 },
  { nome: 'Depreciacao e Amortizacao', valores: [-38,-39,-40,-41,-42,-43,-42,-41,-43,-44,-45,-46], tipo: 'neg', nivel: 2 },
  { nome: 'EBIT', valores: [215,220,225,235,240,245,236,231,242,250,255,260], tipo: 'total', nivel: 1 },
  { nome: 'Resultado Financeiro', valores: [-24,-25,-26,-27,-28,-29,-28,-27,-29,-30,-31,-32], tipo: 'neg', nivel: 2 },
  { nome: 'Lucro Antes IR', valores: [191,195,199,208,212,216,208,204,213,220,224,228], tipo: 'total', nivel: 1 },
  { nome: 'IR / CSLL', valores: [-38,-39,-40,-42,-43,-43,-42,-41,-43,-44,-45,-46], tipo: 'neg', nivel: 2 },
  { nome: 'Lucro Liquido', valores: [153,156,159,166,169,173,166,163,170,176,179,182], tipo: 'lucro', nivel: 1 },
]

const fmt = (v) => {
  if (v === 0) return 'R$ 0'
  const abs = Math.abs(v)
  const str = abs >= 1000 ? `R$ ${(abs/1000).toFixed(0)} mil` : `R$ ${abs.toLocaleString('pt-BR')}`
  return v < 0 ? `-${str}` : str
}

export default function DREDetalhado() {
  const [mesSel, setMesSel] = useState(3)
  
  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>DRE Detalhado</h1>
        <p style={S.subtitle}>Demonstracao do Resultado com abertura mensal completa</p>
      </div>
      <div style={S.filters}>
        <select style={S.select} value={mesSel} onChange={e => setMesSel(Number(e.target.value))}>
          {meses.map((m,i) => <option key={i} value={i}>{m} 2026</option>)}
        </select>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>DRE Completo - {meses[mesSel]}/2026</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Conta</th>
              <th style={{...S.th, textAlign:'right'}}>Valor</th>
              <th style={{...S.th, textAlign:'right'}}>AV%</th>
              <th style={{...S.th, textAlign:'right'}}>MH%</th>
            </tr>
          </thead>
          <tbody>
            {contas.map((c,i) => {
              const val = c.valores[mesSel] * 1000
              const recBruta = contas[0].valores[mesSel] * 1000
              const av = ((val / recBruta) * 100).toFixed(1)
              const prev = mesSel > 0 ? contas[i].valores[mesSel-1] * 1000 : val
              const mh = prev !== 0 ? (((val - prev) / Math.abs(prev)) * 100).toFixed(1) : '0.0'
              const isNeg = val < 0
              const isTotal = c.tipo === 'total' || c.tipo === 'lucro'
              return (
                <tr key={i}>
                  <td style={{...S.td, ...(isTotal ? S.bold : {}), paddingLeft: c.nivel === 2 ? 28 : 12}}>{c.nome}</td>
                  <td style={isNeg ? S.tdNeg : {...S.tdRight, ...(c.tipo==='lucro'?{color:'#00e676',fontWeight:700}:{})}}>
                    {isNeg ? `-R$ ${Math.abs(val).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : `R$ ${val.toLocaleString('pt-BR',{minimumFractionDigits:2})}`}
                  </td>
                  <td style={{...S.tdRight, color: '#9ca3af'}}>{Math.abs(Number(av)).toFixed(1)}%</td>
                  <td style={{...S.tdRight, color: Number(mh) >= 0 ? '#00e676' : '#ef4444'}}>{Number(mh) >= 0 ? '+' : ''}{mh}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>Evolucao Mensal - 2026</div>
        <div style={{overflowX:'auto'}}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Conta</th>
              {meses.map(m => <th key={m} style={{...S.th, textAlign:'right'}}>{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {contas.filter(c => c.nivel === 1).map((c,i) => (
              <tr key={i}>
                <td style={{...S.td, ...S.bold}}>{c.nome}</td>
                {c.valores.map((v,j) => (
                  <td key={j} style={v < 0 ? S.tdNeg : {...S.tdRight, ...(c.tipo==='lucro'?{color:'#00e676',fontWeight:700}:{})}}>
                    {v < 0 ? `-R$ ${(Math.abs(v)).toLocaleString('pt-BR')} mil` : `R$ ${v.toLocaleString('pt-BR')} mil`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
