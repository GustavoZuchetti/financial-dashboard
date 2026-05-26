'use client'
import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { supabase } from '@/lib/supabase'

// ─── Formatadores ─────────────────────────────────────────────────────────────
const fmt     = (v) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', notation:'compact', maximumFractionDigits:1 }).format(Number(v)||0)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(v)||0)

// ─── Tooltip customizado (resolve NaN + dark mode) ────────────────────────────
// Recharts passa array [min,max] quando dataKey="range" — o formatter nativo
// tenta formatar o array inteiro → NaN. Usamos tooltip custom que lê entry.payload.value
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const entry  = payload[0]?.payload
  const val    = entry?.value ?? 0
  const isNeg  = entry?.type === 'negative'

  // Detectar tema pelo atributo data-theme do documento
  const isDark = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-theme') !== 'light'
    : true

  const bg     = isDark ? '#1e2433' : '#ffffff'
  const border = isDark ? '#2d3748' : '#e2e8f0'
  const text1  = isDark ? '#f1f5f9' : '#0f172a'
  const text2  = isDark ? '#94a3b8' : '#64748b'

  return (
    <div style={{
      background:bg, border:`1px solid ${border}`, borderRadius:8,
      padding:'10px 14px', fontSize:12, minWidth:150,
      boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontWeight:700, color:text1, marginBottom:4 }}>{label}</div>
      <div style={{ color: isNeg ? '#ef4444' : '#3b82f6', fontWeight:600, fontSize:13 }}>
        {isNeg && val !== 0 ? '-' : ''}{fmtFull(Math.abs(val))}
      </div>
      {entry?.type === 'total' && (
        <div style={{ color:text2, fontSize:11, marginTop:2 }}>Acumulado</div>
      )}
    </div>
  )
}

