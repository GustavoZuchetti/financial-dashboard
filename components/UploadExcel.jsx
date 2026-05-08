'use client'
import { useState, useRef, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { CheckCircle2, AlertCircle, Clock, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

const formatExcelDate = (value) => {
  if (!value) return ''
  let num = parseFloat(String(value).replace(',', '.'))
  if (!isNaN(num) && num > 30000 && num < 60000) {
    try {
      const date = XLSX.SSF.parse_date_code(num)
      return `${String(date.d).padStart(2, '0')}/${String(date.m).padStart(2, '0')}/${date.y}`
    } catch (e) { return String(value) }
  }
  return String(value).trim()
}

export default function UploadExcel({ onFileSelect, mappings = [], planoContas = [], onAddMapping, initialData }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [status, setStatus] = useState(initialData?.length > 0 ? 'success' : 'idle')
  const [data, setData] = useState(initialData || [])
  const [errorMsg, setErrorMsg] = useState('')
  const [editingRow, setEditingRow] = useState(null)
  const [selectedContaId, setSelectedContaId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState('all')
  const rowsPerPage = 10
  const fileInputRef = useRef(null)

  const validateRow = (row) => {
    const categoriaERP = String(row['Descrição'] || row['descrição'] || '').trim()
    const isMapped = mappings.some(m => m.categoria_origem.toLowerCase() === categoriaERP.toLowerCase())
    return { isValid: isMapped, categoriaERP }
  }

  const processFile = async (file) => {
    if (!file) return
    setStatus('processing')
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
      
      const processed = rows.map((row, index) => ({
        ...row,
        __id: index,
        __validation: validateRow(row)
      }))
      
      setData(processed)
      setStatus('success')
      onFileSelect?.(processed)
    } catch (err) {
      setErrorMsg(`Erro: ${err.message}`)
      setStatus('error')
    }
  }

  const handleConfirmMapping = () => {
    if (!selectedContaId || !editingRow) return
    onAddMapping?.(editingRow.__validation.categoriaERP, selectedContaId)
    setEditingRow(null)
    setSelectedContaId('')
  }

  const filteredData = useMemo(() => filter === 'error' ? data.filter(r => !r.__validation.isValid) : data, [data, filter])
  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage), [filteredData, currentPage])

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={(e) => processFile(e.target.files[0])} className="hidden" />
      
      {status === 'idle' && (
        <div className="border-2 border-dashed border-zinc-700 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 transition-colors" onClick={() => fileInputRef.current?.click()}>
          <Plus className="w-10 h-10 text-zinc-500 mx-auto mb-4" />
          <p className="text-white font-medium">Clique para selecionar o arquivo CSV/XLSX</p>
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
              <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded text-xs ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>Todos</button>
              <button onClick={() => setFilter('error')} className={`px-3 py-1 rounded text-xs ${filter === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>Não Mapeados</button>
              <button onClick={() => { setStatus('idle'); setData([]); onFileSelect(null) }} className="px-3 py-1 rounded text-xs bg-zinc-800 text-zinc-400">Trocar</button>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-100 text-sm text-left">
              <thead className="bg-zinc-800 text-zinc-400 text-xs uppercase">
                <tr>
                  <th className="p-3">Descrição (Categoria)</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {paginatedData.map(row => (
                  <tr key={row.__id} className="hover:bg-zinc-800/50">
                    <td className="p-3 text-white">{row['Descrição'] || row['descrição'] || '-'}</td>
                    <td className="p-3 text-zinc-300">{row['Valor Pago/Recebido'] || row['Valor'] || '-'}</td>
                    <td className="p-3">
                      {row.__validation.isValid ? 
                        <span className="text-blue-500 flex items-center gap-1"><CheckCircle2 size={14}/> Mapeado</span> : 
                        <span className="text-red-500 flex items-center gap-1"><AlertCircle size={14}/> Pendente</span>
                      }
                    </td>
                    <td className="p-3">
                      {!row.__validation.isValid && (
                        <button onClick={() => setEditingRow(row)} className="text-blue-500 hover:underline">Configurar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="text-blue-500" /> Configurar De-Para
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Categoria no Arquivo</label>
                <div className="bg-zinc-800 p-3 rounded border border-zinc-700 text-white">
                  {editingRow.__validation.categoriaERP}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Conta no Sistema (Destino)</label>
                <select 
                  value={selectedContaId} 
                  onChange={(e) => setSelectedContaId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded p-3 text-white outline-none focus:border-blue-500"
                >
                  <option value="">Selecione uma conta...</option>
                  {planoContas.map(c => (
                    <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setEditingRow(null)} className="flex-1 bg-zinc-800 text-white py-3 rounded font-bold hover:bg-zinc-700">Cancelar</button>
                <button onClick={handleConfirmMapping} disabled={!selectedContaId} className="flex-1 bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-500 disabled:opacity-50">Salvar e Validar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
