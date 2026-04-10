'use client'
import { useState } from 'react'

const PLANO_MOCK = [
  { codigo: '1', nome: 'ATIVO', tipo: 'sintetica', nivel: 1, filhos: [
    { codigo: '1.1', nome: 'ATIVO CIRCULANTE', tipo: 'sintetica', nivel: 2, filhos: [
      { codigo: '1.1.1', nome: 'Caixa e Equivalentes', tipo: 'analitica', nivel: 3, saldo: 125000 },
      { codigo: '1.1.2', nome: 'Contas a Receber', tipo: 'analitica', nivel: 3, saldo: 380000 },
      { codigo: '1.1.3', nome: 'Estoques', tipo: 'analitica', nivel: 3, saldo: 95000 },
    ]},
    { codigo: '1.2', nome: 'ATIVO NAO CIRCULANTE', tipo: 'sintetica', nivel: 2, filhos: [
      { codigo: '1.2.1', nome: 'Imobilizado', tipo: 'analitica', nivel: 3, saldo: 450000 },
      { codigo: '1.2.2', nome: 'Depreciacao Acumulada', tipo: 'analitica', nivel: 3, saldo: -120000 },
    ]},
  ]},
  { codigo: '2', nome: 'PASSIVO', tipo: 'sintetica', nivel: 1, filhos: [
    { codigo: '2.1', nome: 'PASSIVO CIRCULANTE', tipo: 'sintetica', nivel: 2, filhos: [
      { codigo: '2.1.1', nome: 'Fornecedores', tipo: 'analitica', nivel: 3, saldo: 180000 },
      { codigo: '2.1.2', nome: 'Obrigacoes Trabalhistas', tipo: 'analitica', nivel: 3, saldo: 65000 },
      { codigo: '2.1.3', nome: 'Impostos a Pagar', tipo: 'analitica', nivel: 3, saldo: 48000 },
    ]},
    { codigo: '2.2', nome: 'PATRIMONIO LIQUIDO', tipo: 'sintetica', nivel: 2, filhos: [
      { codigo: '2.2.1', nome: 'Capital Social', tipo: 'analitica', nivel: 3, saldo: 500000 },
      { codigo: '2.2.2', nome: 'Lucros Acumulados', tipo: 'analitica', nivel: 3, saldo: 137000 },
    ]},
  ]},
  { codigo: '3', nome: 'RECEITAS', tipo: 'sintetica', nivel: 1, filhos: [
    { codigo: '3.1', nome: 'Receita Bruta de Vendas', tipo: 'analitica', nivel: 2, saldo: 850000 },
    { codigo: '3.2', nome: 'Deducoes de Receita', tipo: 'analitica', nivel: 2, saldo: -85000 },
  ]},
  { codigo: '4', nome: 'CUSTOS E DESPESAS', tipo: 'sintetica', nivel: 1, filhos: [
    { codigo: '4.1', nome: 'Custo das Mercadorias Vendidas', tipo: 'analitica', nivel: 2, saldo: -306000 },
    { codigo: '4.2', nome: 'Despesas Comerciais', tipo: 'analitica', nivel: 2, saldo: -95000 },
    { codigo: '4.3', nome: 'Despesas Administrativas', tipo: 'analitica', nivel: 2, saldo: -88000 },
    { codigo: '4.4', nome: 'Despesas Financeiras', tipo: 'analitica', nivel: 2, saldo: -25000 },
  ]},
]

const fmtFull = (v) => v !== undefined ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : ''

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  toolbar: { display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', justifyContent: 'space-between' },
  searchInput: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e5e7eb', padding: '8px 14px', fontSize: 13, width: 260 },
  btn: { background: '#00e676', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, overflow: 'hidden' },
  tableHead: { display: 'grid', gridTemplateColumns: '120px 1fr 100px 140px 100px', padding: '10px 16px', background: '#0a0a0f', borderBottom: '1px solid #1e1e2e' },
  th: { color: '#9ca3af', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  row1: { padding: '12px 16px', display: 'grid', gridTemplateColumns: '120px 1fr 100px 140px 100px', borderBottom: '1px solid #1e1e2e', background: 'rgba(0,230,118,0.04)', alignItems: 'center' },
  row2: { padding: '10px 16px', display: 'grid', gridTemplateColumns: '120px 1fr 100px 140px 100px', borderBottom: '1px solid #1e1e2e', background: 'rgba(255,255,255,0.02)', alignItems: 'center' },
  row3: { padding: '9px 16px 9px 32px', display: 'grid', gridTemplateColumns: '120px 1fr 100px 140px 100px', borderBottom: '1px solid #0d0d18', alignItems: 'center' },
  badge: (t) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: t === 'analitica' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)', color: t === 'analitica' ? '#60a5fa' : '#a78bfa' }),
  toggleBtn: { background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, marginRight: 6 },
}

