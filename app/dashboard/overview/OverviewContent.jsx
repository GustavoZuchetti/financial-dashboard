'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import EmptyState from '@/components/EmptyState'
import SvgIcon from '@/components/SvgIcon'
import { supabase, fetchAll, getSelectedEntidadeIds } from '@/lib/supabase'
import { calcDRE } from '@/lib/dre-calc'
import { efeitosCaixa } from '@/lib/fluxo-status'
import { KpiCardsSkeleton, ChartSkeleton } from '@/components/Skeleton'
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Legend
} from 'recharts'

// ─── Constantes ───────────────────────────────────────────────────────────────
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const PIE_COLORS = ['var(--fs-brand)', 'var(--fs-purple)', 'var(--fs-teal)', 'var(--fs-warning)', '#ec4899', 'var(--fs-success)']

// ─── Utilitários ──────────────────────────────────────────────────────────────
const fC = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '—'
  const n = Number(v), a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a >= 1e6) return `${s}R$\u00a0${(a/1e6).toFixed(2)}M`
  if (a >= 1e3) return `${s}R$\u00a0${(a/1e3).toFixed(1)}k`
  return `${s}R$\u00a0${a.toFixed(0)}`
}

const pad2 = (n) => String(n).padStart(2,'0')

// Formata YYYY-MM-DD → DD/MM/AAAA
const fDate = (iso) => {
  if (!iso) return ''
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Último dia do mês
const lastDay = (year, month) => new Date(year, month + 1, 0).getDate()

// ─── Sparkline ────────────────────────────────────────────────────────────────
const Spark = ({ data, dataKey, color }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{top:2,right:2,bottom:2,left:2}}>
      <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={2} />
    </LineChart>
  </ResponsiveContainer>
)

