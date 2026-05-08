'use client'
import { useState, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { CheckCircle2, AlertCircle, Plus } from 'lucide-react'

export default function UploadExcel({ onFileSelect, mappings = [], planoContas = [], onAddMapping, initialData }) {
  const [status, setStatus] = useState(initialData?.length > 0 ? 'success' : 'idle')
  const [data, setData] = useState(initialData || [])
  const [editingRow, setEditingRow] = useState(null)
  const [selectedContaId, setSelectedContaId] = useState('')
  const [filter, setFilter] = useState('all')
  const fileInputRef = useRef(null)

  const validateRow = (row, currentMappings) => {
    const desc = String(row['Descrição'] || row['descrição'] || '').trim()
    const isMapped = currentMappings.some(m => m.categoria_origem.toLowerCase() === desc.toLowerCase())
    return { isValid: isMapped, categoriaERP: desc }
  }

  const processFile = async (file) => {
    if (!file) return
    setStatus('processing')
    try {
      const buffer = await file.arrayBuffer()
      const isCsv = file.name.toLowerCase().endsWith('.csv')
      let workbook
      if (isCsv) {
        const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '')
        const sep = text.split('\n')[0].includes(';') ? ';' : ','
        workbook = XLSX.read(text, { type: 'string', FS: sep })
      } else {
        workbook = XLSX.read(buffer, { type: 'array' })
      }
      const sheetName = workbook.SheetNames[0]
      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
      const rows = (rawRows || []).map(row => {
        const r = {}
        Object.keys(row).forEach(k => { r[k.trim()] = typeof row[k] === 'string' ? row[k].trim() : row[k] })
        return r
      })
      
      const processed = rows.map((row, index) => ({
        ...row,
        __id: index,
        __validation: validateRow(row, mappings)
      }))
      
      setData(processed)
      setStatus('success')
      onFileSelect?.(processed)
    } catch (err) {
      console.error('Erro ao processar arquivo:', err)
      setStatus('error')
    }
  }

  const handleConfirmMapping = async () => {
    if (!selectedContaId || !editingRow) return
    
    const categoriaERP = editingRow.__validation.categoriaERP
    await onAddMapping?.(categoriaERP, selectedContaId)
    
    // Atualizar validação local após mapear
    const newMappings = [...mappings, { categoria_origem: categoriaERP }]
    const updatedData = data.map(row => ({
      ...row,
      __validation: validateRow(row, newMappings)
    }))
    
    setData(updatedData)
    onFileSelect?.(updatedData)
    setEditingRow(null)
    setSelectedContaId('')
  }

  const filteredData = useMemo(() => {
    if (filter === 'error') return data.filter(r => !r.__validation.isValid)
    return data
  }, [data, filter])

  return (
    <div className="space-y-4">
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".xlsx,.csv" 
        onChange={(e) => processFile(e.target.files[0])} 
        className="hidden" 
      />
      
      {status === 'idle' && (
        <div 
          className="border-2 border-dashed border-zinc-700 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 transition-colors bg-zinc-900/50" 
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="w-10 h-10 text-zinc-500 mx-auto mb-4" />
          <p className="text-white font-medium">Clique para selecionar o arquivo CSV/XLSX</p>
          <p className="text-zinc-500 text-sm mt-2">O sistema usará a coluna "Descrição" para o mapeamento</p>
        </div>
      )}

      {status === 'processing' && (
        <div className="p-12 text-center bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Processando arquivo...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-blue-500" />
              <span className="text-white font-medium">{data.length} registros carregados</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilter('all')} 
                className={`px-3 py-1 rounded text-xs font-bold ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFilter('error')} 
                className={`px-3 py-1 rounded text-xs font-bold ${filter === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
              >
                Pendentes
              </button>
              <button 
                onClick={() => { setStatus('idle'); setData([]); onFileSelect(null) }} 
                className="px-3 py-1 rounded text-xs font-bold bg-zinc-800 text-zinc-400 hover:text-white"
              >
                Trocar Arquivo
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-800 text-zinc-400 text-xs uppercase sticky top-0">
                <tr>
                  <th className="p-3">Descrição (Categoria)</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredData.slice(0, 50).map(row => (
                  <tr key={row.__id} className="hover:bg-zinc-800/50">
                    <td className="p-3 text-white font-medium">{row['Descrição'] || row['descrição'] || '-'}</td>
                    <td className="p-3 text-zinc-300">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        parseFloat(String(row['Valor Pago/Recebido'] || row['Valor'] || 0).replace(/\./g, '').replace(',', '.'))
                      )}
                    </td>
                    <td className="p-3">
                      {row.__validation.isValid ? 
                        <span className="text-blue-500 flex items-center gap-1 text-xs font-bold"><CheckCircle2 size={14}/> MAPEADO</span> : 
                        <span className="text-red-500 flex items-center gap-1 text-xs font-bold"><AlertCircle size={14}/> PENDENTE</span>
                      }
                    </td>
                    <td className="p-3 text-right">
                      {!row.__validation.isValid && (
                        <button 
                          onClick={() => setEditingRow(row)} 
                          className="bg-blue-600/10 text-blue-500 px-3 py-1 rounded text-xs font-bold hover:bg-blue-600 hover:text-white transition-all"
                        >
                          Configurar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredData.length > 50 && (
              <div className="p-3 text-center text-zinc-500 text-xs bg-zinc-900 border-t border-zinc-800">
                Mostrando os primeiros 50 de {filteredData.length} registros.
              </div>
            )}
          </div>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="text-blue-500" /> Configurar De-Para
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Categoria no Arquivo</label>
                <div className="bg-zinc-800 p-3 rounded border border-zinc-700 text-white font-medium">
                  {editingRow.__validation.categoriaERP}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Conta no Sistema (Destino)</label>
                <select 
                  value={selectedContaId} 
                  onChange={(e) => setSelectedContaId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white outline-none focus:border-blue-500 appearance-none"
                >
                  <option value="">Selecione uma conta...</option>
                  {(planoContas || []).map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setEditingRow(null)} 
                  className="flex-1 bg-zinc-800 text-white py-3 rounded-lg font-bold hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmMapping} 
                  disabled={!selectedContaId} 
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  Salvar e Validar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
