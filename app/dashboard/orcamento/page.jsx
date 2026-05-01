'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '@/lib/supabase'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const var_ = (r, o) => o ? (((r - o) / Math.abs(o)) * 100).toFixed(1) + '%' : '-'

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  filters: { display: 'flex', gap: 10, marginBottom: 24 },
  select: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e5e7eb', padding: '8px 12px', fontSize: 13, outline: 'none' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  kpiCard: (c) => ({ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '16px 20px', borderLeft: `3px solid ${c}` }),
  kpiLabel: { color: '#9ca3af', fontSize: 12, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  kpiValue: { fontSize: 22, fontWeight: 800, color: '#fff' },
  kpiSub: (pos) => ({ fontSize: 12, color: pos ? '#3b82f6' : '#f87171', marginTop: 4 }),
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '20px 24px', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 4px', fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #1e1e2e', fontWeight: 600 },
  td: { padding: '10px 4px', fontSize: 13, color: '#e5e7eb', borderBottom: '1px solid #1e1e2e' },
}

export default function OrcamentoPage() {
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(ANO_ATUAL)
  const [realizado, setRealizado] = useState([])
  const [orcado, setOrcado] = useState([])
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState(null)

  useEffect(() => {
    const savedId = localStorage.getItem('empresa_id')
    if (savedId) setEmpresaId(savedId)
  }, [])

  useEffect(() => {
    if (!empresaId) return

    const fetchData = async () => {
      setLoading(true)
      // Buscar realizado (lançamentos)
      const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`
      const endDate = new Date(ano, mes, 0).toISOString().split('T')[0]

      const { data: lancamentos } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('data', startDate)
        .lte('data', endDate)

      // Buscar orçado
      const { data: orcamentos } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('ano', ano)
        .eq('mes', mes)

      if (lancamentos) setRealizado(lancamentos)
      if (orcamentos) setOrcado(orcamentos)
      setLoading(false)
    }

    fetchData()
  }, [empresaId, mes, ano])

  // Lógica de consolidação
  const categorias = [...new Set([...realizado.map(r => r.categoria), ...orcado.map(o => o.categoria)])]
  
  const tableData = categorias.map(cat => {
    const real = realizado.filter(r => r.categoria === cat).reduce((acc, curr) => acc + Number(curr.valor), 0)
    const orc = orcado.filter(o => o.categoria === cat).reduce((acc, curr) => acc + Number(curr.valor_orcado), 0)
    return { conta: cat, orcado: orc, realizado: real }
  })

  const totalOrcado = tableData.reduce((acc, curr) => acc + curr.orcado, 0)
  const totalRealizado = tableData.reduce((acc, curr) => acc + curr.realizado, 0)
  const achiev = totalOrcado > 0 ? ((totalRealizado / totalOrcado) * 100).toFixed(1) : '0'

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Orçamento vs Realizado</h1>
        <p style={S.subtitle}>Acompanhamento do desempenho orçamentário</p>
      </div>

      <div style={S.filters}>
        <select style={S.select} value={mes} onChange={e => setMes(+e.target.value)}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select style={S.select} value={ano} onChange={e => setAno(+e.target.value)}>
          {[ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={S.kpiGrid}>
        <div style={S.kpiCard('#3b82f6')}>
          <div style={S.kpiLabel}>Total Orçado</div>
          <div style={S.kpiValue}>{fmtFull(totalOrcado)}</div>
          <div style={S.kpiSub(true)}>Meta do período</div>
        </div>
        <div style={S.kpiCard(totalRealizado >= totalOrcado ? '#3b82f6' : '#ef4444')}>
          <div style={S.kpiLabel}>Total Realizado</div>
          <div style={S.kpiValue}>{fmtFull(totalRealizado)}</div>
          <div style={S.kpiSub(totalRealizado >= totalOrcado)}>{achiev}% da meta atingida</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Detalhamento por Categoria - {MESES[mes - 1]}/{ano}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, textAlign: 'left' }}>Categoria</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Orçado</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Realizado</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Variação</th>
            </tr>
          </thead>
          <tbody>
            {tableData.length === 0 ? (
              <tr><td colSpan="4" style={{ ...S.td, textAlign: 'center', padding: '20px' }}>Nenhum dado para este período.</td></tr>
            ) : (
              tableData.map((row, i) => {
                const v = parseFloat(var_(row.realizado, row.orcado))
                return (
                  <tr key={i}>
                    <td style={S.td}>{row.conta}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{fmtFull(row.orcado)}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{fmtFull(row.realizado)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: v >= 0 ? '#3b82f6' : '#f87171', fontWeight: 600 }}>{var_(row.realizado, row.orcado)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      
      {loading && <div style={{ textAlign: 'center', color: '#3b82f6' }}>Carregando dados...</div>}
    </div>
  )
}