// ─── KPI Card grande ──────────────────────────────────────────────────────────
const KCard = ({ label, value, pct, pctLabel, sparkData, sparkKey, sparkColor, isNegative, sub, hero }) => {
  const pctNum = pct !== undefined && pct !== null ? Number(pct) : null
  const pos = pctNum === null ? null : !isNegative ? pctNum >= 0 : pctNum <= 0
  return (
    <div style={{
      background: hero ? 'var(--fs-surface-2)' : 'var(--fs-surface)',
      border:'1px solid var(--fs-border)',
      borderTop: hero ? '2px solid var(--fs-brand)' : '1px solid var(--fs-border)',
      borderRadius:12, padding: hero ? '20px 24px' : '18px 20px',
      flex: hero ? 1.6 : 1, minWidth:0,
    }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
        <div style={{ flex:1 }}>
          <div className="fs-num" style={{ fontSize: hero ? 36 : 24, fontWeight: hero ? 800 : 750, fontFamily: hero ? 'var(--fs-font-display)' : undefined, color:'var(--fs-text-1)', lineHeight:1.1, marginBottom:6 }}>{value}</div>
          {pctNum !== null && (
            <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, fontWeight:700, color: pos ? 'var(--fs-success)' : 'var(--fs-danger)', display:'inline-flex', alignItems:'center', gap:4 }}>
                <SvgIcon name={pctNum >= 0 ? 'trendingUp' : 'trendingDown'} size={13} color="currentColor" />
                {Math.abs(pctNum).toFixed(1)}%
              </span>
              {pctLabel && <span style={{ fontSize:11, color:'var(--fs-text-4)' }}>{pctLabel}</span>}
            </div>
          )}
          {sub && <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:4 }}>{sub}</div>}
        </div>
        {sparkData && sparkData.length > 1 && (
          <div style={{ width: hero ? 130 : 84, height: hero ? 54 : 40, flexShrink:0 }}>
            <Spark data={sparkData} dataKey={sparkKey} color={sparkColor || 'var(--fs-brand)'} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── KPI Card secundário ──────────────────────────────────────────────────────
// Célula da faixa de indicadores secundários — uma única superfície com
// divisórias internas em vez de quatro cards idênticos
const SCard = ({ label, value, sub, color, first }) => (
  <div style={{ padding:'14px 20px', flex:1, minWidth:0, borderLeft: first ? 'none' : '1px solid var(--fs-border)' }}>
    <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:6 }}>{label}</div>
    <div className="fs-num" style={{ fontSize:19, fontWeight:750, color: color || 'var(--fs-text-1)', lineHeight:1.2 }}>{value}</div>
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
          <span>{p.name}</span><strong className="fs-num">{fC(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Botão de período rápido ──────────────────────────────────────────────────
const QuickBtn = ({ label, active, onClick, color }) => {
  const c = color === 'blue'
    ? { on:  { bg:'rgba(var(--fs-brand-rgb),0.20)',  text:'var(--fs-brand-text)',  border:'rgba(var(--fs-brand-rgb),0.45)'  },
        off: { bg:'rgba(var(--fs-brand-rgb),0.06)',  text:'var(--fs-text-4)', border:'rgba(var(--fs-brand-rgb),0.15)' } }
    : color === 'purple'
    ? { on:  { bg:'rgba(var(--fs-purple-rgb),0.20)', text:'var(--fs-purple)',  border:'rgba(var(--fs-purple-rgb),0.45)'  },
        off: { bg:'rgba(var(--fs-purple-rgb),0.06)', text:'var(--fs-text-4)', border:'rgba(var(--fs-purple-rgb),0.15)' } }
    : { on:  { bg:'rgba(20,184,166,0.20)', text:'#2dd4bf',  border:'rgba(20,184,166,0.45)'  },
        off: { bg:'rgba(20,184,166,0.06)', text:'var(--fs-text-4)', border:'rgba(20,184,166,0.15)' } }
  const s = active ? c.on : c.off
  return (
    <button onClick={onClick} style={{
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:700,
      cursor:'pointer', transition:'all 0.15s', outline:'none', lineHeight:'20px',
    }}>{label}</button>
  )
}

// ─── Seletor de período personalizado ────────────────────────────────────────
const CustomPeriodPicker = ({ value, onChange, onClose }) => {
  const [start, setStart] = useState(value.start)
  const [end,   setEnd]   = useState(value.end)
  const ref = useRef(null)

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const apply = () => {
    if (!start || !end || start > end) return
    onChange({ start, end })
    onClose()
  }

  const inputStyle = {
    background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8,
    color:'var(--fs-text-1)', fontSize:13, padding:'7px 10px', outline:'none',
    colorScheme:'dark', width:'100%',
  }
  const labelStyle = { fontSize:11, fontWeight:600, color:'var(--fs-text-4)', marginBottom:4, display:'block' }

  // Atalhos rápidos dentro do picker
  const now = new Date()
  const yr  = now.getFullYear()
  const mo  = now.getMonth()

  const shortcuts = [
    { label: 'Este mês',        s: `${yr}-${pad2(mo+1)}-01`,      e: now.toISOString().split('T')[0] },
    { label: 'Mês anterior',    s: `${yr}-${pad2(mo)}-01`,         e: `${yr}-${pad2(mo)}-${pad2(lastDay(yr,mo-1))}` },
    { label: '1º Trimestre',    s: `${yr}-01-01`,                  e: `${yr}-03-31` },
    { label: '2º Trimestre',    s: `${yr}-04-01`,                  e: `${yr}-06-30` },
    { label: '3º Trimestre',    s: `${yr}-07-01`,                  e: `${yr}-09-30` },
    { label: '4º Trimestre',    s: `${yr}-10-01`,                  e: `${yr}-12-31` },
    { label: '1º Semestre',     s: `${yr}-01-01`,                  e: `${yr}-06-30` },
    { label: '2º Semestre',     s: `${yr}-07-01`,                  e: `${yr}-12-31` },
    { label: 'Ano anterior',    s: `${yr-1}-01-01`,                e: `${yr-1}-12-31` },
    { label: 'Últimos 12 meses',s: `${yr-1}-${pad2(mo+1)}-01`,     e: now.toISOString().split('T')[0] },
  ]

  return (
    <div ref={ref} style={{
      position:'absolute', top:'calc(100% + 8px)', left:0, zIndex:200,
      background:'var(--fs-surface)', border:'1px solid var(--fs-border)',
      borderRadius:14, padding:20, width:340, boxShadow:'0 8px 32px rgba(0,0,0,0.35)',
    }}>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--fs-text-1)', marginBottom:14 }}>Período personalizado</div>

      {/* Inputs de data */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
        <div>
          <label style={labelStyle}>Data inicial</label>
          <input type="date" onClick={e => { try { e.target.showPicker() } catch(_) {} }} value={start} onChange={e => setStart(e.target.value)} style={inputStyle} max={end} />
        </div>
        <div>
          <label style={labelStyle}>Data final</label>
          <input type="date" onClick={e => { try { e.target.showPicker() } catch(_) {} }} value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} min={start} />
        </div>
      </div>

      {/* Atalhos */}
      <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:8 }}>Atalhos</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
        {shortcuts.map((sh,i) => (
          <button key={i} onClick={() => { setStart(sh.s); setEnd(sh.e) }} style={{
            background: start===sh.s && end===sh.e ? 'rgba(var(--fs-brand-rgb),0.18)' : 'var(--fs-bg)',
            border: start===sh.s && end===sh.e ? '1px solid rgba(var(--fs-brand-rgb),0.4)' : '1px solid var(--fs-border)',
            color: start===sh.s && end===sh.e ? 'var(--fs-brand-text)' : 'var(--fs-text-3)',
            borderRadius:6, padding:'4px 9px', fontSize:11, cursor:'pointer', fontWeight:600,
            transition:'all 0.12s',
          }}>{sh.label}</button>
        ))}
      </div>

      {/* Ações */}
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onClose} style={{
          background:'transparent', border:'1px solid var(--fs-border)', color:'var(--fs-text-3)',
          borderRadius:8, padding:'7px 16px', fontSize:12, fontWeight:600, cursor:'pointer',
        }}>Cancelar</button>
        <button onClick={apply} disabled={!start || !end || start > end} style={{
          background: (!start || !end || start > end) ? 'rgba(var(--fs-brand-rgb),0.3)' : 'var(--fs-brand)',
          border:'none', color:'#fff', borderRadius:8, padding:'7px 16px',
          fontSize:12, fontWeight:700, cursor: (!start||!end||start>end) ? 'not-allowed' : 'pointer',
          transition:'background 0.15s',
        }}>Aplicar</button>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function OverviewPage() {
  const now      = new Date()
  const curYear  = now.getFullYear()
  const curMonth = now.getMonth()
  const today    = now.toISOString().split('T')[0]

  // Modo: 'mes' | 'ytd' | 'custom'
  const [modo,         setModo]         = useState('ytd')
  const [customRange,  setCustomRange]  = useState({ start: `${curYear}-01-01`, end: today })
  const [pickerOpen,   setPickerOpen]   = useState(false)

  const [loading,   setLoading]   = useState(true)
  const [firstLoad, setFirstLoad] = useState(true)
  const [empresaId, setEmpresaId] = useState(null)
  const [isConsol,  setIsConsol]  = useState(false)
  const [empNome,   setEmpNome]   = useState('')

  const [kpis,     setKpis]     = useState(null)
  const [monthly,  setMonthly]  = useState([])
  const [fcMensal, setFcMensal] = useState([])
  const [recComp,  setRecComp]  = useState([])
  const [recentes, setRecentes] = useState([])

  // ─── Calcular intervalo de datas ─────────────────────────────────────────
  const getRange = useCallback(() => {
    if (modo === 'mes') {
      const mm = pad2(curMonth + 1)
      const ld = pad2(lastDay(curYear, curMonth))
      const prevYear = curMonth === 0 ? curYear - 1 : curYear
      const prevMm   = curMonth === 0 ? '12' : pad2(curMonth)
      const prevLd   = pad2(lastDay(prevYear, curMonth === 0 ? 11 : curMonth - 1))
      return {
        start:     `${curYear}-${mm}-01`,
        end:       today,
        prevStart: `${prevYear}-${prevMm}-01`,
        prevEnd:   `${prevYear}-${prevMm}-${prevLd}`,
        label:     `01/${mm}/${curYear} → ${fDate(today)}`,
        subLabel:  `${MESES[curMonth]} ${curYear}`,
        nMonths:   1,
      }
    }
    if (modo === 'ytd') {
      return {
        start:     `${curYear}-01-01`,
        end:       today,
        prevStart: `${curYear-1}-01-01`,
        prevEnd:   `${curYear-1}-12-31`,
        label:     `01/01/${curYear} → ${fDate(today)} · vs ano anterior`,
        subLabel:  `YTD ${curYear}`,
        nMonths:   curMonth + 1,
      }
    }
    // custom
    const { start, end } = customRange
    const s = new Date(start + 'T00:00:00')
    const e = new Date(end   + 'T00:00:00')
    const diasCur  = Math.max(1, (e - s) / 86400000 + 1)
    const prevEnd  = new Date(s - 86400000)
    const prevStart= new Date(prevEnd - diasCur * 86400000 + 86400000)
    const nMonths  = Math.max(1, Math.round(diasCur / 30.44))
    return {
      start,
      end,
      prevStart: prevStart.toISOString().split('T')[0],
      prevEnd:   prevEnd.toISOString().split('T')[0],
      label:     `${fDate(start)} → ${fDate(end)}`,
      subLabel:  `${fDate(start)} – ${fDate(end)}`,
      nMonths,
    }
  }, [modo, customRange, curYear, curMonth, today])

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
      const dr = getRange()

      let empIds = await getSelectedEntidadeIds()
      if (isConsol || empIds.length > 1) {
        setEmpNome('')
      } else if (empIds.length === 1) {
        const { data: e } = await supabase.from('empresas').select('nome').eq('id', empIds[0]).single()
        setEmpNome(e?.nome || '')
      }
      if (!empIds.length) { setLoading(false); return }

      const next30    = new Date(); next30.setDate(next30.getDate() + 30)
      const next30str = next30.toISOString().split('T')[0]
      const buildQ = (table, cols) => {
        let q = supabase.from(table).select(cols)
        return isConsol ? q.in('empresa_id', empIds) : q.eq('empresa_id', empresaId)
      }

      // fetchAll: Supabase corta em 1000 linhas/request — a FACE sozinha já
      // ultrapassa esse limite, o que distorcia KPIs e gráficos
      const [curLanc, prevLanc, fcAll, fcAnterior, planoContas, cfgRows] = await Promise.all([
        fetchAll(buildQ('lancamentos', 'id,tipo,valor,data,descricao,categoria,conta_id')
          .gte('data', dr.start).lte('data', dr.end)),
        fetchAll(buildQ('lancamentos', 'tipo,valor,data')
          .gte('data', dr.prevStart).lte('data', dr.prevEnd)),
        fetchAll(buildQ('fluxo_caixa', 'id,tipo,valor,data,descricao,status,valor_liquidado,data_liquidacao')
          .or(`and(data.gte.${dr.start},data.lte.${dr.end}),and(data_liquidacao.gte.${dr.start},data_liquidacao.lte.${dr.end})`)
          .order('data')),
        // Movimentos ANTERIORES ao período — compõem o saldo de partida
        fetchAll(buildQ('fluxo_caixa', 'tipo,valor,data,status,valor_liquidado,data_liquidacao')
          .or(`data.lt.${dr.start},data_liquidacao.lt.${dr.start}`)),
        fetchAll(supabase.from('plano_contas').select('id,nome,tipo,codigo')
          .eq('empresa_id', isConsol ? empIds[0] : empresaId)),
        // Saldo inicial configurado (soma das entidades selecionadas)
        fetchAll(supabase.from('empresa_config').select('valor')
          .eq('chave', 'saldo_inicial')
          .in('empresa_id', isConsol ? empIds : [empresaId])),
      ])

      const ENTRADA_TIPOS = ['entrada','fluxo_entrada','receita','receita_financeira']
      const saldoInicial = (cfgRows || []).reduce((a, r) => a + (Number(r.valor) || 0), 0)
      // CAIXA EFETIVO: só efeitos (liquidações/vencimentos válidos) < início
      const netAnterior  = (fcAnterior || []).reduce((a, f) => {
        let s0 = 0
        efeitosCaixa(f).forEach(e => { if (e.data < dr.start) s0 += e.valor })
        return a + (ENTRADA_TIPOS.includes(f.tipo) ? s0 : -s0)
      }, 0)
      const saldoBase = saldoInicial + netAnterior

      const planMap = Object.fromEntries((planoContas||[]).map(p=>[p.id,p.nome]))
      const vCur    = calcDRE(curLanc  || [])
      const vPrev   = calcDRE(prevLanc || [])

      // ── Evolução mensal por mês dentro do intervalo ───────────────────────
      const byMonth = {}
      ;(curLanc||[]).forEach(l => {
        const m = new Date(l.data+'T00:00:00').getMonth()
        if (!byMonth[m]) byMonth[m] = []
        byMonth[m].push(l)
      })

      // Meses presentes no intervalo
      const startMo = new Date(dr.start+'T00:00:00').getMonth()
      const endMo   = new Date(dr.end  +'T00:00:00').getMonth()
      const startYr = new Date(dr.start+'T00:00:00').getFullYear()
      const endYr   = new Date(dr.end  +'T00:00:00').getFullYear()
      let   monthRange = []
      if (startYr === endYr) {
        monthRange = Array.from({ length: endMo - startMo + 1 }, (_,i) => startMo + i)
      } else {
        // multi-ano: simplifica mostrando os últimos 12 meses
        monthRange = Array.from({ length: 12 }, (_,i) => i)
      }

      const monthData = monthRange.map(i => {
        const v = calcDRE(byMonth[i] || [])
        return { name: MESES[i], receita: v.rb, rl: v.rl, ebitda: v.ebt, resLiq: v.resL }
      })
      setMonthly(monthData)

      // ── Fluxo de Caixa ────────────────────────────────────────────────────
      // CAIXA EFETIVO: liquidado na data efetiva; a vencer pelo vencimento;
      // vencidos não liquidados fora
      const fcByMonth = {}
      ;(fcAll||[]).forEach(f => {
        efeitosCaixa(f).forEach(e => {
          if (e.data < dr.start || e.data > dr.end) return
          const m = new Date(e.data+'T00:00:00').getMonth()
          if (!fcByMonth[m]) fcByMonth[m] = { entradas:0, saidas:0 }
          if (ENTRADA_TIPOS.includes(f.tipo)) fcByMonth[m].entradas += e.valor
          else fcByMonth[m].saidas += e.valor
        })
      })
      // Saldo acumulado REAL: parte do saldo inicial + histórico anterior e
      // preserva valores negativos — truncar em zero mascara ruptura de caixa
      let saldo = saldoBase
      const temFluxo = (fcAll || []).length > 0
      const fcChart = monthRange.map(i => {
        if (!temFluxo) {
          // fallback: aproxima pelo regime de competência (lançamentos)
          const saidas = (byMonth[i]||[]).filter(l=>['custo','despesa','despesa_financeira','deducao'].includes(l.tipo)).reduce((a,l)=>a+Number(l.valor),0)
          const entradas = (byMonth[i]||[]).filter(l=>l.tipo==='receita').reduce((a,l)=>a+Number(l.valor),0)
          saldo += entradas - saidas
          return { name:MESES[i], entradas, saidas, saldo }
        }
        const fc = fcByMonth[i] || { entradas:0, saidas:0 }
        saldo += fc.entradas - fc.saidas
        return { name:MESES[i], entradas:fc.entradas, saidas:fc.saidas, saldo }
      })
      setFcMensal(fcChart)

      // ── Composição da Receita ─────────────────────────────────────────────
      const recMap = {}
      ;(curLanc||[]).filter(l=>l.tipo==='receita').forEach(l => {
        const cat = planMap[l.conta_id] || l.categoria || l.descricao?.substring(0,25) || 'Receita Geral'
        recMap[cat] = (recMap[cat]||0) + Number(l.valor)
      })
      const sortedRec = Object.entries(recMap).sort((a,b)=>b[1]-a[1])
      const top3Rec   = sortedRec.slice(0,3)
      const outrosRec = sortedRec.slice(3).reduce((a,[,v])=>a+v,0)
      const totalRec  = sortedRec.reduce((a,[,v])=>a+v,0)
      setRecComp([
        ...top3Rec.map(([name,value])=>({ name:name.substring(0,22), value, pct:totalRec>0?Math.round(value/totalRec*100):0 })),
        ...(outrosRec>0?[{ name:'Outros', value:outrosRec, pct:Math.round(outrosRec/totalRec*100) }]:[])
      ])

      // ── Variação vs período anterior ──────────────────────────────────────
      const diasCur  = Math.max(1, (new Date(dr.end)-new Date(dr.start))/86400000+1)
      const diasPrev = Math.max(1, (new Date(dr.prevEnd)-new Date(dr.prevStart))/86400000+1)
      const scale    = diasCur / diasPrev
      const rlPrev_p  = vPrev.rl  * scale
      const ebtPrev_p = vPrev.ebt * scale
      const margPrev  = rlPrev_p>0?(vPrev.resL*scale)/rlPrev_p*100:0
      const rlPct   = rlPrev_p>0.01  ? (vCur.rl -rlPrev_p)/rlPrev_p*100   : null
      const ebtPct  = ebtPrev_p>0.01 ? (vCur.ebt-ebtPrev_p)/ebtPrev_p*100 : null
      const margCur = vCur.rb>0 ? vCur.resL/vCur.rb*100 : 0
      const margDiff = margPrev!==0 ? margCur-margPrev : null

      // ── Métricas auxiliares ───────────────────────────────────────────────
      const burnRate = (vCur.cv + vCur.df) / dr.nMonths
      const caixa    = fcChart.length>0 ? fcChart[fcChart.length-1].saldo : (vCur.rb-vCur.cv-vCur.df)
      const runway   = (burnRate>0 && caixa>0) ? caixa/burnRate : null
      const fc30     = (fcAll||[]).filter(f=>f.data>today&&f.data<=next30str)
      const aReceber = fc30.filter(f=>['entrada','fluxo_entrada','receita'].includes(f.tipo)).reduce((a,f)=>a+Math.abs(Number(f.valor)||0),0)
      const aPagar   = fc30.filter(f=>['saida','fluxo_saida','despesa','custo'].includes(f.tipo)).reduce((a,f)=>a+Math.abs(Number(f.valor)||0),0)

      // Variação Receita Bruta vs período anterior
      const rbPrev_p = vPrev.rb * scale
      const rbPct    = rbPrev_p > 0.01 ? (vCur.rb - rbPrev_p) / rbPrev_p * 100 : null
      setKpis({ rb:vCur.rb, rbPct, rl:vCur.rl, rlPct, ebt:vCur.ebt, ebtPct, marg:margCur, margDiff, caixa, aReceber, aPagar, burnRate, runway })

      // ── Lançamentos recentes ──────────────────────────────────────────────
      const rec = [...(curLanc||[])].sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,6)
      setRecentes(rec.map(l=>({ desc:(l.descricao||l.categoria||'Lançamento').substring(0,28), tipo:l.tipo, valor:Number(l.valor), data:l.data })))

    } catch(e) { console.error('Overview:', e) }
    finally { setLoading(false); setFirstLoad(false) }
  }, [empresaId, isConsol, getRange, today])

  useEffect(() => {
    if (empresaId === null) return
    // Debounce: aguarda 500ms sem novas mudanças antes de buscar.
    // Evita recarregar a cada clique ao navegar por meses/datas rapidamente.
    const t = setTimeout(() => { load() }, firstLoad ? 0 : 500)
    return () => clearTimeout(t)
  }, [load, empresaId, firstLoad])

  const tipoColor = { receita:'var(--fs-success)', custo:'var(--fs-danger)', despesa:'var(--fs-warning)', deducao:'#f97316', receita_financeira:'var(--fs-teal)', despesa_financeira:'var(--fs-purple)', investimento:'#64748b' }
  const dr = getRange()

  if (!empresaId) return (
    <EmptyState icon="building" title="Nenhuma entidade selecionada">
      Escolha uma entidade do grupo no seletor do menu lateral para carregar os indicadores.
    </EmptyState>
  )

  return (
    <div style={{ color:'var(--fs-text-1)', width:'100%' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11, color:'var(--fs-text-4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:6 }}>
          {empNome || 'Consolidado'} · {dr.subLabel}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <h1 style={{ fontSize:30, fontWeight:800, color:'var(--fs-text-1)', margin:0 }}>Overview</h1>

          {/* Botão mês corrente */}
          <QuickBtn
            label={`${MESES[curMonth]} ${String(curYear).slice(2)}`}
            active={modo === 'mes'}
            color="blue"
            onClick={() => { setModo('mes'); setPickerOpen(false) }}
          />

          {/* Botão YTD */}
          <QuickBtn
            label="YTD"
            active={modo === 'ytd'}
            color="purple"
            onClick={() => { setModo('ytd'); setPickerOpen(false) }}
          />

          {/* Botão Personalizado com picker */}
          <div style={{ position:'relative' }}>
            <QuickBtn
              label={modo === 'custom' ? `${fDate(customRange.start)} – ${fDate(customRange.end)}` : 'Personalizado'}
              active={modo === 'custom'}
              color="teal"
              onClick={() => setPickerOpen(p => !p)}
            />
            {pickerOpen && (
              <CustomPeriodPicker
                value={customRange}
                onChange={(range) => { setCustomRange(range); setModo('custom') }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        </div>

      </div>

      {firstLoad ? (
        <><KpiCardsSkeleton count={4} /><ChartSkeleton height={320} /></>
      ) : !kpis ? (
        <div style={{ textAlign:'center', padding:80, color:'var(--fs-text-4)' }}>Sem dados para exibir.</div>
      ) : (
        <>
          {/* ── KPIs principais ─────────────────────────────────────────────── */}
          <div style={{ display:'flex', gap:12, marginBottom:12, flexWrap:'wrap' }}>
            <KCard hero label={`Receita Bruta · ${dr.subLabel}`} value={fC(kpis.rb)} pct={kpis.rbPct} pctLabel="vs período anterior" sparkData={monthly} sparkKey="receita" sparkColor="var(--fs-success)" sub={kpis.rl !== kpis.rb ? `Rec. Líquida: ${fC(kpis.rl)}` : null} />
            <KCard label="EBITDA"          value={fC(kpis.ebt)}                   pct={kpis.ebtPct} pctLabel="vs período anterior" sparkData={monthly} sparkKey="ebitda" sparkColor="var(--fs-brand)" />
            <KCard label="Margem Líquida"  value={`${kpis.marg.toFixed(1)}%`}     pct={kpis.margDiff} pctLabel="p.p. vs anterior"  sparkData={monthly} sparkKey="resLiq" sparkColor="var(--fs-purple)" />
            <KCard label="Caixa Disponível" value={fC(kpis.caixa)} pct={null} sparkData={fcMensal} sparkKey="saldo" sparkColor="var(--fs-warning)" />
          </div>

          {/* ── KPIs secundários ────────────────────────────────────────────── */}
          <div style={{ display:'flex', marginBottom:20, background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, overflow:'hidden', flexWrap:'wrap' }}>
            <SCard first label="A Receber · 30 Dias" value={kpis.aReceber>0?fC(kpis.aReceber):'—'} color="var(--fs-success)" />
            <SCard label="A Pagar · 30 Dias"   value={kpis.aPagar>0?fC(kpis.aPagar):'—'}     color="var(--fs-danger)" />
            <SCard label="Burn Rate Mensal"     value={fC(kpis.burnRate)} sub="custos + despesas / mês" />
            <SCard label="Runway"               value={kpis.runway?`${kpis.runway.toFixed(1)} meses`:'—'} sub="caixa ÷ burn rate" />
          </div>

          {/* ── Gráficos linha 1 ────────────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:12, marginBottom:12 }}>
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Fluxo de Caixa</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:16 }}>Entradas, saídas e saldo acumulado</div>
              {fcMensal.length>0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={fcMensal} margin={{top:4,right:8,left:0,bottom:4}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:11}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} tickFormatter={fC} width={62} />
                    <Tooltip content={<TT cursor={false} />} cursor={false} />
                    <Legend iconType="circle" wrapperStyle={{fontSize:11,paddingTop:8}} />
                    <Bar dataKey="entradas" fill="var(--fs-brand)" radius={[3,3,0,0]} name="Entradas" barSize={12} />
                    <Bar dataKey="saidas"   fill="rgba(var(--fs-danger-rgb),0.6)" radius={[3,3,0,0]} name="Saídas" barSize={12} />
                    <Line type="monotone" dataKey="saldo" stroke="var(--fs-purple)" strokeWidth={2.5} dot={{r:3,fill:'var(--fs-purple)'}} name="Saldo" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <div style={{textAlign:'center',padding:40,color:'var(--fs-text-4)',fontSize:13}}>Sem dados de fluxo de caixa</div>}
            </div>

            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Composição da Receita</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:8 }}>Por conta/categoria</div>
              {recComp.length>0 ? (
                <>
                  <div style={{ position:'relative' }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={recComp} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={2}>
                          {recComp.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={fC} wrapperStyle={{zIndex:60}} allowEscapeViewBox={{x:true,y:true}} offset={18}
                          contentStyle={{background:'var(--fs-surface-3)',border:'1px solid var(--fs-border-2)',borderRadius:8,fontSize:12,whiteSpace:'nowrap',boxShadow:'var(--fs-shadow-md)'}}
                          itemStyle={{color:'var(--fs-text-1)'}} labelStyle={{color:'var(--fs-text-2)'}} cursor={false} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
                      <div style={{ fontSize:9, color:'var(--fs-text-4)', textTransform:'uppercase' }}>TOTAL</div>
                      <div style={{ fontSize:13, fontWeight:800, color:'var(--fs-text-1)' }} className="fs-num">{fC(recComp.reduce((a,r)=>a+r.value,0))}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:7, marginTop:4 }}>
                    {recComp.map((r,i)=>(
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

          {/* ── Gráficos linha 2 ────────────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:12 }}>
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Demonstrativo Mensal</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:16 }}>Receita vs EBITDA · {dr.subLabel}</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthly} margin={{top:4,right:8,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} tickFormatter={fC} width={62} />
                  <Tooltip content={<TT cursor={false} />} cursor={false} />
                  <Legend iconType="circle" wrapperStyle={{fontSize:11,paddingTop:8}} />
                  <Bar dataKey="receita" fill="var(--fs-success)" name="Receita Bruta" radius={[3,3,0,0]} barSize={14} />
                  <Bar dataKey="ebitda"  fill="var(--fs-brand)" name="EBITDA"        radius={[3,3,0,0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Atividade</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:14 }}>Lançamentos recentes</div>
              {recentes.length===0 ? (
                <div style={{ textAlign:'center', padding:'30px 0', color:'var(--fs-text-4)', fontSize:13 }}>Nenhum lançamento</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {recentes.map((r,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:7,height:7,borderRadius:'50%',background:tipoColor[r.tipo]||'#64748b',flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, color:'var(--fs-text-1)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.desc}</div>
                        <div style={{ fontSize:11, color:'var(--fs-text-4)', display:'flex', gap:6 }}>
                          <span>{r.data}</span><span>·</span><span style={{ textTransform:'capitalize' }}>{r.tipo}</span>
                        </div>
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:tipoColor[r.tipo]||'var(--fs-text-2)', flexShrink:0 }} className="fs-num">{fC(r.valor)}</div>
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
