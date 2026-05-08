'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

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
  const [debugInfo, setDebugInfo] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: emps } = await supabase.from('empresas').select('*').order('nome')
        setEmpresas(emps || [])
        const savedId = localStorage.getItem('empresa_id')
        const initialId = savedId || emps?.[0]?.id
        setEmpresaId(initialId)
        const { data: plano } = await supabase.from('plano_contas').select('*').order('nome')
        setPlanoContas(plano || [])
        if (initialId) {
          const { data: maps } = await supabase.from('categoria_mappings').select('*').eq('empresa_id', initialId)
          setMappings(maps || [])
        }
      } catch (e) { 
        setDebugInfo('Erro inicial: ' + e.message)
      } finally { 
        setLoading(false) 
      }
    }
    init()
  }, [])

  const processCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return []
    
    // Detectar separador (vírgula ou ponto e vírgula)
    const firstLine = lines[0]
    const separator = firstLine.includes(';') ? ';' : ','
    
    const headers = firstLine.split(separator).map(h => h.trim().replace(/"/g, ''))
    
    const findIdx = (names) => headers.findIndex(h => names.some(n => h.toLowerCase().includes(n.toLowerCase())))
    
    const descIdx = findIdx(['descrição', 'descricao', 'categoria'])
    const valorIdx = findIdx(['valor', 'pago', 'recebido'])
    const nomeIdx = findIdx(['nome', 'cliente', 'fornecedor'])
    const dataIdx = findIdx(['data', 'vencimento'])

    return lines.slice(1).map((line, i) => {
      const cells = line.split(separator).map(c => c.trim().replace(/"/g, ''))
      const desc = cells[descIdx] || ''
      return {
        __id: i,
        __desc: String(desc).trim(),
        'Nome': cells[nomeIdx] || '',
        'Valor': cells[valorIdx] || '0',
        'Data': cells[dataIdx] || '',
        'Descrição': desc
      }
    })
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setDebugInfo('Processando: ' + file.name)
    
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const content = evt.target.result
        let data = []
        
        if (file.name.toLowerCase().endsWith('.csv')) {
          data = processCSV(content)
        } else {
          const wb = XLSX.read(content, { type: 'binary' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
          data = json.map((row, i) => {
            const desc = row['Descrição'] || row['descrição'] || row['Categoria'] || row['categoria'] || ''
            return {
              ...row,
              __id: i,
              __desc: String(desc).trim()
            }
          })
        }
        
        if (data.length === 0) {
          setDebugInfo('Arquivo vazio ou sem colunas reconhecidas.')
        } else {
          setUploadedData(data)
          setDebugInfo(`Sucesso: ${data.length} linhas carregadas.`)
        }
      } catch (err) { 
        setDebugInfo('Erro: ' + err.message)
        console.error(err)
      }
    }

    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8')
    } else {
      reader.readAsBinaryString(file)
    }
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
      setDebugInfo('Mapeamento salvo!')
    } catch (e) { 
      alert('Erro ao salvar: ' + e.message) 
    }
  }

  const finalizeImport = async () => {
    setIsImporting(true)
    try {
      const toInsert = uploadedData.map(row => {
        const map = mappings.find(m => m.categoria_origem.toLowerCase() === row.__desc.toLowerCase())
        if (!map) return null
        let v = row['Valor'] || 0
        let valor = typeof v === 'number' ? v : parseFloat(String(v).replace(/\./g, '').replace(',', '.'))
        return {
          empresa_id: empresaId,
          data: row['Data'] || new Date().toISOString(),
          descricao: row['Nome'] || '',
          valor: isNaN(valor) ? 0 : valor,
          tipo: map.tipo_destino,
          conta_id: map.conta_id,
          categoria: row.__desc
        }
      }).filter(Boolean)
      
      if (toInsert.length > 0) {
        const { error } = await supabase.from('lancamentos').insert(toInsert)
        if (error) throw error
        alert(`${toInsert.length} registros importados!`)
        setUploadedData([])
      } else {
        alert('Nenhum registro mapeado.')
      }
    } catch (e) { 
      alert('Erro: ' + e.message) 
    } finally { 
      setIsImporting(false) 
    }
  }

  if (loading) return <div className="p-8 text-white">Carregando...</div>

  return (
    <div className="p-6 text-white max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Importação / De-Para</h1>
        <span className="text-[10px] text-gray-500">{debugInfo}</span>
      </div>
      
      <div className="bg-gray-900 p-4 rounded-lg mb-6 border border-gray-800">
        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Empresa</label>
        <select 
          className="w-full bg-black p-2 rounded border border-gray-700 text-white"
          value={empresaId || ''} 
          onChange={(e) => setEmpresaId(e.target.value)}
        >
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {uploadedData.length === 0 ? (
        <div 
          className="border-2 border-dashed border-gray-700 p-16 text-center rounded-xl cursor-pointer hover:border-blue-500 bg-gray-900/50"
          onClick={() => fileInputRef.current.click()}
        >
          <p className="text-lg font-medium mb-1">Selecione seu arquivo CSV ou Excel</p>
          <p className="text-sm text-gray-500">Suporta CSV (vírgula ou ponto e vírgula) e Excel</p>
          <input ref={fileInputRef} type="file" hidden onChange={handleFile} accept=".csv,.xlsx,.xls" />
        </div>
      ) : (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <span className="font-bold">{uploadedData.length} registros encontrados</span>
            <button onClick={() => setUploadedData([])} className="text-red-500 text-xs font-bold">Remover Arquivo</button>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-black text-gray-500">
                <tr>
                  <th className="p-3">Descrição (Arquivo)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {uploadedData.map(row => {
                  const map = mappings.find(m => m.categoria_origem.toLowerCase() === (row.__desc || '').toLowerCase())
                  return (
                    <tr key={row.__id} className="hover:bg-white/5">
                      <td className="p-3 text-gray-300">{row.__desc}</td>
                      <td className="p-3">
                        {map ? <span className="text-blue-500 text-[10px] font-bold">MAPEADO</span> : <span className="text-red-500 text-[10px] font-bold">PENDENTE</span>}
                      </td>
                      <td className="p-3 text-right">
                        {!map && <button onClick={() => setEditingRow(row)} className="text-blue-500 font-bold text-xs">Configurar</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          <button 
            onClick={finalizeImport} 
            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl mt-8 font-black"
            disabled={isImporting}
          >
            {isImporting ? 'IMPORTANDO...' : 'FINALIZAR IMPORTAÇÃO'}
          </button>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-md border border-gray-800">
            <h2 className="text-2xl font-black mb-6">Configurar De-Para</h2>
            <div className="mb-6">
              <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Categoria no arquivo</p>
              <div className="bg-black p-4 rounded-xl border border-gray-800 text-blue-400 font-bold">{editingRow.__desc}</div>
            </div>
            <div className="mb-8">
              <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Conta no sistema</p>
              <select 
                className="w-full bg-black p-4 rounded-xl border border-gray-800 text-white"
                value={selectedContaId} 
                onChange={(e) => setSelectedContaId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {planoContas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setEditingRow(null)} className="flex-1 bg-gray-800 py-4 rounded-xl font-bold">Cancelar</button>
              <button onClick={saveMapping} className="flex-1 bg-blue-600 py-4 rounded-xl font-bold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
