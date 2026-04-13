'use client'
import { useState, useRef, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { CheckCircle2, AlertCircle, Clock, ChevronLeft, ChevronRight, FileText, X } from 'lucide-react'

// --- Helpers ---
const isValidFile = (file) => {
  if (!file) return false
  const name = file.name.toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.csv')
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// Função robusta para converter serial do Excel ou datas em string
const formatExcelDate = (value) => {
  if (value === null || value === undefined || value === '') return ''
  
  // Se for um número (serial do Excel)
  let num = parseFloat(String(value).replace(',', '.'))
  if (!isNaN(num) && num > 30000 && num < 60000) { // Range razoável para datas (1982 a 2064)
    try {
      const date = XLSX.SSF.parse_date_code(num)
      const d = String(date.d).padStart(2, '0')
      const m = String(date.m).padStart(2, '0')
      const y = date.y
      return `${d}/${m}/${y}`
    } catch (e) {
      return String(value)
    }
  }
  
  return String(value)
}

const validateRow = (row) => {
  const errors = []
  if (!row['Nome'] && !row['nome']) errors.push('Nome ausente')
  const valorRaw = row['Valor'] || row['valor'] || row['Valor Pago/Recebido']
  const valor = parseFloat(String(valorRaw).replace(',', '.'))
  if (isNaN(valor)) errors.push('Valor inválido')
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

const S = {
  uploadArea: (isDragging) => ({
    border: `2px dashed ${isDragging ? '#00ff88' : '#3f3f46'}`,
    borderRadius: 12,
    padding: '48px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    background: isDragging ? 'rgba(0, 255, 136, 0.05)' : '#09090b',
    transition: 'all 0.2s ease',
  }),
  btnPrimary: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { background: 'transparent', color: '#a1a1aa', border: '1px solid #27272a', borderRadius: 6, padding: '8px 16px', fontSize: 12, cursor: 'pointer' },
}

export default function UploadExcel({ onFileSelect }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState('idle') // idle | processing | success | error
  const [data, setData] = useState([])
  const [headers, setHeaders] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState('all') // all | error
  const rowsPerPage = 10

  const fileInputRef = useRef(null)

  const processFile = async (file) => {
    if (!file || !isValidFile(file)) {
      setErrorMsg('Por favor, selecione um arquivo .xlsx ou .csv válido.')
      setStatus('error')
      return
    }

    setSelectedFile(file)
    setStatus('processing')
    setErrorMsg('')

    try {
      const buffer = await file.arrayBuffer()
      const isCSV = file.name.toLowerCase().endsWith('.csv')
      
      const workbook = XLSX.read(buffer, { 
        type: isCSV ? 'string' : 'array',
        cellDates: false 
      })
      
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      if (rows.length === 0) {
        throw new Error('O arquivo está vazio.')
      }

      // Normalização de colunas de data
      const dateColumns = ['Data', 'Competência', 'Data de vencimento', 'Liquidação', 'data', 'competencia']
      
      const processed = rows.map((row, index) => {
        const newRow = { ...row }
        Object.keys(newRow).forEach(key => {
          if (dateColumns.some(col => key.toLowerCase().includes(col.toLowerCase()))) {
            newRow[key] = formatExcelDate(newRow[key])
          }
        })
        return {
          ...newRow,
          __id: index,
          __validation: validateRow(newRow)
        }
      })

      setData(processed)
      setHeaders(Object.keys(rows[0]))
      setStatus('success')
      setCurrentPage(1)
    } catch (err) {
      console.error(err)
      setErrorMsg(`Erro ao processar arquivo: ${err.message}`)
      setStatus('error')
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const filteredData = useMemo(() => {
    if (filter === 'error') return data.filter(r => !r.__validation.isValid)
    return data
  }, [data, filter])

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filteredData.slice(start, start + rowsPerPage)
  }, [filteredData, currentPage])

  const totalPages = Math.ceil(filteredData.length / rowsPerPage)

  const handleReset = () => {
    setSelectedFile(null)
    setData([])
    setStatus('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".xlsx,.csv" 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {status === 'idle' && (
        <div 
          style={S.uploadArea(isDragging)}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2">
            <FileText className="w-10 h-10 text-zinc-500 mb-2" />
            <p className="text-sm font-medium text-zinc-200">Arraste e solte ou clique para selecionar</p>
            <p className="text-xs text-zinc-500">Aceito: .xlsx (Excel) ou .csv (UTF-8)</p>
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div className="p-12 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center gap-4">
          <Clock className="w-8 h-8 text-green-500 animate-pulse" />
          <p className="text-sm text-zinc-400">Processando e validando dados...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-xl flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-sm text-red-200">{errorMsg}</p>
          <button style={S.btnGhost} onClick={handleReset}>Tentar outro arquivo</button>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <div className="flex items-center justify-between p-4 bg-green-950/20 border border-green-900/30 rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-sm font-semibold text-green-400">Arquivo lido com sucesso!</p>
                <p className="text-xs text-green-600/80">{data.length} registros encontrados no total.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button style={S.btnGhost} onClick={handleReset}>Trocar Arquivo</button>
              <button 
                style={S.btnPrimary} 
                onClick={() => onFileSelect?.(data)}
                disabled={data.some(r => !r.__validation.isValid)}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar Importação
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="p-3 bg-zinc-800/50 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Prévia dos Dados</span>
                <div className="flex gap-1">
                  <button 
                    onClick={() => {setFilter('all'); setCurrentPage(1)}}
                    className={`px-2 py-1 text-[10px] rounded border ${filter === 'all' ? 'bg-zinc-700 border-zinc-600 text-white' : 'border-zinc-800 text-zinc-500'}`}
                  >Todos</button>
                  <button 
                    onClick={() => {setFilter('error'); setCurrentPage(1)}}
                    className={`px-2 py-1 text-[10px] rounded border ${filter === 'error' ? 'bg-red-900 text-red-200 border-red-800' : 'border-zinc-800 text-zinc-500'}`}
                  >Erros ({data.filter(r => !r.__validation.isValid).length})</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                ><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-[10px] text-zinc-400">Pág {currentPage} de {totalPages || 1}</span>
                <button 
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
                ><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-zinc-800/30 text-zinc-500 border-b border-zinc-800">
                    <th className="p-3 w-8">#</th>
                    {headers.map(h => <th key={h} className="p-3 font-medium truncate max-w-[150px]">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {paginatedData.map((row) => (
                    <tr key={row.__id} className={`hover:bg-zinc-800/20 ${!row.__validation.isValid ? 'bg-red-900/5' : ''}`}>
                      <td className="p-3">
                        {row.__validation.isValid ? 
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : 
                          <AlertCircle className="w-3.5 h-3.5 text-red-500" title={row.__validation.errors.join(", ")} />
                        }
                      </td>
                      {headers.map(h => (
                        <td key={h} className="p-3 text-zinc-400 border-r border-zinc-800/30 last:border-0">
                          {String(row[h] || '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
