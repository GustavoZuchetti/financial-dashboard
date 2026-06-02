'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import SvgIcon from '@/components/SvgIcon'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'

// ─── Constantes ───────────────────────────────────────────────────────────────
const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const fDias = (v) => {
  if (!v && v !== 0) return '—'
  return `${Math.round(Number(v))} dias`
}
const fC = (v) => {
  if (!v && v !== 0) return '—'
  const a = Math.abs(v)
  if (a >= 1e6) return `R$\u00a0${(a/1e6).toFixed(2)}M`
  if (a >= 1e3) return `R$\u00a0${(a/1e3).toFixed(1)}k`
  return `R$\u00a0${a.toFixed(0)}`
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────
const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const isDark = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-theme') !== 'light' : true
  return (
    <div style={{ background: isDark ? '#1e2433' : '#fff', border:'1px solid var(--fs-border)', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
      <div style={{ fontWeight:700, color:'var(--fs-text-1)', marginBottom:5 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color, display:'flex', justifyContent:'space-between', gap:16, marginBottom:2 }}>
          <span>{p.name}</span>
          <strong>{Math.round(p.value)} dias</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Card KPI ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, sigla, valor, descricao, cor, aviso, hint }) => {
  const v = Math.round(Number(valor) || 0)
  return (
    <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'18px 20px', borderLeft:`3px solid ${cor}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px' }}>{label}</div>
          <div style={{ fontSize:11, fontWeight:600, color:cor, marginTop:2 }}>{sigla}</div>
        </div>
        {aviso && (
          <span style={{ fontSize:10, fontWeight:700, background:`${cor}22`, color:cor, border:`1px solid ${cor}44`, padding:'2px 8px', borderRadius:20 }}>
            {aviso}
          </span>
        )}
      </div>
      <div style={{ fontSize:32, fontWeight:900, color:'var(--fs-text-1)', lineHeight:1, marginBottom:4 }}>
        {v > 0 ? fDias(v) : <span style={{ fontSize:18, color:'var(--fs-text-4)' }}>Sem dados</span>}
      </div>
      {descricao && <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:4 }}>{descricao}</div>}
      {hint && v > 0 && <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:2, fontStyle:'italic' }}>{hint}</div>}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CicloFinanceiroPage() {
  const now = new Date()
  const curYear  = now.getFullYear()
  const curMonth = now.getMonth() + 1

  const [empresaId, setEmpresaId] = useState(null)
  const [empNome,   setEmpNome]   = useState('')
  const [loading,     setLoading]     = useState(true)
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [recalcMsg,     setRecalcMsg]     = useState(null)

  // Filtro de período
  const [anoSel,  setAnoSel]  = useState(curYear)
  const [mesSel,  setMesSel]  = useState(curMonth)
  const [mesesHist, setMesesHist] = useState(6)

  // Dados
  const [cicloAtual, setCicloAtual] = useState(null)   // {pmr, pmp, pme, ano, mes}
  const [historico,  setHistorico]  = useState([])     // array de meses
  const [fcMes,      setFcMes]      = useState(null)   // entradas/saídas do mês selecionado

  useEffect(() => {
    const id = localStorage.getItem('empresa_id') || ''
    setEmpresaId(id)
    const h = () => setEmpresaId(localStorage.getItem('empresa_id')||'')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const load = useCallback(async () => {
    if (!empresaId || empresaId === 'todas') { setLoading(false); return }
    setLoading(true)
    try {
      // Nome da empresa
      const { data: emp } = await supabase.from('empresas').select('nome').eq('id', empresaId).single()
      setEmpNome(emp?.nome || '')

      // Mês selecionado — buscar na tabela ciclo_financeiro
      const { data: atual } = await supabase.from('ciclo_financeiro')
        .select('*').eq('empresa_id', empresaId).eq('ano', anoSel).eq('mes', mesSel).single()
      setCicloAtual(atual || null)

      // Histórico dos últimos N meses
      const hist = []
      for (let i = mesesHist - 1; i >= 0; i--) {
        let m = mesSel - i, a = anoSel
        if (m <= 0) { m += 12; a -= 1 }
        hist.push({ ano: a, mes: m })
      }

      const { data: histData = [] } = await supabase.from('ciclo_financeiro')
        .select('ano,mes,pmr,pmp,pme')
        .eq('empresa_id', empresaId)
        .in('ano', [...new Set(hist.map(h=>h.ano))])
        .order('ano').order('mes')

      // Montar série histórica com todos os meses (mesmo sem dado)
      const histMapped = hist.map(({ ano, mes }) => {
        const found = (histData||[]).find(d => d.ano === ano && d.mes === mes)
        const pmr = Number(found?.pmr || 0)
        const pmp = Number(found?.pmp || 0)
        const pme = Number(found?.pme || 0)
        const co  = pmr + pme
        const cf  = co  - pmp
        return {
          name:    `${MESES_LABEL[mes-1]}/${String(ano).slice(2)}`,
          pmr:     Math.round(pmr),
          pmp:     Math.round(pmp),
          pme:     Math.round(pme),
          cicloOp: Math.round(co),
          cicloCF: Math.round(cf),
          temDado: !!found,
        }
      })
      setHistorico(histMapped)

      // Fluxo de caixa do mês selecionado para contexto financeiro
      const mesStart = `${anoSel}-${String(mesSel).padStart(2,'0')}-01`
      const mesEnd   = new Date(anoSel, mesSel, 0).toISOString().split('T')[0]
      const { data: fc = [] } = await supabase.from('fluxo_caixa')
        .select('tipo,valor,data')
        .eq('empresa_id', empresaId)
        .gte('data', mesStart).lte('data', mesEnd)

      const entradas = (fc||[]).filter(f=>f.tipo==='entrada').reduce((a,c)=>a+Number(c.valor),0)
      const saidas   = (fc||[]).filter(f=>f.tipo==='saida').reduce((a,c)=>a+Number(c.valor),0)
      const cntE = (fc||[]).filter(f=>f.tipo==='entrada').length
      const cntS = (fc||[]).filter(f=>f.tipo==='saida').length
      setFcMes({ entradas, saidas, cntE, cntS, total: fc?.length || 0 })

    } catch(e) { console.error('CicloFinanceiro:', e) }
    finally { setLoading(false) }
  }, [empresaId, anoSel, mesSel, mesesHist])

  const recalcular = async () => {
    if (!empresaId || empresaId === 'todas') return
    setRecalcLoading(true)
    setRecalcMsg(null)
    try {
      // Usa a API route com Service Role (bypassa RLS) — resolve o erro de policy
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/recalcular-ciclo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ empresa_id: empresaId }),
      })
      const json = await res.json()
      if (!res.ok) { setRecalcMsg(`Erro: ${json.error}`); return }
      setRecalcMsg(`✓ ${json.meses} meses recalculados (${json.total} lançamentos)`)
      await load()
    } catch(e) { setRecalcMsg('Erro: ' + e.message) }
    finally { setRecalcLoading(false) }
  }

  useEffect(() => { if (empresaId) load() }, [load, empresaId])

  // Derivados
  const pmr = Math.round(Number(cicloAtual?.pmr || 0))
  const pmp = Math.round(Number(cicloAtual?.pmp || 0))
  const pme = Math.round(Number(cicloAtual?.pme || 0))
  const co  = pmr + pme           // Ciclo Operacional
  const cf  = co  - pmp           // Ciclo Financeiro (CCL)

  // Anos disponíveis para seleção
  const anosDisp = Array.from({ length: 4 }, (_, i) => curYear - i)
  const IS = { background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'6px 10px', fontSize:12, outline:'none', colorScheme:'dark' }

  const semDados = !cicloAtual || (pmr === 0 && pmp === 0)

  return (
    <div style={{ color:'var(--fs-text-1)', width:'100%' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 }}>
            {empNome || 'Empresa'} · Liquidez Operacional
          </div>
          <h1 style={{ fontSize:28, fontWeight:900, margin:0 }}>Ciclo Financeiro</h1>
          <div style={{ fontSize:12, color:'var(--fs-text-4)', marginTop:4 }}>
            Prazos médios de recebimento, pagamento e estoque derivados do Fluxo de Caixa
          </div>
        </div>

        {/* Controles de período */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <select value={mesSel} onChange={e=>setMesSel(Number(e.target.value))} style={IS}>
            {MESES_LABEL.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={anoSel} onChange={e=>setAnoSel(Number(e.target.value))} style={IS}>
            {anosDisp.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button
            onClick={recalcular}
            disabled={recalcLoading}
            style={{ background: recalcLoading ? 'rgba(59,130,246,0.4)' : '#3b82f6', border:'none', color:'#fff', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor: recalcLoading ? 'default' : 'pointer', whiteSpace:'nowrap' }}
          >
            {recalcLoading ? 'Recalculando...' : <><SvgIcon name="refresh" size={13} color="currentColor" style={{marginRight:6}} />Recalcular</>}
          </button>
          <select value={mesesHist} onChange={e=>setMesesHist(Number(e.target.value))} style={IS}>
            {[3,6,12].map(n => <option key={n} value={n}>Histórico: {n}m</option>)}
          </select>
        </div>
      </div>

      {/* Feedback do recalculo */}
      {recalcMsg && (
        <div style={{ background: recalcMsg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border:`1px solid ${recalcMsg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius:8, padding:'10px 16px', marginBottom:12, fontSize:13, fontWeight:600, color: recalcMsg.startsWith('✓') ? '#22c55e' : '#ef4444', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {recalcMsg}
          <button onClick={()=>setRecalcMsg(null)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'inherit', fontSize:16 }}>✕</button>
        </div>
      )}

      {/* ── Aviso sem dados ─────────────────────────────────────────────────── */}
      {semDados && !loading && (
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:10, padding:'12px 18px', marginBottom:20, fontSize:13, color:'#f59e0b' }}>
          Nenhum dado de ciclo financeiro para <strong>{MESES_LABEL[mesSel-1]}/{anoSel}</strong>.
          Os dados são gerados automaticamente ao importar o Fluxo de Caixa em{' '}
          <strong>Importação → Fluxo de Caixa</strong>.
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--fs-text-4)', fontSize:14 }}>Calculando ciclos...</div>
      ) : (
        <>
          {/* ── KPIs principais ─────────────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginBottom:20 }}>
            <KpiCard
              label="Prazo Médio de Recebimento" sigla="PMR"
              valor={pmr} cor="#3b82f6"
              descricao="Tempo médio entre emissão e recebimento"
              hint={pmr > 0 ? `${fC(fcMes?.entradas)} em ${fcMes?.cntE || 0} recebimentos` : null}
              aviso={pmr > 45 ? 'Elevado' : pmr > 0 ? 'Ok' : null}
            />
            <KpiCard
              label="Prazo Médio de Pagamento" sigla="PMP"
              valor={pmp} cor="#22c55e"
              descricao="Tempo médio entre compra e pagamento"
              hint={pmp > 0 ? `${fC(fcMes?.saidas)} em ${fcMes?.cntS || 0} pagamentos` : null}
              aviso={pmp < 20 ? 'Curto' : pmp > 0 ? 'Ok' : null}
            />
            <KpiCard
              label="Prazo Médio de Estoque" sigla="PME"
              valor={pme} cor="#8b5cf6"
              descricao="Dias médios de permanência em estoque"
              aviso={pme > 60 ? 'Alto' : pme > 0 ? 'Ok' : null}
            />
            <KpiCard
              label="Ciclo Operacional" sigla="CO = PMR + PME"
              valor={co} cor="#f59e0b"
              descricao="Tempo desde a compra até o recebimento"
              aviso={co > 90 ? 'Longo' : co > 0 ? 'Ok' : null}
            />
            <KpiCard
              label="Ciclo Financeiro" sigla="CF = CO − PMP"
              valor={Math.abs(cf)} cor={cf <= 0 ? '#22c55e' : '#ef4444'}
              descricao={cf <= 0 ? 'Caixa positivo: recebe antes de pagar' : 'Necessidade de capital de giro'}
              aviso={cf <= 0 ? 'Favorável' : 'Atenção'}
            />
          </div>

          {/* ── Equação visual do ciclo ──────────────────────────────────────── */}
          {co > 0 && (
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'18px 22px', marginBottom:20 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12 }}>
                Equação do Ciclo — {MESES_LABEL[mesSel-1]}/{anoSel}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                {[
                  { label:'PMR', valor:pmr, cor:'#3b82f6' },
                  { op:'+' },
                  { label:'PME', valor:pme, cor:'#8b5cf6' },
                  { op:'=' },
                  { label:'C. Operacional', valor:co, cor:'#f59e0b' },
                  { op:'−' },
                  { label:'PMP', valor:pmp, cor:'#22c55e' },
                  { op:'=' },
                  { label:'C. Financeiro', valor:cf, cor: cf <= 0 ? '#22c55e' : '#ef4444' },
                ].map((item, i) => item.op ? (
                  <div key={i} style={{ fontSize:20, fontWeight:800, color:'var(--fs-text-4)' }}>{item.op}</div>
                ) : (
                  <div key={i} style={{ background:`${item.cor}15`, border:`1px solid ${item.cor}44`, borderRadius:10, padding:'10px 16px', textAlign:'center', minWidth:90 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:item.cor, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{item.label}</div>
                    <div style={{ fontSize:22, fontWeight:900, color:'var(--fs-text-1)' }}>{Math.abs(item.valor)}d</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Gráficos ────────────────────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:16, marginBottom:16 }}>

            {/* Histórico PMR vs PMP */}
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Evolução Histórica</div>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--fs-text-1)', marginBottom:16 }}>PMR vs PMP — últimos {mesesHist} meses</div>
              {historico.some(h => h.pmr > 0 || h.pmp > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={historico} margin={{top:4,right:8,left:0,bottom:4}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:11}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} tickFormatter={v=>v+'d'} width={38} />
                    <Tooltip content={<TT />} cursor={false} />
                    <Legend iconType="circle" wrapperStyle={{fontSize:11,paddingTop:8}} />
                    <Line type="monotone" dataKey="pmr" stroke="#3b82f6" strokeWidth={2.5} dot={{r:4}} name="PMR" connectNulls />
                    <Line type="monotone" dataKey="pmp" stroke="#22c55e" strokeWidth={2.5} dot={{r:4}} name="PMP" connectNulls />
                    <Line type="monotone" dataKey="pme" stroke="#8b5cf6" strokeWidth={2} dot={{r:3}} strokeDasharray="4 3" name="PME" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{textAlign:'center',padding:40,color:'var(--fs-text-4)',fontSize:13}}>
                  Sem histórico disponível. Importe o Fluxo de Caixa para gerar os dados.
                </div>
              )}
            </div>

            {/* Ciclo Financeiro histórico */}
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:2 }}>Ciclo Financeiro</div>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--fs-text-1)', marginBottom:16 }}>Necessidade de capital de giro</div>
              {historico.some(h => h.cicloCF !== 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={historico} margin={{top:4,right:8,left:0,bottom:4}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:11}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} tickFormatter={v=>v+'d'} width={38} />
                    <Tooltip content={<TT />} cursor={false} />
                    <ReferenceLine y={0} stroke="var(--fs-border)" strokeWidth={2} />
                    <Bar dataKey="cicloCF" radius={[4,4,0,0]} name="Ciclo Financeiro">
                      {historico.map((entry, i) => (
                        <rect key={i} fill={entry.cicloCF <= 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{textAlign:'center',padding:40,color:'var(--fs-text-4)',fontSize:13}}>Sem dados</div>
              )}
            </div>
          </div>

          {/* ── Contexto do mês: movimentação FC ────────────────────────────── */}
          {fcMes && fcMes.total > 0 && (
            <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'18px 22px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12 }}>
                Movimentação do mês · Base de cálculo — {MESES_LABEL[mesSel-1]}/{anoSel}
              </div>
              <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                {[
                  { label:'Total de lançamentos', valor:String(fcMes.total),         cor:'var(--fs-text-1)', unit:'' },
                  { label:'Entradas (recebimentos)',valor:fC(fcMes.entradas),         cor:'#22c55e',         unit:`${fcMes.cntE} registros` },
                  { label:'Saídas (pagamentos)',    valor:fC(fcMes.saidas),            cor:'#ef4444',         unit:`${fcMes.cntS} registros` },
                  { label:'Saldo do mês',           valor:fC(fcMes.entradas - fcMes.saidas), cor: fcMes.entradas >= fcMes.saidas ? '#22c55e' : '#ef4444', unit:'' },
                ].map(({ label, valor, cor, unit }) => (
                  <div key={label} style={{ flex:1, minWidth:140 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:20, fontWeight:800, color:cor }}>{valor}</div>
                    {unit && <div style={{ fontSize:11, color:'var(--fs-text-4)' }}>{unit}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
