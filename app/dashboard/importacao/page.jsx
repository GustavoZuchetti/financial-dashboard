'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const S = {
  container: { padding: '24px', color: '#e5e7eb' },
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151', marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' },
  sectionTitle: { fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#f3f4f6' },
  tabContainer: { display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #374151', paddingBottom: '16px' },
  tab: (active) => ({ padding: '8px 16px', background: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent', border: active ? '2px solid #3b82f6' : '1px solid #374151', borderRadius: '6px', cursor: 'pointer', color: active ? '#3b82f6' : '#9ca3af', fontWeight: active ? '600' : '400', transition: 'all 0.2s' }),
  input: { background: '#111827', border: '1px solid #374151', borderRadius: '6px', color: '#fff', padding: '10px 12px', fontSize: '14px', outline: 'none', width: '100%', marginBottom: '12px' },
  select: { background: '#111827', border: '1px solid #374151', borderRadius: '6px', color: '#fff', padding: '10px 12px', fontSize: '14px', outline: 'none', width: '100%', marginBottom: '12px' },
  btn: { background: '#3b82f6', color: '#000', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  btnDanger: { background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '16px' },
  th: { textAlign: 'left', color: '#9ca3af', fontSize: '12px', fontWeight: '600', padding: '12px', borderBottom: '1px solid #374151', textTransform: 'uppercase' },
  td: { padding: '12px', borderBottom: '1px solid #1f2937', fontSize: '13px' },
  badge: { display: 'inline-block', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' },
  error: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px', color: '#f87171', marginBottom: '16px', fontSize: '13px' },
  success: { background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', padding: '12px', color: '#3b82f6', marginBottom: '16px', fontSize: '13px' }
}

export default function ImportacaoPage() {
  const [activeTab, setActiveTab] = useState('mappings')
  const [empresaId, setEmpresaId] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [planoContas, setPlanoContas] = useState([])
  const [mappings, setMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
  // Modal para novo mapeamento
  const [showModal, setShowModal] = useState(false)
  const [newMapping, setNewMapping] = useState({ categoria_origem: '', conta_id: '', tipo_destino: 'receita' })
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // Carregar empresas
        const { data: allEmpresas } = await supabase.from('empresas').select('*').order('nome')
        setEmpresas(allEmpresas || [])
        
        const savedId = localStorage.getItem('empresa_id')
        const initialId = savedId && allEmpresas?.find(e => e.id === savedId) ? savedId : allEmpresas?.[0]?.id
        setEmpresaId(initialId)

        // Carregar plano de contas
        const { data: plano } = await supabase.from('plano_contas').select('*').order('codigo')
        setPlanoContas(plano || [])

        if (initialId) {
          // Carregar mapeamentos da empresa
          const { data: maps } = await supabase
            .from('categoria_mappings')
            .select('*, plano_contas(codigo, nome)')
            .eq('empresa_id', initialId)
            .order('categoria_origem')
          setMappings(maps || [])
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
        setError('Erro ao carregar dados. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    if (!empresaId) return

    const loadMappings = async () => {
      try {
        const { data: maps } = await supabase
          .from('categoria_mappings')
          .select('*, plano_contas(codigo, nome)')
          .eq('empresa_id', empresaId)
          .order('categoria_origem')
        setMappings(maps || [])
      } catch (err) {
        console.error('Erro ao carregar mapeamentos:', err)
      }
    }

    loadMappings()
  }, [empresaId])

  const handleSaveMapping = async () => {
    if (!newMapping.categoria_origem || !newMapping.conta_id) {
      setError('Preencha todos os campos obrigatórios.')
      return
    }

    try {
      setError(null)
      setSuccess(null)

      if (editingId) {
        // Atualizar mapeamento existente
        const { error: err } = await supabase
          .from('categoria_mappings')
          .update({
            categoria_origem: newMapping.categoria_origem,
            conta_id: newMapping.conta_id,
            tipo_destino: newMapping.tipo_destino,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)

        if (err) throw err
        setSuccess('Mapeamento atualizado com sucesso!')
      } else {
        // Criar novo mapeamento
        const { error: err } = await supabase
          .from('categoria_mappings')
          .insert({
            empresa_id: empresaId,
            categoria_origem: newMapping.categoria_origem,
            conta_id: newMapping.conta_id,
            tipo_destino: newMapping.tipo_destino,
            ativo: true
          })

        if (err) throw err
        setSuccess('Mapeamento criado com sucesso!')
      }

      setNewMapping({ categoria_origem: '', conta_id: '', tipo_destino: 'receita' })
      setEditingId(null)
      setShowModal(false)

      // Recarregar mapeamentos
      const { data: maps } = await supabase
        .from('categoria_mappings')
        .select('*, plano_contas(codigo, nome)')
        .eq('empresa_id', empresaId)
        .order('categoria_origem')
      setMappings(maps || [])
    } catch (err) {
      console.error('Erro ao salvar mapeamento:', err)
      setError('Erro ao salvar mapeamento. Tente novamente.')
    }
  }

  const handleEditMapping = (mapping) => {
    setNewMapping({
      categoria_origem: mapping.categoria_origem,
      conta_id: mapping.conta_id,
      tipo_destino: mapping.tipo_destino
    })
    setEditingId(mapping.id)
    setShowModal(true)
  }

  const handleDeleteMapping = async (id) => {
    if (!confirm('Tem certeza que deseja deletar este mapeamento?')) return

    try {
      const { error: err } = await supabase
        .from('categoria_mappings')
        .delete()
        .eq('id', id)

      if (err) throw err
      setSuccess('Mapeamento deletado com sucesso!')

      // Recarregar mapeamentos
      const { data: maps } = await supabase
        .from('categoria_mappings')
        .select('*, plano_contas(codigo, nome)')
        .eq('empresa_id', empresaId)
        .order('categoria_origem')
      setMappings(maps || [])
    } catch (err) {
      console.error('Erro ao deletar mapeamento:', err)
      setError('Erro ao deletar mapeamento. Tente novamente.')
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setNewMapping({ categoria_origem: '', conta_id: '', tipo_destino: 'receita' })
    setEditingId(null)
  }

  const getContaNome = (contaId) => {
    const conta = planoContas.find(c => c.id === contaId)
    return conta ? `${conta.codigo} - ${conta.nome}` : 'N/A'
  }

  const getTipoLabel = (tipo) => {
    const labels = {
      'receita': '💰 Receita',
      'custo': '📊 Custo',
      'despesa': '💸 Despesa',
      'fluxo_entrada': '⬆️ Entrada (Fluxo)',
      'fluxo_saida': '⬇️ Saída (Fluxo)'
    }
    return labels[tipo] || tipo
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
      <h1 style={S.title}>Importação / De-Para</h1>

      {/* Seletor de Empresa */}
      <div style={S.card}>
        <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
          Empresa
        </label>
        <select
          style={S.select}
          value={empresaId || ''}
          onChange={(e) => setEmpresaId(e.target.value)}
        >
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {/* Abas */}
      <div style={S.tabContainer}>
        <button style={S.tab(activeTab === 'mappings')} onClick={() => setActiveTab('mappings')}>
          📋 Mapeamentos de Categorias
        </button>
        <button style={S.tab(activeTab === 'info')} onClick={() => setActiveTab('info')}>
          ℹ️ Informações
        </button>
      </div>

      {/* Mensagens */}
      {error && <div style={S.error}>❌ {error}</div>}
      {success && <div style={S.success}>✅ {success}</div>}

      {/* Aba: Mapeamentos */}
      {activeTab === 'mappings' && (
        <div>
          <div style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={S.sectionTitle}>Configurar Mapeamentos</h2>
              <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
                Mapeie as categorias do seu arquivo ERP para as contas do Plano de Contas. Esses mapeamentos serão aplicados automaticamente nas importações.
              </p>
            </div>
            <button style={S.btn} onClick={() => setShowModal(true)}>
              ➕ Novo Mapeamento
            </button>
          </div>

          {/* Tabela de Mapeamentos */}
          <div style={S.card}>
            {mappings.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px' }}>
                Nenhum mapeamento configurado ainda. Clique em "Novo Mapeamento" para começar.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Categoria (ERP)</th>
                      <th style={S.th}>Conta (Plano de Contas)</th>
                      <th style={S.th}>Tipo</th>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map(m => (
                      <tr key={m.id}>
                        <td style={S.td}><strong>{m.categoria_origem}</strong></td>
                        <td style={S.td}>{m.plano_contas?.codigo} - {m.plano_contas?.nome}</td>
                        <td style={S.td}>{getTipoLabel(m.tipo_destino)}</td>
                        <td style={S.td}>
                          <span style={S.badge}>{m.ativo ? '✅ Ativo' : '⏸️ Inativo'}</span>
                        </td>
                        <td style={S.td}>
                          <button
                            style={{ ...S.btnDanger, background: '#3b82f6', color: '#fff', marginRight: '8px' }}
                            onClick={() => handleEditMapping(m)}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            style={S.btnDanger}
                            onClick={() => handleDeleteMapping(m.id)}
                          >
                            🗑️ Deletar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Aba: Informações */}
      {activeTab === 'info' && (
        <div style={S.card}>
          <h2 style={S.sectionTitle}>Como Funciona</h2>
          <div style={{ color: '#9ca3af', lineHeight: '1.8' }}>
            <p><strong style={{ color: '#f3f4f6' }}>1. Configurar Mapeamentos:</strong> Defina como as categorias do seu arquivo ERP devem ser mapeadas para as contas do Plano de Contas.</p>
            <p><strong style={{ color: '#f3f4f6' }}>2. Importar Arquivo:</strong> Quando você importar um arquivo XLS, o sistema automaticamente aplicará esses mapeamentos.</p>
            <p><strong style={{ color: '#f3f4f6' }}>3. Visualizar no DRE:</strong> Os dados importados aparecerão automaticamente nos Demonstrativos, agrupados por conta.</p>
            <p style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #374151' }}>
              <strong style={{ color: '#f3f4f6' }}>Dica:</strong> Use categorias consistentes no seu arquivo ERP para facilitar o mapeamento. Por exemplo: "Vendas", "Custos Diretos", "Despesas Operacionais".
            </p>
          </div>
        </div>
      )}

      {/* Modal: Novo/Editar Mapeamento */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...S.card, width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={S.sectionTitle}>{editingId ? 'Editar' : 'Novo'} Mapeamento</h2>

            <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
              Categoria do Arquivo ERP *
            </label>
            <input
              type="text"
              style={S.input}
              placeholder="Ex: Vendas, Custos Diretos, Despesas Operacionais"
              value={newMapping.categoria_origem}
              onChange={(e) => setNewMapping({ ...newMapping, categoria_origem: e.target.value })}
            />

            <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
              Tipo de Lançamento *
            </label>
            <select
              style={S.select}
              value={newMapping.tipo_destino}
              onChange={(e) => setNewMapping({ ...newMapping, tipo_destino: e.target.value })}
            >
              <option value="receita">💰 Receita</option>
              <option value="custo">📊 Custo</option>
              <option value="despesa">💸 Despesa</option>
              <option value="fluxo_entrada">⬆️ Entrada (Fluxo de Caixa)</option>
              <option value="fluxo_saida">⬇️ Saída (Fluxo de Caixa)</option>
            </select>

            <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
              Conta do Plano de Contas *
            </label>
            <select
              style={S.select}
              value={newMapping.conta_id}
              onChange={(e) => setNewMapping({ ...newMapping, conta_id: e.target.value })}
            >
              <option value="">Selecione uma conta...</option>
              {planoContas
                .filter(c => {
                  // Filtrar contas por tipo
                  if (newMapping.tipo_destino === 'receita') return c.tipo === 'receita'
                  if (newMapping.tipo_destino === 'custo') return c.tipo === 'custo'
                  if (newMapping.tipo_destino === 'despesa') return c.tipo === 'despesa'
                  return true
                })
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} - {c.nome}
                  </option>
                ))}
            </select>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={handleSaveMapping}>
                💾 Salvar
              </button>
              <button
                style={{ ...S.btn, background: '#6b7280', flex: 1 }}
                onClick={closeModal}
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
