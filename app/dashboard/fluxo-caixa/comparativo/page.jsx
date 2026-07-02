'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, fetchAll, getSelectedEntidadeIds } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

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
          <span>{p.name}</span><strong>{fC(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function FluxoComparativo() {
  const now = new Date()
  const yr  = now.getFullYear()

  const [empresaId,  setEmpresaId]  = useState(null)
  const [isConsol,   setIsConsol]   = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [p1Start,    setP1Start]    = useState(`${yr}-01-01`)
  const [p1End,      setP1End]      = useState(now.toISOString().split('T')[0])
  const [p2Start,    setP2Start]    = useState(`${yr-1}-01-01`)
  const [p2End,      setP2End]      = useState(`${yr-1}-12-31`)
  const [data1,      setData1]      = useState([])
  const [data2,      setData2]      = useState([])

  useEffect(() => {
    const id = localStorage.getItem('empresa_id') || ''
    setEmpresaId(id); setIsConsol(id === 'todas')
    const h = () => { const nid = localStorage.getItem('empresa_id')||''; setEmpresaId(nid); setIsConsol(nid==='todas') }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const fetchPeriod = useCallback(async (start, end) => {
    if (!empresaId) return []
    let empIds = await getSelectedEntidadeIds()
    if (!empIds.length) return []
    let q = supabase.from('fluxo_caixa').select('tipo,valor,data').gte('data', start).lte('data', end)
    q = isConsol ? q.in('empresa_id', empIds) : q.eq('empresa_id', empIds[0])
    const data = await fetchAll(q)
    return data || []
  }, [empresaId, isConsol])

  const load = useCallback(async () => {
    setLoading(true)
    const [d1, d2] = await Promise.all([fetchPeriod(p1Start, p1End), fetchPeriod(p2Start, p2End)])
    setData1(d1); setData2(d2)
    setLoading(false)
  }, [fetchPeriod, p1Start, p1End, p2Start, p2End])

  useEffect(() => { if (empresaId !== null) load() }, [load, empresaId])

  const entradas = (d) => d.filter(r=>['entrada','receita','receita_financeira','fluxo_entrada'].includes(r.tipo)).reduce((a,c)=>a+Math.abs(Number(c.valor)),0)
  const saidas   = (d) => d.filter(r=>['saida','despesa','custo','despesa_financeira','fluxo_saida'].includes(r.tipo)).reduce((a,c)=>a+Math.abs(Number(c.valor)),0)

  // Agrupar por mês para o gráfico
  const byMonth = (d) => {
    const map = {}
    d.forEach(r => {
      const dt = new Date(r.data + 'T00:00:00')
      const k = `${MESES[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}`
      if (!map[k]) map[k] = { entradas:0, saidas:0 }
      const v = Math.abs(Number(r.valor))
      if (['entrada','receita','receita_financeira','fluxo_entrada'].includes(r.tipo)) map[k].entradas += v
      else map[k].saidas += v
    })
    return Object.entries(map).sort().map(([name, v]) => ({ name, ...v, saldo: v.entradas - v.saidas }))
  }

  const chart1 = byMonth(data1)
  const chart2 = byMonth(data2)

  // Comparativo mês a mês (intersecção de meses)
  const comparativo = (() => {
    const map1 = Object.fromEntries(chart1.map(r => [r.name.split('/')[0], r]))
    const map2 = Object.fromEntries(chart2.map(r => [r.name.split('/')[0], r]))
    const allMeses = [...new Set([...Object.keys(map1), ...Object.keys(map2)])]
    return allMeses.map(m => ({
      mes: m,
      entradas1: map1[m]?.entradas || 0,
      saidas1:   map1[m]?.saidas   || 0,
      saldo1:    map1[m]?.saldo    || 0,
      entradas2: map2[m]?.entradas || 0,
      saidas2:   map2[m]?.saidas   || 0,
      saldo2:    map2[m]?.saldo    || 0,
    }))
  })()

  const e1 = entradas(data1), s1 = saidas(data1), sl1 = e1 - s1
  const e2 = entradas(data2), s2 = saidas(data2), sl2 = e2 - s2
  const varE  = e2 > 0 ? ((e1 - e2) / e2 * 100).toFixed(1) : null
  const varS  = s2 > 0 ? ((s1 - s2) / s2 * 100).toFixed(1) : null
  const varSl = Math.abs(sl2) > 0 ? ((sl1 - sl2) / Math.abs(sl2) * 100).toFixed(1) : null

  const KPI = ({ label, v1, v2, pct, inv }) => {
    const pos = pct === null ? null : inv ? Number(pct) <= 0 : Number(pct) >= 0
    return (
      <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'14px 18px', flex:1 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:8 }}>{label}</div>
        <div style={{ display:'flex', gap:16, alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:11, color:'var(--fs-text-4)', marginBottom:2 }}>Período 1</div>
            <div style={{ fontSize:20, fontWeight:800, color:'var(--fs-text-1)' }}>{fC(v1)}</div>
          </div>
          <div>
            <div style={{ fontSize:11, color:'var(--fs-text-4)', marginBottom:2 }}>Período 2</div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--fs-text-3)' }}>{fC(v2)}</div>
          </div>
          {pct !== null && (
            <div style={{ marginLeft:'auto', fontSize:13, fontWeight:700, color: pos ? '#22c55e' : '#ef4444' }}>
              {pos ? '▲' : '▼'} {Math.abs(pct)}%
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ color:'var(--fs-text-1)', width:'100%' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:28, fontWeight:800, margin:0 }}>Comparativo de Períodos</h1>
        <div style={{ fontSize:12, color:'var(--fs-text-4)', marginTop:4 }}>Compare dois períodos de movimentação financeira lado a lado</div>
      </div>

      {/* Seletores */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
        {[['Período 1', p1Start, setP1Start, p1End, setP1End], ['Período 2', p2Start, setP2Start, p2End, setP2End]].map(([lbl, s, setS, e, setE], i) => (
          <div key={i} style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:8 }}>{lbl}</div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="date" value={s} onChange={ev=>{setS(ev.target.value)}} style={IS}/>
              <span style={{ color:'var(--fs-text-4)' }}>→</span>
              <input type="date" value={e} onChange={ev=>{setE(ev.target.value)}} style={IS}/>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--fs-text-4)', fontSize:14 }}>Carregando dados...</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            <KPI label="Entradas"  v1={e1}  v2={e2}  pct={varE}  inv={false} />
            <KPI label="Saídas"    v1={s1}  v2={s2}  pct={varS}  inv={true}  />
            <KPI label="Saldo"     v1={sl1} v2={sl2} pct={varSl} inv={false} />
          </div>

          {/* Gráfico comparativo */}
          <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px', marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--fs-text-1)', marginBottom:16 }}>Entradas por mês — Período 1 vs Período 2</div>
            {comparativo.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={comparativo} margin={{top:4,right:8,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} tickFormatter={fC} width={68} />
                  <Tooltip content={<TT />} cursor={false} />
                  <Legend iconType="circle" wrapperStyle={{fontSize:11,paddingTop:8}} />
                  <Bar dataKey="entradas1" fill="#3b82f6" radius={[3,3,0,0]} name="Entradas P1" barSize={12} />
                  <Bar dataKey="entradas2" fill="rgba(59,130,246,0.35)" radius={[3,3,0,0]} name="Entradas P2" barSize={12} />
                  <Bar dataKey="saidas1"   fill="#ef4444" radius={[3,3,0,0]} name="Saídas P1"   barSize={12} />
                  <Bar dataKey="saidas2"   fill="rgba(239,68,68,0.35)" radius={[3,3,0,0]} name="Saídas P2" barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{textAlign:'center',padding:40,color:'var(--fs-text-4)'}}>Sem dados nos períodos selecionados</div>}
          </div>

          {/* Tabela comparativa */}
          <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--fs-text-1)', marginBottom:16 }}>Detalhamento mensal</div>
            {comparativo.length === 0
              ? <div style={{textAlign:'center',padding:30,color:'var(--fs-text-4)'}}>Sem dados</div>
              : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr>
                        {['Mês','Entradas P1','Saídas P1','Saldo P1','Entradas P2','Saídas P2','Saldo P2','Δ Saldo'].map(h => (
                          <th key={h} style={{ padding:'9px 12px', textAlign:h==='Mês'?'left':'right', color:'var(--fs-text-4)', fontSize:10, fontWeight:700, textTransform:'uppercase', borderBottom:'1px solid var(--fs-border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparativo.map((r,i) => {
                        const delta = r.saldo1 - r.saldo2
                        return (
                          <tr key={i} style={{ borderBottom:'1px solid var(--fs-border)' }}>
                            <td style={{ padding:'10px 12px', fontWeight:600, color:'var(--fs-text-1)' }}>{r.mes}</td>
                            {[r.entradas1, r.saidas1, r.saldo1, r.entradas2, r.saidas2, r.saldo2].map((v,j) => (
                              <td key={j} style={{ padding:'10px 12px', textAlign:'right', fontWeight:j===2||j===5?700:400, color: j===2?(r.saldo1>=0?'#22c55e':'#ef4444'):j===5?(r.saldo2>=0?'#22c55e':'#ef4444'):'var(--fs-text-2)' }}>{fC(v)}</td>
                            ))}
                            <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color: delta >= 0 ? '#22c55e' : '#ef4444' }}>{delta >= 0 ? '+' : ''}{fC(delta)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </>
      )}
    </div>
  )
}
