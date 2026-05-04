'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { supabase } from '@/lib/supabase'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()

const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtCompact = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)

// ─── Lógica F/D ─────────────────────────────────────────────────────────────────
// Receita: realizado > orçado = F (favorável — recebemos mais)
// Custo / Despesa: realizado < orçado = F (favorável — gastamos menos)
const calcFD = (realizado, orcado, isExpense) => {
  if (!orcado || orcado === 0) return null
  const delta = realizado - orcado
  const deltaPct = (delta / Math.abs(orcado)) * 100
  const favorable = isExpense ? delta <= 0 : delta >= 0
  return { delta, deltaPct, favorable }
}

const S = {
  page: { color: '#e5e7eb', padding: '0' },
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '20px 24px', marginBottom: '16px' },
  cardTitle: { fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '16px' },
  select: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: '8px', color: '#e5e7eb', padding: '8px 12px', fontSize: '13px', outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1e1e2e', fontWeight: 700, textAlign: 'right' },
  thLeft: { padding: '10px 12px', fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1e1e2e', fontWeight: 700, textAlign: 'left' },
  td: { padding: '10px 12px', fontSize: '13px', color: '#e5e7eb', borderBottom: '1px solid #0f0f18', textAlign: 'right' },
  tdLeft: { padding: '10px 12px', fontSize: '13px', color: '#e5e7eb', borderBottom: '1px solid #0f0f18', textAlign: 'left' },
  subtotal: { background: '#1a1a2e', fontWeight: 700 },
  total: { background: '#1e2235', fontWeight: 800, borderTop: '2px solid #2a2a4a' },
  groupHeader: { background: '#0a0a14', borderTop: '2px solid #1e1e2e', borderBottom: '1px solid #1e1e2e' },
}

// ─── Badge F / D ─────────────────────────────────────────────────────────────────
const FDBadge = ({ favorable, size = 'sm' }) => {
  if (favorable === null) return <span style={{ color: '#4b5563', fontSize: '11px' }}>—</span>
  return (
    <span style={{
      display: 'inline-block',
      fontSize: size === 'lg' ? '12px' : '11px',
      fontWeight: 700,
      padding: size === 'lg' ? '3px 10px' : '2px 7px',
      borderRadius: '4px',
      letterSpacing: '0.5px',
      color: favorable ? '#10b981' : '#ef4444',
      background: favorable ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      border: `1px solid ${favorable ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
    }}>
      {favorable ? '✓ F' : '✗ D'}
    </span>
  )
}

// ─── Linha da tabela DRE ────────────────────────────────────────────────────────
const DRERow = ({ label, orcado, realizado, isExpense, isSubtotal, isTotal, isGroupHeader, indent = false }) => {
  const fd = calcFD(realizado, orcado, isExpense)
  const rowStyle = isTotal ? S.total : isSubtotal ? S.subtotal : isGroupHeader ? S.groupHeader : {}
  const labelColor = isTotal ? '#fff' : isSubtotal ? '#e5e7eb' : isGroupHeader ? '#9ca3af' : '#d1d5db'
  const fontSize = isTotal ? '14px' : isSubtotal ? '13px' : isGroupHeader ? '11px' : '13px'

  return (
    <tr style={rowStyle}>
      <td style={{ ...S.tdLeft, color: labelColor, fontSize, paddingLeft: indent ? '28px' : '12px', fontWeight: isTotal || isSubtotal ? 700 : 400, letterSpacing: isGroupHeader ? '0.8px' : 0 }}>
        {isGroupHeader ? label.toUpperCase() : label}
      </td>
      <td style={{ ...S.td, color: isGroupHeader ? 'transparent' : '#9ca3af' }}>
        {isGroupHeader ? '' : fmtFull(orcado)}
      </td>
      <td style={{ ...S.td, color: isGroupHeader ? 'transparent' : '#fff', fontWeight: isTotal || isSubtotal ? 700 : 400 }}>
        {isGroupHeader ? '' : fmtFull(realizado)}
      </td>
      <td style={{ ...S.td, color: isGroupHeader ? 'transparent' : (fd ? (fd.favorable ? '#10b981' : '#ef4444') : '#6b7280') }}>
        {isGroupHeader ? '' : (fd ? (fd.delta >= 0 ? '+' : '') + fmtFull(fd.delta) : '—')}
      </td>
      <td style={{ ...S.td, color: isGroupHeader ? 'transparent' : (fd ? (fd.favorable ? '#10b981' : '#ef4444') : '#6b7280') }}>
        {isGroupHeader ? '' : (fd ? (fd.deltaPct >= 0 ? '+' : '') + fd.deltaPct.toFixed(1) + '%' : '—')}
      </td>
      <td style={{ ...S.td, textAlign: 'center' }}>
        {isGroupHeader ? '' : <FDBadge favorable={fd?.favorable ?? null} size={isTotal ? 'lg' : 'sm'} />}
      </td>
    </tr>
  )
}

// ─── KPI Card simples ────────────────────────────────────────────────────────────
const KPICard = ({ label, orcado, realizado, isExpense, color }) => {
  const fd = calcFD(realizado, orcado, isExpense)
  const atingimento = orcado > 0 ? (realizado / orcado * 100) : 0

  return (
    <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '16px 20px', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{fmtFull(realizado)}</div>
      <div style={{ fontSize: '12px', color: '#4b5563', marginBottom: '8px' }}>Orçado: {fmtFull(orcado)}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, height: '4px', background: '#1e1e2e', borderRadius: '2px', marginRight: '10px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, atingimento)}%`, background: fd?.favorable ? '#10b981' : '#ef4444', borderRadius: '2px', transition: 'width 0.5s ease' }} />
        </div>
        <span style={{ fontSize: '12px', color: fd?.favorable ? '#10b981' : '#ef4444', fontWeight: 700, whiteSpace: 'nowrap' }}>
          {atingimento.toFixed(0)}%
        </span>
        <FDBadge favorable={fd?.favorable ?? null} />
      </div>
    </div>
  )
}

