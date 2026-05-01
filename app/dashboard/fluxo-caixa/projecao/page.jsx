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
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 },
  kpiLabel: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 },
  kpiValue: { fontSize: 24, fontWeight: 800 },
  badge: (t) => ({ display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background: t==='projetado'?'rgba(59,130,246,0.1)':'rgba(59,130,246,0.1)', color: t==='projetado'?'#3b82f6':'#3b82f6' }),
}

const meses = ['Mai 2026','Jun 2026','Jul 2026','Ago 2026','Set 2026','Dez 2026']
const projecoes = [
  { mes: 'Mai 2026', entradas: 870, saidas: 462, saldo: 408, acumulado: 2808, tipo: 'projetado' },
  { mes: 'Jun 2026', entradas: 890, saidas: 478, saldo: 412, acumulado: 3220, tipo: 'projetado' },
  { mes: 'Jul 2026', entradas: 860, saidas: 455, saldo: 405, acumulado: 3625, tipo: 'projetado' },
  { mes: 'Ago 2026', entradas: 840, saidas: 448, saldo: 392, acumulado: 4017, tipo: 'projetado' },
  { mes: 'Set 2026', entradas: 880, saidas: 465, saldo: 415, acumulado: 4432, tipo: 'projetado' },
  { mes: 'Out 2026', entradas: 910, saidas: 485, saldo: 425, acumulado: 4857, tipo: 'projetado' },
]

export default function FluxoCaixaProjecao() {
  const [cenario, setCenario] = useState('base')

  const multiplicador = cenario === 'otimista' ? 1.1 : cenario === 'pessimista' ? 0.85 : 1

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Projecao do Fluxo de Caixa</h1>
        <p style={S.subtitle}>Previsao de entradas e saidas para os proximos meses</p>
      </div>

      <div style={{display:'flex', gap:8, marginBottom:24}}>
        {['base','otimista','pessimista'].map(c => (
          <button key={c} onClick={() => setCenario(c)} style={{padding:'8px 20px', borderRadius:8, border:'1px solid #1e1e2e', background: cenario===c?'#3b82f6':'transparent', color: cenario===c?'#000':'#9ca3af', fontWeight:600, cursor:'pointer', fontSize:13, textTransform:'capitalize'}}>
            {c}
          </button>
        ))}
      </div>

      <div style={S.grid3}>
        <div style={S.card}>
          <div style={S.kpiLabel}>Projecao Proximos 6 Meses</div>
          <div style={{...S.kpiValue, color:'#3b82f6'}}>R$ {(projecoes.reduce((s,p) => s + p.entradas, 0) * multiplicador).toFixed(0)} mil</div>
          <div style={{fontSize:12,color:'#6b7280',marginTop:4}}>Total entradas projetadas</div>
        </div>
        <div style={S.card}>
          <div style={S.kpiLabel}>Total Saidas Projetadas</div>
          <div style={{...S.kpiValue, color:'#ef4444'}}>R$ {(projecoes.reduce((s,p) => s + p.saidas, 0) * multiplicador).toFixed(0)} mil</div>
          <div style={{fontSize:12,color:'#6b7280',marginTop:4}}>Total saidas projetadas</div>
        </div>
        <div style={S.card}>
          <div style={S.kpiLabel}>Saldo Projetado Acumulado</div>
          <div style={{...S.kpiValue, color:'#3b82f6'}}>R$ {(projecoes[projecoes.length-1].acumulado * multiplicador).toFixed(0)} mil</div>
          <div style={{fontSize:12,color:'#6b7280',marginTop:4}}>Acumulado Dez/2026</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Projecao Mensal - Cenario {cenario.charAt(0).toUpperCase() + cenario.slice(1)}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Mes</th>
              <th style={{...S.th, textAlign:'right'}}>Entradas</th>
              <th style={{...S.th, textAlign:'right'}}>Saidas</th>
              <th style={{...S.th, textAlign:'right'}}>Saldo Mes</th>
              <th style={{...S.th, textAlign:'right'}}>Acumulado</th>
              <th style={{...S.th, textAlign:'right'}}>Status</th>
            </tr>
          </thead>
          <tbody>
            {projecoes.map((p, i) => {
              const ent = Math.round(p.entradas * multiplicador)
              const sai = Math.round(p.saidas * multiplicador)
              const sal = ent - sai
              const acum = Math.round(p.acumulado * multiplicador)
              return (
                <tr key={i}>
                  <td style={S.td}>{p.mes}</td>
                  <td style={{...S.tdRight, color:'#3b82f6'}}>R$ {ent} mil</td>
                  <td style={{...S.tdRight, color:'#ef4444'}}>R$ {sai} mil</td>
                  <td style={{...S.tdRight, color: sal >= 0 ? '#3b82f6' : '#ef4444', fontWeight:700}}>R$ {sal} mil</td>
                  <td style={{...S.tdRight, color:'#3b82f6'}}>R$ {acum} mil</td>
                  <td style={{...S.tdRight}}><span style={S.badge(p.tipo)}>{p.tipo}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
