'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

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
  const [status, setStatus] = useState('Pronto')
  const fileInputRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: emps } = await supabase.from('empresas').select('*').order('nome')
        setEmpresas(emps || [])
        const savedId = localStorage.getItem('empresa_id')
        setEmpresaId(savedId || emps?.[0]?.id)
        const { data: plano } = await supabase.from('plano_contas').select('*').order('nome')
        setPlanoContas(plano || [])
        if (savedId || emps?.[0]?.id) {
          const { data: maps } = await supabase.from('categoria_mappings').select('*').eq('empresa_id', savedId || emps?.[0]?.id)
          setMappings(maps || [])
        }
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    init()
  }, [])

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        let content = evt.target.result.replace(/^\uFEFF/, '')
        const lines = content.split(/\r?\n/).filter(l => l.trim())
        if (lines.length < 2) return
        
        const sep = lines[0].includes(';') ? ';' : ','
        const headers = lines[0].split(sep).map(h => h.trim().replace(/"/g, ''))
        
        const dIdx = headers.findIndex(h => h.toLowerCase().includes('descri'))
        const vIdx = headers.findIndex(h => h.toLowerCase().includes('valor'))
        const nIdx = headers.findIndex(h => h.toLowerCase().includes('nome'))
        const dtIdx = headers.findIndex(h => h.toLowerCase().includes('data'))

        const data = lines.slice(1).map((line, i) => {
          const cells = line.split(sep).map(c => c.trim().replace(/"/g, ''))
          return {
            id: i,
            desc: String(cells[dIdx] || '').trim(),
            nome: cells[nIdx] || '',
            valor: cells[vIdx] || '0',
            data: cells[dtIdx] || ''
          }
        })
        setUploadedData(data)
        setStatus(`${data.length} linhas`)
      } catch (err) { setStatus('Erro no arquivo') }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const saveMapping = async () => {
    if (!selectedContaId || !editingRow) return
    try {
      const conta = planoContas.find(c => c.id === selectedContaId)
      await supabase.from('categoria_mappings').upsert({
        empresa_id: empresaId,
        categoria_origem: editingRow.desc,
        conta_id: selectedContaId,
        tipo_destino: conta?.tipo || 'receita',
        ativo: true
      }, { onConflict: 'empresa_id,categoria_origem' })
      const { data: maps } = await supabase.from('categoria_mappings').select('*').eq('empresa_id', empresaId)
      setMappings(maps || [])
      setEditingRow(null)
    } catch (e) { alert('Erro ao salvar') }
  }

  const finalizeImport = async () => {
    setIsImporting(true)
    try {
      const toInsert = uploadedData.map(row => {
        const map = mappings.find(m => m.categoria_origem.toLowerCase() === row.desc.toLowerCase())
        if (!map) return null
        let valor = parseFloat(String(row.valor).replace(/\./g, '').replace(',', '.'))
        return {
          empresa_id: empresaId,
          data: row.data || new Date().toISOString(),
          descricao: row.nome || '',
          valor: isNaN(valor) ? 0 : valor,
          tipo: map.tipo_destino,
          conta_id: map.conta_id,
          categoria: row.desc
        }
      }).filter(Boolean)
      if (toInsert.length > 0) await supabase.from('lancamentos').insert(toInsert)
      alert('Importado!')
      setUploadedData([])
    } catch (e) { alert('Erro') } finally { setIsImporting(false) }
  }

  if (loading) return <div className="p-8 text-white">Carregando...</div>

  return (
    <div className="p-6 text-white max-w-4xl mx-auto">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Importação</h1>
        <span className="text-xs text-gray-500">{status}</span>
      </div>
      
      <select 
        className="w-full bg-gray-900 p-3 rounded mb-6 border border-gray-800"
        value={empresaId || ''} 
        onChange={(e) => setEmpresaId(e.target.value)}
      >
        {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </select>

      {uploadedData.length === 0 ? (
        <div 
          className="border-2 border-dashed border-gray-800 p-12 text-center rounded cursor-pointer hover:bg-gray-900"
          onClick={() => fileInputRef.current.click()}
        >
          <p>Clique para selecionar o arquivo CSV</p>
          <input ref={fileInputRef} type="file" hidden onChange={handleFile} accept=".csv" />
        </div>
      ) : (
        <div className="bg-gray-900 p-6 rounded border border-gray-800">
          <div className="flex justify-between mb-4">
            <span className="font-bold">{uploadedData.length} registros</span>
            <button onClick={() => setUploadedData([])} className="text-red-500 text-xs">Remover</button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500 border-b border-gray-800">
                <tr>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {uploadedData.map(row => {
                  const map = mappings.find(m => m.categoria_origem.toLowerCase() === row.desc.toLowerCase())
                  return (
                    <tr key={row.id} className="border-b border-gray-800/50">
                      <td className="p-2">{row.desc}</td>
                      <td className="p-2">{map ? '✅' : '❌'}</td>
                      <td className="p-2 text-right">
                        {!map && <button onClick={() => setEditingRow(row)} className="text-blue-500">Configurar</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button onClick={finalizeImport} className="w-full bg-blue-600 py-3 rounded mt-6 font-bold" disabled={isImporting}>
            {isImporting ? 'Importando...' : 'Finalizar'}
          </button>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 p-6 rounded w-full max-w-sm border border-gray-800">
            <h2 className="text-lg font-bold mb-4">Configurar</h2>
            <p className="text-xs text-gray-500 mb-1">Categoria:</p>
            <div className="bg-black p-2 rounded mb-4 text-blue-400">{editingRow.desc}</div>
            <select 
              className="w-full bg-black p-2 rounded border border-gray-800 mb-6"
              value={selectedContaId} 
              onChange={(e) => setSelectedContaId(e.target.value)}
            >
              <option value="">Selecione a conta...</option>
              {planoContas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setEditingRow(null)} className="flex-1 bg-gray-800 py-2 rounded">Sair</button>
              <button onClick={saveMapping} className="flex-1 bg-blue-600 py-2 rounded">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
