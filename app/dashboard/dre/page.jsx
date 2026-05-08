'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '@/lib/supabase'
import { CHART_PALETTE } from '@/lib/design-tokens'

const fmt     = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtPct  = (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '%'

const calcDelta = (cur, prev) => (!prev || prev === 0) ? null : ((cur - prev) / Math.abs(prev)) * 100

const formatPeriod = (start, end) => {
  const opts = { day: '2-digit', month: 'short', year: 'numeric' }
  return `${new Date(start+'T00:00:00').toLocaleDateString('pt-BR', opts)} → ${new Date(end+'T00:00:00').toLocaleDateString('pt-BR', opts)}`
}

const getPrevPeriod = (s, e) => {
  const start = new Date(s+'T00:00:00'), end = new Date(e+'T00:00:00')
  const diff = end - start
  const pEnd = new Date(start); pEnd.setDate(pEnd.getDate() - 1)
  const pStart = new Date(pEnd - diff)
  return { start: pStart.toISOString().split('T')[0], end: pEnd.toISOString().split('T')[0] }
}

// ─── Item 5 + 8: KPI Card com animação, acento e paleta padronizada ─────────────
const KPICard = ({ title, rawValue, accent = CHART_PALETTE.receita, loading, prevRawValue, isExpense = false, large = false }) => {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { if (!loading) { setAnimated(false); const t = setTimeout(() => setAnimated(true), 50); return () => clearTimeout(t) } }, [loading, rawValue])

  const delta = prevRawValue != null ? calcDelta(Math.abs(rawValue), Math.abs(prevRawValue)) : null
  const favorable = delta !== null ? (isExpense ? delta <= 0 : delta >= 0) : null
  const fColor = '#10b981', dColor = '#ef4444'

  return (
    <div style={{
      background: 'var(--fs-surface)',
      border: '1px solid var(--fs-border)',
      borderTop: `3px solid ${accent}`,
      borderRadius: 12,
      padding: large ? '24px 20px' : '16px 18px',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>{title}</div>
      {loading ? (
        <div style={{ height: large ? 36 : 28, width: '75%', borderRadius: 6, background: 'linear-gradient(90deg,var(--fs-surface) 25%,var(--fs-surface-2) 50%,var(--fs-surface) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      ) : (
        <>
          <div style={{
            fontSize: large ? 30 : 22, fontWeight: 800, color: accent,
            animation: animated ? 'countUp 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
            marginBottom: 6,
          }}>
            {fmtFull(rawValue)}
          </div>
          {delta !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: favorable ? fColor : dColor }}>{delta >= 0 ? '▲' : '▼'}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: favorable ? fColor : dColor }}>{fmtPct(delta)}</span>
              <span style={{ fontSize: 10, color: 'var(--fs-text-4)' }}>vs anterior</span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: favorable ? fColor : dColor,
                background: favorable ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${favorable ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                padding: '1px 6px', borderRadius: 4,
              }}>{favorable ? '✓ F' : '✗ D'}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tooltip waterfall ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, data }) => {
  if (!active || !payload?.[0]) return null
  const entry = payload[0].payload
  const getTop = (tipo) => {
    const items = [...(data||[]).filter(d => d.tipo === tipo)].sort((a,b)=>Number(b.valor)-Number(a.valor))
    const total = items.reduce((a,c)=>a+Number(c.valor),0)
    let acc=0; return items.filter(i=>{acc+=Number(i.valor);return acc<=total*0.8}).slice(0,3)
  }
  let details = []
  if (entry.name==='Receita Bruta') details=getTop('receita')
  else if (entry.name==='Custos')   details=getTop('custo')
  else if (entry.name==='Despesas') details=getTop('despesa')
  return (
    <div style={{ background:'var(--fs-input-bg)', border:'1px solid var(--fs-border)', borderRadius:8, padding:10, fontSize:12, boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
      <p style={{ margin:'0 0 6px', fontWeight:700, color:CHART_PALETTE.receita }}>{entry.name}</p>
      <p style={{ margin:'3px 0', color:'var(--fs-text-4)' }}>Total: <span style={{ color:'var(--fs-text-1)', fontWeight:700 }}>{fmtFull(Math.abs(entry.value))}</span></p>
      {details.length > 0 && <>
        <p style={{ margin:'8px 0 3px', color:'var(--fs-text-4)', fontSize:11, borderTop:'1px solid #334155', paddingTop:5 }}>Top 80% (Pareto):</p>
        {details.map((d,i)=>(
          <p key={i} style={{ margin:'1px 0 1px 8px', color:'#94a3b8', fontSize:11 }}>• {(d.descricao||d.categoria||'Item').substring(0,24)}: {fmtFull(Number(d.valor))}</p>
        ))}
      </>}
    </div>
  )
}

// ─── Modo Apresentação ──────────────────────────────────────────────────────────
const PresentationOverlay = ({ kpis, prevKpis, waterfallData, startDate, endDate, isConsolidado, loading, onExit, data }) => {
  useEffect(() => {
    const h = (e) => { if (e.key==='Escape') onExit() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onExit])

  const mB = kpis.receita > 0 ? ((kpis.receita-kpis.custo)/kpis.receita*100) : 0
  const mE = kpis.receita > 0 ? (kpis.ebitda/kpis.receita*100) : 0
  const mL = kpis.receita > 0 ? ((kpis.receita-kpis.custo-kpis.despesa)/kpis.receita*100) : 0

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'#0a1628', display:'flex', flexDirection:'column', padding:'36px 48px', overflowY:'auto' }}>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}} @keyframes countUp{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}`}</style>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:32 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
            <div style={{ width:42, height:42, background:'linear-gradient(135deg,#1d4ed8,#3b82f6)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:18, boxShadow:'0 6px 20px rgba(59,130,246,0.4)' }}>FS</div>
            <span style={{ fontSize:20, fontWeight:900, color:'#fff', letterSpacing:'-0.5px' }}>Facesign</span>
            {isConsolidado && <span style={{ background:'rgba(59,130,246,0.12)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.25)', padding:'3px 12px', borderRadius:20, fontSize:11, fontWeight:700 }}>Consolidado</span>}
          </div>
          <div style={{ color:'var(--fs-text-4)', fontSize:13 }}>Demonstrativos Executivos — {formatPeriod(startDate, endDate)}</div>
        </div>
        <button onClick={onExit} style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>✕ Sair (ESC)</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20, marginBottom:24 }}>
        <KPICard title="Receita Bruta"   rawValue={kpis.receita}  accent={CHART_PALETTE.receita}  loading={loading} prevRawValue={prevKpis?.receita}  isExpense={false} large />
        <KPICard title="Custos Totais"   rawValue={kpis.custo}    accent={CHART_PALETTE.custo}    loading={loading} prevRawValue={prevKpis?.custo}    isExpense={true}  large />
        <KPICard title="Despesas Totais" rawValue={kpis.despesa}  accent={CHART_PALETTE.despesa}  loading={loading} prevRawValue={prevKpis?.despesa}  isExpense={true}  large />
        <KPICard title="EBITDA"          rawValue={kpis.ebitda}   accent={kpis.ebitda>=0?CHART_PALETTE.ebitda:CHART_PALETTE.custo} loading={loading} prevRawValue={prevKpis?.ebitda} isExpense={false} large />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:28 }}>
        {[{l:'Margem Bruta',v:mB,c:'#8b5cf6'},{l:'Margem EBITDA',v:mE,c:CHART_PALETTE.despesa},{l:'Margem Líquida',v:mL,c:CHART_PALETTE.ebitda}].map(m=>(
          <div key={m.l} style={{ background:'#131f35', border:'1px solid var(--fs-border)', borderRadius:10, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'var(--fs-text-4)', fontSize:13 }}>{m.l}</span>
            <span style={{ color:m.v>=0?m.c:CHART_PALETTE.custo, fontSize:26, fontWeight:900 }}>{m.v.toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <div style={{ background:'#131f35', border:'1px solid var(--fs-border)', borderRadius:12, padding:'22px 28px', flex:1, minHeight:300 }}>
        <h2 style={{ fontSize:15, fontWeight:700, color:'#e2e8f0', marginBottom:20 }}>Fluxo do Resultado (Waterfall)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={waterfallData} margin={{top:10,right:30,left:0,bottom:40}}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#475569',fontSize:11}} interval={0} angle={-20} textAnchor="end" />
            <YAxis axisLine={false} tickLine={false} tick={{fill:'#475569',fontSize:11}} tickFormatter={fmt} />
            <Tooltip content={<CustomTooltip data={data} />} cursor={{fill:'transparent'}} />
            <Bar dataKey="range" radius={[3,3,0,0]}>
              {waterfallData.map((e,i)=><Cell key={i} fill={e.type==='total'?CHART_PALETTE.receita:CHART_PALETTE.custo} fillOpacity={e.type==='total'?0.85:1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ textAlign:'center', marginTop:14, color:'var(--fs-text-4)', fontSize:11 }}>Facesign — Uso Interno Confidencial — {new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  )
}

// ─── Página principal ───────────────────────────────────────────────────────────
export default function DREGeral() {
  const [startDate, setStartDate] = useState(() => { const d=new Date(); return new Date(d.getFullYear(),0,1).toISOString().split('T')[0] })
  const [endDate,   setEndDate]   = useState(new Date().toISOString().split('T')[0])
  const [data,      setData]      = useState([])
  const [prevData,  setPrevData]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [empresaId, setEmpresaId] = useState(null)
  const [isConsolidado, setIsConsolidado] = useState(false)
  const [presentation, setPresentation]  = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('empresa_id')
    if (id) { setEmpresaId(id); setIsConsolidado(id==='todas') }
    const h = () => { const nid=localStorage.getItem('empresa_id'); setEmpresaId(nid); setIsConsolidado(nid==='todas') }
    window.addEventListener('storage', h); return () => window.removeEventListener('storage', h)
  }, [])

  const fetchPeriod = useCallback(async (s, e, consol, empId) => {
    let q = supabase.from('lancamentos').select('*, empresas(nome)').gte('data',s).lte('data',e)
    if (consol) {
      const { data: ue } = await supabase.from('empresas').select('id').eq('user_id',(await supabase.auth.getSession()).data.session.user.id)
      if (ue?.length) q = q.in('empresa_id', ue.map(x=>x.id))
    } else { q = q.eq('empresa_id', empId) }
    const { data: r, error: err } = await q
    if (err) throw err
    return r || []
  }, [])

  useEffect(() => {
    if (!empresaId) return
    const run = async () => {
      setLoading(true); setError(null)
      try {
        const [cur, prev] = await Promise.all([
          fetchPeriod(startDate, endDate, isConsolidado, empresaId),
          fetchPeriod(...Object.values(getPrevPeriod(startDate, endDate)), isConsolidado, empresaId),
        ])
        setData(cur); setPrevData(prev)
      } catch (e) { setError('Erro ao carregar dados. Verifique a conexão.') }
      finally { setLoading(false) }
    }
    run()
  }, [empresaId, startDate, endDate, isConsolidado, fetchPeriod])

  const sum = (arr, tipo) => arr.filter(d=>d.tipo===tipo).reduce((a,c)=>a+Number(c.valor),0)
  const R=sum(data,'receita'), C=sum(data,'custo'), D=sum(data,'despesa'), E=R-C-D
  const pR=sum(prevData,'receita'), pC=sum(prevData,'custo'), pD=sum(prevData,'despesa'), pE=pR-pC-pD

  const kpis     = { receita:R, custo:C, despesa:D, ebitda:E }
  const prevKpis = { receita:pR, custo:pC, despesa:pD, ebitda:pE }

  const wfData = [
    { name:'Receita Bruta', range:[0,R],       value:R,  type:'total'    },
    { name:'Custos',        range:[R-C,R],      value:-C, type:'negative' },
    { name:'Lucro Bruto',   range:[0,R-C],      value:R-C,type:'total'    },
    { name:'Despesas',      range:[Math.max(0,E),R-C], value:-D,type:'negative' },
    { name:'EBITDA',        range:[0,Math.max(0,E)],   value:E, type:'total'    },
  ]

  const mB = R>0?((R-C)/R*100):0, mE = R>0?(E/R*100):0, mL = R>0?((R-C-D)/R*100):0

  const badge = { display:'inline-block', background:'rgba(59,130,246,0.1)', color:'#93c5fd', padding:'3px 12px', borderRadius:20, fontSize:11, fontWeight:700, marginLeft:8, border:'1px solid rgba(59,130,246,0.2)' }

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}} @keyframes countUp{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}`}</style>
      {presentation && <PresentationOverlay kpis={kpis} prevKpis={prevKpis} waterfallData={wfData} startDate={startDate} endDate={endDate} isConsolidado={isConsolidado} loading={loading} onExit={()=>setPresentation(false)} data={data} />}

      <div style={{ color:'#e2e8f0', padding:24 }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--fs-text-1)', display:'flex', alignItems:'center' }}>
            Demonstrativos Executivos
            {isConsolidado && <span style={badge}>📊 Consolidado</span>}
          </h1>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--fs-surface)', padding:'7px 14px', borderRadius:8, border:'1px solid var(--fs-border)' }}>
              <span style={{ fontSize:12, color:'var(--fs-text-4)' }}>Período:</span>
              <input type="date" style={{ background:'var(--fs-input-bg)', border:'1px solid var(--fs-border)', borderRadius:6, color:'var(--fs-text-1)', padding:'5px 8px', fontSize:12, outline:'none' }} value={startDate} onChange={e=>setStartDate(e.target.value)} />
              <span style={{ color:'var(--fs-text-4)' }}>→</span>
              <input type="date" style={{ background:'var(--fs-input-bg)', border:'1px solid var(--fs-border)', borderRadius:6, color:'var(--fs-text-1)', padding:'5px 8px', fontSize:12, outline:'none' }} value={endDate}   onChange={e=>setEndDate(e.target.value)} />
            </div>
            <button onClick={()=>setPresentation(true)} style={{ background:'linear-gradient(135deg,#1e3a5f,#1d4ed8)', border:'1px solid #2563eb', color:'#bfdbfe', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
              🎯 Apresentação
            </button>
          </div>
        </div>

        {error && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'12px 16px', color:'#fca5a5', marginBottom:20 }}>⚠️ {error}</div>}

        {/* KPIs — Item 5 e 8 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:14 }}>
          <KPICard title="Receita Bruta"   rawValue={R} accent={CHART_PALETTE.receita}                          loading={loading} prevRawValue={pR} isExpense={false} />
          <KPICard title="Custos Totais"   rawValue={C} accent={CHART_PALETTE.custo}                            loading={loading} prevRawValue={pC} isExpense={true}  />
          <KPICard title="Despesas Totais" rawValue={D} accent={CHART_PALETTE.despesa}                          loading={loading} prevRawValue={pD} isExpense={true}  />
          <KPICard title="EBITDA"          rawValue={E} accent={E>=0?CHART_PALETTE.ebitda:CHART_PALETTE.custo}  loading={loading} prevRawValue={pE} isExpense={false} />
        </div>

        {/* Margens */}
        {!loading && data.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:22 }}>
            {[{l:'Margem Bruta',v:mB,c:'#8b5cf6'},{l:'Margem EBITDA',v:mE,c:CHART_PALETTE.despesa},{l:'Margem Líquida',v:mL,c:CHART_PALETTE.ebitda}].map(m=>(
              <div key={m.l} style={{ background:'var(--fs-input-bg)', border:'1px solid var(--fs-border)', borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ color:'var(--fs-text-4)', fontSize:12 }}>{m.l}</span>
                <span style={{ color:m.v>=0?m.c:CHART_PALETTE.custo, fontSize:17, fontWeight:800 }}>{m.v.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Waterfall */}
        <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px', marginBottom:20, minHeight:400, display:'flex', flexDirection:'column' }}>
          <h2 style={{ fontSize:15, fontWeight:700, color:'#f1f5f9', marginBottom:20 }}>Fluxo do Resultado (Waterfall)</h2>
          {loading ? (
            <div style={{ flex:1, height:300, background:'linear-gradient(90deg,var(--fs-surface) 25%,var(--fs-surface-2) 50%,var(--fs-surface) 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s infinite', borderRadius:8 }} />
          ) : data.length===0 ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fs-text-4)', flexDirection:'column', gap:8 }}>
              <span style={{ fontSize:32 }}>📊</span>
              <span>Nenhum lançamento no período selecionado</span>
            </div>
          ) : (
            <div style={{ height:360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wfData} margin={{top:10,right:30,left:0,bottom:40}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#475569',fontSize:11}} interval={0} angle={-25} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{fill:'#475569',fontSize:11}} tickFormatter={fmt} />
                  <Tooltip content={<CustomTooltip data={data} />} cursor={{fill:'transparent'}} />
                  <Bar dataKey="range" radius={[3,3,0,0]}>
                    {wfData.map((e,i)=><Cell key={i} fill={e.type==='total'?CHART_PALETTE.receita:CHART_PALETTE.custo} fillOpacity={e.type==='total'?0.85:1} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {!loading && prevData.length > 0 && (
          <div style={{ textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>
            ℹ️ Variações vs período anterior: {formatPeriod(...Object.values(getPrevPeriod(startDate,endDate)))}
          </div>
        )}
      </div>
    </>
  )
}
