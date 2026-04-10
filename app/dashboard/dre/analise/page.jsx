'use client'
import { useState } from 'react'

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '24px' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 },
  kpiLabel: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 },
  kpiValue: { fontSize: 28, fontWeight: 800 },
  kpiSub: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  bar: { height: 8, borderRadius: 4, background: '#1e1e2e', marginBottom: 12 },
  barFill: (pct, color) => ({ height: 8, borderRadius: 4, background: color, width: `${pct}%` }),
  metricRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1e1e2e' },
  metricLabel: { fontSize: 13, color: '#9ca3af' },
  metricValue: { fontSize: 14, fontWeight: 700 },
  badge: (ok) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: ok ? 'rgba(0,230,118,0.1)' : 'rgba(239,68,68,0.1)', color: ok ? '#00e676' : '#ef4444' }),
}

const indicadores = [
  { label: 'Margem Bruta', valor: 54.0, meta: 55.0, cor: '#00e676' },
  { label: 'Margem EBITDA', valor: 32.5, meta: 35.0, cor: '#3b82f6' },
  { label: 'Margem Liquida', valor: 18.1, meta: 20.0, cor: '#8b5cf6' },
  { label: 'Margem EBIT', valor: 27.6, meta: 30.0, cor: '#f59e0b' },
  { label: 'Margem Operacional', valor: 21.5, meta: 25.0, cor: '#ec4899' },
]

export default function DREAnalise() {
  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Analise DRE</h1>
        <p style={S.subtitle}>Indicadores de rentabilidade e performance financeira</p>
      </div>

      <div style={S.grid}>
        <div style={S.card}>
          <div style={S.kpiLabel}>Receita Bruta</div>
          <div style={{...S.kpiValue, color: '#00e676'}}>R$ 850 mil</div>
          <div style={S.kpiSub}>+8.3% vs mes anterior</div>
        </div>
        <div style={S.card}>
          <div style={S.kpiLabel}>Lucro Bruto</div>
          <div style={{...S.kpiValue, color: '#3b82f6'}}>R$ 459 mil</div>
          <div style={S.kpiSub}>Margem: 54.0%</div>
        </div>
        <div style={S.card}>
          <div style={S.kpiLabel}>Lucro Liquido</div>
          <div style={{...S.kpiValue, color: '#8b5cf6'}}>R$ 153,8 mil</div>
          <div style={S.kpiSub}>Margem: 18.1%</div>
        </div>
      </div>

      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardTitle}>Margens de Rentabilidade</div>
          {indicadores.map((ind, i) => (
            <div key={i} style={{marginBottom: 16}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom: 6}}>
                <span style={{fontSize: 13, color: '#e5e7eb'}}>{ind.label}</span>
                <span style={{fontSize: 13, fontWeight: 700, color: ind.valor >= ind.meta ? '#00e676' : '#f59e0b'}}>{ind.valor}%</span>
              </div>
              <div style={S.bar}>
                <div style={S.barFill(ind.valor, ind.cor)} />
              </div>
              <div style={{fontSize: 11, color: '#6b7280'}}>Meta: {ind.meta}% - {ind.valor >= ind.meta ? 'Atingido' : `Falta ${(ind.meta - ind.valor).toFixed(1)}%`}</div>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>Indicadores Financeiros</div>
          {[
            { label: 'ROE (Retorno sobre PL)', valor: '23.5%', ok: true },
            { label: 'ROA (Retorno sobre Ativo)', valor: '12.8%', ok: true },
            { label: 'ROIC', valor: '18.2%', ok: true },
            { label: 'Indice de Eficiencia', valor: '67.3%', ok: false },
            { label: 'Alavancagem Financeira', valor: '1.84x', ok: true },
            { label: 'Cobertura de Juros', valor: '9.1x', ok: true },
            { label: 'Crescimento da Receita (YoY)', valor: '+12.4%', ok: true },
            { label: 'Crescimento do Lucro (YoY)', valor: '+8.7%', ok: true },
          ].map((m, i) => (
            <div key={i} style={S.metricRow}>
              <span style={S.metricLabel}>{m.label}</span>
              <div style={{display:'flex', gap: 8, alignItems:'center'}}>
                <span style={{...S.metricValue, color: m.ok ? '#00e676' : '#f59e0b'}}>{m.valor}</span>
                <span style={S.badge(m.ok)}>{m.ok ? 'OK' : 'Atencao'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Composicao de Custos e Despesas</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16}}>
          {[
            { label: 'CPV / CMV', valor: 'R$ 306 mil', pct: '36.0%', cor: '#ef4444' },
            { label: 'Deducoes', valor: 'R$ 85 mil', pct: '10.0%', cor: '#f59e0b' },
            { label: 'Desp. Operacionais', valor: 'R$ 183 mil', pct: '21.5%', cor: '#8b5cf6' },
            { label: 'Desp. Financeiras', valor: 'R$ 27 mil', pct: '3.2%', cor: '#3b82f6' },
          ].map((item, i) => (
            <div key={i} style={{textAlign:'center'}}>
              <div style={{width:80,height:80,borderRadius:'50%',background:`conic-gradient(${item.cor} 0% ${item.pct}, #1e1e2e ${item.pct} 100%)`,margin:'0 auto 12px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{width:50,height:50,borderRadius:'50%',background:'#12121a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff'}}>{item.pct}</div>
              </div>
              <div style={{fontSize:13,color:'#e5e7eb',fontWeight:600}}>{item.label}</div>
              <div style={{fontSize:12,color:item.cor}}>{item.valor}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
