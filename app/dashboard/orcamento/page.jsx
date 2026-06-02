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
  page: { color: 'var(--fs-text-1)', padding: '0' },
  card: { background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: '12px', padding: '20px 24px', marginBottom: '16px' },
  cardTitle: { fontSize: '15px', fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: '16px' },
  select: { background: 'var(--fs-input-bg)', border: '1px solid var(--fs-input-border)', borderRadius: '8px', color: 'var(--fs-text-1)', padding: '8px 12px', fontSize: '13px', outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', fontSize: '11px', color: 'var(--fs-text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--fs-border)', fontWeight: 700, textAlign: 'right' },
  thLeft: { padding: '10px 12px', fontSize: '11px', color: 'var(--fs-text-4)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--fs-border)', fontWeight: 700, textAlign: 'left' },
  td: { padding: '10px 12px', fontSize: '13px', color: 'var(--fs-text-1)', borderBottom: '1px solid var(--fs-border)', textAlign: 'right' },
  tdLeft: { padding: '10px 12px', fontSize: '13px', color: 'var(--fs-text-1)', borderBottom: '1px solid var(--fs-border)', textAlign: 'left' },
  subtotal: { background: 'var(--fs-surface-2)', fontWeight: 700, transition: 'background-color 0.3s' },
  total: { background: '#1e2235', fontWeight: 800, borderTop: '2px solid #2a2a4a' },
  groupHeader: { background: 'var(--fs-surface-2)', borderTop: '1px solid var(--fs-border)', borderBottom: '1px solid var(--fs-border)' },
}

