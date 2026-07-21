'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, fetchAll, getSelectedEntidadeIds } from '@/lib/supabase'
import SvgIcon from '@/components/SvgIcon'
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  green:    'var(--fs-success)',
  blue:     'var(--fs-brand)',
  red:      'var(--fs-danger)',
  gray:     '#64748b',
  purple:   'var(--fs-purple)',
  yellow:   'var(--fs-warning)',
  teal:     'var(--fs-teal)',
  orange:   '#f97316',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt     = v => { const a=Math.abs(v); return a>=1e6?`R$${(a/1e6).toFixed(1)}mi`:a>=1e3?`R$${(a/1e3).toFixed(0)}mil`:`R$${a.toFixed(0)}` }
const fmtFull = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const formatPeriod = (s,e) => {
  const fmt_ = d => new Date(d+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})
  return `${fmt_(s)} → ${fmt_(e)}`
}
const getPrevPeriod = (s,e) => {
  const ms=new Date(s+'T00:00:00'), me=new Date(e+'T00:00:00')
  const diff=me-ms; const ps=new Date(ms-diff-86400000); const pe=new Date(ms-86400000)
  const iso=d=>d.toISOString().split('T')[0]
  return { s:iso(ps), e:iso(pe) }
}

// ─── Estrutura do DRE ─────────────────────────────────────────────────────────
// Mapeia tipo → linha do DRE
const DRE_STRUCTURE = [
  { key:'receita_bruta',      label:'Receita Bruta',       tipos:['receita'],             sign:+1, subtotal:false, color: C.green  },
  { key:'deducoes',           label:'Deduções',            tipos:['deducao'],             sign:-1, subtotal:false, color: C.red    },
  { key:'receita_liquida',    label:'Receita Líquida',     tipos:[],                      sign: 0, subtotal:true,  color: C.blue   },
  { key:'custos_variaveis',   label:'Custos Variáveis',    tipos:['custo'],               sign:-1, subtotal:false, color: C.red    },
  { key:'lucro_bruto',        label:'Lucro Bruto',         tipos:[],                      sign: 0, subtotal:true,  color: C.blue   },
  { key:'despesas_fixas',     label:'Despesas Fixas',      tipos:['despesa'],             sign:-1, subtotal:false, color: C.red    },
  { key:'ebitda',             label:'EBITDA',              tipos:[],                      sign: 0, subtotal:true,  color: C.teal   },
  { key:'receitas_financeiras',label:'Rec. Financeiras',   tipos:['receita_financeira'],  sign:+1, subtotal:false, color: C.green  },
  { key:'despesas_financeiras',label:'Desp. Financeiras',  tipos:['despesa_financeira'],  sign:-1, subtotal:false, color: C.red    },
  { key:'resultado_liquido',  label:'Resultado Líquido',   tipos:[],                      sign: 0, subtotal:true,  color: C.purple },
  { key:'investimentos',      label:'Investimentos',       tipos:['investimento'],        sign:-1, subtotal:false, color: C.yellow },
  { key:'resultado_final',    label:'Resultado Final',     tipos:[],                      sign: 0, subtotal:true,  color: C.blue   },
]

// ─── Calcular valores do DRE ──────────────────────────────────────────────────
function calcDRE(lancamentos) {
  const sum = (tipos) => lancamentos.filter(l => tipos.includes(l.tipo)).reduce((a,c)=>a+Number(c.valor),0)

  const rb   = sum(['receita'])
  const ded  = sum(['deducao'])
  const rl   = rb - ded
  const cv   = sum(['custo'])
  const lb   = rl - cv
  const df   = sum(['despesa'])
  const ebt  = lb - df
  const imp  = sum(['imposto_lucro'])
  const rf   = sum(['receita_financeira'])
  const dfin = sum(['despesa_financeira'])
  const resL = ebt - imp + rf - dfin
  const inv  = sum(['investimento'])
  const resF = resL - inv

  return { rb, ded, rl, cv, lb, df, ebt, imp, rf, dfin, resL, inv, resF }
}

