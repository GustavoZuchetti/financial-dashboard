'use client'
import { useState, useEffect, Fragment } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { supabase, fetchAll, getSelectedEntidadeIds } from '@/lib/supabase'
import { calcDRE } from '@/lib/dre-calc'
import SvgIcon from '@/components/SvgIcon'

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
      <div style={{ color: isNeg ? 'var(--fs-danger)' : 'var(--fs-brand)', fontWeight:600, fontSize:13 }}>
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
        <SvgIcon name="arrowRight" size={11} color="var(--fs-text-4)" />
        <input type="date" style={S.input} value={endDate}   onChange={e=>onDateChange('end',   e.target.value)} />
      </div>
    </div>

    {/* KPIs */}
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
      <KPICard title="Receita Bruta" value={fmt(kpis.receita)}   color="var(--fs-success)" />
      <KPICard title="Custos"        value={fmt(kpis.custos)}    color="var(--fs-danger)" />
      <KPICard title="EBITDA"        value={fmt(kpis.ebitda)}    color={kpis.ebitda >= 0 ? 'var(--fs-brand)' : 'var(--fs-danger)'} />
      <KPICard title="Despesas"      value={fmt(kpis.despesas)}  color="var(--fs-warning)" />
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
                    entry.type === 'total'    ? 'var(--fs-brand)' :
                    entry.type === 'negative' ? 'var(--fs-danger)' :
                    'var(--fs-success)'
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
          { color:'var(--fs-brand)', label:'Acumulado' },
          { color:'var(--fs-danger)', label:'Dedução' },
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
      <div style={{ fontSize:22, fontWeight:800, color: kpis.resultado >= 0 ? 'var(--fs-success)' : 'var(--fs-danger)' }}>
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

  // Debounce das datas — evita query (e sumiço da tela) a cada clique no calendário
  const [deb, setDeb] = useState({ p1s:`${yr}-01-01`, p1e: now.toISOString().split('T')[0], p2s:`${yr-1}-01-01`, p2e:`${yr-1}-12-31` })
  useEffect(() => {
    const t = setTimeout(() => setDeb({ p1s:p1Start, p1e:p1End, p2s:p2Start, p2e:p2End }), 500)
    return () => clearTimeout(t)
  }, [p1Start, p1End, p2Start, p2End])

  const [data1,      setData1]      = useState([])
  const [data2,      setData2]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [firstLoad,  setFirstLoad]  = useState(true)
  const [empresaId,  setEmpresaId]  = useState(null)

  useEffect(() => {
    setEmpresaId(localStorage.getItem('empresa_id'))
    // Reagir à troca de entidade no Sidebar (mesmo padrão das demais páginas)
    const h = () => setEmpresaId(localStorage.getItem('empresa_id'))
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  useEffect(() => {
    if (!empresaId) return
    const fetch = async () => {
      setLoading(true)
      try {
        // Multi-entidade: resolve 'todas' / multi-seleção / id único para lista
        // de IDs validados da organização — .eq('empresa_id','todas') retornava vazio
        const ids = await getSelectedEntidadeIds()
        const q = (s, e) => {
          let qb = supabase.from('lancamentos').select('tipo,valor').gte('data', s).lte('data', e)
          if (ids.length) qb = qb.in('empresa_id', ids)
          return qb
        }
        // fetchAll: paginação completa (Supabase corta em 1000 linhas/request)
        const [d1, d2] = await Promise.all([fetchAll(q(deb.p1s, deb.p1e)), fetchAll(q(deb.p2s, deb.p2e))])
        setData1(d1 || [])
        setData2(d2 || [])
      } finally { setLoading(false); setFirstLoad(false) }
    }
    fetch()
  }, [empresaId, deb])

  // KPIs pelo cálculo central do sistema (lib/dre-calc) — inclui impostos,
  // resultado financeiro e investimentos, consistente com o DRE oficial
  const calcKPIs = (data) => {
    const v = calcDRE(data)
    return { receita: v.rb, deducoes: v.ded, recLiq: v.rl, custos: v.cv,
             despesas: v.df, ebitda: v.ebt, resultado: v.resF }
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
        <h1 style={{ fontSize:28, fontWeight:800, margin:0 }}>DRE Comparativo</h1>
        <div style={{ fontSize:12, color:'var(--fs-text-4)', marginTop:4 }}>
          Compare dois períodos lado a lado com estrutura de resultado e variação
        </div>
      </div>

      {firstLoad ? (
        <div style={{ textAlign:'center', padding:80, color:'var(--fs-text-4)', fontSize:14 }}>Carregando dados...</div>
      ) : (
        <div style={{ opacity: loading ? 0.55 : 1, transition:'opacity 0.2s', pointerEvents: loading ? 'none' : 'auto' }}>
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
                  <Fragment key={row.label}>
                    <div key={`l-${i}`} style={{ fontSize:13, fontWeight:600, color:'var(--fs-text-2)', padding:'12px', borderBottom:'1px solid var(--fs-border)' }}>{row.label}</div>
                    <div key={`v1-${i}`} style={{ fontSize:13, fontWeight:700, color:'var(--fs-text-1)', padding:'12px', borderBottom:'1px solid var(--fs-border)', fontVariantNumeric:'tabular-nums' }}>{fmtFull(row.v1)}</div>
                    <div key={`v2-${i}`} style={{ fontSize:13, color:'var(--fs-text-3)', padding:'12px', borderBottom:'1px solid var(--fs-border)', fontVariantNumeric:'tabular-nums' }}>{fmtFull(row.v2)}</div>
                    <div key={`p-${i}`}  style={{ padding:'12px', borderBottom:'1px solid var(--fs-border)', display:'flex', alignItems:'center' }}>
                      {pct !== null ? (
                        <span style={{ fontSize:12, fontWeight:700, color: pos ? 'var(--fs-success)' : 'var(--fs-danger)', display:'inline-flex', alignItems:'center', gap:4 }}>
                          <SvgIcon name={Number(pct) >= 0 ? 'trendingUp' : 'trendingDown'} size={13} color="currentColor" />
                          {Math.abs(Number(pct))}%
                        </span>
                      ) : (
                        <span style={{ fontSize:11, color:'var(--fs-text-4)' }}>—</span>
                      )}
                    </div>
                  </Fragment>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