// ─── Badge F / D ─────────────────────────────────────────────────────────────────
const FDBadge = ({ favorable, size = 'sm' }) => {
  if (favorable === null) return <span style={{ color: 'var(--fs-text-4)', fontSize: '11px' }}>—</span>
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
const DRERow = ({ label, orcado, realizado, isExpense, isSubtotal, isTotal, isGroupHeader, indent = false,
                  editMode, editKey, editValue, onEdit }) => {
  const fd = calcFD(realizado, orcado, isExpense)
  const rowStyle = isTotal ? S.total : isSubtotal ? S.subtotal : isGroupHeader ? S.groupHeader : {}
  const labelColor = isTotal ? 'var(--fs-text-1)' : isSubtotal ? 'var(--fs-text-1)' : isGroupHeader ? 'var(--fs-text-3)' : 'var(--fs-text-2)'
  const fontSize = isTotal ? '14px' : isSubtotal ? '13px' : isGroupHeader ? '11px' : '13px'

  const orcDisplay = editMode && editKey && !isGroupHeader && !isSubtotal && !isTotal ? (
    <input
      type="number"
      value={editValue ?? ''}
      onChange={e => onEdit(editKey, e.target.value)}
      style={{
        width: '130px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.4)',
        borderRadius: 6, color: 'var(--fs-text-1)', padding: '4px 8px', fontSize: 13,
        textAlign: 'right', outline: 'none',
      }}
      placeholder="0,00"
    />
  ) : (
    <span style={{ color: isGroupHeader ? 'transparent' : 'var(--fs-text-3)' }}>
      {isGroupHeader ? '' : fmtFull(orcado)}
    </span>
  )

  return (
    <tr style={rowStyle}>
      <td style={{ ...S.tdLeft, color: labelColor, fontSize, paddingLeft: indent ? '28px' : '12px', fontWeight: isTotal || isSubtotal ? 700 : 400, letterSpacing: isGroupHeader ? '0.8px' : 0 }}>
        {isGroupHeader ? label.toUpperCase() : label}
      </td>
      <td style={{ ...S.td, color: isGroupHeader ? 'transparent' : 'var(--fs-text-3)' }}>
        {orcDisplay}
      </td>
      <td style={{ ...S.td, color: isGroupHeader ? 'transparent' : 'var(--fs-text-1)', fontWeight: isTotal || isSubtotal ? 700 : 400 }}>
        {isGroupHeader ? '' : fmtFull(realizado)}
      </td>
      <td style={{ ...S.td, color: isGroupHeader ? 'transparent' : (fd ? (fd.favorable ? '#10b981' : '#ef4444') : '#6b7280') }}>
        {isGroupHeader ? '' : (fd ? (fd.delta >= 0 ? '+' : '') + fmtFull(fd.delta) : '—')}
      </td>
      <td style={{ ...S.td, color: isGroupHeader ? 'transparent' : (fd ? (fd.favorable ? '#10b981' : '#ef4444') : '#6b7280') }}>
        {isGroupHeader ? '' : (fd ? (fd.deltaPct >= 0 ? '+' : '') + fd.deltaPct.toFixed(1) + '%' : '—')}
      </td>
      <td style={{ ...S.td, textAlign: 'center' }}>
        {isGroupHeader ? '' : <FDBadge favorable={editMode ? null : (fd?.favorable ?? null)} size={isTotal ? 'lg' : 'sm'} />}
      </td>
    </tr>
  )
}

// ─── KPI Card simples ────────────────────────────────────────────────────────────
const KPICard = ({ label, orcado, realizado, isExpense, color }) => {
  const fd = calcFD(realizado, orcado, isExpense)
  const atingimento = orcado > 0 ? (realizado / orcado * 100) : 0

  return (
    <div style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: '12px', padding: '16px 20px', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: '11px', color: 'var(--fs-text-4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--fs-brand)', marginBottom: '4px' }}>{fmtFull(realizado)}</div>
      <div style={{ fontSize: '12px', color: 'var(--fs-text-4)', marginBottom: '8px' }}>Orçado: {fmtFull(orcado)}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, height: '4px', background: 'var(--fs-surface-3)', borderRadius: '2px', marginRight: '10px', overflow: 'hidden' }}>
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
  // ─── Estados de edição de orçamento ───────────────────────────────────────
  const [editMode, setEditMode]     = useState(false)
  const [orcEdits, setOrcEdits]     = useState({}) // chave: "tipo|categoria" → valor numérico
  const [savingOrc, setSavingOrc]   = useState(false)
  const [orcMsg, setOrcMsg]         = useState(null)

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

  // ─── Edição de orçamento ───────────────────────────────────────────────────
  const startEditMode = () => {
    // pré-preencher com valores atuais
    const initial = {}
    ;[...receitaRows.map(r => ({...r, tipo:'receita'})),
      ...custoRows.map(r => ({...r, tipo:'custo'})),
      ...despesaRows.map(r => ({...r, tipo:'despesa'}))
    ].forEach(row => { initial[`${row.tipo}|${row.categoria}`] = row.orcado })
    setOrcEdits(initial)
    setEditMode(true)
    setOrcMsg(null)
  }

  const cancelEditMode = () => { setEditMode(false); setOrcEdits({}) }

  const saveOrcamento = async () => {
    if (!empresaId || empresaId === 'todas') {
      setOrcMsg({ t: 'error', m: 'Selecione uma empresa específica para editar o orçamento.' }); return
    }
    setSavingOrc(true)
    try {
      const upsertRows = Object.entries(orcEdits)
        .filter(([, val]) => val !== '' && val !== null && val !== undefined)
        .map(([key, val]) => {
          const idx = key.indexOf('|')
          const tipo      = key.substring(0, idx)
          const categoria = key.substring(idx + 1)
          return { empresa_id: empresaId, ano, mes, categoria, tipo, valor_orcado: parseFloat(String(val).replace(',', '.')) || 0 }
        })
      if (upsertRows.length > 0) {
        const { error } = await supabase.from('orcamentos')
          .upsert(upsertRows, { onConflict: 'empresa_id,ano,mes,categoria,tipo' })
        if (error) { setOrcMsg({ t: 'error', m: 'Erro ao salvar: ' + error.message }); return }
      }
      setOrcMsg({ t: 'ok', m: `✓ Orçamento de ${MESES[mes-1]}/${ano} salvo com sucesso.` })
      setEditMode(false); setOrcEdits({})
      // recarregar dados
      const startDate = `${ano}-${String(mes).padStart(2,'0')}-01`
      const endDate   = new Date(ano, mes, 0).toISOString().split('T')[0]
      const { data: orc } = await supabase.from('orcamentos').select('*')
        .eq('empresa_id', empresaId).eq('ano', ano).eq('mes', mes)
      setOrcado(orc || [])
    } finally { setSavingOrc(false) }
  }
  // ──────────────────────────────────────────────────────────────────────────

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
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--fs-text-1)', margin: 0 }}>Budget vs. Realizado</h1>
          <p style={{ color: 'var(--fs-text-4)', fontSize: '14px', margin: '4px 0 0' }}>
            Análise de atingimento orçamentário com indicadores F/D (Favorável / Desfavorável)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {editMode ? (
            <>
              <button onClick={cancelEditMode} style={{ background: 'transparent', color: 'var(--fs-text-2)', border: '1px solid var(--fs-border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={saveOrcamento} disabled={savingOrc} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: savingOrc ? 0.6 : 1 }}>
                {savingOrc ? 'Salvando...' : 'Salvar Orçamento'}
              </button>
            </>
          ) : (
            <button onClick={startEditMode} style={{ background: 'var(--fs-surface)', color: 'var(--fs-text-1)', border: '1px solid var(--fs-border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              Editar Orçamento
            </button>
          )}
        </div>
      </div>

      {orcMsg && (
        <div style={{ background: orcMsg.t === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${orcMsg.t === 'ok' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 8, padding: '10px 16px', color: orcMsg.t === 'ok' ? '#10b981' : '#f87171', fontSize: 13, marginBottom: 16 }}>
          {orcMsg.m}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={S.select} value={mes} onChange={e => setMes(+e.target.value)}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select style={S.select} value={ano} onChange={e => setAno(+e.target.value)}>
          {[ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {/* Toggle Mensal / Acumulado */}
        <div style={{ display: 'flex', background: 'var(--fs-input-bg)', border: '1px solid var(--fs-input-border)', borderRadius: '8px', overflow: 'hidden' }}>
          {['mensal', 'acumulado'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '8px 16px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: viewMode === mode ? '#1d4ed8' : 'transparent',
                color: viewMode === mode ? '#fff' : 'var(--fs-text-4)',
                transition: 'all 0.2s'
              }}
            >
              {mode === 'mensal' ? 'Mensal' : 'Acumulado'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--fs-text-4)', marginLeft: '4px' }}>{periodoLabel}</span>
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
                    ? <tr><td colSpan={6} style={{ ...S.tdLeft, color: 'var(--fs-text-4)', padding: '10px 28px', fontStyle: 'italic' }}>Sem lançamentos de receita neste período</td></tr>
                    : receitaRows.map((r, i) => <DRERow key={i} label={r.categoria} orcado={r.orcado} realizado={r.realizado} isExpense={false} indent
                        editMode={editMode} editKey={`receita|${r.categoria}`} editValue={orcEdits[`receita|${r.categoria}`] ?? r.orcado}
                        onEdit={(k, v) => setOrcEdits(p => ({...p, [k]: v}))} />)
                  }
                  <DRERow label="(=) Receita Bruta" orcado={totRec.o} realizado={totRec.r} isExpense={false} isSubtotal />

                  {/* CUSTOS */}
                  <DRERow label="Custos" isGroupHeader />
                  {custoRows.length === 0
                    ? <tr><td colSpan={6} style={{ ...S.tdLeft, color: 'var(--fs-text-4)', padding: '10px 28px', fontStyle: 'italic' }}>Sem lançamentos de custo neste período</td></tr>
                    : custoRows.map((r, i) => <DRERow key={i} label={r.categoria} orcado={r.orcado} realizado={r.realizado} isExpense={true} indent
                        editMode={editMode} editKey={`custo|${r.categoria}`} editValue={orcEdits[`custo|${r.categoria}`] ?? r.orcado}
                        onEdit={(k, v) => setOrcEdits(p => ({...p, [k]: v}))} />)
                  }
                  <DRERow label="(–) Total Custos" orcado={totCus.o} realizado={totCus.r} isExpense={true} isSubtotal />

                  {/* LUCRO BRUTO */}
                  <DRERow label="(=) Lucro Bruto" orcado={lucroBrutoO} realizado={lucroBrutoR} isExpense={false} isSubtotal />

                  {/* DESPESAS */}
                  <DRERow label="Despesas Operacionais" isGroupHeader />
                  {despesaRows.length === 0
                    ? <tr><td colSpan={6} style={{ ...S.tdLeft, color: 'var(--fs-text-4)', padding: '10px 28px', fontStyle: 'italic' }}>Sem lançamentos de despesa neste período</td></tr>
                    : despesaRows.map((r, i) => <DRERow key={i} label={r.categoria} orcado={r.orcado} realizado={r.realizado} isExpense={true} indent
                        editMode={editMode} editKey={`despesa|${r.categoria}`} editValue={orcEdits[`despesa|${r.categoria}`] ?? r.orcado}
                        onEdit={(k, v) => setOrcEdits(p => ({...p, [k]: v}))} />)
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fs-border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--fs-text-4)', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--fs-text-4)', fontSize: 11 }} tickFormatter={fmtCompact} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--fs-bg)', border: '1px solid var(--fs-border)', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v, name) => [fmtFull(v), name === 'orcado' ? 'Orçado' : 'Realizado']}
                      cursor={false}
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
          <div style={{ background: 'var(--fs-input-bg)', border: '1px solid var(--fs-input-border)', borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: 'var(--fs-text-4)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <span><strong style={{ color: 'var(--fs-text-4)' }}>Lógica F/D aplicada:</strong></span>
            <span>Receita: Realizado {'>'} Orçado = <strong style={{ color: '#10b981' }}>Favorável</strong></span>
            <span>Custo/Despesa: Realizado {'<'} Orçado = <strong style={{ color: '#10b981' }}>Favorável</strong></span>
            <span>Resultado oposto em qualquer linha = Desfavorável</span>
          </div>
        </>
      )}
    </div>
  )
}
