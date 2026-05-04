'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { supabase } from '@/lib/supabase'
import { CHART_PALETTE, COLORS } from '@/lib/design-tokens'

const fmtFull    = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtCompact = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtPct     = (v) => v.toFixed(1) + '%'

const S = {
  page:      { color: '#e5e7eb' },
  card:      { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '20px 24px', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 },
  kpiCard: (accent) => ({
    background: '#1e293b', border: '1px solid #334155',
    borderTop: `3px solid ${accent}`, borderRadius: 12,
    padding: '16px 20px',
  }),
  kpiLabel: { fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 },
  kpiValue: { fontSize: 22, fontWeight: 800, marginBottom: 4 },
  kpiSub:   { fontSize: 12, color: '#475569' },
  select:    { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e5e7eb', padding: '7px 12px', fontSize: 13, outline: 'none' },
  input:     { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e5e7eb', padding: '7px 12px', fontSize: 13, outline: 'none' },
  skeleton:  { background: 'linear-gradient(90deg,#1e293b 25%,#263548 50%,#1e293b 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 6 },
}

const PIE_COLORS = ['#3b82f6','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4','#f97316']

export default function FluxoCaixaAnalise() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState(null)
  const [isConsolidado, setIsConsolidado] = useState(false)

  useEffect(() => {
    const savedId = localStorage.getItem('empresa_id')
    if (savedId) { setEmpresaId(savedId); setIsConsolidado(savedId === 'todas') }
  }, [])

  useEffect(() => {
    if (!empresaId) return
    const fetchData = async () => {
      setLoading(true)
      try {
        let query = supabase.from('fluxo_caixa').select('*').gte('data', startDate).lte('data', endDate)
        if (isConsolidado) {
          const { data: userEmpresas } = await supabase.from('empresas').select('id').eq('user_id', (await supabase.auth.getSession()).data.session.user.id)
          if (userEmpresas) query = query.in('empresa_id', userEmpresas.map(e => e.id))
        } else {
          query = query.eq('empresa_id', empresaId)
        }
        const { data: fluxo } = await query
        setData(fluxo || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [empresaId, startDate, endDate, isConsolidado])

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const entradas = data.filter(d => d.tipo === 'entrada')
  const saidas   = data.filter(d => d.tipo === 'saida')

  const totalEntradas = entradas.reduce((acc, curr) => acc + Number(curr.valor), 0)
  const totalSaidas   = saidas.reduce((acc, curr)   => acc + Number(curr.valor), 0)
  const saldoLiquido  = totalEntradas - totalSaidas
  const cobertura     = totalSaidas > 0 ? totalEntradas / totalSaidas : 0

  // Composição por categoria
  const groupBy = (items, field) => {
    const map = {}
    items.forEach(i => {
      const key = i[field] || 'Sem categoria'
      map[key] = (map[key] || 0) + Number(i.valor)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }

  const entCats  = groupBy(entradas, 'categoria')
  const saiCats  = groupBy(saidas,   'categoria')

  // Evolução mensal
  const evolucao = data.reduce((acc, curr) => {
    const d = new Date(curr.data + 'T00:00:00')
    const key = `${String(d.getMonth() + 1).padStart(2,'0')}/${d.getFullYear()}`
    if (!acc[key]) acc[key] = { name: key, entradas: 0, saidas: 0, saldo: 0 }
    if (curr.tipo === 'entrada') acc[key].entradas += Number(curr.valor)
    else                         acc[key].saidas   += Number(curr.valor)
    acc[key].saldo = acc[key].entradas - acc[key].saidas
    return acc
  }, {})
  const evolucaoData = Object.values(evolucao).sort((a, b) => a.name.localeCompare(b.name))

  // Indicadores de saúde
  const mediaDiariaSaidas = totalSaidas / Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000))
  const diasDeCaixa = mediaDiariaSaidas > 0 ? Math.round(saldoLiquido / mediaDiariaSaidas) : 0

  const SkeletonBox = ({ h = 22, w = '80%' }) => (
    <div style={{ ...S.skeleton, height: h, width: w }} />
  )

  return (
    <div style={S.page}>
      <style>{`@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Análise do Fluxo de Caixa</h1>
          <p style={{ color: '#475569', fontSize: 14, margin: '4px 0 0' }}>Composição, evolução e indicadores de saúde financeira</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1e293b', padding: '8px 14px', borderRadius: 8, border: '1px solid #334155' }}>
          <span style={{ fontSize: 12, color: '#475569' }}>Período:</span>
          <input type="date" style={S.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span style={{ color: '#334155' }}>→</span>
          <input type="date" style={S.input} value={endDate}   onChange={e => setEndDate(e.target.value)}   />
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Recebido',        value: totalEntradas, color: CHART_PALETTE.entrada, accent: CHART_PALETTE.entrada },
          { label: 'Total Pago',            value: totalSaidas,   color: CHART_PALETTE.saida,   accent: CHART_PALETTE.saida   },
          { label: 'Saldo Líquido',         value: saldoLiquido,  color: saldoLiquido >= 0 ? CHART_PALETTE.ebitda : CHART_PALETTE.saida, accent: saldoLiquido >= 0 ? CHART_PALETTE.ebitda : CHART_PALETTE.saida },
          { label: 'Índice de Cobertura',   value: null,          color: CHART_PALETTE.saldo,   accent: CHART_PALETTE.saldo, custom: cobertura.toFixed(2) + 'x' },
        ].map((k, i) => (
          <div key={i} style={S.kpiCard(k.accent)}>
            <div style={S.kpiLabel}>{k.label}</div>
            {loading
              ? <SkeletonBox />
              : <div style={{ ...S.kpiValue, color: k.color }}>{k.custom ?? fmtFull(k.value)}</div>
            }
            {!loading && k.value !== null && (
              <div style={S.kpiSub}>{k.value >= 0 ? '▲ Positivo' : '▼ Atenção'}</div>
            )}
          </div>
        ))}
      </div>

      {/* Composição Entradas + Saídas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {[
          { title: 'Composição das Entradas', cats: entCats, color: CHART_PALETTE.entrada, total: totalEntradas },
          { title: 'Composição das Saídas',   cats: saiCats, color: CHART_PALETTE.saida,   total: totalSaidas   },
        ].map((panel, pi) => (
          <div key={pi} style={S.card}>
            <div style={S.cardTitle}>{panel.title}</div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[80, 65, 50].map((w, i) => <SkeletonBox key={i} h={36} w={`${w}%`} />)}
              </div>
            ) : panel.cats.length === 0 ? (
              <p style={{ color: '#334155', fontSize: 13, fontStyle: 'italic' }}>Nenhum dado disponível.</p>
            ) : (
              panel.cats.slice(0, 6).map((c, i) => {
                const pct = panel.total > 0 ? (c.value / panel.total * 100) : 0
                return (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: '#cbd5e1', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{fmtPct(pct)}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: panel.color }}>{fmtFull(c.value)}</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#334155', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ))}
      </div>

      {/* Evolução Mensal */}
      <div style={S.card}>
        <div style={S.cardTitle}>Evolução Mensal — Entradas vs Saídas</div>
        {loading ? <SkeletonBox h={240} w="100%" /> : evolucaoData.length === 0 ? (
          <p style={{ color: '#334155', fontSize: 13, fontStyle: 'italic' }}>Nenhum dado para o período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={evolucaoData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={fmtCompact} />
              <Tooltip contentStyle={{ background: '#1a2540', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} formatter={(v, n) => [fmtFull(v), n === 'entradas' ? 'Entradas' : n === 'saidas' ? 'Saídas' : 'Saldo']} />
              <Legend formatter={v => v === 'entradas' ? 'Entradas' : v === 'saidas' ? 'Saídas' : 'Saldo'} />
              <Bar dataKey="entradas" fill={CHART_PALETTE.entrada} radius={[3,3,0,0]} barSize={22} name="entradas" />
              <Bar dataKey="saidas"   fill={CHART_PALETTE.saida}   radius={[3,3,0,0]} barSize={22} name="saidas"   />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Indicadores de Saúde */}
      <div style={S.card}>
        <div style={S.cardTitle}>Indicadores de Saúde Financeira</div>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[1,2,3,4,5,6].map(i => <SkeletonBox key={i} h={64} w="100%" />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'Índice de Cobertura',      value: cobertura.toFixed(2) + 'x',    desc: 'Entradas / Saídas',               ok: cobertura >= 1 },
              { label: 'Burn Rate Médio (diário)',  value: fmtCompact(mediaDiariaSaidas), desc: 'Média de saídas por dia',         ok: mediaDiariaSaidas > 0 },
              { label: 'Saldo Líquido',             value: fmtCompact(saldoLiquido),      desc: 'Entradas − Saídas no período',    ok: saldoLiquido >= 0 },
              { label: 'Total de Transações',       value: data.length,                   desc: 'Lançamentos no período',          ok: data.length > 0 },
              { label: 'Ticket Médio Entradas',     value: entradas.length > 0 ? fmtCompact(totalEntradas / entradas.length) : '—', desc: 'Média por lançamento de entrada', ok: true },
              { label: 'Ticket Médio Saídas',       value: saidas.length > 0   ? fmtCompact(totalSaidas   / saidas.length)   : '—', desc: 'Média por lançamento de saída',   ok: true },
            ].map((ind, i) => (
              <div key={i} style={{ background: '#1a2540', borderRadius: 8, padding: '14px 16px', border: '1px solid #334155' }}>
                <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{ind.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: ind.ok ? '#3b82f6' : '#f59e0b', marginBottom: 3 }}>{ind.value}</div>
                <div style={{ fontSize: 11, color: '#334155' }}>{ind.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