// ─── Montar dados do waterfall ────────────────────────────────────────────────
// Técnica: spacer transparente + barra colorida empilhada
// spacer = limite inferior da barra (pode ser negativo)
// barHeight = magnitude visível (sempre positivo)
// Resultado: barra colorida flutua entre [spacer, spacer+barHeight]
function buildWaterfall(v) {
  const { rb, ded, rl, cv, lb, df, ebt, imp, rf, dfin, resL, inv, resF } = v
  let acc = 0
  const bars = []

  // Adiciona barra de abertura (anchored no zero)
  const open = (name, val) => {
    const lo = Math.min(0, val), hi = Math.max(0, val)
    bars.push({ name, value: val, type:'open', color: val>=0?C.green:C.red,
      spacer: lo, barHeight: hi - lo })
    acc = val
  }

  // Adiciona contribuição positiva (sobe)
  const add = (name, val, skip=false) => {
    if (skip && Math.abs(val) < 0.01) return
    const lo = acc, hi = acc + val
    bars.push({ name, value: val, type:'add', color: C.green,
      spacer: Math.min(lo, hi), barHeight: Math.abs(hi - lo) })
    acc += val
  }

  // Adiciona contribuição negativa (desce)
  const sub = (name, val, skip=false) => {
    if (skip && Math.abs(val) < 0.01) return
    const lo = acc - val, hi = acc
    bars.push({ name, value: -val, type:'sub', color: C.red,
      spacer: Math.min(lo, hi), barHeight: Math.abs(hi - lo) })
    acc = lo
  }

  // Adiciona subtotal (anchored no zero, mostra acumulado)
  const total = (name) => {
    const color = name==='Resultado Final' ? (acc>=0?C.blue:C.red)
      : name==='EBITDA' ? C.teal : name==='Resultado Líquido' ? C.purple : C.blue
    const lo = Math.min(0, acc), hi = Math.max(0, acc)
    bars.push({ name, value: acc, type:'subtotal', color,
      spacer: lo, barHeight: hi - lo })
  }

  open('Receita Bruta',      rb)
  sub( 'Deduções',           ded,  true)
  if (ded > 0.01) total('Receita Líquida')
  sub( 'Custos Variáveis',   cv,   true)
  total('Lucro Bruto')
  sub( 'Despesas Fixas',     df,   true)
  total('EBITDA')
  sub( 'Impostos s/ Lucro',  imp,  true)
  add( 'Rec. Financeiras',   rf,   true)
  sub( 'Desp. Financeiras',  dfin, true)
  if (rf > 0.01 || dfin > 0.01 || imp > 0.01) total('Resultado Líquido')
  sub( 'Investimentos',      inv,  true)
  total('Resultado Final')

  return bars
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ title, value, prev, accent, isExpense, loading, large }) {
  const delta = prev != null && prev !== 0 ? ((value - prev) / Math.abs(prev) * 100) : null
  const favorable = isExpense ? (value <= prev) : (value >= prev)
  return (
    <div style={{ background:'var(--fs-surface)', border:`1px solid var(--fs-border)`, borderRadius:12, padding: large?'20px 24px':'14px 18px', borderTop:`3px solid ${accent}`, position:'relative', overflow:'hidden' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>{title}</div>
      {loading ? (
        <div style={{ height:32, background:'linear-gradient(90deg,var(--fs-surface) 25%,var(--fs-surface-2) 50%,var(--fs-surface) 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s infinite', borderRadius:6 }} />
      ) : (
        <>
          <div style={{ fontSize: large?28:22, fontWeight:800, color:accent, letterSpacing:'-0.5px', animation:'countUp 0.4s ease' }}>
            {fmtFull(value)}
          </div>
          {delta !== null && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
              <span style={{ fontSize:10, color:'var(--fs-text-4)' }}>vs anterior</span>
              <span style={{ fontSize:10, fontWeight:700, color:favorable?C.green:C.red, background:favorable?'rgba(var(--fs-success-rgb),0.12)':'rgba(var(--fs-danger-rgb),0.12)', border:`1px solid ${favorable?'rgba(var(--fs-success-rgb),0.3)':'rgba(var(--fs-danger-rgb),0.3)'}`, padding:'1px 6px', borderRadius:4 }}>
                {favorable?'✓ F':'✗ D'} {Math.abs(delta).toFixed(1)}%
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tooltip Waterfall ────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, lancamentos }) => {
  if (!active || !payload?.[0]) return null
  const entry = payload[0].payload

  // Pareto por tipo
  const pareto = (tipos) => {
    const grouped = {}
    ;(lancamentos||[]).filter(d=>tipos.includes(d.tipo)).forEach(d=>{
      const k=(d.descricao||d.categoria||'—').trim()
      grouped[k]=(grouped[k]||0)+Number(d.valor)
    })
    const sorted=Object.entries(grouped).map(([nome,valor])=>({nome,valor})).sort((a,b)=>b.valor-a.valor)
    const total=sorted.reduce((a,c)=>a+c.valor,0)
    let acc=0
    return sorted.filter(i=>{ if(acc>=total*0.8)return false; acc+=i.valor; return true })
  }

  const tiposMap = { 'Receita Bruta':['receita'], 'Rec. Financeiras':['receita_financeira'], 'Deduções':['deducao'], 'Custos Variáveis':['custo'], 'Despesas Fixas':['despesa'], 'Desp. Financeiras':['despesa_financeira'], 'Investimentos':['investimento'], 'Impostos s/ Lucro':['imposto_lucro'] }
  const details = tiposMap[entry.name] ? pareto(tiposMap[entry.name]) : []

  return (
    <div style={{ background:'var(--fs-input-bg)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'12px 14px', fontSize:12, boxShadow:'0 8px 24px rgba(0,0,0,0.4)', maxWidth:280 }}>
      <p style={{ margin:'0 0 6px', fontWeight:700, color:entry.color||'var(--fs-text-1)' }}>{entry.name}</p>
      <p style={{ margin:'3px 0', color:'var(--fs-text-4)' }}>
        {entry.type==='subtotal'?'Resultado:':'Total:'}{' '}
        <strong style={{ color:'var(--fs-text-1)' }}>{fmtFull(Math.abs(entry.value))}</strong>
      </p>
      {details.length > 0 && (
        <>
          <p style={{ margin:'8px 0 3px', color:'var(--fs-text-4)', fontSize:11, borderTop:'1px solid var(--fs-border)', paddingTop:5 }}>Top 80% (Pareto):</p>
          {details.slice(0,5).map((d,i)=>(
            <p key={i} style={{ margin:'2px 0 2px 8px', color:'var(--fs-text-2)', fontSize:11 }}>• {d.nome.substring(0,28)}: <strong>{fmtFull(d.valor)}</strong></p>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function DREGeral() {
  const [startDate, setStartDate]  = useState(() => new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0])
  const [endDate,   setEndDate]    = useState(new Date().toISOString().split('T')[0])
  // Datas com debounce — evita query a cada keystroke
  const [debouncedStart, setDebouncedStart] = useState(startDate)
  const [debouncedEnd,   setDebouncedEnd]   = useState(endDate)
  useEffect(() => { const t = setTimeout(() => setDebouncedStart(startDate), 400); return () => clearTimeout(t) }, [startDate])
  useEffect(() => { const t = setTimeout(() => setDebouncedEnd(endDate), 400);   return () => clearTimeout(t) }, [endDate])
  const [data,      setData]       = useState([])
  const [prevData,  setPrevData]   = useState([])
  const [loading,   setLoading]    = useState(true)
  const [error,     setError]      = useState(null)
  const [empresaId, setEmpresaId]  = useState(null)
  const [isConsol,  setIsConsol]   = useState(false)
  const [showPres,  setShowPres]   = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('empresa_id')
    if (id) { setEmpresaId(id); setIsConsol(id==='todas') }
    const h = () => { const nid=localStorage.getItem('empresa_id'); setEmpresaId(nid); setIsConsol(nid==='todas') }
    window.addEventListener('storage', h); return () => window.removeEventListener('storage', h)
  }, [])

  const fetchPeriod = useCallback(async (s, e, consol, empId) => {
    let q = supabase.from('lancamentos').select('id,tipo,valor,data,descricao,categoria,conta_id,empresa_id').gte('data',s).lte('data',e)
    // Resolve as entidades selecionadas (única, múltiplas marcadas, ou todas)
    const ids = await getSelectedEntidadeIds()
    if (ids.length) q = q.in('empresa_id', ids)
    const r = await fetchAll(q)
    return r || []
  }, [])

  useEffect(() => {
    if (!empresaId) return
    const run = async () => {
      setLoading(true); setError(null)
      try {
        const [cur, prev] = await Promise.all([
          fetchPeriod(debouncedStart, debouncedEnd, isConsol, empresaId),
          fetchPeriod(...Object.values(getPrevPeriod(debouncedStart, debouncedEnd)), isConsol, empresaId),
        ])
        setData(cur); setPrevData(prev)
      } catch(e) { setError('Erro ao carregar dados.') }
      finally { setLoading(false) }
    }
    run()
  }, [empresaId, debouncedStart, debouncedEnd, isConsol, fetchPeriod])

  const v  = calcDRE(data)
  const pv = calcDRE(prevData)
  const wf = buildWaterfall(v)

  const mB  = v.rl>0 ? (v.lb/v.rl*100) : 0
  const mE  = v.rl>0 ? (v.ebt/v.rl*100) : 0
  const mL  = v.rl>0 ? (v.resL/v.rl*100) : 0

  const badge = { display:'inline-block', background:'rgba(var(--fs-brand-rgb),0.1)', color:'var(--fs-brand-text)', padding:'3px 12px', borderRadius:20, fontSize:11, fontWeight:700, marginLeft:8, border:'1px solid rgba(var(--fs-brand-rgb),0.2)' }

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}} @keyframes countUp{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}`}</style>

      {showPres && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'var(--fs-bg)', display:'flex', flexDirection:'column', padding:'36px 48px', overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40,height:40,background:'linear-gradient(135deg,var(--fs-brand-dark),var(--fs-brand))',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#fff',fontSize:16 }}>FS</div>
              <div>
                <div style={{ fontWeight:800, fontSize:18, color:'var(--fs-text-1)' }}>Facesign {isConsol&&<span style={{...badge,display:'inline-flex',alignItems:'center',gap:5}}><SvgIcon name="layers" size={11} color="currentColor" />Consolidado</span>}</div>
                <div style={{ fontSize:12, color:'var(--fs-text-4)' }}>DRE — {formatPeriod(startDate,endDate)}</div>
              </div>
            </div>
            <button onClick={()=>setShowPres(false)} style={{ background:'rgba(var(--fs-danger-rgb),0.08)',border:'1px solid rgba(var(--fs-danger-rgb),0.2)',color:'var(--fs-danger)',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700 }}>✕ ESC</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:20 }}>
            <KPICard title="Receita Bruta"      value={v.rb}   prev={pv.rb}   accent={C.green}  loading={loading} large />
            <KPICard title="Lucro Bruto"         value={v.lb}   prev={pv.lb}   accent={C.blue}   loading={loading} large />
            <KPICard title="EBITDA"              value={v.ebt}  prev={pv.ebt}  accent={v.ebt>=0?C.teal:C.red} loading={loading} large />
            <KPICard title="Resultado Final"     value={v.resF} prev={pv.resF} accent={v.resF>=0?C.purple:C.red} loading={loading} large />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
            {[{l:'Margem Bruta',v:mB,c:C.purple},{l:'Margem EBITDA',v:mE,c:C.teal},{l:'Margem Líquida',v:mL,c:C.blue}].map(m=>(
              <div key={m.l} style={{ background:'var(--fs-surface-2)',border:'1px solid var(--fs-border)',borderRadius:10,padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <span style={{ color:'var(--fs-text-4)',fontSize:13 }}>{m.l}</span>
                <span style={{ color:m.v>=0?m.c:C.red,fontSize:24,fontWeight:800 }}>{m.v.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--fs-surface)',border:'1px solid var(--fs-border)',borderRadius:12,padding:'20px 24px',flex:1 }}>
            <h2 style={{ fontSize:14,fontWeight:700,color:'var(--fs-text-1)',marginBottom:16 }}>Da Receita ao Lucro</h2>
            <ResponsiveContainer width="100%" height={260}>
              {(() => {
                const allBots = wf.map(d => d.spacer)
                const allTops = wf.map(d => d.spacer + d.barHeight)
                const domMin  = Math.min(0, ...allBots)
                const domMax  = Math.max(0, ...allTops)
                const pad     = (domMax - domMin) * 0.12
                return (
                  <BarChart data={wf} margin={{top:8,right:20,left:0,bottom:48}} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false}
                      tick={{fill:'var(--fs-text-4)',fontSize:10}} interval={0} angle={-25} textAnchor="end" />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{fill:'var(--fs-text-4)',fontSize:10}} tickFormatter={fmt}
                      domain={[domMin - pad, domMax + pad]} />
                    <ReferenceLine y={0} stroke="var(--fs-border-2)" strokeWidth={1.5} />
                    <Tooltip content={<CustomTooltip lancamentos={data} cursor={false} />} cursor={{fill:'transparent'}} />
                    <Bar dataKey="spacer" stackId="wf" fill="transparent" isAnimationActive={false} />
                    <Bar dataKey="barHeight" stackId="wf" radius={[3,3,0,0]} isAnimationActive={false}>
                      {wf.map((e,i) => (
                        <Cell key={i} fill={e.color} fillOpacity={e.type==='subtotal' ? 0.78 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                )
              })()}
            </ResponsiveContainer>
          </div>
          <div style={{ textAlign:'center',marginTop:12,color:'var(--fs-text-4)',fontSize:11 }}>Uso Interno Confidencial — {new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      )}

      <div style={{ color:'var(--fs-text-1)', padding:24 }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--fs-text-1)', display:'flex', alignItems:'center' }}>
            Demonstrativos Executivos
            {isConsol && <span style={{...badge,display:'inline-flex',alignItems:'center',gap:5}}><SvgIcon name="layers" size={11} color="currentColor" />Consolidado</span>}
          </h1>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--fs-surface)', padding:'7px 14px', borderRadius:8, border:'1px solid var(--fs-border)' }}>
              <span style={{ fontSize:12, color:'var(--fs-text-4)' }}>Período:</span>
              <input type="date" onClick={e => { try { e.target.showPicker() } catch(_) {} }} style={{ background:'var(--fs-input-bg)',border:'1px solid var(--fs-input-border)',borderRadius:6,color:'var(--fs-text-1)',padding:'5px 8px',fontSize:12,outline:'none' }} value={startDate} onChange={e=>setStartDate(e.target.value)} />
              <span style={{ color:'var(--fs-text-4)' }}>→</span>
              <input type="date" onClick={e => { try { e.target.showPicker() } catch(_) {} }} style={{ background:'var(--fs-input-bg)',border:'1px solid var(--fs-input-border)',borderRadius:6,color:'var(--fs-text-1)',padding:'5px 8px',fontSize:12,outline:'none' }} value={endDate} onChange={e=>setEndDate(e.target.value)} />
            </div>
            <button onClick={()=>setShowPres(true)} style={{ background:'linear-gradient(135deg,var(--fs-brand-deep),var(--fs-brand-dark))',border:'1px solid var(--fs-brand-dark)',color:'#fff',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700 }}>
              <span style={{display:'inline-flex',alignItems:'center',gap:6}}><SvgIcon name="presentation" size={13} color="currentColor" />Apresentação</span>
            </button>
          </div>
        </div>

        {error && <div style={{ background:'rgba(var(--fs-danger-rgb),0.08)',border:'1px solid rgba(var(--fs-danger-rgb),0.2)',borderRadius:8,padding:'12px 16px',color:'#fca5a5',marginBottom:20 }}>⚠️ {error}</div>}

        {/* KPI Cards — estrutura DRE completa */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:14 }}>
          <KPICard title="Receita Bruta"   value={v.rb}   prev={pv.rb}   accent={C.green}                    loading={loading} />
          <KPICard title="Lucro Bruto"     value={v.lb}   prev={pv.lb}   accent={v.lb>=0?C.blue:C.red}       loading={loading} />
          <KPICard title="EBITDA"          value={v.ebt}  prev={pv.ebt}  accent={v.ebt>=0?C.teal:C.red}      loading={loading} />
          <KPICard title="Resultado Final" value={v.resF} prev={pv.resF} accent={v.resF>=0?C.purple:C.red}   loading={loading} />
        </div>

        {/* Margens */}
        {!loading && data.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
            {[{l:'Margem Bruta',v:mB,c:C.purple},{l:'Margem EBITDA',v:mE,c:C.teal},{l:'Margem Líquida',v:mL,c:C.blue}].map(m=>(
              <div key={m.l} style={{ background:'var(--fs-input-bg)',border:'1px solid var(--fs-border)',borderRadius:8,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <span style={{ color:'var(--fs-text-4)',fontSize:12 }}>{m.l}</span>
                <span style={{ color:m.v>=0?m.c:C.red,fontSize:17,fontWeight:800 }}>{m.v.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Waterfall — Da Receita ao Lucro */}
        <div style={{ background:'var(--fs-surface)',border:'1px solid var(--fs-border)',borderRadius:12,padding:'20px 24px',marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h2 style={{ fontSize:15,fontWeight:700,color:'var(--fs-text-1)',margin:0 }}>Da Receita ao Lucro</h2>
            <div style={{ display:'flex', gap:14, fontSize:11 }}>
              {[{c:C.green,l:'Positivo'},{c:C.red,l:'Redução'},{c:C.blue,l:'Resultado'},{c:C.teal,l:'EBITDA'},{c:C.purple,l:'Líquido'}].map(i=>(
                <span key={i.l} style={{ display:'flex',alignItems:'center',gap:4,color:'var(--fs-text-4)' }}>
                  <span style={{ width:10,height:10,borderRadius:2,background:i.c,display:'inline-block' }}/>
                  {i.l}
                </span>
              ))}
            </div>
          </div>
          {loading ? (
            <div style={{ height:360,background:'linear-gradient(90deg,var(--fs-surface) 25%,var(--fs-surface-2) 50%,var(--fs-surface) 75%)',backgroundSize:'200% 100%',animation:'shimmer 1.5s infinite',borderRadius:8 }}/>
          ) : data.length===0 ? (
            <div style={{ height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--fs-text-4)',flexDirection:'column',gap:8 }}>
              <span>Nenhum lançamento no período</span>
            </div>
          ) : (
            <div style={{ height:380 }}>
              <ResponsiveContainer width="100%" height="100%">
                {(() => {
                  const allBots = wf.map(d => d.spacer)
                  const allTops = wf.map(d => d.spacer + d.barHeight)
                  const domMin  = Math.min(0, ...allBots)
                  const domMax  = Math.max(0, ...allTops)
                  const pad = (domMax - domMin) * 0.12
                  return (
                    <BarChart data={wf} margin={{top:10,right:20,left:0,bottom:54}} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false}
                        tick={{fill:'var(--fs-text-4)',fontSize:11}} interval={0} angle={-25} textAnchor="end" />
                      <YAxis axisLine={false} tickLine={false}
                        tick={{fill:'var(--fs-text-4)',fontSize:11}} tickFormatter={fmt} width={72}
                        domain={[domMin - pad, domMax + pad]} />
                      <ReferenceLine y={0} stroke="var(--fs-border-2)" strokeWidth={1.5} />
                      <Tooltip content={<CustomTooltip lancamentos={data} cursor={false} />} cursor={{fill:'rgba(255,255,255,0.03)'}} />
                      {/* Spacer invisível — posiciona a barra colorida */}
                      <Bar dataKey="spacer" stackId="wf" fill="transparent" isAnimationActive={false} />
                      {/* Barra colorida — a magnitude visível */}
                      <Bar dataKey="barHeight" stackId="wf" radius={[3,3,0,0]} isAnimationActive={false}>
                        {wf.map((e,i) => (
                          <Cell key={i} fill={e.color} fillOpacity={e.type==='subtotal' ? 0.78 : 1} />
                        ))}
                      </Bar>
                    </BarChart>
                  )
                })()}
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tabela Resumo DRE */}
        {!loading && data.length > 0 && (
          <div style={{ background:'var(--fs-surface)',border:'1px solid var(--fs-border)',borderRadius:12,padding:'20px 24px' }}>
            <h2 style={{ fontSize:15,fontWeight:700,color:'var(--fs-text-1)',marginBottom:16 }}>Resumo Executivo</h2>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'2px solid var(--fs-border)' }}>
                  <th style={{ padding:'8px 12px',textAlign:'left',color:'var(--fs-text-4)',fontSize:11,fontWeight:700,textTransform:'uppercase' }}>Linha DRE</th>
                  <th style={{ padding:'8px 12px',textAlign:'right',color:'var(--fs-text-4)',fontSize:11,fontWeight:700,textTransform:'uppercase' }}>Período Atual</th>
                  <th style={{ padding:'8px 12px',textAlign:'right',color:'var(--fs-text-4)',fontSize:11,fontWeight:700,textTransform:'uppercase' }}>Período Anterior</th>
                  <th style={{ padding:'8px 12px',textAlign:'right',color:'var(--fs-text-4)',fontSize:11,fontWeight:700,textTransform:'uppercase' }}>Variação</th>
                  <th style={{ padding:'8px 12px',textAlign:'right',color:'var(--fs-text-4)',fontSize:11,fontWeight:700,textTransform:'uppercase' }}>% Receita</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { l:'Receita Bruta',       cur:v.rb,   prev:pv.rb,   pct:v.rb/v.rb,   isTotal:false, isSub:false, indent:0 },
                  { l:'(-) Deduções',         cur:-v.ded, prev:-pv.ded, pct:-v.ded/v.rb, isTotal:false, isSub:false, indent:1, hide: v.ded<0.01 },
                  { l:'= Receita Líquida',    cur:v.rl,   prev:pv.rl,   pct:v.rl/v.rb,   isTotal:false, isSub:true,  indent:0, hide: v.ded<0.01 },
                  { l:'(-) Custos Variáveis', cur:-v.cv,  prev:-pv.cv,  pct:-v.cv/v.rb,  isTotal:false, isSub:false, indent:1, hide: v.cv<0.01 },
                  { l:'= Lucro Bruto',        cur:v.lb,   prev:pv.lb,   pct:v.lb/v.rb,   isTotal:false, isSub:true,  indent:0 },
                  { l:'(-) Despesas Fixas',   cur:-v.df,  prev:-pv.df,  pct:-v.df/v.rb,  isTotal:false, isSub:false, indent:1, hide: v.df<0.01 },
                  { l:'= EBITDA',             cur:v.ebt,  prev:pv.ebt,  pct:v.ebt/v.rb,  isTotal:true,  isSub:false, indent:0 },
                  { l:'(-) Impostos s/ Lucro', cur:-v.imp, prev:-pv.imp, pct:-v.imp/v.rb, isTotal:false, isSub:false, indent:1, hide: v.imp<0.01 },
                  { l:'(+) Rec. Financeiras', cur:v.rf,   prev:pv.rf,   pct:v.rf/v.rb,   isTotal:false, isSub:false, indent:1, hide: v.rf<0.01 },
                  { l:'(-) Desp. Financeiras',cur:-v.dfin,prev:-pv.dfin,pct:-v.dfin/v.rb,isTotal:false, isSub:false, indent:1, hide: v.dfin<0.01 },
                  { l:'= Resultado Líquido',  cur:v.resL, prev:pv.resL, pct:v.resL/v.rb, isTotal:false, isSub:true,  indent:0, hide: (v.rf+v.dfin+v.imp)<0.01 },
                  { l:'(-) Investimentos',    cur:-v.inv, prev:-pv.inv, pct:-v.inv/v.rb,  isTotal:false, isSub:false, indent:1, hide: v.inv<0.01  },
                  { l:'= Resultado Final',    cur:v.resF, prev:pv.resF, pct:v.resF/v.rb, isTotal:true,  isSub:false, indent:0 },
                ].filter(r=>!r.hide).map((r,i)=>{
                  const delta = pv.rb > 0 ? ((r.cur-r.prev)/Math.abs(r.prev||1)*100) : null
                  const bg = r.isTotal ? 'var(--fs-surface-2)' : i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                  const color = r.isTotal ? (r.cur>=0?C.teal:C.red) : r.isSub ? C.blue : r.cur<0 ? C.red : 'var(--fs-text-1)'
                  const fw = r.isTotal || r.isSub ? 800 : 400
                  return (
                    <tr key={r.l} style={{ borderBottom:'1px solid var(--fs-border)', background:bg }}>
                      <td style={{ padding:'9px 12px', color:'var(--fs-text-2)', fontWeight:fw, paddingLeft: r.indent?24:12 }}>{r.l}</td>
                      <td style={{ padding:'9px 12px', textAlign:'right', color, fontWeight:fw }}>{fmtFull(r.cur)}</td>
                      <td style={{ padding:'9px 12px', textAlign:'right', color:'var(--fs-text-3)', fontWeight:400 }}>{fmtFull(r.prev)}</td>
                      <td style={{ padding:'9px 12px', textAlign:'right' }}>
                        {delta!==null&&<span style={{ color:delta>=0?C.green:C.red, fontSize:11, fontWeight:600 }}>{delta>=0?'+':''}{delta.toFixed(1)}%</span>}
                      </td>
                      <td style={{ padding:'9px 12px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>
                        {v.rb>0&&!isNaN(r.pct) ? `${(r.pct*100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && prevData.length > 0 && (
          <div style={{ textAlign:'right',color:'var(--fs-text-4)',fontSize:11,marginTop:12 }}>
            ℹ️ Variações vs {formatPeriod(...Object.values(getPrevPeriod(startDate,endDate)))}
          </div>
        )}
      </div>
    </>
  )
}