// ─── Estilos base ─────────────────────────────────────────────────────────────
const S = {
  card:       { backgroundColor:'var(--fs-surface)', borderRadius:12, padding:20, border:'1px solid var(--fs-border)' },
  kpiTitle:   { fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:5 },
  kpiValue:   { fontSize:20, fontWeight:800 },
  sectionTitle:{ fontSize:15, fontWeight:800, marginBottom:20, color:'var(--fs-text-1)' },
  input:      { background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:7, color:'var(--fs-text-1)', padding:'6px 10px', fontSize:12, outline:'none', colorScheme:'dark' },
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KPICard = ({ title, value, color }) => (
  <div style={{ ...S.card, padding:'14px 16px' }}>
    <div style={S.kpiTitle}>{title}</div>
    <div style={{ ...S.kpiValue, color: color || 'var(--fs-text-1)' }}>{value}</div>
  </div>
)

// ─── Coluna DRE ───────────────────────────────────────────────────────────────
const DREColumn = ({ label, startDate, endDate, waterfallData, kpis, onDateChange }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

    {/* Seletor de período */}
    <div style={{ ...S.card, padding:'12px 16px' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:8 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <input type="date" style={S.input} value={startDate} onChange={e=>onDateChange('start', e.target.value)} />
        <span style={{ color:'var(--fs-text-4)', fontSize:12 }}>→</span>
        <input type="date" style={S.input} value={endDate}   onChange={e=>onDateChange('end',   e.target.value)} />
      </div>
    </div>

    {/* KPIs */}
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
      <KPICard title="Receita Bruta" value={fmt(kpis.receita)}   color="#22c55e" />
      <KPICard title="Custos"        value={fmt(kpis.custos)}    color="#ef4444" />
      <KPICard title="EBITDA"        value={fmt(kpis.ebitda)}    color={kpis.ebitda >= 0 ? '#3b82f6' : '#ef4444'} />
      <KPICard title="Despesas"      value={fmt(kpis.despesas)}  color="#f59e0b" />
    </div>

    {/* Gráfico Waterfall */}
    <div style={S.card}>
      <h3 style={S.sectionTitle}>Estrutura de Resultado</h3>
      <div style={{ height:300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={waterfallData} margin={{ top:8, right:8, left:0, bottom:40 }}
            barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
            <XAxis
              dataKey="name"
              axisLine={false} tickLine={false}
              tick={{ fill:'var(--fs-text-4)', fontSize:11 }}
              angle={-20} textAnchor="end" interval={0}
            />
            <YAxis
              axisLine={false} tickLine={false}
              tick={{ fill:'var(--fs-text-4)', fontSize:10 }}
              tickFormatter={fmt} width={72}
            />
            {/* Tooltip custom — sem NaN, adaptado ao tema */}
            <Tooltip content={<CustomTooltip />} cursor={false} />

            {/* Barra transparente de base (offset) — cria o efeito waterfall */}
            <Bar dataKey="base" stackId="wf" fill="transparent" />

            {/* Barra visível — usa "display" para altura, cor por tipo */}
            <Bar dataKey="display" stackId="wf" radius={[4,4,0,0]}>
              {waterfallData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.type === 'total'    ? '#3b82f6' :
                    entry.type === 'negative' ? '#ef4444' :
                    '#22c55e'
                  }
                  fillOpacity={entry.type === 'total' ? 0.85 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda manual */}
      <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:8, flexWrap:'wrap' }}>
        {[
          { color:'#3b82f6', label:'Acumulado' },
          { color:'#ef4444', label:'Dedução' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--fs-text-4)' }}>
            <div style={{ width:10, height:10, borderRadius:2, background:color }} />
            {label}
          </div>
        ))}
      </div>
    </div>

    {/* Variação Receita → Resultado */}
    <div style={{ ...S.card, padding:'14px 16px' }}>
      <div style={S.kpiTitle}>Resultado Líquido</div>
      <div style={{ fontSize:22, fontWeight:900, color: kpis.resultado >= 0 ? '#22c55e' : '#ef4444' }}>
        {fmt(kpis.resultado)}
      </div>
      {kpis.receita > 0 && (
        <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:3 }}>
          Margem: {((kpis.resultado / kpis.receita) * 100).toFixed(1)}%
        </div>
      )}
    </div>
  </div>
)

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DREComparativo() {
  const now  = new Date()
  const yr   = now.getFullYear()

  const [p1Start, setP1Start] = useState(`${yr}-01-01`)
  const [p1End,   setP1End]   = useState(now.toISOString().split('T')[0])
  const [p2Start, setP2Start] = useState(`${yr-1}-01-01`)
  const [p2End,   setP2End]   = useState(`${yr-1}-12-31`)

  const [data1,      setData1]      = useState([])
  const [data2,      setData2]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [empresaId,  setEmpresaId]  = useState(null)

  useEffect(() => {
    const id = localStorage.getItem('empresa_id')
    if (id) setEmpresaId(id)
  }, [])

  useEffect(() => {
    if (!empresaId) return
    const fetch = async () => {
      setLoading(true)
      const q = (s, e) => supabase.from('lancamentos').select('tipo,valor')
        .eq('empresa_id', empresaId).gte('data', s).lte('data', e)
      const [{ data: d1 }, { data: d2 }] = await Promise.all([q(p1Start, p1End), q(p2Start, p2End)])
      setData1(d1 || [])
      setData2(d2 || [])
      setLoading(false)
    }
    fetch()
  }, [empresaId, p1Start, p1End, p2Start, p2End])

  const calcKPIs = (data) => {
    const sum  = (tipo) => data.filter(d=>d.tipo===tipo).reduce((a,c)=>a+Number(c.valor||0),0)
    const receita  = sum('receita')
    const custos   = sum('custo')
    const despesas = sum('despesa')
    const deducoes = sum('deducao')
    const recLiq   = receita - deducoes
    const ebitda   = recLiq  - custos
    const resultado= ebitda  - despesas
    return { receita, custos, despesas, deducoes, recLiq, ebitda, resultado }
  }

  // ── Waterfall com base + display (evita NaN do range array) ──────────────
  // Recharts StackedBar: "base" é transparente (offset), "display" é a barra visível
  const buildWaterfall = (k) => {
    const rows = [
      { name:'Receita',   base: 0,                                                        display: k.receita,   value: k.receita,   type:'total'    },
      { name:'Deduções',  base: Math.max(0, k.recLiq),                                   display: k.deducoes,  value:-k.deducoes,  type:'negative' },
      { name:'Rec. Líq.', base: 0,                                                        display: k.recLiq,    value: k.recLiq,    type:'total'    },
      { name:'Custos',    base: Math.max(0, k.ebitda),                                    display: k.custos,    value:-k.custos,    type:'negative' },
      { name:'EBITDA',    base: 0,                                                        display: Math.max(0, k.ebitda), value: k.ebitda, type:'total' },
      { name:'Despesas',  base: Math.max(0, k.resultado),                                 display: k.despesas,  value:-k.despesas,  type:'negative' },
      { name:'Resultado', base: 0,                                                        display: Math.max(0, k.resultado), value: k.resultado, type:'total' },
    ]
    return rows
  }

  const kpis1 = calcKPIs(data1)
  const kpis2 = calcKPIs(data2)
  const wf1   = buildWaterfall(kpis1)
  const wf2   = buildWaterfall(kpis2)

  // ── Variação entre períodos ───────────────────────────────────────────────
  const varPct = (a, b) => b > 0.01 ? ((a - b) / b * 100).toFixed(1) : null

  const variacoes = [
    { label:'Receita Bruta', v1:kpis1.receita,   v2:kpis2.receita   },
    { label:'Custos',        v1:kpis1.custos,    v2:kpis2.custos,    inv:true },
    { label:'EBITDA',        v1:kpis1.ebitda,    v2:kpis2.ebitda    },
    { label:'Despesas',      v1:kpis1.despesas,  v2:kpis2.despesas,  inv:true },
    { label:'Resultado',     v1:kpis1.resultado, v2:kpis2.resultado  },
  ]

  return (
    <div style={{ color:'var(--fs-text-1)', width:'100%' }}>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 }}>
          Demonstrativos · Análise Comparativa
        </div>
        <h1 style={{ fontSize:28, fontWeight:900, margin:0 }}>DRE Comparativo</h1>
        <div style={{ fontSize:12, color:'var(--fs-text-4)', marginTop:4 }}>
          Compare dois períodos lado a lado com estrutura de resultado e variação
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:80, color:'var(--fs-text-4)', fontSize:14 }}>Carregando dados...</div>
      ) : (
        <>
          {/* Colunas comparativas */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:24 }}>
            <DREColumn
              label="Período 1"
              startDate={p1Start} endDate={p1End}
              waterfallData={wf1} kpis={kpis1}
              onDateChange={(t,v) => t==='start' ? setP1Start(v) : setP1End(v)}
            />
            <DREColumn
              label="Período 2"
              startDate={p2Start} endDate={p2End}
              waterfallData={wf2} kpis={kpis2}
              onDateChange={(t,v) => t==='start' ? setP2Start(v) : setP2End(v)}
            />
          </div>

          {/* Tabela de variação */}
          <div style={{ ...S.card }}>
            <h3 style={S.sectionTitle}>Variação entre Períodos</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 100px', gap:0 }}>
              {/* Cabeçalho */}
              {['Indicador','Período 1','Período 2','Δ %'].map(h => (
                <div key={h} style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', padding:'8px 12px', borderBottom:'1px solid var(--fs-border)', background:'var(--fs-bg)' }}>
                  {h}
                </div>
              ))}
              {/* Linhas */}
              {variacoes.map((row, i) => {
                const pct = varPct(row.v1, row.v2)
                const pos = pct === null ? null : row.inv ? Number(pct) <= 0 : Number(pct) >= 0
                return (
                  <>
                    <div key={`l-${i}`} style={{ fontSize:13, fontWeight:600, color:'var(--fs-text-2)', padding:'12px', borderBottom:'1px solid var(--fs-border)' }}>{row.label}</div>
                    <div key={`v1-${i}`} style={{ fontSize:13, fontWeight:700, color:'var(--fs-text-1)', padding:'12px', borderBottom:'1px solid var(--fs-border)', fontVariantNumeric:'tabular-nums' }}>{fmtFull(row.v1)}</div>
                    <div key={`v2-${i}`} style={{ fontSize:13, color:'var(--fs-text-3)', padding:'12px', borderBottom:'1px solid var(--fs-border)', fontVariantNumeric:'tabular-nums' }}>{fmtFull(row.v2)}</div>
                    <div key={`p-${i}`}  style={{ padding:'12px', borderBottom:'1px solid var(--fs-border)', display:'flex', alignItems:'center' }}>
                      {pct !== null ? (
                        <span style={{ fontSize:12, fontWeight:700, color: pos ? '#22c55e' : '#ef4444' }}>
                          {pos ? '▲' : '▼'} {Math.abs(Number(pct))}%
                        </span>
                      ) : (
                        <span style={{ fontSize:11, color:'var(--fs-text-4)' }}>—</span>
                      )}
                    </div>
                  </>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
