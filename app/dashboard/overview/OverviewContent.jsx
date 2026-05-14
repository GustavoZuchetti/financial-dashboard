'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { calcDRE } from '@/lib/dre-calc'
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Legend
} from 'recharts'

// ─── Constantes ───────────────────────────────────────────────────────────────
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#22c55e']

// ─── Utilitários ──────────────────────────────────────────────────────────────
const fC = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '—'
  const n = Number(v), a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a >= 1e6) return `${s}R$\u00a0${(a/1e6).toFixed(2)}M`
  if (a >= 1e3) return `${s}R$\u00a0${(a/1e3).toFixed(1)}k`
  return `${s}R$\u00a0${a.toFixed(0)}`
}

// ─── Sparkline inline ─────────────────────────────────────────────────────────
const Spark = ({ data, dataKey, color }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{top:2,right:2,bottom:2,left:2}}>
      <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={2} />
    </LineChart>
  </ResponsiveContainer>
)

// ─── KPI Card grande ──────────────────────────────────────────────────────────
const KCard = ({ label, value, pct, pctLabel, sparkData, sparkKey, sparkColor, isNegative }) => {
  const pctNum = pct !== undefined && pct !== null ? Number(pct) : null
  const pos = pctNum === null ? null : !isNegative ? pctNum >= 0 : pctNum <= 0
  return (
    <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'18px 20px', flex:1, minWidth:0 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:26, fontWeight:900, color:'var(--fs-text-1)', lineHeight:1.1, marginBottom:6 }}>{value}</div>
          {pctNum !== null && (
            <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, fontWeight:700, color: pos ? '#22c55e' : '#ef4444' }}>
                {pos ? '▲' : '▼'} {Math.abs(pctNum).toFixed(1)}%
              </span>
              {pctLabel && <span style={{ fontSize:11, color:'var(--fs-text-4)' }}>{pctLabel}</span>}
            </div>
          )}
        </div>
        {sparkData && sparkData.length > 1 && (
          <div style={{ width:90, height:42, flexShrink:0 }}>
            <Spark data={sparkData} dataKey={sparkKey} color={sparkColor || '#3b82f6'} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── KPI Card secundário ──────────────────────────────────────────────────────
const SCard = ({ label, value, sub, color }) => (
  <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'16px 20px', flex:1, minWidth:0 }}>
    <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>{label}</div>
    <div style={{ fontSize:22, fontWeight:800, color: color || 'var(--fs-text-1)', lineHeight:1.2 }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:3 }}>{sub}</div>}
  </div>
)

