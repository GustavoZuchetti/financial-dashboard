'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, fetchAll, getSelectedEntidadeIds } from '@/lib/supabase'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const fC = (v) => {
  if (!v && v !== 0) return '—'
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e6) return `${s}R$\u00a0${(a/1e6).toFixed(2)}M`
  if (a >= 1e3) return `${s}R$\u00a0${(a/1e3).toFixed(1)}k`
  return `${s}R$\u00a0${a.toFixed(0)}`
}
const IS = { background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'7px 10px', fontSize:12, outline:'none', colorScheme:'dark' }
const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
      <div style={{ fontWeight:700, color:'var(--fs-text-1)', marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color, display:'flex', justifyContent:'space-between', gap:16 }}>
          <span>{p.name}</span><strong className="fs-num">{fC(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function FluxoProjecao() {
  const now = new Date()
  const yr  = now.getFullYear()
  const mo  = now.getMonth()

  const [empresaId, setEmpresaId] = useState(null)
  const [isConsol,  setIsConsol]  = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [mesesBase, setMesesBase] = useState(6)   // meses históricos para calcular média
  const [mesesProj, setMesesProj] = useState(6)   // meses a projetar

  const [historico,  setHistorico]  = useState([])
  const [projecoes,  setProjecoes]  = useState([])
  const [mediaE,     setMediaE]     = useState(0)
  const [mediaS,     setMediaS]     = useState(0)

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
      let empIds = await getSelectedEntidadeIds()
      if (!empIds.length) { setLoading(false); return }

      // Buscar histórico — últimos N meses
      const baseStart = new Date(yr, mo - mesesBase, 1)
      const baseEnd   = new Date(yr, mo, 0) // último dia do mês anterior

      let q = supabase.from('fluxo_caixa').select('tipo,valor,data')
        .gte('data', baseStart.toISOString().split('T')[0])
        .lte('data', baseEnd.toISOString().split('T')[0])
      q = isConsol ? q.in('empresa_id', empIds) : q.eq('empresa_id', empIds[0])
      const hist = await fetchAll(q)

      // Agrupar por mês
      const byMonth = {}
      ;(hist||[]).forEach(r => {
        const dt = new Date(r.data + 'T00:00:00')
        const k  = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`
        if (!byMonth[k]) byMonth[k] = { e:0, s:0 }
        const v = Math.abs(Number(r.valor))
        if (['entrada','receita','receita_financeira','fluxo_entrada'].includes(r.tipo)) byMonth[k].e += v
        else byMonth[k].s += v
      })

      const histMeses = Object.entries(byMonth).sort().map(([k, v]) => {
        const [y, m] = k.split('-')
        return { name: `${MESES[Number(m)-1]}/${String(y).slice(2)}`, entradas: v.e, saidas: v.s, saldo: v.e - v.s, tipo: 'realizado' }
      })
      setHistorico(histMeses)

      // Calcular médias
      const mE = histMeses.length > 0 ? histMeses.reduce((a,c)=>a+c.entradas,0) / histMeses.length : 0
      const mS = histMeses.length > 0 ? histMeses.reduce((a,c)=>a+c.saidas,0)   / histMeses.length : 0
      setMediaE(mE); setMediaS(mS)

      // Gerar projeções — crescimento linear suavizado (média móvel + tendência leve)
      const tendE = histMeses.length >= 2 ? (histMeses[histMeses.length-1].entradas - histMeses[0].entradas) / histMeses.length * 0.3 : 0
      const tendS = histMeses.length >= 2 ? (histMeses[histMeses.length-1].saidas   - histMeses[0].saidas)   / histMeses.length * 0.3 : 0

      let saldoAcum = histMeses.reduce((a,c)=>a+c.saldo, 0)
      const proj = Array.from({ length: mesesProj }, (_, i) => {
        const futDate = new Date(yr, mo + i, 1)
        const projE = Math.max(0, mE + tendE * (i + 1))
        const projS = Math.max(0, mS + tendS * (i + 1))
        const saldo  = projE - projS
        saldoAcum   += saldo
        return {
          name:      `${MESES[futDate.getMonth()]}/${String(futDate.getFullYear()).slice(2)}`,
          entradas:  Math.round(projE),
          saidas:    Math.round(projS),
          saldo:     Math.round(saldo),
          acumulado: Math.round(saldoAcum),
          tipo:      'projetado'
        }
      })
      setProjecoes(proj)
    } catch(e) { console.error('Projecao:', e) }
    finally { setLoading(false) }
  }, [empresaId, isConsol, mesesBase, mesesProj, yr, mo])

  useEffect(() => { if (empresaId !== null) load() }, [load, empresaId])

  const chartData = [
    ...historico.map(h => ({ ...h, entradas_real: h.entradas, saidas_real: h.saidas })),
    ...projecoes.map(p => ({ ...p, entradas_proj: p.entradas, saidas_proj: p.saidas }))
  ]

  return (
    <div style={{ color:'var(--fs-text-1)', width:'100%' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:28, fontWeight:800, margin:0 }}>Projeção de Caixa</h1>
        <div style={{ fontSize:12, color:'var(--fs-text-4)', marginTop:4 }}>
          Projeção calculada com base na média histórica + tendência dos últimos {mesesBase} meses
        </div>
      </div>

      {/* Controles */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase' }}>Base histórica</div>
          <select value={mesesBase} onChange={e=>setMesesBase(Number(e.target.value))} style={IS}>
            {[3,6,9,12].map(n=><option key={n} value={n}>{n} meses</option>)}
          </select>
        </div>
        <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase' }}>Projetar</div>
          <select value={mesesProj} onChange={e=>setMesesProj(Number(e.target.value))} style={IS}>
            {[3,6,9,12].map(n=><option key={n} value={n}>{n} meses</option>)}
          </select>
        </div>
        {mediaE > 0 && (
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {[
              { label:'Média Entradas/mês', val: mediaE, color:'var(--fs-success)' },
              { label:'Média Saídas/mês',   val: mediaS, color:'var(--fs-danger)' },
              { label:'Média Saldo/mês',    val: mediaE - mediaS, color: mediaE >= mediaS ? 'var(--fs-brand)' : 'var(--fs-warning)' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'12px 16px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:18, fontWeight:800, color }} className="fs-num">{fC(Math.round(val))}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--fs-text-4)', fontSize:14 }}>Calculando projeção...</div>
      ) : historico.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, color:'var(--fs-text-4)', fontSize:14 }}>
          Sem histórico suficiente para calcular projeção. Importe dados do Fluxo de Caixa primeiro.
        </div>
      ) : (
        <>
          {/* Gráfico */}
          <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px', marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--fs-text-1)' }}>Histórico + Projeção</div>
              <div style={{ display:'flex', gap:16, fontSize:11, color:'var(--fs-text-4)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:24, height:3, background:'var(--fs-brand)', borderRadius:2 }}/> Realizado</div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:24, height:3, background:'var(--fs-purple)', borderRadius:2, borderTop:'2px dashed var(--fs-purple)' }}/> Projetado</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={chartData} margin={{top:4,right:8,left:0,bottom:4}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} tickFormatter={fC} width={72} />
                <Tooltip content={<TT />} cursor={false} />
                <Bar dataKey="entradas_real" fill="var(--fs-success)"                    name="Entradas (real)"     barSize={14} radius={[3,3,0,0]} />
                <Bar dataKey="saidas_real"   fill="rgba(var(--fs-danger-rgb),0.7)"        name="Saídas (real)"       barSize={14} radius={[3,3,0,0]} />
                <Bar dataKey="entradas_proj" fill="rgba(var(--fs-success-rgb),0.35)"       name="Entradas (proj)"     barSize={14} radius={[3,3,0,0]} />
                <Bar dataKey="saidas_proj"   fill="rgba(var(--fs-danger-rgb),0.25)"       name="Saídas (proj)"       barSize={14} radius={[3,3,0,0]} />
                <Line type="monotone" dataKey="acumulado" stroke="var(--fs-purple)" strokeWidth={2} strokeDasharray="5 3" dot={{r:3}} name="Saldo acumulado (proj)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela de projeção */}
          <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--fs-text-1)', marginBottom:16 }}>Detalhamento da projeção</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr>
                  {['Mês','Entradas','Saídas','Saldo','Saldo Acumulado'].map(h => (
                    <th key={h} style={{ padding:'9px 12px', textAlign:h==='Mês'?'left':'right', color:'var(--fs-text-4)', fontSize:10, fontWeight:700, textTransform:'uppercase', borderBottom:'1px solid var(--fs-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projecoes.map((r,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--fs-border)' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600, color:'var(--fs-text-1)', display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:9, background:'rgba(var(--fs-purple-rgb),0.15)', color:'var(--fs-purple)', border:'1px solid rgba(var(--fs-purple-rgb),0.3)', padding:'1px 6px', borderRadius:4, fontWeight:700 }}>PROJ</span>
                      {r.name}
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'var(--fs-success)', fontWeight:600 }} className="fs-num">{fC(r.entradas)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'var(--fs-danger)', fontWeight:600 }} className="fs-num">{fC(r.saidas)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color: r.saldo >= 0 ? 'var(--fs-success)' : 'var(--fs-danger)' }} className="fs-num">{fC(r.saldo)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color: r.acumulado >= 0 ? 'var(--fs-brand)' : 'var(--fs-danger)' }} className="fs-num">{fC(r.acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