// ─── Página Principal ────────────────────────────────────────────────────────────
export default function OrcamentoPage() {
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(ANO_ATUAL)
  const [viewMode, setViewMode] = useState('mensal') // 'mensal' | 'acumulado'
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
      try {
        if (viewMode === 'mensal') {
          // Período mensal
          const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`
          const endDate = new Date(ano, mes, 0).toISOString().split('T')[0]
          const [{ data: lanc }, { data: orc }] = await Promise.all([
            supabase.from('lancamentos').select('*').eq('empresa_id', empresaId).gte('data', startDate).lte('data', endDate),
            supabase.from('orcamentos').select('*').eq('empresa_id', empresaId).eq('ano', ano).eq('mes', mes)
          ])
          setRealizado(lanc || [])
          setOrcado(orc || [])
        } else {
          // Acumulado anual (Jan até mês selecionado)
          const startDate = `${ano}-01-01`
          const endDate = new Date(ano, mes, 0).toISOString().split('T')[0]
          const mesesRange = Array.from({ length: mes }, (_, i) => i + 1)
          const [{ data: lanc }, { data: orc }] = await Promise.all([
            supabase.from('lancamentos').select('*').eq('empresa_id', empresaId).gte('data', startDate).lte('data', endDate),
            supabase.from('orcamentos').select('*').eq('empresa_id', empresaId).eq('ano', ano).in('mes', mesesRange)
          ])
          setRealizado(lanc || [])
          setOrcado(orc || [])
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [empresaId, mes, ano, viewMode])

  // ─── Consolidação por categoria e tipo ────────────────────────────────────────
  const buildRows = (tipo) => {
    const cats = [...new Set([
      ...realizado.filter(r => r.tipo === tipo).map(r => r.categoria || 'Sem categoria'),
      ...orcado.filter(o => o.tipo === tipo).map(o => o.categoria || 'Sem categoria')
    ])].sort()

    return cats.map(cat => ({
      categoria: cat,
      realizado: realizado.filter(r => r.tipo === tipo && (r.categoria || 'Sem categoria') === cat).reduce((acc, curr) => acc + Number(curr.valor), 0),
      orcado: orcado.filter(o => o.tipo === tipo && (o.categoria || 'Sem categoria') === cat).reduce((acc, curr) => acc + Number(curr.valor_orcado), 0),
    }))
  }

  const receitaRows  = buildRows('receita')
  const custoRows    = buildRows('custo')
  const despesaRows  = buildRows('despesa')

  const totRec  = { r: receitaRows.reduce((a, c) => a + c.realizado, 0),  o: receitaRows.reduce((a, c) => a + c.orcado, 0)  }
  const totCus  = { r: custoRows.reduce((a, c) => a + c.realizado, 0),    o: custoRows.reduce((a, c) => a + c.orcado, 0)    }
  const totDesp = { r: despesaRows.reduce((a, c) => a + c.realizado, 0),  o: despesaRows.reduce((a, c) => a + c.orcado, 0)  }

  const lucroBrutoR = totRec.r - totCus.r
  const lucroBrutoO = totRec.o - totCus.o
  const ebitdaR = lucroBrutoR - totDesp.r
  const ebitdaO = lucroBrutoO - totDesp.o

  // Atingimento geral para o gráfico por mês (acumulado)
  const chartMeses = MESES_ABREV.slice(0, mes).map((m, i) => {
    const mNum = i + 1
    const orcM = orcado.filter(o => o.mes === mNum).reduce((a, c) => a + Number(c.valor_orcado), 0)
    const realM = realizado.filter(r => {
      const d = new Date(r.data + 'T00:00:00')
      return d.getMonth() + 1 === mNum
    }).reduce((a, c) => a + Number(c.valor), 0)
    return { name: m, orcado: orcM, realizado: realM }
  })

  const periodoLabel = viewMode === 'mensal'
    ? `${MESES[mes - 1]}/${ano}`
    : `Acumulado Jan–${MESES_ABREV[mes - 1]}/${ano}`

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: 0 }}>Budget vs. Realizado</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }}>
          Análise de atingimento orçamentário com indicadores F/D (Favorável / Desfavorável)
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={S.select} value={mes} onChange={e => setMes(+e.target.value)}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select style={S.select} value={ano} onChange={e => setAno(+e.target.value)}>
          {[ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {/* Toggle Mensal / Acumulado */}
        <div style={{ display: 'flex', background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '8px', overflow: 'hidden' }}>
          {['mensal', 'acumulado'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '8px 16px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: viewMode === mode ? '#1d4ed8' : 'transparent',
                color: viewMode === mode ? '#bfdbfe' : '#6b7280',
                transition: 'all 0.2s'
              }}
            >
              {mode === 'mensal' ? '📅 Mensal' : '📊 Acumulado'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '13px', color: '#4b5563', marginLeft: '4px' }}>{periodoLabel}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#3b82f6', padding: '60px' }}>Carregando dados...</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <KPICard label="Receita Bruta"  orcado={totRec.o}   realizado={totRec.r}   isExpense={false} color="#3b82f6" />
            <KPICard label="Custos Totais"  orcado={totCus.o}   realizado={totCus.r}   isExpense={true}  color="#ef4444" />
            <KPICard label="Despesas Totais" orcado={totDesp.o} realizado={totDesp.r}  isExpense={true}  color="#f59e0b" />
            <KPICard label="EBITDA"          orcado={ebitdaO}   realizado={ebitdaR}    isExpense={false} color="#10b981" />
          </div>

          {/* Tabela DRE Estruturada */}
          <div style={S.card}>
            <div style={{ ...S.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>DRE — Budget vs. Realizado · {periodoLabel}</span>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ color: '#10b981' }}>✓ F = Favorável ao resultado</span>
                <span style={{ color: '#ef4444' }}>✗ D = Desfavorável ao resultado</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.thLeft, width: '36%' }}>Conta / Categoria</th>
                    <th style={S.th}>Orçado</th>
                    <th style={S.th}>Realizado</th>
                    <th style={S.th}>Variação R$</th>
                    <th style={S.th}>Variação %</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>F / D</th>
                  </tr>
                </thead>
                <tbody>
                  {/* RECEITAS */}
                  <DRERow label="Receitas" isGroupHeader />
                  {receitaRows.length === 0
                    ? <tr><td colSpan={6} style={{ ...S.tdLeft, color: '#4b5563', padding: '10px 28px', fontStyle: 'italic' }}>Sem lançamentos de receita neste período</td></tr>
                    : receitaRows.map((r, i) => <DRERow key={i} label={r.categoria} orcado={r.orcado} realizado={r.realizado} isExpense={false} indent />)
                  }
                  <DRERow label="(=) Receita Bruta" orcado={totRec.o} realizado={totRec.r} isExpense={false} isSubtotal />

                  {/* CUSTOS */}
                  <DRERow label="Custos" isGroupHeader />
                  {custoRows.length === 0
                    ? <tr><td colSpan={6} style={{ ...S.tdLeft, color: '#4b5563', padding: '10px 28px', fontStyle: 'italic' }}>Sem lançamentos de custo neste período</td></tr>
                    : custoRows.map((r, i) => <DRERow key={i} label={r.categoria} orcado={r.orcado} realizado={r.realizado} isExpense={true} indent />)
                  }
                  <DRERow label="(–) Total Custos" orcado={totCus.o} realizado={totCus.r} isExpense={true} isSubtotal />

                  {/* LUCRO BRUTO */}
                  <DRERow label="(=) Lucro Bruto" orcado={lucroBrutoO} realizado={lucroBrutoR} isExpense={false} isSubtotal />

                  {/* DESPESAS */}
                  <DRERow label="Despesas Operacionais" isGroupHeader />
                  {despesaRows.length === 0
                    ? <tr><td colSpan={6} style={{ ...S.tdLeft, color: '#4b5563', padding: '10px 28px', fontStyle: 'italic' }}>Sem lançamentos de despesa neste período</td></tr>
                    : despesaRows.map((r, i) => <DRERow key={i} label={r.categoria} orcado={r.orcado} realizado={r.realizado} isExpense={true} indent />)
                  }
                  <DRERow label="(–) Total Despesas" orcado={totDesp.o} realizado={totDesp.r} isExpense={true} isSubtotal />

                  {/* EBITDA */}
                  <DRERow label="(=) EBITDA" orcado={ebitdaO} realizado={ebitdaR} isExpense={false} isTotal />
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico Evolução Mensal */}
          {viewMode === 'acumulado' && chartMeses.length > 1 && (
            <div style={S.card}>
              <div style={S.cardTitle}>Evolução Mensal — Orçado vs. Realizado (Total)</div>
              <div style={{ height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMeses} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e1e2e" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={fmtCompact} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v, name) => [fmtFull(v), name === 'orcado' ? 'Orçado' : 'Realizado']}
                    />
                    <Legend formatter={(v) => v === 'orcado' ? 'Orçado' : 'Realizado'} />
                    <Bar dataKey="orcado"    fill="#2563eb" opacity={0.6} radius={[3,3,0,0]} barSize={20} />
                    <Bar dataKey="realizado" fill="#3b82f6" radius={[3,3,0,0]} barSize={20}>
                      {chartMeses.map((entry, i) => (
                        <Cell key={i} fill={entry.realizado >= entry.orcado ? '#10b981' : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Legenda F/D */}
          <div style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: '#4b5563', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <span><strong style={{ color: '#6b7280' }}>Lógica F/D aplicada:</strong></span>
            <span>📈 <strong style={{ color: '#10b981' }}>Receita:</strong> Realizado {'>'} Orçado = Favorável</span>
            <span>📉 <strong style={{ color: '#10b981' }}>Custo/Despesa:</strong> Realizado {'<'} Orçado = Favorável</span>
            <span>⚠️ Resultado oposto em qualquer linha = Desfavorável</span>
          </div>
        </>
      )}
    </div>
  )
}