function ContaRow({ conta, busca, expanded, onToggle }) {
  const temFilhos = conta.filhos && conta.filhos.length > 0
  const aberto = expanded[conta.codigo]
  const match = busca ? conta.nome.toLowerCase().includes(busca.toLowerCase()) || conta.codigo.includes(busca) : true

  if (!match && !temFilhos) return null

  const rowStyle = conta.nivel === 1 ? S.row1 : conta.nivel === 2 ? S.row2 : S.row3
  const nameStyle = { fontSize: conta.nivel === 1 ? 14 : conta.nivel === 2 ? 13 : 12, fontWeight: conta.nivel === 1 ? 800 : conta.nivel === 2 ? 600 : 400, color: conta.nivel === 1 ? '#fff' : conta.nivel === 2 ? '#e5e7eb' : '#9ca3af' }

  return (
    <>
      <div style={rowStyle}>
        <span style={{ color: '#6b7280', fontSize: 12, fontFamily: 'monospace' }}>{conta.codigo}</span>
        <span style={nameStyle}>
          {temFilhos && (
            <button style={S.toggleBtn} onClick={() => onToggle(conta.codigo)}>
              {aberto ? '▾' : '▸'}
            </button>
          )}
          {conta.nome}
        </span>
        <span><span style={S.badge(conta.tipo)}>{conta.tipo}</span></span>
        <span style={{ textAlign: 'right', color: conta.saldo < 0 ? '#f87171' : conta.saldo > 0 ? '#e5e7eb' : '#6b7280', fontSize: 13, fontFamily: 'monospace' }}>
          {conta.saldo !== undefined ? fmtFull(conta.saldo) : ''}
        </span>
        <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={{ background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#60a5fa', fontSize: 11, cursor: 'pointer' }}>Editar</button>
        </span>
      </div>
      {temFilhos && aberto && conta.filhos.map(filho => (
        <ContaRow key={filho.codigo} conta={filho} busca={busca} expanded={expanded} onToggle={onToggle} />
      ))}
    </>
  )
}

export default function PlanoContasPage() {
  const [busca, setBusca] = useState('')
  const [expanded, setExpanded] = useState({ '1': true, '2': true, '3': true, '4': true, '1.1': true, '1.2': true, '2.1': true, '2.2': true })

  const onToggle = (codigo) => setExpanded(prev => ({ ...prev, [codigo]: !prev[codigo] }))

  const totalContas = PLANO_MOCK.reduce((a, g) => a + 1 + (g.filhos?.length || 0) + g.filhos?.reduce((b, f) => b + (f.filhos?.length || 0), 0), 0)

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Plano de Contas</h1>
        <p style={S.subtitle}>Estrutura contabil hierarquica da empresa</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total de Contas', valor: totalContas, cor: '#00e676' },
          { label: 'Contas Analiticas', valor: 12, cor: '#3b82f6' },
          { label: 'Grupos Sinteticos', valor: 8, cor: '#8b5cf6' },
          { label: 'Niveis', valor: 3, cor: '#f59e0b' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 10, padding: '14px 18px', borderLeft: `3px solid ${k.cor}` }}>
            <div style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 4 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <div style={S.toolbar}>
        <input style={S.searchInput} placeholder="Buscar por codigo ou nome..." value={busca} onChange={e => setBusca(e.target.value)} />
        <button style={S.btn}>+ Nova Conta</button>
      </div>

      <div style={S.card}>
        <div style={S.tableHead}>
          <span style={S.th}>Codigo</span>
          <span style={S.th}>Nome</span>
          <span style={S.th}>Tipo</span>
          <span style={{ ...S.th, textAlign: 'right' }}>Saldo</span>
          <span style={{ ...S.th, textAlign: 'right' }}>Acoes</span>
        </div>
        {PLANO_MOCK.map(conta => (
          <ContaRow key={conta.codigo} conta={conta} busca={busca} expanded={expanded} onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}
