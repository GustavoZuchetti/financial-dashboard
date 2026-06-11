'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ComposedChart, BarChart, Bar, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { supabase } from '@/lib/supabase'

// ─── Formatadores ─────────────────────────────────────────────────────────────
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const fC = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '—'
  const n = Number(v), a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a >= 1e6) return `${s}R$\u00a0${(a/1e6).toFixed(2)}M`
  if (a >= 1e3) return `${s}R$\u00a0${(a/1e3).toFixed(1)}k`
  return `${s}R$\u00a0${a.toFixed(0)}`
}
const fCFull = (v) => {
  if (!v && v !== 0) return '—'
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v)
}
const fDate = (iso) => {
  if (!iso) return ''
  const [,m,d] = iso.split('-')
  return `${d}/${m}`
}
const pad2 = (n) => String(n).padStart(2,'0')

// ─── Tooltip customizado ──────────────────────────────────────────────────────
const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, padding:'10px 14px', fontSize:12, minWidth:160 }}>
      <div style={{ fontWeight:700, color:'var(--fs-text-1)', marginBottom:6 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:20, marginBottom:2 }}>
          <span style={{ color:p.color }}>{p.name}</span>
          <strong style={{ color:'var(--fs-text-1)' }}>{fC(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
const Spark = ({ data, color, positive }) => {
  const c = positive ? '#22c55e' : '#ef4444'
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{top:2,right:2,bottom:2,left:2}}>
        <defs>
          <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={c} stopOpacity={0.25} />
            <stop offset="95%" stopColor={c} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={c} fill={`url(#sg-${color})`} dot={false} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KCard = ({ label, value, pct, sparkData, positive = true }) => {
  const pctNum = pct !== null && pct !== undefined ? Number(pct) : null
  const up = pctNum === null ? null : positive ? pctNum >= 0 : pctNum <= 0
  return (
    <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 22px', flex:1, minWidth:0 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.9px', marginBottom:10 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:8 }}>
        <div>
          <div style={{ fontSize:28, fontWeight:900, color:'var(--fs-text-1)', lineHeight:1.1, marginBottom:6, letterSpacing:'-0.5px' }}>{value}</div>
          {pctNum !== null && (
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:12, fontWeight:700, color: up ? '#22c55e' : '#ef4444' }}>
                {up ? '↑' : '↓'}{Math.abs(pctNum).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        {sparkData && sparkData.length > 1 && (
          <div style={{ width:100, height:44, flexShrink:0 }}>
            <Spark data={sparkData} color={label} positive={positive} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Barra de progresso categor ───────────────────────────────────────────────
const CatBar = ({ label, value, total, color }) => {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:13, color:'var(--fs-text-2)', fontWeight:500 }}>{label}</span>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--fs-text-1)' }}>{fC(value)}</span>
          <span style={{ fontSize:11, color:'var(--fs-text-4)' }}>{pct.toFixed(1)}%</span>
        </div>
      </div>
      <div style={{ height:5, background:'var(--fs-bg)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ─── Badge toggle ─────────────────────────────────────────────────────────────
const TBtn = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding:'5px 14px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer',
    background: active ? 'var(--fs-brand,#3b82f6)' : 'transparent',
    color: active ? '#fff' : 'var(--fs-text-3)',
    border: active ? 'none' : '1px solid transparent',
    transition:'all 0.15s', outline:'none',
  }}>{label}</button>
)

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FluxoCaixaPage() {
  const now      = new Date()
  const curYear  = now.getFullYear()
  const curMonth = now.getMonth()
  const today    = now.toISOString().split('T')[0]

  const [loading,      setLoading]      = useState(true)
  const [empresaId,    setEmpresaId]    = useState(null)
  const [isConsol,     setIsConsol]     = useState(false)
  const [empNome,      setEmpNome]      = useState('')
  const [startDate,    setStartDate]    = useState(`${curYear - 2}-01-01`)
  const [endDate,      setEndDate]      = useState(today)
  // Debounce de datas — evita query a cada clique no calendário
  const [debStart, setDebStart] = useState(`${curYear - 2}-01-01`)
  const [debEnd,   setDebEnd]   = useState(today)
  useEffect(() => { const t = setTimeout(() => setDebStart(startDate), 500); return () => clearTimeout(t) }, [startDate])
  useEffect(() => { const t = setTimeout(() => setDebEnd(endDate), 500);     return () => clearTimeout(t) }, [endDate])
  const [granular,     setGranular]     = useState('mensal') // mensal | trimestral | anual
  const [busca,        setBusca]        = useState('')

  const [raw,          setRaw]          = useState([])
  const [vencidos,     setVencidos]     = useState({ e:0, s:0, aE:0, aS:0 })    // todos os registros do período
  const [rawPrev,      setRawPrev]      = useState([])    // período anterior (para % variação)
  const [lancRecentes, setLancRecentes] = useState([])    // lançamentos da tabela

  useEffect(() => {
    const id = localStorage.getItem('empresa_id') || ''
    setEmpresaId(id); setIsConsol(id === 'todas')
    const h = () => { const nid = localStorage.getItem('empresa_id')||''; setEmpresaId(nid); setIsConsol(nid==='todas') }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const load = useCallback(async () => {
    if (!empresaId) { setLoading(false); return }
    setLoading(true)
    try {
      let empIds = []
      if (isConsol) {
        const { data: { session } } = await supabase.auth.getSession()
        const { data: ue } = await supabase.from('empresas').select('id').eq('user_id', session.user.id)
        empIds = (ue||[]).map(e=>e.id)
      } else {
        empIds = [empresaId]
        const { data: e } = await supabase.from('empresas').select('nome').eq('id', empresaId).single()
        setEmpNome(e?.nome || '')
      }
      if (!empIds.length) { setLoading(false); return }

      // Período anterior com mesmo número de dias
      const diasCur   = Math.max(1, (new Date(debEnd) - new Date(debStart)) / 86400000 + 1)
      const prevEnd   = new Date(new Date(debStart).getTime() - 86400000)
      const prevStart = new Date(prevEnd.getTime() - diasCur * 86400000 + 86400000)
      const prevStartStr = prevStart.toISOString().split('T')[0]
      const prevEndStr   = prevEnd.toISOString().split('T')[0]

      const buildQ = (table, cols, s, e) => {
        let q = supabase.from(table).select(cols).gte('data', s).lte('data', e)
        return isConsol ? q.in('empresa_id', empIds) : q.eq('empresa_id', empIds[0])
      }

      // fetchAll: paginação completa — Supabase limita 1000 por request
      const fetchAll = async (cols, gte, lte) => {
        let all = [], pg = 0
        while (true) {
          let q = supabase.from('fluxo_caixa').select(cols).range(pg*1000, (pg+1)*1000-1)
          q = isConsol ? q.in('empresa_id', empIds) : q.eq('empresa_id', empIds[0])
          if (gte) q = q.gte('data', gte)
          if (lte) q = q.lte('data', lte)
          const { data: batch = [] } = await q
          if (!batch || batch.length === 0) break
          all = all.concat(batch)
          if (batch.length < 1000) break
          pg++
        }
        return all
      }

      const [fc, fcPrev, fcAll] = await Promise.all([
        fetchAll('id,tipo,valor,data,descricao,categoria', debStart, debEnd),
        fetchAll('tipo,valor', prevStartStr, prevEndStr),
        fetchAll('tipo,valor,data', '2020-01-01', null),
      ])

      setRaw(fc || [])
      setRawPrev(fcPrev || [])

      // Lançamentos recentes
      const lRecentes = [...(fc||[])].sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,20)
      setLancRecentes(lRecentes)

      // Vencidos e a vencer — usa fcAll (todos os registros)
      const fcFuture = fcAll
      const vencidosE  = (fcFuture||[]).filter(f => f.tipo==='entrada' && f.data < today).reduce((a,f)=>a+Math.abs(Number(f.valor)),0)
      const vencidosS  = (fcFuture||[]).filter(f => f.tipo==='saida'   && f.data < today).reduce((a,f)=>a+Math.abs(Number(f.valor)),0)
      const aVencerE   = (fcFuture||[]).filter(f => f.tipo==='entrada' && f.data >= today && f.data <= next30str).reduce((a,f)=>a+Math.abs(Number(f.valor)),0)
      const aVencerS   = (fcFuture||[]).filter(f => f.tipo==='saida'   && f.data >= today && f.data <= next30str).reduce((a,f)=>a+Math.abs(Number(f.valor)),0)
      setVencidos({ e: vencidosE, s: vencidosS, aE: aVencerE, aS: aVencerS })

    } catch(e) { console.error('FluxoCaixa:', e) }
    finally { setLoading(false) }
  }, [empresaId, isConsol, debStart, debEnd])

  useEffect(() => { if (empresaId !== null) load() }, [load, empresaId])

  // ─── Métricas ─────────────────────────────────────────────────────────────
  const entradaTipos = ['entrada','fluxo_entrada','receita','receita_financeira']
  const saidaTipos   = ['saida','fluxo_saida','despesa','custo','despesa_financeira']

  const totalEntradas = raw.filter(d=>entradaTipos.includes(d.tipo)).reduce((a,c)=>a+Math.abs(Number(c.valor)),0)
  const totalSaidas   = raw.filter(d=>saidaTipos.includes(d.tipo)).reduce((a,c)=>a+Math.abs(Number(c.valor)),0)
  const saldo         = totalEntradas - totalSaidas
  const margem        = totalEntradas > 0 ? (saldo / totalEntradas) * 100 : 0

  const prevEntradas  = rawPrev.filter(d=>entradaTipos.includes(d.tipo)).reduce((a,c)=>a+Math.abs(Number(c.valor)),0)
  const prevSaidas    = rawPrev.filter(d=>saidaTipos.includes(d.tipo)).reduce((a,c)=>a+Math.abs(Number(c.valor)),0)
  const prevSaldo     = prevEntradas - prevSaidas
  const prevMargem    = prevEntradas > 0 ? ((prevEntradas - prevSaidas) / prevEntradas) * 100 : 0

  const pctE = prevEntradas > 0 ? ((totalEntradas - prevEntradas) / prevEntradas) * 100 : null
  const pctS = prevSaidas   > 0 ? ((totalSaidas   - prevSaidas)   / prevSaidas)   * 100 : null
  const pctD = prevSaldo    !== 0 ? ((saldo - prevSaldo) / Math.abs(prevSaldo)) * 100 : null
  const pctM = prevMargem   !== 0 ? margem - prevMargem : null

  // ─── Dados para gráfico (agrupa por granularidade) ────────────────────────
  const getKey = (iso) => {
    const d = new Date(iso + 'T00:00:00')
    if (granular === 'mensal')     return MESES[d.getMonth()] + '/' + String(d.getFullYear()).slice(2)
    if (granular === 'trimestral') return `T${Math.floor(d.getMonth()/3)+1}/${String(d.getFullYear()).slice(2)}`
    return String(d.getFullYear())
  }

  const chartMap = {}
  raw.forEach(f => {
    const k = getKey(f.data)
    if (!chartMap[k]) chartMap[k] = { name:k, entradas:0, saidas:0, saldo:0 }
    const v = Math.abs(Number(f.valor)||0)
    if (entradaTipos.includes(f.tipo)) chartMap[k].entradas += v
    else if (saidaTipos.includes(f.tipo)) chartMap[k].saidas += v
  })

  // Ordenar cronologicamente
  const chartData = Object.values(chartMap).map(c => ({
    ...c,
    saldo: c.entradas - c.saidas
  }))

  // Sparklines — evolução mensal de cada KPI
  const sparkByMonth = {}
  raw.forEach(f => {
    const m = new Date(f.data+'T00:00:00').getMonth()
    if (!sparkByMonth[m]) sparkByMonth[m] = { e:0, s:0 }
    const v = Math.abs(Number(f.valor)||0)
    if (entradaTipos.includes(f.tipo)) sparkByMonth[m].e += v
    else sparkByMonth[m].s += v
  })
  const sparkE    = Object.entries(sparkByMonth).sort((a,b)=>a[0]-b[0]).map(([,v])=>({ v:v.e }))
  const sparkS    = Object.entries(sparkByMonth).sort((a,b)=>a[0]-b[0]).map(([,v])=>({ v:v.s }))
  const sparkSald = Object.entries(sparkByMonth).sort((a,b)=>a[0]-b[0]).map(([,v])=>({ v:v.e-v.s }))
  const sparkM    = Object.entries(sparkByMonth).sort((a,b)=>a[0]-b[0]).map(([,v])=>({ v: v.e>0?(v.e-v.s)/v.e*100:0 }))

  // ─── Top categorias saídas ────────────────────────────────────────────────
  const catMap = {}
  raw.filter(d=>saidaTipos.includes(d.tipo)).forEach(d => {
    const cat = d.categoria || d.descricao?.substring(0,20) || 'Outros'
    catMap[cat] = (catMap[cat]||0) + Math.abs(Number(d.valor)||0)
  })
  const topCats = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const catColors = ['#ef4444','#f59e0b','#8b5cf6','#3b82f6','#14b8a6']

  // ─── Tabela de lançamentos filtrada ───────────────────────────────────────
  const tipoColor  = { receita:'#22c55e', custo:'#ef4444', despesa:'#f59e0b', deducao:'#f97316', receita_financeira:'#14b8a6', despesa_financeira:'#8b5cf6', investimento:'#64748b', entrada:'#22c55e', saida:'#ef4444' }
  const tipoLabel  = { receita:'Receita Operacional', custo:'Custo', despesa:'Despesa', deducao:'Dedução', receita_financeira:'Rec. Financeira', despesa_financeira:'Desp. Financeira', investimento:'Investimento', entrada:'Receita Operacional', saida:'Despesa' }
  const isEntrada  = (tipo) => ['receita','receita_financeira','entrada','fluxo_entrada'].includes(tipo)

  const lancFiltrados = lancRecentes.filter(l => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return (l.descricao||'').toLowerCase().includes(q) || (l.categoria||'').toLowerCase().includes(q)
  })

  // ─── Período label ────────────────────────────────────────────────────────
  const fDateFull = (iso) => { if (!iso) return ''; const [y,m,d]=iso.split('-'); return `${d} ${MESES[Number(m)-1]}, ${y}` }

  if (!empresaId) return (
    <div style={{ textAlign:'center', padding:80, color:'var(--fs-text-4)' }}>Selecione uma empresa no menu lateral.</div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ color:'var(--fs-text-1)', width:'100%' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 }}>
            Liquidez · Movimentação Financeira
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <h1 style={{ fontSize:28, fontWeight:900, margin:0, color:'var(--fs-text-1)' }}>Fluxo de Caixa</h1>
            {isConsol && (
              <span style={{ background:'rgba(59,130,246,0.12)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.25)', padding:'3px 11px', borderRadius:20, fontSize:12, fontWeight:700 }}>Consolidado</span>
            )}
          </div>

        </div>

        {/* Ações */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {/* Filtro de período */}
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'7px 12px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--fs-text-4)" strokeWidth="2"><path d="M3 4h18M3 8h18M3 12h18M3 16h10"/></svg>
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
              style={{ background:'transparent', border:'none', color:'var(--fs-text-2)', fontSize:12, outline:'none', colorScheme:'dark' }} />
            <span style={{ color:'var(--fs-text-4)', fontSize:12 }}>→</span>
            <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
              style={{ background:'transparent', border:'none', color:'var(--fs-text-2)', fontSize:12, outline:'none', colorScheme:'dark' }} />
          </div>

          <button style={{ display:'flex', alignItems:'center', gap:6, background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'8px 16px', color:'var(--fs-text-2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filtrar
          </button>

          <button style={{ display:'flex', alignItems:'center', gap:6, background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'8px 16px', color:'var(--fs-text-2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Exportar
          </button>

          <button style={{ display:'flex', alignItems:'center', gap:6, background:'#3b82f6', border:'none', borderRadius:10, padding:'8px 16px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo lançamento
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:80, color:'var(--fs-text-4)', fontSize:14 }}>Carregando dados...</div>
      ) : (
        <>
          {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
          <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            <KCard label="Total Recebido"  value={fC(totalEntradas)} pct={pctE}    sparkData={sparkE}    positive={true} />
            <KCard label="Total Pago"      value={fC(totalSaidas)}   pct={pctS}    sparkData={sparkS}    positive={false} />
            <KCard label="Saldo do Período" value={fC(saldo)}        pct={pctD}    sparkData={sparkSald} positive={true} />
            <KCard label="Margem de Caixa" value={`${margem.toFixed(1)}%`} pct={pctM !== null ? pctM : null} sparkData={sparkM} positive={true} />
          </div>

          {/* ── Cards Vencidos + A Vencer ─────────────────────────────────────── */}
          {(vencidos.e > 0 || vencidos.s > 0 || vencidos.aE > 0 || vencidos.aS > 0) && (
            <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
              {vencidos.s > 0 && (
                <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:12, padding:'14px 18px', flex:1, minWidth:180 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:6 }}>A Pagar Vencido</div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#ef4444' }}>{fC(vencidos.s)}</div>
                  <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:3 }}>Saídas com data no passado</div>
                </div>
              )}
              {vencidos.e > 0 && (
                <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:12, padding:'14px 18px', flex:1, minWidth:180 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:6 }}>A Receber Vencido</div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#f59e0b' }}>{fC(vencidos.e)}</div>
                  <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:3 }}>Entradas com data no passado</div>
                </div>
              )}
              {vencidos.aS > 0 && (
                <div style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:12, padding:'14px 18px', flex:1, minWidth:180 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#60a5fa', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:6 }}>A Pagar · 30 dias</div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#60a5fa' }}>{fC(vencidos.aS)}</div>
                  <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:3 }}>Saídas nos próximos 30 dias</div>
                </div>
              )}
              {vencidos.aE > 0 && (
                <div style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:12, padding:'14px 18px', flex:1, minWidth:180 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#22c55e', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:6 }}>A Receber · 30 dias</div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#22c55e' }}>{fC(vencidos.aE)}</div>
                  <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:3 }}>Entradas nos próximos 30 dias</div>
                </div>
              )}
            </div>
          )}

          {/* ── Gráfico Evolução Mensal ────────────────────────────────────────── */}
          <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:14, padding:'22px 26px', marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Evolução Mensal</div>
                <div style={{ fontSize:16, fontWeight:800, color:'var(--fs-text-1)' }}>Entradas, saídas e saldo acumulado</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                {/* Legenda */}
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  {[{c:'#3b82f6',l:'Entradas'},{c:'#ef4444',l:'Saídas'},{c:'#8b5cf6',l:'Saldo'}].map(({c,l})=>(
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--fs-text-3)' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:c }} />
                      {l}
                    </div>
                  ))}
                </div>
                {/* Toggle granularidade */}
                <div style={{ display:'flex', background:'var(--fs-bg)', borderRadius:8, padding:3, gap:2 }}>
                  {['mensal','trimestral','anual'].map(g => (
                    <TBtn key={g} label={g.charAt(0).toUpperCase()+g.slice(1)} active={granular===g} onClick={()=>setGranular(g)} />
                  ))}
                </div>
              </div>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{top:4,right:8,left:0,bottom:4}}>
                  <defs>
                    <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:11}} tickFormatter={fC} width={68} />
                  <Tooltip content={<TT />} cursor={false} />
                  <Bar dataKey="entradas" fill="url(#gradEntradas)" radius={[4,4,0,0]} name="Entradas" barSize={28} />
                  <Bar dataKey="saidas"   fill="rgba(239,68,68,0.55)" radius={[4,4,0,0]} name="Saídas" barSize={28} />
                  <Line type="monotone" dataKey="saldo" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r:4, fill:'#8b5cf6', strokeWidth:0 }} name="Saldo" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign:'center', padding:60, color:'var(--fs-text-4)', fontSize:13 }}>Sem dados no período selecionado</div>
            )}
          </div>

          {/* ── Linha inferior: Top Categorias + Últimos Lançamentos ─────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:16 }}>

            {/* Top Categorias */}
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:14, padding:'22px 26px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Top Categorias</div>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--fs-text-1)', marginBottom:20 }}>
                Maiores saídas · {startDate.split('-')[0] === endDate.split('-')[0] && startDate.split('-')[1] === '01' ? 'YTD' : 'Período'}
              </div>
              {topCats.length > 0 ? topCats.map(([cat, val], i) => (
                <CatBar key={cat} label={cat} value={val} total={totalSaidas} color={catColors[i % catColors.length]} />
              )) : (
                <div style={{ textAlign:'center', padding:'30px 0', color:'var(--fs-text-4)', fontSize:13 }}>Sem saídas registradas</div>
              )}
            </div>

            {/* Últimos lançamentos */}
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:14, padding:'22px 26px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Movimentações</div>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--fs-text-1)' }}>Últimos lançamentos</div>
                </div>
                {/* Campo de busca */}
                <div style={{ display:'flex', alignItems:'center', gap:7, background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, padding:'6px 12px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--fs-text-4)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input
                    placeholder="Buscar lançamento..."
                    value={busca}
                    onChange={e=>setBusca(e.target.value)}
                    style={{ background:'transparent', border:'none', color:'var(--fs-text-2)', fontSize:12, outline:'none', width:160 }}
                  />
                </div>
              </div>

              {/* Cabeçalho da tabela */}
              <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 130px 110px', gap:8, padding:'0 8px 8px', borderBottom:'1px solid var(--fs-border)', marginBottom:4 }}>
                {['Data','Descrição','Categoria','Valor'].map(h => (
                  <div key={h} style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px' }}>{h}</div>
                ))}
              </div>

              {/* Linhas */}
              <div style={{ maxHeight:320, overflowY:'auto' }}>
                {lancFiltrados.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'30px 0', color:'var(--fs-text-4)', fontSize:13 }}>
                    {busca ? 'Nenhum resultado encontrado' : 'Sem lançamentos no período'}
                  </div>
                ) : lancFiltrados.map((l, i) => {
                  const entrada = isEntrada(l.tipo)
                  const cat     = tipoLabel[l.tipo] || l.categoria || l.tipo
                  const catBg   = entrada ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'
                  const catClr  = entrada ? '#22c55e' : '#ef4444'
                  return (
                    <div key={l.id||i} style={{
                      display:'grid', gridTemplateColumns:'60px 1fr 130px 110px', gap:8,
                      padding:'11px 8px', borderBottom:'1px solid var(--fs-border)',
                      transition:'background 0.1s',
                    }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--fs-bg)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    >
                      <div style={{ fontSize:12, color:'var(--fs-text-4)', fontWeight:600 }}>{fDate(l.data)}</div>
                      <div style={{ fontSize:13, color:'var(--fs-text-1)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ color: entrada ? '#22c55e' : '#ef4444', fontSize:11 }}>{entrada ? '↑' : '↓'}</span>
                        {l.descricao || l.categoria || 'Lançamento'}
                      </div>
                      <div style={{ display:'flex', alignItems:'center' }}>
                        <span style={{ background:catBg, color:catClr, fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>
                          {cat.length > 16 ? cat.substring(0,16)+'…' : cat}
                        </span>
                      </div>
                      <div style={{ fontSize:13, fontWeight:700, color: entrada ? '#22c55e' : '#ef4444', textAlign:'right' }}>
                        {entrada ? '+' : '-'}{fC(Math.abs(Number(l.valor)))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
