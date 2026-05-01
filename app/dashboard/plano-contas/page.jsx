'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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
    tipo: conta?.tipo || 'receita',
    pai_id: conta?.pai_id || null,
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
            placeholder="Ex: Receita de Serviços"
          />
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Tipo</label>
          <select 
            style={S.select} 
            value={form.tipo} 
            onChange={(e) => setForm({...form, tipo: e.target.value})}
          >
            <option value="receita">Receita</option>
            <option value="custo">Custo</option>
            <option value="despesa">Despesa</option>
            <option value="ativo">Ativo</option>
            <option value="passivo">Passivo</option>
          </select>
        </div>

        <div style={S.modalActions}>
          <button style={S.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={S.btnSave} onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function PlanoContasPage() {
  const [contas, setContas] = useState([])
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [contaEditando, setContaEditando] = useState(null)
  const [empresaId, setEmpresaId] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      const savedEmpresaId = localStorage.getItem('empresa_id')
      if (savedEmpresaId) {
        setEmpresaId(savedEmpresaId)
        const { data } = await supabase
          .from('plano_contas')
          .select('*')
          .eq('empresa_id', savedEmpresaId)
          .order('codigo')
        if (data) setContas(data)
      }
    }
    loadData()
  }, [])

  const handleSalvarConta = async (formData) => {
    if (!empresaId) return

    if (contaEditando) {
      const { data, error } = await supabase
        .from('plano_contas')
        .update(formData)
        .eq('id', contaEditando.id)
        .select()
        .single()
      
      if (!error && data) {
        setContas(prev => prev.map(c => c.id === data.id ? data : c))
      }
    } else {
      const { data, error } = await supabase
        .from('plano_contas')
        .insert([{ ...formData, empresa_id: empresaId }])
        .select()
        .single()
      
      if (!error && data) {
        setContas(prev => [...prev, data].sort((a, b) => a.codigo.localeCompare(b.codigo)))
      }
    }
  }

  const filteredContas = contas.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) || 
    c.codigo.includes(busca)
  )

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Plano de Contas</h1>
        <p style={S.subtitle}>Estrutura de contas para classificação financeira</p>
      </div>

      <div style={S.toolbar}>
        <input 
          style={S.searchInput} 
          placeholder="Buscar conta..." 
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button style={S.btn} onClick={() => { setContaEditando(null); setModalAberto(true); }}>
          + Nova Conta
        </button>
      </div>

      <div style={S.card}>
        <div style={S.tableHead}>
          <div style={S.th}>Código</div>
          <div style={S.th}>Nome</div>
          <div style={S.th}>Tipo</div>
          <div style={S.th}>Ações</div>
        </div>
        
        {filteredContas.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Nenhuma conta encontrada.</div>
        ) : (
          filteredContas.map(conta => (
            <div key={conta.id} style={S.row2}>
              <div style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{conta.codigo}</div>
              <div style={{ color: '#fff', fontWeight: 600 }}>{conta.nome}</div>
              <div><span style={S.badge(conta.tipo)}>{conta.tipo}</span></div>
              <div>
                <button style={S.editBtn} onClick={() => { setContaEditando(conta); setModalAberto(true); }}>Editar</button>
              </div>
            </div>
          ))
        )}
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
