'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const S = {
  container: { padding: '24px', color: 'var(--fs-text-1)' },
  card: { backgroundColor: 'var(--fs-surface)', borderRadius: '8px', padding: '20px', border: '1px solid var(--fs-border)', marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' },
  input: { background: 'var(--fs-input-bg)', border: '1px solid var(--fs-input-border)', borderRadius: '6px', color: 'var(--fs-text-1)', padding: '6px 10px', fontSize: '13px', outline: 'none' },
  badge: { display: 'inline-block', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', marginLeft: '8px' },
  row: (level, isTotal, isExpanded) => ({
    display: 'flex',
    alignItems: 'center',
    padding: `${12 + level * 8}px 16px`,
    borderBottom: '1px solid var(--fs-border)',
    background: isTotal ? 'var(--fs-surface-2)' : isExpanded ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
    fontWeight: isTotal ? '700' : level === 0 ? '600' : '400',
    color: isTotal ? 'var(--fs-brand)' : 'var(--fs-text-1)',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }),
  expandIcon: (isOpen) => ({
    marginRight: '12px',
    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
    transition: 'transform 0.2s',
    color: '#3b82f6',
    fontWeight: 'bold'
  }),
  label: { flex: 1, marginRight: '16px' },
  value: (isPositive) => ({
    textAlign: 'right',
    minWidth: '120px',
    color: isPositive ? '#3b82f6' : '#ef4444',
    fontWeight: '600'
  })
}

export default function DREDetalhado() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [empresaId, setEmpresaId] = useState(null)
  const [isConsolidado, setIsConsolidado] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [dreData, setDreData] = useState(null)

  useEffect(() => {
    const savedId = localStorage.getItem('empresa_id')
    if (savedId) {
      setEmpresaId(savedId)
      setIsConsolidado(savedId === 'todas')
    }
  }, [])

  useEffect(() => {
    if (!empresaId) return

    const fetchData = async () => {
      setLoading(true)
      try {
        let query = supabase
          .from('lancamentos')
          .select('*')
          .gte('data', startDate)
          .lte('data', endDate)

        if (isConsolidado) {
          const { data: userEmpresas } = await supabase
            .from('empresas')
            .select('id')
            .eq('user_id', (await supabase.auth.getSession()).data.session.user.id)

          if (userEmpresas) {
            const ids = (userEmpresas || []).map(e => e.id)
            query = query.in('empresa_id', ids)
          }
        } else {
          query = query.eq('empresa_id', empresaId)
        }

        const { data: lancamentos } = await query

        // Agrupar por categoria
        const grouped = {}
        lancamentos?.forEach(l => {
          if (!grouped[l.categoria]) {
            grouped[l.categoria] = []
          }
          grouped[l.categoria].push(l)
        })

        setDreData(grouped)
      } catch (e) {
        console.error('Erro ao carregar DRE:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [empresaId, startDate, endDate, isConsolidado])

  const toggleExpand = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Estrutura do DRE Gerencial
  const dreStructure = [
    {
      codigo: '1.1',
      nome: 'RECEITA BRUTA',
      level: 0,
      children: [
        { codigo: '1.1.1', nome: 'Receita de Serviços', categoria: 'Receita de Serviços', level: 1 },
        { codigo: '1.1.2', nome: 'Receita de Produtos', categoria: 'Receita de Produtos', level: 1 },
      ]
    },
    {
      codigo: '1.2',
      nome: 'IMPOSTOS SOBRE RECEITA',
      level: 0,
      children: [
        { codigo: '1.2.1', nome: 'ICMS', categoria: 'ICMS', level: 1 },
        { codigo: '1.2.2', nome: 'ISS', categoria: 'ISS', level: 1 },
      ]
    },
    {
      codigo: '1.3',
      nome: 'RECEITA LÍQUIDA',
      level: 0,
      isCalculated: true
    },
    {
      codigo: '2.1',
      nome: 'CUSTOS VARIÁVEIS',
      level: 0,
      children: [
        { codigo: '2.1.1', nome: 'CAC', categoria: 'CAC', level: 1 },
        { codigo: '2.1.2', nome: 'CSP', categoria: 'CSP', level: 1 },
      ]
    },
    {
      codigo: '2.2',
      nome: 'LUCRO BRUTO',
      level: 0,
      isCalculated: true
    },
    {
      codigo: '3.1',
      nome: 'DESPESAS FIXAS',
      level: 0,
      children: [
        { codigo: '3.1.1', nome: 'DESPESAS DE DESENVOLVIMENTO', categoria: 'Despesas Desenvolvimento', level: 1 },
        { codigo: '3.1.2', nome: 'DESPESAS GERAIS E ADM', categoria: 'Despesas Gerais', level: 1 },
        { codigo: '3.1.3', nome: 'SALÁRIOS E ENCARGOS ADM', categoria: 'Salários ADM', level: 1 },
        { codigo: '3.1.4', nome: 'DESPESAS OPERACIONAIS', categoria: 'Despesas Operacionais', level: 1 },
        { codigo: '3.1.5', nome: 'DESPESAS DE MKT E COMERCIAIS', categoria: 'Despesas MKT', level: 1 },
        { codigo: '3.1.6', nome: 'SALÁRIOS E ENCARGOS MOB', categoria: 'Salários MOB', level: 1 },
      ]
    },
    {
      codigo: '3.2',
      nome: 'EBITDA',
      level: 0,
      isCalculated: true
    }
  ]

  const getValueForCategory = (categoria) => {
    if (!dreData || !dreData[categoria]) return 0
    return dreData[categoria].reduce((acc, l) => acc + Number(l.valor), 0)
  }

  const getValueForGroup = (group) => {
    if (!group.children) return 0
    return group.children.reduce((acc, child) => acc + getValueForCategory(child.categoria), 0)
  }

  const renderRow = (item, parentKey) => {
    const key = `${parentKey}-${item.codigo}`
    const isOpen = expanded[key]
    const hasChildren = item.children && item.children.length > 0
    const value = item.children ? getValueForGroup(item) : getValueForCategory(item.categoria)

    return (
      <div key={key}>
        <div
          style={S.row(item.level, item.isCalculated, isOpen)}
          onClick={() => hasChildren && toggleExpand(key)}
        >
          <div style={S.label}>
            {hasChildren && (
              <span style={S.expandIcon(isOpen)}>{isOpen ? '▼' : '▶'}</span>
            )}
            <span style={{ marginLeft: hasChildren ? '0' : '24px' }}>{item.nome}</span>
          </div>
          <div style={S.value(value >= 0)}>
            {fmt(Math.abs(value))}
          </div>
        </div>

        {hasChildren && isOpen && (
          <div>
            {(item.children || []).map(child => (
              <div key={`${key}-${child.codigo}`}>
                <div style={S.row(child.level, false, false)}>
                  <div style={S.label}>
                    <span style={{ marginLeft: '24px' }}>{child.nome}</span>
                  </div>
                  <div style={S.value(true)}>
                    {fmt(getValueForCategory(child.categoria))}
                  </div>
                </div>

                {expanded[`${key}-${child.codigo}`] && dreData?.[child.categoria] && (
                  <div>
                    {dreData[child.categoria].map((lancamento, idx) => (
                      <div
                        key={idx}
                        style={{
                          ...S.row(3, false, false),
                          background: 'rgba(59, 130, 246, 0.02)',
                          fontSize: '12px'
                        }}
                      >
                        <div style={S.label}>
                          <span style={{ marginLeft: '48px', color: 'var(--fs-text-2)' }}>
                            {lancamento.descricao?.substring(0, 40) || 'Sem descrição'}
                          </span>
                        </div>
                        <div style={S.value(true)}>
                          {fmt(lancamento.valor)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {dreData?.[child.categoria] && (
                  <div
                    style={{
                      ...S.row(child.level + 1, false, false),
                      cursor: 'pointer',
                      color: '#3b82f6'
                    }}
                    onClick={() => toggleExpand(`${key}-${child.codigo}`)}
                  >
                    <div style={S.label}>
                      <span style={{ marginLeft: '40px', fontSize: '11px' }}>
                        {expanded[`${key}-${child.codigo}`] ? '▼ Ocultar detalhes' : '▶ Ver detalhes'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={S.container}>
        <div style={{ textAlign: 'center', color: '#3b82f6' }}>Carregando...</div>
      </div>
    )
  }

  return (
    <div style={S.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={S.title}>
          DRE Detalhado
          {isConsolidado && <span style={S.badge}>📊 Consolidado</span>}
        </h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--fs-surface)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--fs-border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--fs-text-2)' }}>Período:</span>
            <input type="date" style={S.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span style={{ color: 'var(--fs-text-2)' }}>→</span>
            <input type="date" style={S.input} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          {(dreStructure || []).map(group => renderRow(group, 'root'))}
        </div>
      </div>
    </div>
  )
}
