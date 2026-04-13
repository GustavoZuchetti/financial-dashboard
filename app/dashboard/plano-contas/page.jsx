'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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
  btnImport: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, overflow: 'hidden' },
  tableHead: { display: 'grid', gridTemplateColumns: '120px 1fr 100px 140px 100px', padding: '10px 16px', background: '#0a0a0f', borderBottom: '1px solid #1e1e2e' },
  th: { color: '#9ca3af', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  row1: { padding: '12px 16px', display: 'grid', gridTemplateColumns: '120px 1fr 100px 140px 100px', borderBottom: '1px solid #1e1e2e', background: 'rgba(0,230,118,0.04)', alignItems: 'center' },
  row2: { padding: '10px 16px', display: 'grid', gridTemplateColumns: '120px 1fr 100px 140px 100px', borderBottom: '1px solid #1e1e2e', background: 'rgba(255,255,255,0.02)', alignItems: 'center' },
  row3: { padding: '9px 16px 9px 32px', display: 'grid', gridTemplateColumns: '120px 1fr 100px 140px 100px', borderBottom: '1px solid #0d0d18', alignItems: 'center' },
  badge: (t) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: t === 'analitica' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)', color: t === 'analitica' ? '#60a5fa' : '#a78bfa' }),
  toggleBtn: { background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, marginRight: 6 },
  editBtn: { background: 'transparent', border: '1px solid #3b82f6', borderRadius: 6, color: '#3b82f6', padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '24px', width: 500, maxWidth: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20 },
  formGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6 },
  input: { width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 14 },
  select: { width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 14 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  btnCancel: { background: 'transparent', color: '#9ca3af', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSave: { background: '#00e676', color: '#000', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
}

function ModalConta({ conta, onClose, onSave }) {
  const [form, setForm] = useState({
    codigo: conta?.codigo || '',
    nome: conta?.nome || '',
    tipo: conta?.tipo || 'analitica',
    nivel: conta?.nivel || 3,
    saldo: conta?.saldo || 0,
  })

  const handleSave = () => {
    onSave(form)
    onClose()
  }

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={S.modalTitle}>{conta ? 'Editar Conta' : 'Nova Conta'}</h2>
        
        <div style={S.formGroup}>
          <label style={S.label}>Código</label>
          <input 
            style={S.input} 
            value={form.codigo} 
            onChange={(e) => setForm({...form, codigo: e.target.value})}
            placeholder="Ex: 1.1.1"
          />
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Nome da Conta</label>
          <input 
            style={S.input} 
            value={form.nome} 
            onChange={(e) => setForm({...form, nome: e.target.value})}
            placeholder="Ex: Caixa e Equivalentes"
          />
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Tipo</label>
          <select 
            style={S.select} 
            value={form.tipo} 
            onChange={(e) => setForm({...form, tipo: e.target.value})}
          >
            <option value="analitica">Analítica</option>
            <option value="sintetica">Sintética</option>
          </select>
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Nível</label>
          <select 
            style={S.select} 
            value={form.nivel} 
            onChange={(e) => setForm({...form, nivel: Number(e.target.value)})}
          >
            <option value={1}>1 - Grupo Principal</option>
            <option value={2}>2 - Subgrupo</option>
            <option value={3}>3 - Conta Detalhada</option>
          </select>
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Saldo Inicial (R$)</label>
          <input 
            style={S.input} 
            type="number"
            value={form.saldo} 
            onChange={(e) => setForm({...form, saldo: Number(e.target.value)})}
            placeholder="0.00"
          />
        </div>

        <div style={S.modalActions}>
          <button style={S.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={S.btnSave} onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

function ContaRow({ conta, busca, expanded, onToggle, onEdit }) {
  const temFilhos = conta.filhos && conta.filhos.length > 0
  const aberto = expanded[conta.codigo]
  
  const matches = busca === '' || 
    conta.nome.toLowerCase().includes(busca.toLowerCase()) || 
    conta.codigo.includes(busca)

  const nameStyle = {
    fontWeight: conta.nivel === 1 ? 800 : conta.nivel === 2 ? 600 : 400,
    fontSize: conta.nivel === 1 ? 15 : 13,
    color: conta.nivel === 1 ? '#fff' : '#e5e7eb'
  }

  if (!matches && !temFilhos) return null

  return (
    <>
      <div style={conta.nivel === 1 ? S.row1 : conta.nivel === 2 ? S.row2 : S.row3}>
        <div style={{ color: '#9ca3af', fontFamily: 'monospace' }}>
          {conta.codigo}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {temFilhos && (
            <button style={S.toggleBtn} onClick={() => onToggle(conta.codigo)}>
              {aberto ? '▾' : '▸'}
            </button>
          )}
          <span style={nameStyle}>{conta.nome}</span>
        </div>
        <div>
          <span style={S.badge(conta.tipo)}>{conta.tipo}</span>
        </div>
        <div style={{ color: conta.saldo > 0 ? '#e5e7eb' : '#6b7280', fontSize: 13, fontFamily: 'monospace' }}>
          {conta.saldo !== undefined ? fmtFull(conta.saldo) : ''}
        </div>
        <div>
          <button style={S.editBtn} onClick={() => onEdit(conta)}>Editar</button>
        </div>
      </div>
      {temFilhos && aberto && conta.filhos.map(filho => (
        <ContaRow 
          key={filho.codigo} 
          conta={filho} 
          busca={busca}
          expanded={expanded}
          onToggle={onToggle}
          onEdit={onEdit}
        />
      ))}
    </>
  )
}

export default function PlanoContasPage() {
  const [contas, setContas] = useState(PLANO_MOCK)
  const [busca, setBusca] = useState('')
  const [expanded, setExpanded] = useState({ '1': true, '2': true, '3': true, '4': true, '1.1': true, '1.2': true, '2.1': true, '2.2': true })
  const [modalAberto, setModalAberto] = useState(false)
  const [contaEditando, setContaEditando] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('plano_contas')
    if (saved) {
      try {
        setContas(JSON.parse(saved))
      } catch (e) {
        console.error('Erro ao carregar plano de contas:', e)
      }
    }
  }, [])

  const onToggle = (codigo) => setExpanded(prev => ({ ...prev, [codigo]: !prev[codigo] }))

  const handleNovaConta = () => {
    setContaEditando(null)
    setModalAberto(true)
  }

  const handleEditarConta = (conta) => {
    setContaEditando(conta)
    setModalAberto(true)
  }

  const handleSalvarConta = (formData) => {
    let novasContas
    if (contaEditando) {
      const updateRecursive = (list) => list.map(c => {
        if (c.codigo === contaEditando.codigo) return { ...c, ...formData }
        if (c.filhos) return { ...c, filhos: updateRecursive(c.filhos) }
        return c
      })
      novasContas = updateRecursive(contas)
    } else {
      novasContas = [...contas, formData]
    }
    
    setContas(novasContas)
    localStorage.setItem('plano_contas', JSON.stringify(novasContas))
  }

  const totalContas = contas.reduce((a, g) => a + 1 + (g.filhos?.length || 0) + g.filhos?.reduce((b, f) => b + (f.filhos?.length || 0), 0), 0)

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Plano de Contas</h1>
        <p style={S.subtitle}>Estrutura contábil hierárquica da empresa</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total de Contas', valor: totalContas, cor: '#00e676' },
          { label: 'Contas Analíticas', valor: 12, cor: '#3b82f6' },
          { label: 'Grupos Sintéticos', valor: 8, cor: '#8b5cf6' },
          { label: 'Níveis', valor: 3, cor: '#f59e0b' },
        ].map((k, i) => (
          <div key={i} style={{ flex: 1, background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16 }}>
            <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.cor }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <div style={S.toolbar}>
        <input 
          style={S.searchInput} 
          placeholder="Buscar por código ou nome..." 
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnImport} onClick={() => window.location.href='/dashboard/importacao'}>
            📥 Importar XLSx
          </button>
          <button style={S.btn} onClick={handleNovaConta}>
            + Nova Conta
          </button>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.tableHead}>
          <div style={S.th}>Código</div>
          <div style={S.th}>Nome</div>
          <div style={S.th}>Tipo</div>
          <div style={S.th}>Saldo</div>
          <div style={S.th}>Ações</div>
        </div>
        {contas.map(conta => (
          <ContaRow 
            key={conta.codigo} 
            conta={conta} 
            busca={busca}
            expanded={expanded}
            onToggle={onToggle}
            onEdit={handleEditarConta}
          />
        ))}
      </div>

      {modalAberto && (
        <ModalConta 
          conta={contaEditando}
          onClose={() => setModalAberto(false)}
          onSave={handleSalvarConta}
        />
      )}
    </div>
  )
}
