'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, fetchAll, getSelectedEntidadeIds } from '@/lib/supabase'
import { calcDRE, fmtBRL, fmtCompact } from '@/lib/dre-calc'
import { KpiCardsSkeleton, ChartSkeleton } from '@/components/Skeleton'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine, ComposedChart} from 'recharts'

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function DREAnalise() {
  const [startDate,  setStartDate]  = useState(() => new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0])
  const [endDate,    setEndDate]    = useState(new Date().toISOString().split('T')[0])
  const [debouncedStart, setDebouncedStart] = useState(startDate)
  const [debouncedEnd,   setDebouncedEnd]   = useState(endDate)
  useEffect(() => { const t = setTimeout(() => setDebouncedStart(startDate), 400); return () => clearTimeout(t) }, [startDate])
  useEffect(() => { const t = setTimeout(() => setDebouncedEnd(endDate),   400); return () => clearTimeout(t) }, [endDate])
  const [empresaId,  setEmpresaId]  = useState(null)
  const [isConsol,   setIsConsol]   = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [data,       setData]       = useState([])
  const [evolucao,   setEvolucao]   = useState([])
  const [topClientes,setTopClientes]= useState([])
  const [paretoGastos,setParetoGastos]= useState([])

  useEffect(() => {
    const id = localStorage.getItem('empresa_id')
    setEmpresaId(id); setIsConsol(id === 'todas')
    const h = () => { const nid=localStorage.getItem('empresa_id'); setEmpresaId(nid); setIsConsol(nid==='todas') }
    window.addEventListener('storage', h); return () => window.removeEventListener('storage', h)
  }, [])

  const fetchData = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      let q = supabase.from('lancamentos').select('id,tipo,valor,data,descricao,categoria').gte('data', debouncedStart).lte('data', debouncedEnd)
      const ids = await getSelectedEntidadeIds()
      if (ids.length) q = q.in('empresa_id', ids)
      const rows = await fetchAll(q)
      const all = rows || []
      setData(all)

      // ── Evolução mensal usando calcDRE por mês ──────────────────
      const porMes = {}
      all.forEach(l => {
        const d = new Date(l.data + 'T00:00:00')
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        if (!porMes[key]) porMes[key] = []
        porMes[key].push(l)
      })
      const evo = Object.entries(porMes).sort().map(([key, lns]) => {
        const v = calcDRE(lns)
        const [year, month] = key.split('-')
        return {
          name: MESES_PT[parseInt(month)-1] + '/' + year.slice(2),
          receita:    v.rb,
          lucroBruto: v.lb,
          ebitda:     v.ebt,
          resLiquido: v.resL,
          resFinal:   v.resF,
        }
      })
      setEvolucao(evo)

      // ── Top clientes por Receita Bruta ──────────────────────────
      const clienteMap = {}
      all.filter(l => l.tipo === 'receita').forEach(l => {
        const k = (l.descricao || l.categoria || 'Não identificado').trim()
        clienteMap[k] = (clienteMap[k] || 0) + Number(l.valor)
      })
      setTopClientes(
        Object.entries(clienteMap)
          .map(([name, valor]) => ({ name: name.substring(0,28), valor }))
          .sort((a,b) => b.valor - a.valor)
          .slice(0, 8)
      )

      // ── Pareto de gastos por fornecedor (custos + despesas) ─────
      const fornMap = {}
      all.filter(l => ['custo','despesa'].includes(l.tipo)).forEach(l => {
        const k = (l.descricao || l.categoria || 'Não identificado').trim()
        fornMap[k] = (fornMap[k] || 0) + Math.abs(Number(l.valor))
      })
      const fornOrd = Object.entries(fornMap)
        .map(([name, valor]) => ({ name, valor }))
        .sort((a,b) => b.valor - a.valor)
      const totalGastos = fornOrd.reduce((a,c) => a + c.valor, 0)
      let acum = 0
      setParetoGastos(fornOrd.slice(0, 8).map(f => {
        acum += f.valor
        return { name: f.name.substring(0,18), valor: f.valor,
                 acumulado: totalGastos > 0 ? +((acum/totalGastos)*100).toFixed(1) : 0 }
      }))
    } finally { setLoading(false) }
  }, [empresaId, debouncedStart, debouncedEnd, isConsol])

  useEffect(() => { fetchData() }, [fetchData])

  const v = calcDRE(data)
  const tt = { contentStyle:{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8 }, formatter:(val)=>fmtBRL(val), cursor: false }

  return (
    <div style={{ color:'var(--fs-text-1)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--fs-text-1)', margin:0 }}>DRE Análise</h1>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', background:'var(--fs-surface)', padding:'7px 14px', borderRadius:8, border:'1px solid var(--fs-border)' }}>
          <span style={{ fontSize:12, color:'var(--fs-text-4)' }}>Período:</span>
          <input type="date" onClick={e => { try { e.target.showPicker() } catch(_) {} }} style={{ background:'var(--fs-input-bg)',border:'1px solid var(--fs-input-border)',borderRadius:6,color:'var(--fs-text-1)',padding:'5px 8px',fontSize:12,outline:'none' }} value={startDate} onChange={e=>setStartDate(e.target.value)} />
          <span style={{ color:'var(--fs-text-4)' }}>→</span>
          <input type="date" onClick={e => { try { e.target.showPicker() } catch(_) {} }} style={{ background:'var(--fs-input-bg)',border:'1px solid var(--fs-input-border)',borderRadius:6,color:'var(--fs-text-1)',padding:'5px 8px',fontSize:12,outline:'none' }} value={endDate} onChange={e=>setEndDate(e.target.value)} />
        </div>
      </div>

      {loading ? <><KpiCardsSkeleton count={4} /><ChartSkeleton height={240} /></> : <>
      {/* KPIs — mesmos valores da Visão Geral */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Receita Bruta',    val:v.rb,   color:'var(--fs-success)' },
          { label:'EBITDA',           val:v.ebt,  color:'var(--fs-teal)' },
          { label:'Res. Líquido',     val:v.resL, color:'var(--fs-purple)' },
          { label:'Resultado Final',  val:v.resF, color:'var(--fs-brand)' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--fs-surface)', border:`1px solid var(--fs-border)`, borderRadius:10, padding:'14px 16px', borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontSize:11, color:'var(--fs-text-4)', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color: k.val>=0 ? k.color : 'var(--fs-danger)' }} className="fs-num">{fmtBRL(k.val)}</div>
            {v.rb > 0 && <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:4 }}>{(k.val/v.rb*100).toFixed(1)}% da receita</div>}
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:16, marginBottom:16 }}>
        {/* Evolução Mensal */}
        <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:16 }}>Evolução Mensal</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evolucao} margin={{top:5,right:10,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:11}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} tickFormatter={fmtCompact} width={65} />
              <ReferenceLine y={0} stroke="var(--fs-border-2)" strokeWidth={1} />
              <Tooltip {...tt} cursor={false} />
              <Legend iconType="circle" wrapperStyle={{fontSize:11}} />
              <Line type="monotone" dataKey="receita"    stroke="var(--fs-success)" strokeWidth={2} dot={false} name="Receita Bruta" />
              <Line type="monotone" dataKey="ebitda"     stroke="var(--fs-teal)" strokeWidth={2} dot={false} name="EBITDA" />
              <Line type="monotone" dataKey="resLiquido" stroke="var(--fs-purple)" strokeWidth={2} dot={false} name="Res. Líquido" />
              <Line type="monotone" dataKey="resFinal"   stroke="var(--fs-brand)" strokeWidth={2.5} dot={{r:3}} name="Res. Final" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Clientes */}
        <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
          <h2 style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:16 }}>Top Receitas por Cliente</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topClientes} layout="vertical" margin={{left:10,right:10}}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--fs-border)" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} width={110} />
              <Tooltip {...tt} formatter={(v)=>fmtBRL(v)} />
              <Bar dataKey="valor" fill="var(--fs-success)" radius={[0,4,4,0]} barSize={16} name="Receita" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pareto de Gastos + Margens Mensais — lado a lado */}
      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:16, marginBottom:16 }}>
      <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
        <h2 style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:4 }}>Maiores Gastos por Fornecedor — Pareto</h2>
        <p style={{ fontSize:11.5, color:'var(--fs-text-4)', margin:'0 0 16px' }}>Custos + despesas do período, ordenados. A linha mostra o % acumulado do gasto total — evidencia a concentração.</p>
        {paretoGastos.length === 0 ? (
          <div style={{ padding:24, textAlign:'center', color:'var(--fs-text-4)', fontSize:12.5 }}>Sem gastos no período.</div>
        ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={paretoGastos} margin={{top:10,right:14,left:0,bottom:44}}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} angle={-32} textAnchor="end" tick={{fill:'var(--fs-text-4)',fontSize:9.5}} height={64} />
            <YAxis yAxisId="v" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} tickFormatter={fmtCompact} width={58} />
            <YAxis yAxisId="p" orientation="right" domain={[0,100]} unit="%" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} width={42} />
            <Tooltip {...tt} formatter={(v,n)=> n==='% acumulado' ? [`${v}%`, n] : [fmtBRL(v), 'Gasto']} />
            <Bar yAxisId="v" dataKey="valor" fill="var(--fs-danger)" radius={[4,4,0,0]} barSize={26} name="Gasto" />
            <Line yAxisId="p" type="monotone" dataKey="acumulado" stroke="var(--fs-warning)" strokeWidth={2.5} dot={{r:3, fill:'var(--fs-warning)'}} name="% acumulado" />
          </ComposedChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Margens mensais */}
      <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px' }}>
        <h2 style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', marginBottom:16 }}>Margens Mensais (%)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={evolucao.map(m => ({
            ...m,
            mEBITDA:   m.receita > 0 ? +(m.ebitda   / m.receita * 100).toFixed(1) : 0,
            mLiquida:  m.receita > 0 ? +(m.resLiquido/ m.receita * 100).toFixed(1) : 0,
          }))} margin={{top:5,right:10,left:0,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:11}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill:'var(--fs-text-4)',fontSize:10}} unit="%" width={40} />
            <ReferenceLine y={0} stroke="var(--fs-border-2)" strokeWidth={1} />
            <Tooltip {...tt} formatter={(v)=>`${v}%`} />
            <Legend iconType="circle" wrapperStyle={{fontSize:11}} />
            <Line type="monotone" dataKey="mEBITDA"  stroke="var(--fs-teal)" strokeWidth={2} dot={{r:3}} name="Margem EBITDA" />
            <Line type="monotone" dataKey="mLiquida" stroke="var(--fs-purple)" strokeWidth={2} dot={{r:3}} name="Margem Líquida" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      </div>
      </>}

    </div>
  )
}
