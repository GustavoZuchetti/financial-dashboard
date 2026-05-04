'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '@/lib/supabase'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtPct = (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '%'

const S = {
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  kpiTitle: { fontSize: '13px', color: '#9ca3af', marginBottom: '8px' },
  kpiValue: { fontSize: '22px', fontWeight: 'bold' },
  sectionTitle: { fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f3f4f6' },
  input: { background: '#111827', border: '1px solid #374151', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '13px', outline: 'none' },
  skeleton: { background: 'linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' },
  error: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '16px', color: '#f87171', textAlign: 'center', marginBottom: '24px' },
  badge: { display: 'inline-block', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', marginLeft: '8px' }
}

const calcDelta = (current, previous) => {
  if (!previous || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

const formatPeriod = (start, end) => {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const opts = { day: '2-digit', month: 'short', year: 'numeric' }
  return `${s.toLocaleDateString('pt-BR', opts)} → ${e.toLocaleDateString('pt-BR', opts)}`
}

const getPreviousPeriod = (startDate, endDate) => {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const diffMs = end - start
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd - diffMs)
  return {
    start: prevStart.toISOString().split('T')[0],
    end: prevEnd.toISOString().split('T')[0]
  }
}

const KPICard = ({ title, rawValue, color = '#3b82f6', loading, prevRawValue, isExpense = false, presentationMode }) => {
  const delta = (prevRawValue !== undefined && prevRawValue !== null)
    ? calcDelta(Math.abs(rawValue), Math.abs(prevRawValue))
    : null
  const isFavorable = delta !== null ? (isExpense ? delta <= 0 : delta >= 0) : null

  return (
    <div style={{ ...S.card, ...(presentationMode ? { padding: '28px 24px', borderRadius: '12px' } : {}) }}>
      <div style={{ ...S.kpiTitle, ...(presentationMode ? { fontSize: '15px' } : {}) }}>{title}</div>
      {loading ? (
        <div style={{ ...S.skeleton, height: '28px', width: '80%', borderRadius: '4px' }} />
      ) : (
        <>
          <div style={{ ...S.kpiValue, color, ...(presentationMode ? { fontSize: '32px' } : {}) }}>
            {fmtFull(rawValue)}
          </div>
          {delta !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: presentationMode ? '16px' : '14px', color: isFavorable ? '#10b981' : '#ef4444' }}>
                {delta >= 0 ? '▲' : '▼'}
              </span>
              <span style={{ fontSize: presentationMode ? '13px' : '12px', color: isFavorable ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                {fmtPct(delta)}
              </span>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>vs período anterior</span>
              <span style={{
                fontSize: '11px', fontWeight: '700',
                color: isFavorable ? '#10b981' : '#ef4444',
                background: isFavorable ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${isFavorable ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                padding: '1px 7px', borderRadius: '4px', letterSpacing: '0.5px'
              }}>
                {isFavorable ? '✓ F' : '✗ D'}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, data }) => {
  if (!active || !payload || !payload[0]) return null
  const entry = payload[0].payload
  let details = []
  const getTopItems = (items) => {
    const sorted = [...items].sort((a, b) => Number(b.valor) - Number(a.valor))
    const total = sorted.reduce((acc, curr) => acc + Number(curr.valor), 0)
    let acc = 0
    return sorted.filter(r => { acc += Number(r.valor); return acc <= total * 0.8 }).slice(0, 3)
  }
  if (entry.name === 'Receita Bruta' && data) details = getTopItems(data.filter(d => d.tipo === 'receita'))
  else if (entry.name === 'Custos' && data) details = getTopItems(data.filter(d => d.tipo === 'custo'))
  else if (entry.name === 'Despesas' && data) details = getTopItems(data.filter(d => d.tipo === 'despesa'))
  return (
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #3b82f6', borderRadius: '6px', padding: '10px', color: '#e5e7eb', fontSize: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
      <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#3b82f6' }}>{entry.name}</p>
      <p style={{ margin: '4px 0', color: '#9ca3af' }}>Total: <span style={{ color: '#fff', fontWeight: 'bold' }}>{fmtFull(Math.abs(entry.value))}</span></p>
      {details.length > 0 && (
        <>
          <p style={{ margin: '8px 0 4px 0', color: '#9ca3af', fontSize: '11px', borderTop: '1px solid #1e293b', paddingTop: '4px' }}>Top 80% (Pareto):</p>
          {details.map((d, i) => (
            <p key={i} style={{ margin: '2px 0 2px 8px', color: '#cbd5e1', fontSize: '11px' }}>
              • {d.descricao?.substring(0, 22) || d.categoria?.substring(0, 22) || 'Item'}: {fmtFull(Number(d.valor))}
            </p>
          ))}
        </>
      )}
    </div>
  )
}

const PresentationOverlay = ({ kpis, prevKpis, waterfallData, startDate, endDate, isConsolidado, loading, onExit, data }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onExit])

  const marginBruta   = kpis.receita > 0 ? ((kpis.receita - kpis.custo) / kpis.receita * 100) : 0
  const marginEbitda  = kpis.receita > 0 ? (kpis.ebitda / kpis.receita * 100) : 0
  const marginLiquida = kpis.receita > 0 ? ((kpis.receita - kpis.custo - kpis.despesa) / kpis.receita * 100) : 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#080810', display: 'flex', flexDirection: 'column', padding: '40px 48px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
            <div style={{ width: 40, height: 40, background: '#3b82f6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#000', fontSize: 18 }}>F</div>
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Facesign</span>
            {isConsolidado && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>Consolidado</span>}
          </div>
          <div style={{ color: '#4b5563', fontSize: '14px' }}>Demonstrativos Executivos — {formatPeriod(startDate, endDate)}</div>
        </div>
        <button onClick={onExit} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          ✕ Sair (ESC)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
        <KPICard title="Receita Bruta"   rawValue={kpis.receita}  color="#3b82f6"                             loading={loading} prevRawValue={prevKpis?.receita}  isExpense={false} presentationMode />
        <KPICard title="Custos Totais"   rawValue={kpis.custo}    color="#ef4444"                             loading={loading} prevRawValue={prevKpis?.custo}    isExpense={true}  presentationMode />
        <KPICard title="Despesas Totais" rawValue={kpis.despesa}  color="#ef4444"                             loading={loading} prevRawValue={prevKpis?.despesa}  isExpense={true}  presentationMode />
        <KPICard title="EBITDA"          rawValue={kpis.ebitda}   color={kpis.ebitda >= 0 ? '#10b981' : '#ef4444'} loading={loading} prevRawValue={prevKpis?.ebitda}   isExpense={false} presentationMode />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: 'Margem Bruta',    value: marginBruta,   color: '#8b5cf6' },
          { label: 'Margem EBITDA',   value: marginEbitda,  color: '#f59e0b' },
          { label: 'Margem Líquida',  value: marginLiquida, color: '#10b981' }
        ].map(m => (
          <div key={m.label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#9ca3af', fontSize: '14px' }}>{m.label}</span>
            <span style={{ color: m.value >= 0 ? m.color : '#ef4444', fontSize: '26px', fontWeight: 800 }}>{m.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px 28px', flex: 1, minHeight: '320px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#e5e7eb', marginBottom: '24px' }}>Fluxo do Resultado (Waterfall)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={waterfallData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} interval={0} angle={-20} textAnchor="end" />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={fmt} />
            <Tooltip content={<CustomTooltip data={data} />} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="range" radius={[3, 3, 0, 0]}>
              {waterfallData.map((entry, i) => (
                <Cell key={i} fill={entry.type === 'total' ? '#3b82f6' : '#ef4444'} fillOpacity={entry.type === 'total' ? 0.85 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ textAlign: 'center', marginTop: '16px', color: '#1f2937', fontSize: '12px' }}>
        Facesign — Uso Interno Confidencial — {new Date().toLocaleDateString('pt-BR')}
      </div>
    </div>
  )
}

export default function DREGeral() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState([])
  const [prevData, setPrevData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [empresaId, setEmpresaId] = useState(null)
  const [isConsolidado, setIsConsolidado] = useState(false)
  const [presentationMode, setPresentationMode] = useState(false)

  useEffect(() => {
    const savedId = localStorage.getItem('empresa_id')
    if (savedId) { setEmpresaId(savedId); setIsConsolidado(savedId === 'todas') }
    const handleStorage = () => {
      const newId = localStorage.getItem('empresa_id')
      if (newId !== empresaId) { setEmpresaId(newId); setIsConsolidado(newId === 'todas') }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [empresaId])

  const fetchForPeriod = useCallback(async (start, end, isConsol, empId) => {
    let query = supabase.from('lancamentos').select('*, empresas(nome)').gte('data', start).lte('data', end)
    if (isConsol) {
      const { data: userEmpresas } = await supabase.from('empresas').select('id').eq('user_id', (await supabase.auth.getSession()).data.session.user.id)
      if (userEmpresas) query = query.in('empresa_id', userEmpresas.map(e => e.id))
    } else {
      query = query.eq('empresa_id', empId)
    }
    const { data: lancamentos, error } = await query
    if (error) throw error
    return lancamentos || []
  }, [])

  useEffect(() => {
    if (!empresaId) return
    const fetchAll = async () => {
      setLoading(true); setError(null)
      try {
        const current = await fetchForPeriod(startDate, endDate, isConsolidado, empresaId)
        setData(current)
        const prev = getPreviousPeriod(startDate, endDate)
        const previous = await fetchForPeriod(prev.start, prev.end, isConsolidado, empresaId)
        setPrevData(previous)
      } catch (err) {
        console.error('Erro ao carregar Demonstrativos:', err)
        setError('Não foi possível carregar os dados financeiros. Verifique sua conexão.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [empresaId, startDate, endDate, isConsolidado, fetchForPeriod])

  const totalReceita  = data.filter(d => d.tipo === 'receita').reduce((acc, curr) => acc + Number(curr.valor), 0)
  const totalDespesa  = data.filter(d => d.tipo === 'despesa').reduce((acc, curr) => acc + Number(curr.valor), 0)
  const totalCusto    = data.filter(d => d.tipo === 'custo').reduce((acc, curr) => acc + Number(curr.valor), 0)
  const ebitda        = totalReceita - totalCusto - totalDespesa

  const prevReceita   = prevData.filter(d => d.tipo === 'receita').reduce((acc, curr) => acc + Number(curr.valor), 0)
  const prevDespesa   = prevData.filter(d => d.tipo === 'despesa').reduce((acc, curr) => acc + Number(curr.valor), 0)
  const prevCusto     = prevData.filter(d => d.tipo === 'custo').reduce((acc, curr) => acc + Number(curr.valor), 0)
  const prevEbitda    = prevReceita - prevCusto - prevDespesa

  const kpis     = { receita: totalReceita, custo: totalCusto, despesa: totalDespesa, ebitda }
  const prevKpis = { receita: prevReceita, custo: prevCusto, despesa: prevDespesa, ebitda: prevEbitda }

  const waterfallData = [
    { name: 'Receita Bruta', range: [0, totalReceita], value: totalReceita, type: 'total' },
    { name: 'Custos', range: [totalReceita - totalCusto, totalReceita], value: -totalCusto, type: 'negative' },
    { name: 'Lucro Bruto', range: [0, totalReceita - totalCusto], value: totalReceita - totalCusto, type: 'total' },
    { name: 'Despesas', range: [Math.max(0, ebitda), totalReceita - totalCusto], value: -totalDespesa, type: 'negative' },
    { name: 'EBITDA', range: [0, Math.max(0, ebitda)], value: ebitda, type: 'total' }
  ]

  const marginBruta   = totalReceita > 0 ? ((totalReceita - totalCusto) / totalReceita * 100) : 0
  const marginEbitda  = totalReceita > 0 ? (ebitda / totalReceita * 100) : 0
  const marginLiquida = totalReceita > 0 ? ((totalReceita - totalCusto - totalDespesa) / totalReceita * 100) : 0

  return (
    <>
      {presentationMode && (
        <PresentationOverlay
          kpis={kpis} prevKpis={prevKpis} waterfallData={waterfallData}
          startDate={startDate} endDate={endDate} isConsolidado={isConsolidado}
          loading={loading} onExit={() => setPresentationMode(false)} data={data}
        />
      )}

      <div style={{ color: '#e5e7eb', padding: '24px' }}>
        <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            Demonstrativos Executivos
            {isConsolidado && <span style={S.badge}>📊 Consolidado</span>}
          </h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1f2937', padding: '8px 16px', borderRadius: '8px', border: '1px solid #374151' }}>
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>Período:</span>
              <input type="date" style={S.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span style={{ color: '#9ca3af' }}>→</span>
              <input type="date" style={S.input} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button
              onClick={() => setPresentationMode(true)}
              style={{ background: 'linear-gradient(135deg, #1e3a5f, #1d4ed8)', border: '1px solid #2563eb', color: '#bfdbfe', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              🎯 Modo Apresentação
            </button>
          </div>
        </div>

        {error && <div style={S.error}>⚠️ {error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <KPICard title="Receita Bruta"    rawValue={totalReceita} color="#3b82f6" loading={loading} prevRawValue={prevReceita}  isExpense={false} />
          <KPICard title="Custos Totais"    rawValue={totalCusto}   color="#ef4444" loading={loading} prevRawValue={prevCusto}    isExpense={true}  />
          <KPICard title="Despesas Totais"  rawValue={totalDespesa} color="#ef4444" loading={loading} prevRawValue={prevDespesa}  isExpense={true}  />
          <KPICard title="EBITDA"           rawValue={ebitda}       color={ebitda >= 0 ? '#10b981' : '#ef4444'} loading={loading} prevRawValue={prevEbitda} isExpense={false} />
        </div>

        {!loading && data.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Margem Bruta',   value: marginBruta,   color: '#8b5cf6' },
              { label: 'Margem EBITDA',  value: marginEbitda,  color: '#f59e0b' },
              { label: 'Margem Líquida', value: marginLiquida, color: '#10b981' }
            ].map(m => (
              <div key={m.label} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>{m.label}</span>
                <span style={{ color: m.value >= 0 ? m.color : '#ef4444', fontSize: '18px', fontWeight: 800 }}>{m.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...S.card, marginBottom: '24px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={S.sectionTitle}>Fluxo do Resultado (Waterfall)</h2>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100%', height: '300px', ...S.skeleton, borderRadius: '8px' }} />
            </div>
          ) : data.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
              Nenhum lançamento encontrado para o período selecionado.
            </div>
          ) : (
            <div style={{ height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={fmt} />
                  <Tooltip content={<CustomTooltip data={data} />} cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="range" radius={[2, 2, 0, 0]}>
                    {waterfallData.map((entry, i) => (
                      <Cell key={i} fill={entry.type === 'total' ? '#3b82f6' : '#ef4444'} fillOpacity={entry.type === 'total' ? 0.8 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {!loading && prevData.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontSize: '12px', justifyContent: 'flex-end' }}>
            <span>ℹ️ Variações calculadas vs período anterior:</span>
            <span style={{ color: '#374151', fontWeight: 600 }}>
              {formatPeriod(...Object.values(getPreviousPeriod(startDate, endDate)))}
            </span>
          </div>
        )}
      </div>
    </>
  )
}
