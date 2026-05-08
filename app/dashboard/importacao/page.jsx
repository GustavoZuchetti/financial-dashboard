'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import UploadExcel from '@/components/UploadExcel'

const S = {
  container: { padding: '24px', color: '#e5e7eb' },
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151', marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' },
  select: { background: '#111827', border: '1px solid #374151', borderRadius: '6px', color: '#fff', padding: '10px 12px', fontSize: '14px', outline: 'none', width: '100%', marginBottom: '12px' },
  btn: { background: '#3b82f6', color: '#000', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  error: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px', color: '#f87171', marginBottom: '16px', fontSize: '13px' },
  success: { background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', padding: '12px', color: '#3b82f6', marginBottom: '16px', fontSize: '13px' }
}

export default function ImportacaoPage() {
  const [empresaId, setEmpresaId] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [planoContas, setPlanoContas] = useState([])
  const [mappings, setMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [uploadedData, setUploadedData] = useState(null)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      try {
        const { data: allEmpresas } = await supabase.from('empresas').select('*').order('nome')
        setEmpresas(allEmpresas || [])
        
        const savedId = localStorage.getItem('empresa_id')
        const initialId = savedId && allEmpresas?.find(e => e.id === savedId) ? savedId : allEmpresas?.[0]?.id
        setEmpresaId(initialId)

        const { data: plano } = await supabase.from('plano_contas').select('*').order('codigo')
        setPlanoContas(plano || [])

        if (initialId) {
          const { data: maps } = await supabase.from('categoria_mappings').select('*').eq('empresa_id', initialId)
          setMappings(maps || [])
        }
      } catch (err) {
        setError('Erro ao carregar dados iniciais.')
      } finally {
        setLoading(false)
      }
    }
    loadInitialData()
  }, [])

  useEffect(() => {
    if (!empresaId) return
    const loadMappings = async () => {
      const { data: maps } = await supabase.from('categoria_mappings').select('*').eq('empresa_id', empresaId)
      setMappings(maps || [])
    }
    loadMappings()
  }, [empresaId])

  const handleAddMapping = async (categoriaERP, contaId) => {
    setError(null)
    setSuccess(null)
    try {
      // Buscar tipo da conta selecionada para salvar corretamente
      const conta = planoContas.find(c => c.id === contaId)
      
      const { error: err } = await supabase.from('categoria_mappings').upsert({
        empresa_id: empresaId,
        categoria_origem: categoriaERP,
        conta_id: contaId,
        tipo_destino: conta?.tipo || 'receita',
        ativo: true
      }, { onConflict: 'empresa_id,categoria_origem' })

      if (err) throw err
      
      const { data: maps } = await supabase.from('categoria_mappings').select('*').eq('empresa_id', empresaId)
      setMappings(maps || [])
      setSuccess(`Mapeamento para "${categoriaERP}" salvo com sucesso!`)
    } catch (err) {
      console.error('Erro ao salvar mapeamento:', err)
      setError(`Erro ao salvar mapeamento: ${err.message}`)
    }
  }

  const handleImportData = async (dataToImport) => {
    if (!dataToImport || dataToImport.length === 0) return
    setIsImporting(true)
    setError(null)
    try {
      const lancamentos = dataToImport.map(row => {
        const desc = (row['Descrição'] || row['descrição'] || '').trim()
        const mapping = mappings.find(m => m.categoria_origem.toLowerCase() === desc.toLowerCase())
        if (!mapping) return null

        return {
          empresa_id: empresaId,
          data: row['Data'] || row['data'] || new Date().toISOString(),
          descricao: row['Nome'] || row['nome'] || '',
          valor: parseFloat(String(row['Valor Pago/Recebido'] || row['Valor'] || 0).replace(/\./g, '').replace(',', '.')),
          tipo: mapping.tipo_destino,
          conta_id: mapping.conta_id,
          categoria: desc
        }
      }).filter(Boolean)

      if (lancamentos.length === 0) throw new Error('Nenhum dado mapeado para importar.')

      const { error: err } = await supabase.from('lancamentos').insert(lancamentos)
      if (err) throw err

      setSuccess(`${lancamentos.length} registros importados com sucesso!`)
      setUploadedData(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsImporting(false)
    }
  }

  if (loading) return <div style={S.container}>Carregando...</div>

  return (
    <div style={S.container}>
      <h1 style={S.title}>Importação / De-Para</h1>

      <div style={S.card}>
        <label style={{ display: 'block', marginBottom: '8px', color: '#9ca3af', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Empresa</label>
        <select style={S.select} value={empresaId || ''} onChange={(e) => {
          setEmpresaId(e.target.value)
          localStorage.setItem('empresa_id', e.target.value)
        }}>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {error && <div style={S.error}>{error}</div>}
      {success && <div style={S.success}>{success}</div>}

      <div style={S.card}>
        <UploadExcel 
          onFileSelect={setUploadedData} 
          mappings={mappings} 
          planoContas={planoContas}
          onAddMapping={handleAddMapping}
          initialData={uploadedData}
        />
        
        {uploadedData && (
          <button 
            style={{ ...S.btn, marginTop: '20px', width: '100%' }} 
            onClick={() => handleImportData(uploadedData)}
            disabled={isImporting}
          >
            {isImporting ? '⏳ Importando...' : '🚀 Finalizar Importação'}
          </button>
        )}
      </div>
    </div>
  )
}
