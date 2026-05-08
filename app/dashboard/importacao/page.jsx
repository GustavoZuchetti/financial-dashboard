'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { CheckCircle2, AlertCircle, Plus, Upload, FileText, Trash2 } from 'lucide-react'

const S = {
  container: { padding: '24px', color: '#e5e7eb', maxWidth: '1200px', margin: '0 auto' },
  card: { backgroundColor: '#111827', borderRadius: '12px', padding: '24px', border: '1px solid #1f2937', marginBottom: '24px' },
  title: { fontSize: '28px', fontWeight: '800', marginBottom: '32px', color: '#fff' },
  label: { display: 'block', marginBottom: '8px', color: '#9ca3af', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' },
  select: { background: '#030712', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff', padding: '12px', fontSize: '14px', outline: 'none', width: '100%', cursor: 'pointer' },
  dropzone: { border: '2px dashed #1f2937', borderRadius: '12px', padding: '48px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: 'rgba(17, 24, 39, 0.5)' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0', marginTop: '16px' },
  th: { textAlign: 'left', color: '#6b7280', fontSize: '11px', fontWeight: '700', padding: '12px', borderBottom: '1px solid #1f2937', textTransform: 'uppercase' },
  td: { padding: '14px 12px', borderBottom: '1px solid #1f2937', fontSize: '13px', color: '#d1d5db' },
  btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', width: '100%' },
  modal: { fixed: 'inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4' },
  modalContent: { background: '#111827', border: '1px solid #1f2937', borderRadius: '16px', padding: '32px', w: 'full', maxW: 'md', shadow: '2xl' }
}

export default function ImportacaoPage() {
  const [empresaId, setEmpresaId] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [planoContas, setPlanoContas] = useState([])
  const [mappings, setMappings] = useState([])
  const [uploadedData, setUploadedData] = useState([])
  const [loading, setLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [selectedContaId, setSelectedContaId] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: emps } = await supabase.from('empresas').select('*').order('nome')
        setEmpresas(emps || [])
        const savedId = localStorage.getItem('empresa_id') || emps?.[0]?.id
        setEmpresaId(savedId)
        
        const { data: plano } = await supabase.from('plano_contas').select('*').order('nome')
        setPlanoContas(plano || [])

        if (savedId) {
          const { data: maps } = await supabase.from('categoria_mappings').select('*').eq('empresa_id', savedId)
          setMappings(maps || [])
        }
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    init()
  }, [])

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
      
      const processed = data.map((row, idx) => ({
        ...row,
        __id: idx,
        __desc: String(row['Descrição'] || row['descrição'] || '').trim()
      }))
      setUploadedData(processed)
    }
    reader.readAsBinaryString(file)
  }

  const saveMapping = async () => {
    if (!selectedContaId || !editingRow) return
    try {
      const conta = planoContas.find(c => c.id === selectedContaId)
      const { error } = await supabase.from('categoria_mappings').upsert({
        empresa_id: empresaId,
        categoria_origem: editingRow.__desc,
        conta_id: selectedContaId,
        tipo_destino: conta?.tipo || 'receita',
        ativo: true
      }, { onConflict: 'empresa_id,categoria_origem' })

      if (error) throw error
      
      const { data: maps } = await supabase.from('categoria_mappings').select('*').eq('empresa_id', empresaId)
      setMappings(maps || [])
      setEditingRow(null)
      setSelectedContaId('')
    } catch (e) { alert('Erro ao salvar mapeamento: ' + e.message) }
  }

  const finalizeImport = async () => {
    setIsImporting(true)
    try {
      const toInsert = uploadedData.map(row => {
        const map = mappings.find(m => m.categoria_origem.toLowerCase() === row.__desc.toLowerCase())
        if (!map) return null
        return {
          empresa_id: empresaId,
          data: row['Data'] || row['data'] || new Date().toISOString(),
          descricao: row['Nome'] || row['nome'] || '',
          valor: parseFloat(String(row['Valor Pago/Recebido'] || row['Valor'] || 0).replace(/\./g, '').replace(',', '.')),
          tipo: map.tipo_destino,
          conta_id: map.conta_id,
          categoria: row.__desc
        }
      }).filter(Boolean)

      if (toInsert.length === 0) throw new Error('Nenhum dado mapeado para importar.')
      const { error } = await supabase.from('lancamentos').insert(toInsert)
      if (error) throw error
      alert(`${toInsert.length} registros importados com sucesso!`)
      setUploadedData([])
    } catch (e) { alert(e.message) }
    finally { setIsImporting(false) }
  }

  if (loading) return <div style={S.container}>Carregando sistema...</div>

  return (
    <div style={S.container}>
      <h1 style={S.title}>Importação / De-Para</h1>

      <div style={S.card}>
        <label style={S.label}>Empresa Selecionada</label>
        <select style={S.select} value={empresaId || ''} onChange={(e) => { setEmpresaId(e.target.value); localStorage.setItem('empresa_id', e.target.value) }}>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {uploadedData.length === 0 ? (
        <div style={S.dropzone} onClick={() => fileInputRef.current.click()}>
          <Upload size={48} color="#2563eb" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>Selecione seu arquivo CSV ou Excel</h3>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>O sistema usará a coluna "Descrição" para o mapeamento automático</p>
          <input ref={fileInputRef} type="file" hidden onChange={handleFile} accept=".csv,.xlsx" />
        </div>
      ) : (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileText color="#2563eb" />
              <span style={{ fontWeight: '700', color: '#fff' }}>{uploadedData.length} registros encontrados</span>
            </div>
            <button onClick={() => setUploadedData([])} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Trash2 size={16} /> Remover Arquivo
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Descrição (Categoria)</th>
                  <th style={S.th}>Valor</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {uploadedData.slice(0, 50).map(row => {
                  const isMapped = mappings.some(m => m.categoria_origem.toLowerCase() === row.__desc.toLowerCase())
                  return (
                    <tr key={row.__id}>
                      <td style={S.td}>{row.__desc || '-'}</td>
                      <td style={S.td}>{row['Valor'] || row['Valor Pago/Recebido'] || '-'}</td>
                      <td style={S.td}>
                        {isMapped ? 
                          <span style={{ color: '#2563eb', fontWeight: '700', fontSize: '11px' }}>● MAPEADO</span> : 
                          <span style={{ color: '#ef4444', fontWeight: '700', fontSize: '11px' }}>● PENDENTE</span>
                        }
                      </td>
                      <td style={S.td}>
                        {!isMapped && <button onClick={() => setEditingRow(row)} style={{ color: '#2563eb', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer' }}>Configurar</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button style={{ ...S.btnPrimary, marginTop: '24px' }} onClick={finalizeImport} disabled={isImporting}>
            {isImporting ? '⏳ Importando...' : '🚀 Finalizar Importação'}
          </button>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div style={S.modalContent}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginBottom: '24px' }}>Configurar De-Para</h3>
            <div style={{ marginBottom: '20px' }}>
              <label style={S.label}>Categoria no Arquivo</label>
              <div style={{ background: '#030712', padding: '12px', borderRadius: '8px', border: '1px solid #1f2937', color: '#fff', fontWeight: '600' }}>{editingRow.__desc}</div>
            </div>
            <div style={{ marginBottom: '32px' }}>
              <label style={S.label}>Conta no Sistema (Destino)</label>
              <select style={S.select} value={selectedContaId} onChange={(e) => setSelectedContaId(e.target.value)}>
                <option value="">Selecione uma conta...</option>
                {planoContas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setEditingRow(null)} style={{ flex: 1, background: '#1f2937', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveMapping} disabled={!selectedContaId} style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', opacity: selectedContaId ? 1 : 0.5 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
