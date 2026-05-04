'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import UploadExcel from '@/components/UploadExcel'

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
  const [activeTab, setActiveTab] = useState('upload')
  const [empresaId, setEmpresaId] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [planoContas, setPlanoContas] = useState([])
  const [mappings, setMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [importTarget, setImportTarget] = useState('dre')
  
  // Upload
  const [uploadedData, setUploadedData] = useState(null)
  const [isImporting, setIsImporting] = useState(false)
  
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

  const handleImportData = async () => {
    if (!uploadedData || uploadedData.length === 0) {
      setError('Nenhum arquivo carregado.')
      return
    }

    setIsImporting(true)
    setError(null)
    setSuccess(null)

    try {
      const lancamentosToInsert = []

      uploadedData.forEach(row => {
        // Extrair dados do arquivo
        const descricao = row['Descrição'] || row['descrição'] || ''
        const nome = row['Nome'] || row['nome'] || ''
        const valor = parseFloat(String(row['Valor Pago/Recebido'] || row['Valor'] || 0).replace(/\./g, '').replace(',', '.'))
        const dataStr = row['Data'] || row['data'] || new Date().toISOString().split('T')[0]
        const competencia = row['Competência'] || row['competência'] || dataStr

        // Encontrar o mapeamento baseado na descrição
        const mapping = mappings.find(m => m.categoria_origem.toLowerCase() === descricao.toLowerCase())
        
        if (!mapping) {
          console.warn(`Categoria não mapeada: ${descricao}`)
          return
        }

        // Determinar tipo baseado no mapeamento
        let tipo = 'receita'
        if (mapping.tipo_destino === 'custo') tipo = 'custo'
        if (mapping.tipo_destino === 'despesa') tipo = 'despesa'

        // Para fluxo de caixa
        if (importTarget === 'fluxo') {
          lancamentosToInsert.push({
            empresa_id: empresaId,
            data: dataStr,
            descricao: nome,
            tipo: mapping.tipo_destino === 'fluxo_entrada' ? 'entrada' : 'saida',
            valor: Math.abs(valor),
            categoria: descricao
          })
        } else {
          // Para DRE
          lancamentosToInsert.push({
            empresa_id: empresaId,
            data: dataStr,
            descricao: nome,
            tipo: tipo,
            valor: Math.abs(valor),
            conta_id: mapping.conta_id,
            categoria: descricao
          })
        }
      })

      if (lancamentosToInsert.length === 0) {
        setError('Nenhum registro válido para importar.')
        setIsImporting(false)
        return
      }

      // Inserir no banco de dados
      const table = importTarget === 'fluxo' ? 'fluxo_caixa' : 'lancamentos'
      const { error: insertError } = await supabase
        .from(table)
        .insert(lancamentosToInsert)

      if (insertError) throw insertError

      setSuccess(`✅ ${lancamentosToInsert.length} registros importados com sucesso!`)
      setUploadedData(null)
      setActiveTab('mappings')
    } catch (err) {
      console.error('Erro ao importar:', err)
      setError(`Erro ao importar: ${err.message}`)
    } finally {
      setIsImporting(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setNewMapping({ categoria_origem: '', conta_id: '', tipo_destino: 'receita' })
    setEditingId(null)
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
          📋 Configurar Categorias
        </button>
        <button style={S.tab(activeTab === 'upload')} onClick={() => setActiveTab('upload')}>
          📥 Importar Arquivo
        </button>
      </div>

      {/* Mensagens */}
      {error && <div style={S.error}>❌ {error}</div>}
      {success && <div style={S.success}>✅ {success}</div>}

      {/* Aba: Configurar Categorias */}
      {activeTab === 'mappings' && (
        <div>
          <div style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={S.sectionTitle}>Mapeamento de Categorias</h2>
              <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
                Mapeie as categorias do seu arquivo para as contas do Plano de Contas.
              </p>
            </div>
            <button style={S.btn} onClick={() => setShowModal(true)}>
              ➕ Novo Mapeamento
            </button>
          </div>

          <div style={S.card}>
            {mappings.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px' }}>
                Nenhum mapeamento configurado. Clique em "Novo Mapeamento" para começar.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Categoria (Arquivo)</th>
                      <th style={S.th}>Conta (Plano)</th>
                      <th style={S.th}>Tipo</th>
                      <th style={S.th}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map(m => (
                      <tr key={m.id}>
                        <td style={S.td}><strong>{m.categoria_origem}</strong></td>
                        <td style={S.td}>{m.plano_contas?.codigo} - {m.plano_contas?.nome}</td>
                        <td style={S.td}>{m.tipo_destino}</td>
                        <td style={S.td}>
                          <button style={{ ...S.btnDanger, background: '#3b82f6', color: '#fff', marginRight: '8px' }} onClick={() => handleEditMapping(m)}>
                            ✏️ Editar
                          </button>
                          <button style={S.btnDanger} onClick={() => handleDeleteMapping(m.id)}>
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

      {/* Aba: Importar Arquivo */}
      {activeTab === 'upload' && (
        <div>
          <div style={S.card}>
            <h2 style={S.sectionTitle}>Selecionar Arquivo</h2>
            <UploadExcel onDataLoaded={setUploadedData} />
          </div>

          {uploadedData && uploadedData.length > 0 && (
            <div style={S.card}>
              <h2 style={S.sectionTitle}>Preview dos Dados ({uploadedData.length} registros)</h2>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                  Importar para:
                </label>
                <select style={S.select} value={importTarget} onChange={(e) => setImportTarget(e.target.value)}>
                  <option value="dre">📊 DRE (Demonstrativos)</option>
                  <option value="fluxo">💰 Fluxo de Caixa</option>
                </select>
              </div>

              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Nome</th>
                      <th style={S.th}>Descrição (Categoria)</th>
                      <th style={S.th}>Valor</th>
                      <th style={S.th}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedData.slice(0, 10).map((row, idx) => (
                      <tr key={idx}>
                        <td style={S.td}>{row['Nome'] || row['nome'] || '-'}</td>
                        <td style={S.td}><span style={S.badge}>{row['Descrição'] || row['descrição'] || '-'}</span></td>
                        <td style={S.td}>{row['Valor Pago/Recebido'] || row['Valor'] || '-'}</td>
                        <td style={S.td}>{row['Data'] || row['data'] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button style={S.btn} onClick={handleImportData} disabled={isImporting}>
                {isImporting ? '⏳ Importando...' : '✅ Importar Dados'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal: Novo/Editar Mapeamento */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...S.card, width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={S.sectionTitle}>{editingId ? 'Editar' : 'Novo'} Mapeamento</h2>

            <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
              Categoria do Arquivo *
            </label>
            <input
              type="text"
              style={S.input}
              placeholder="Ex: Receita de Serviços, Juros_Antecipação"
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
              <option value="fluxo_entrada">⬆️ Entrada (Fluxo)</option>
              <option value="fluxo_saida">⬇️ Saída (Fluxo)</option>
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
              <button style={{ ...S.btn, background: '#6b7280', flex: 1 }} onClick={closeModal}>
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