// ─── Tooltip customizado ──────────────────────────────────────────────────────
const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, padding:'8px 12px', fontSize:12 }}>
      <div style={{ fontWeight:700, color:'var(--fs-text-1)', marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color, display:'flex', justifyContent:'space-between', gap:16 }}>
          <span>{p.name}</span><strong>{fC(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Botão de período ─────────────────────────────────────────────────────────
const PeriodBtn = ({ label, active, onClick, color }) => {
  const activeStyle = color === 'blue'
    ? { background:'rgba(59,130,246,0.20)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.45)' }
    : { background:'rgba(139,92,246,0.20)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.45)' }
  const inactiveStyle = color === 'blue'
    ? { background:'rgba(59,130,246,0.06)', color:'var(--fs-text-4)', border:'1px solid rgba(59,130,246,0.15)' }
    : { background:'rgba(139,92,246,0.06)', color:'var(--fs-text-4)', border:'1px solid rgba(139,92,246,0.15)' }
  return (
    <button
      onClick={onClick}
      style={{
        ...(active ? activeStyle : inactiveStyle),
        padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:700,
        cursor:'pointer', transition:'all 0.15s ease', outline:'none',
        lineHeight:'20px',
      }}
    >
      {label}
    </button>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function OverviewPage() {
  const now        = new Date()
  const curYear    = now.getFullYear()
  const curMonth   = now.getMonth()
  const today      = now.toISOString().split('T')[0]

  // 'mes' = mês corrente | 'ytd' = Jan → hoje
  const [periodo,   setPeriodo]   = useState('ytd')
  const [loading,   setLoading]   = useState(true)
  const [empresaId, setEmpresaId] = useState(null)
  const [isConsol,  setIsConsol]  = useState(false)
  const [empNome,   setEmpNome]   = useState('')

  const [kpis,     setKpis]     = useState(null)
  const [monthly,  setMonthly]  = useState([])
  const [fcMensal, setFcMensal] = useState([])
  const [recComp,  setRecComp]  = useState([])
  const [recentes, setRecentes] = useState([])

  // ─── Intervalo de datas conforme período selecionado ──────────────────────
  const dateRange = useCallback(() => {
    if (periodo === 'mes') {
      const mm = String(curMonth + 1).padStart(2, '0')
      return {
        start:    `${curYear}-${mm}-01`,
        end:      today,
        label:    `01 ${MESES[curMonth]} → ${now.getDate()} ${MESES[curMonth]}, ${curYear}`,
        subLabel: `${MESES[curMonth]} ${curYear}`,
        prevStart:`${curYear - 1}-${mm}-01`,
        prevEnd:  `${curYear - 1}-${mm}-${String(new Date(curYear-1, curMonth+1, 0).getDate()).padStart(2,'0')}`,
        nMonths:  1,
      }
    }
    // ytd
    return {
      start:    `${curYear}-01-01`,
      end:      today,
      label:    `01 Jan → ${now.getDate()} ${MESES[curMonth]}, ${curYear} · vs ano anterior`,
      subLabel: `YTD ${curYear}`,
      prevStart:`${curYear - 1}-01-01`,
      prevEnd:  `${curYear - 1}-12-31`,
      nMonths:  curMonth + 1,
    }
  }, [periodo, curYear, curMonth, today])

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
      const dr = dateRange()

      // Obter IDs das empresas
      let empIds = []
      if (isConsol) {
        const { data: { session } } = await supabase.auth.getSession()
        const { data: ue } = await supabase.from('empresas').select('id').eq('user_id', session.user.id)
        empIds = (ue || []).map(e => e.id)
      } else {
        empIds = [empresaId]
        const { data: e } = await supabase.from('empresas').select('nome').eq('id', empresaId).single()
        setEmpNome(e?.nome || '')
      }
      if (!empIds.length) { setLoading(false); return }

      const next30    = new Date(); next30.setDate(next30.getDate() + 30)
      const next30str = next30.toISOString().split('T')[0]

      const buildQ = (table, cols) => {
        let q = supabase.from(table).select(cols)
        return isConsol ? q.in('empresa_id', empIds) : q.eq('empresa_id', empresaId)
      }

      const [
        { data: curLanc  = [] },
        { data: prevLanc = [] },
        { data: fcAll    = [] },
        { data: planoContas = [] },
      ] = await Promise.all([
        buildQ('lancamentos', 'id,tipo,valor,data,descricao,categoria,conta_id')
          .gte('data', dr.start).lte('data', dr.end),
        buildQ('lancamentos', 'tipo,valor,data')
          .gte('data', dr.prevStart).lte('data', dr.prevEnd),
        buildQ('fluxo_caixa', 'id,tipo,valor,data,descricao')
          .gte('data', dr.start).order('data'),
        supabase.from('plano_contas').select('id,nome,tipo,codigo')
          .eq('empresa_id', isConsol ? empIds[0] : empresaId),
      ])

      const planMap = Object.fromEntries((planoContas || []).map(p => [p.id, p.nome]))

      // ── DRE período ───────────────────────────────────────────────────────
      const vCur  = calcDRE(curLanc  || [])
      const vPrev = calcDRE(prevLanc || [])

      // ── Evolução mensal ───────────────────────────────────────────────────
      // Para YTD: todos os meses; para Mês: só o mês corrente
      const refLanc = periodo === 'ytd'
        ? curLanc
        : (curLanc || []) // já filtrado pelo período

      const byMonth = {}
      ;(refLanc || []).forEach(l => {
        const m = new Date(l.data + 'T00:00:00').getMonth()
        if (!byMonth[m]) byMonth[m] = []
        byMonth[m].push(l)
      })

      const monthRange = periodo === 'ytd'
        ? Array.from({ length: curMonth + 1 }, (_, i) => i)
        : [curMonth]

      const monthData = monthRange.map(i => {
        const v = calcDRE(byMonth[i] || [])
        return { name: MESES[i], receita: v.rb, rl: v.rl, ebitda: v.ebt, resLiq: v.resL }
      })
      setMonthly(monthData)

      // ── Fluxo de Caixa mensal ─────────────────────────────────────────────
      const fcByMonth = {}
      ;(fcAll || []).forEach(f => {
        const m = new Date(f.data + 'T00:00:00').getMonth()
        if (!fcByMonth[m]) fcByMonth[m] = { entradas: 0, saidas: 0 }
        const v = Math.abs(Number(f.valor) || 0)
        if (['entrada','fluxo_entrada','receita','receita_financeira'].includes(f.tipo)) fcByMonth[m].entradas += v
        else fcByMonth[m].saidas += v
      })

      let fcChart = []
      if (Object.keys(fcByMonth).length > 0) {
        let saldo = 0
        fcChart = monthRange.map(i => {
          const fc = fcByMonth[i] || { entradas: 0, saidas: 0 }
          saldo += fc.entradas - fc.saidas
          return { name: MESES[i], entradas: fc.entradas, saidas: fc.saidas, saldo: Math.max(0, saldo) }
        })
      } else {
        let saldo = 0
        fcChart = monthData.map(m => {
          const mes = MESES.indexOf(m.name)
          const saidas = (byMonth[mes] || []).filter(l => ['custo','despesa','despesa_financeira','deducao'].includes(l.tipo)).reduce((a,l)=>a+Number(l.valor),0)
          saldo += m.receita - saidas
          return { name: m.name, entradas: m.receita, saidas, saldo: Math.max(0, saldo) }
        })
      }
      setFcMensal(fcChart)

      // ── Composição da Receita ─────────────────────────────────────────────
      const recMap = {}
      ;(curLanc || []).filter(l => l.tipo === 'receita').forEach(l => {
        const cat = planMap[l.conta_id] || l.categoria || l.descricao?.substring(0,25) || 'Receita Geral'
        recMap[cat] = (recMap[cat] || 0) + Number(l.valor)
      })
      const sortedRec = Object.entries(recMap).sort((a,b) => b[1]-a[1])
      const top3Rec   = sortedRec.slice(0, 3)
      const outrosRec = sortedRec.slice(3).reduce((a,[,v])=>a+v, 0)
      const totalRec  = sortedRec.reduce((a,[,v])=>a+v, 0)
      const recCompData = [
        ...top3Rec.map(([name, value]) => ({ name: name.substring(0,22), value, pct: totalRec > 0 ? Math.round(value/totalRec*100) : 0 })),
        ...(outrosRec > 0 ? [{ name: 'Outros', value: outrosRec, pct: Math.round(outrosRec/totalRec*100) }] : [])
      ]
      setRecComp(recCompData)

      // ── Variações YoY ─────────────────────────────────────────────────────
      const diasCur  = Math.max(1, (new Date(dr.end) - new Date(dr.start)) / 86400000 + 1)
      const diasPrev = Math.max(1, (new Date(dr.prevEnd) - new Date(dr.prevStart)) / 86400000 + 1)
      const scale    = diasCur / diasPrev

      const rlPrev_p  = vPrev.rl  * scale
      const ebtPrev_p = vPrev.ebt * scale
      const margPrev  = rlPrev_p > 0 ? (vPrev.resL * scale) / rlPrev_p * 100 : 0

      const rlPct  = rlPrev_p  > 0.01 ? (vCur.rl  - rlPrev_p)  / rlPrev_p  * 100 : null
      const ebtPct = ebtPrev_p > 0.01 ? (vCur.ebt - ebtPrev_p) / ebtPrev_p * 100 : null
      const margCur  = vCur.rb > 0 ? vCur.resL / vCur.rb * 100 : 0
      const margDiff = margPrev !== 0 ? margCur - margPrev : null

      // ── Métricas auxiliares ───────────────────────────────────────────────
      const burnRate = (vCur.cv + vCur.df) / dr.nMonths
      const caixa    = fcChart.length > 0 ? fcChart[fcChart.length-1].saldo : Math.max(0, vCur.rb - vCur.cv - vCur.df)
      const runway   = burnRate > 0 ? caixa / burnRate : null

      const fc30      = (fcAll || []).filter(f => f.data > today && f.data <= next30str)
      const aReceber  = fc30.filter(f => ['entrada','fluxo_entrada','receita'].includes(f.tipo)).reduce((a,f)=>a+Math.abs(Number(f.valor)||0), 0)
      const aPagar    = fc30.filter(f => ['saida','fluxo_saida','despesa','custo'].includes(f.tipo)).reduce((a,f)=>a+Math.abs(Number(f.valor)||0), 0)

      setKpis({ rl: vCur.rl, rlPct, ebt: vCur.ebt, ebtPct, marg: margCur, margDiff, caixa, aReceber, aPagar, burnRate, runway })

      // ── Lançamentos recentes ──────────────────────────────────────────────
      const rec = [...(curLanc||[])].sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,6)
      setRecentes(rec.map(l => ({
        desc: (l.descricao || l.categoria || 'Lançamento').substring(0,28),
        tipo: l.tipo, valor: Number(l.valor), data: l.data
      })))

    } catch (e) { console.error('Overview:', e) }
    finally { setLoading(false) }
  }, [empresaId, isConsol, periodo, dateRange])

  useEffect(() => { if (empresaId !== null) load() }, [load, empresaId, periodo])

  const tipoColor = { receita:'#22c55e', custo:'#ef4444', despesa:'#f59e0b', deducao:'#f97316', receita_financeira:'#14b8a6', despesa_financeira:'#8b5cf6', investimento:'#64748b' }
  const dr = dateRange()

  if (!empresaId) return (
    <div style={{ textAlign:'center', padding:80, color:'var(--fs-text-4)' }}>Selecione uma empresa no menu lateral.</div>
  )

  return (
    <div style={{ color:'var(--fs-text-1)', width:'100%' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11, color:'var(--fs-text-4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:6 }}>
          {empNome || 'Consolidado'} · {dr.subLabel}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <h1 style={{ fontSize:30, fontWeight:900, color:'var(--fs-text-1)', margin:0 }}>Overview</h1>

          {/* ── Botões de período funcionais ─────────────────────────────── */}
          <PeriodBtn
            label={`${MESES[curMonth]} ${String(curYear).slice(2)}`}
            active={periodo === 'mes'}
            color="blue"
            onClick={() => setPeriodo('mes')}
          />
          <PeriodBtn
            label="YTD"
            active={periodo === 'ytd'}
            color="purple"
            onClick={() => setPeriodo('ytd')}
          />
        </div>
        <div style={{ fontSize:12, color:'var(--fs-text-4)', marginTop:5 }}>
          {dr.label}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:80, color:'var(--fs-text-4)' }}>
          <div style={{ fontSize:14 }}>Calculando métricas...</div>
        </div>
      ) : !kpis ? (
        <div style={{ textAlign:'center', padding:80, color:'var(--fs-text-4)' }}>Sem dados para exibir.</div>
      ) : (
        <>
          {/* ── Linha 1: KPIs principais ────────────────────────────────────── */}
          <div style={{ display:'flex', gap:12, marginBottom:12, flexWrap:'wrap' }}>
            <KCard
              label={`Receita Líquida · ${periodo === 'mes' ? MESES[curMonth] : 'YTD'}`}
              value={fC(kpis.rl)}
              pct={kpis.rlPct} pctLabel="vs período anterior"
              sparkData={monthly} sparkKey="rl" sparkColor="#14b8a6"
            />
            <KCard
              label="EBITDA"
              value={fC(kpis.ebt)}
              pct={kpis.ebtPct} pctLabel="vs período anterior"
              sparkData={monthly} sparkKey="ebitda" sparkColor="#3b82f6"
            />
            <KCard
              label="Margem Líquida"
              value={`${kpis.marg.toFixed(1)}%`}
              pct={kpis.margDiff} pctLabel="p.p. vs anterior"
              sparkData={monthly} sparkKey="resLiq" sparkColor="#8b5cf6"
            />
            <KCard
              label="Caixa Disponível"
              value={fC(kpis.caixa)}
              pct={null}
              sparkData={fcMensal} sparkKey="saldo" sparkColor="#f59e0b"
            />
          </div>

          {/* ── Linha 2: KPIs secundários ────────────────────────────────────── */}
          <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            <SCard label="A Receber · 30 Dias" value={kpis.aReceber > 0 ? fC(kpis.aReceber) : '—'} color="#22c55e" />
            <SCard label="A Pagar · 30 Dias"   value={kpis.aPagar   > 0 ? fC(kpis.aPagar)   : '—'} color="#ef4444" />
            <SCard label="Burn Rate Mensal"     value={fC(kpis.burnRate)} sub="custos + despesas / mês" />
            <SCard label="Runway"               value={kpis.runway ? `${kpis.runway.toFixed(1)} meses` : '—'} sub="caixa ÷ burn rate" />
          </div>

          {/* ── Linha 3: Gráficos ───────────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:12, marginBottom:12 }}>
            {/* Fluxo de Caixa */}
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Fluxo de Caixa</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:16 }}>Entradas, saídas e saldo acumulado</div>
              {fcMensal.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={fcMensal} margin={{top:4,right:8,left:0,bottom:4}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:11}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} tickFormatter={fC} width={62} />
                    <Tooltip content={<TT />} />
                    <Legend iconType="circle" wrapperStyle={{fontSize:11,paddingTop:8}} />
                    <Bar dataKey="entradas" fill="#3b82f6" radius={[3,3,0,0]} name="Entradas" barSize={12} />
                    <Bar dataKey="saidas"   fill="rgba(239,68,68,0.6)" radius={[3,3,0,0]} name="Saídas" barSize={12} />
                    <Line type="monotone" dataKey="saldo" stroke="#8b5cf6" strokeWidth={2.5} dot={{r:3,fill:'#8b5cf6'}} name="Saldo" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <div style={{textAlign:'center',padding:40,color:'var(--fs-text-4)',fontSize:13}}>Sem dados de fluxo de caixa</div>}
            </div>

            {/* Composição da Receita */}
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Composição da Receita</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:8 }}>Por conta/categoria</div>
              {recComp.length > 0 ? (
                <>
                  <div style={{ position:'relative' }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={recComp} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={2}>
                          {recComp.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={fC} contentStyle={{background:'var(--fs-bg)',border:'1px solid var(--fs-border)',borderRadius:8,fontSize:12}} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
                      <div style={{ fontSize:9, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.5px' }}>TOTAL</div>
                      <div style={{ fontSize:13, fontWeight:800, color:'var(--fs-text-1)' }}>{fC(recComp.reduce((a,r)=>a+r.value,0))}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:7, marginTop:4 }}>
                    {recComp.map((r, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <div style={{ width:9,height:9,borderRadius:2,background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0 }} />
                          <span style={{ color:'var(--fs-text-2)' }}>{r.name}</span>
                        </div>
                        <span style={{ fontWeight:700, color:'var(--fs-text-1)' }}>{r.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{textAlign:'center',padding:40,color:'var(--fs-text-4)',fontSize:13}}>Sem receitas no período</div>}
            </div>
          </div>

          {/* ── Linha 4: Evolução + Recentes ────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:12 }}>
            {/* Evolução Receita vs EBITDA */}
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Demonstrativo Mensal</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:16 }}>
                Receita vs EBITDA · {periodo === 'mes' ? MESES[curMonth] : curYear}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthly} margin={{top:4,right:8,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} tickFormatter={fC} width={62} />
                  <Tooltip content={<TT />} />
                  <Legend iconType="circle" wrapperStyle={{fontSize:11,paddingTop:8}} />
                  <Bar dataKey="receita" fill="#22c55e" name="Receita Bruta" radius={[3,3,0,0]} barSize={14} />
                  <Bar dataKey="ebitda"  fill="#3b82f6" name="EBITDA"        radius={[3,3,0,0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Lançamentos Recentes */}
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Atividade</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:14 }}>Lançamentos recentes</div>
              {recentes.length === 0 ? (
                <div style={{ textAlign:'center', padding:'30px 0', color:'var(--fs-text-4)', fontSize:13 }}>Nenhum lançamento</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {recentes.map((r, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:7,height:7,borderRadius:'50%',background:tipoColor[r.tipo]||'#64748b',flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, color:'var(--fs-text-1)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.desc}</div>
                        <div style={{ fontSize:11, color:'var(--fs-text-4)', display:'flex', gap:6 }}>
                          <span>{r.data}</span>
                          <span>·</span>
                          <span style={{ textTransform:'capitalize' }}>{r.tipo}</span>
                        </div>
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:tipoColor[r.tipo]||'var(--fs-text-2)', flexShrink:0 }}>{fC(r.valor)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
