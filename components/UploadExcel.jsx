'use client'
import { useState, useRef, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { CheckCircle2, AlertCircle, Clock, ChevronLeft, ChevronRight, FileText, X, Settings2, Plus } from 'lucide-react'

// --- Helpers ---
const isValidFile = (file) => {
  if (!file) return false
  const name = file.name.toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.csv')
}

const formatExcelDate = (value) => {
  if (value === null || value === undefined || value === '') return ''
  let num = parseFloat(String(value).replace(',', '.'))
  if (!isNaN(num) && num > 30000 && num < 60000) {
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
  const strValue = String(value).trim()
  if (strValue.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [y, m, d] = strValue.split('T')[0].split('-')
    return `${d}/${m}/${y}`
  }
  return strValue
}

const validateRow = (row, mappings = []) => {
  const errors = []
  const accountField = Object.keys(row).find(k => 
    k.toLowerCase().includes('nome') || 
    k.toLowerCase().includes('conta') || 
    k.toLowerCase().includes('categoria') || 
    k.toLowerCase().includes('histórico')
  )
  const accountValue = accountField ? String(row[accountField] || '').trim() : ''

  if (!accountValue) {
    errors.push('Nome/Conta ausente')
  } else {
    const normalizedAccount = accountValue.toLowerCase().trim()
    const allMappedAccounts = mappings.flatMap(g => 
      g.items.map(i => (i.erp || '').toLowerCase().trim())
    )
    if (!allMappedAccounts.includes(normalizedAccount)) {
      errors.push('Conta não mapeada no sistema')
    }
  }

  const valorRaw = row['Valor'] || row['valor'] || row['Valor Pago/Recebido'] || row['Total']
  const valorStr = String(valorRaw || '0').replace(/\./g, '').replace(',', '.')
  const valor = parseFloat(valorStr)
  if (isNaN(valor)) errors.push('Valor numérico inválido')

  return { isValid: errors.length === 0, errors, accountValue }
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
  btnPrimary: {
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnGhost: {
    background: 'transparent',
    color: '#a1a1aa',
    border: '1px solid #27272a',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 12,
    cursor: 'pointer'
  },
}

export default function UploadExcel({ onFileSelect, mappings = [], planoContas = [], onAddMapping, initialData }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState(initialData && initialData.length > 0 ? 'success' : 'idle')
  const [data, setData] = useState(initialData || [])
  const [headers, setHeaders] = useState(() => {
    if (initialData && initialData.length > 0) {
      return Object.keys(initialData[0]).filter(k => !k.startsWith('__'))
    }
    return []
  })
  const [errorMsg, setErrorMsg] = useState('')
  const [editingRow, setEditingRow] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState('all')
  const rowsPerPage = 10
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setData(initialData);
      setHeaders(Object.keys(initialData[0]).filter(k => !k.startsWith('__')));
      setStatus('success');
    } else if (!initialData && status === 'success') {
      handleReset();
    }
  }, [initialData]);

  useEffect(() => {
    if (data && data.length > 0) {
      const validated = data.map(row => ({
        ...row,
        __validation: validateRow(row, mappings)
      }));
      const hasChanges = JSON.stringify(validated.map(r => r.__validation.isValid)) !== JSON.stringify(data.map(r => r.__validation.isValid));
      if (hasChanges) {
        setData(validated);
      }
    }
  }, [mappings, data.length]);

  useEffect(() => {
    if (status === 'success' && data.length > 0) {
      onFileSelect?.(data);
    }
  }, [data, status]);

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
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      if (rows.length === 0) throw new Error('O arquivo está vazio.')
      const dateColumns = ['Data', 'Competência', 'Data de vencimento', 'Liquidação', 'data', 'competencia']
      const processed = rows.map((row, index) => {
        const newRow = { ...row }
        Object.keys(newRow).forEach(key => {
          if (dateColumns.some(col => key.toLowerCase().includes(col.toLowerCase()))) {
            newRow[key] = formatExcelDate(newRow[key])
          }
        })
        return { ...newRow, __id: index, __validation: validateRow(newRow, mappings) }
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

  const handleConfirmMapping = () => {
    if (!selectedCategory || !editingRow) return;
    const accountName = editingRow.__validation.accountValue;
    onAddMapping?.(accountName, selectedCategory);
    setEditingRow(null);
    setSelectedCategory('');
  };

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
    setHeaders([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    onFileSelect?.(null);
  }

  return (
    <div className="space-y-6">
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
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-500">
              <Plus className="w-8 h-8" />
            </div>
            <div>
              <p className="text-white font-medium mb-1">Arraste e solte ou clique para selecionar</p>
              <p className="text-sm text-zinc-500">Aceito: .xlsx (Excel) ou .csv (UTF-8)</p>
            </div>
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center animate-pulse">
          <Clock className="w-10 h-10 text-zinc-500 mx-auto mb-4" />
          <p className="text-zinc-400">Processando e validando dados...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-6">{errorMsg}</p>
          <button
            onClick={() => setStatus('idle')}
            style={S.btnPrimary}
            className="bg-red-600 hover:bg-red-700"
          >
            Tentar outro arquivo
          </button>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-white font-medium">Arquivo lido com sucesso!</p>
                <p className="text-sm text-zinc-500">{data.length} registros encontrados no total.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleReset} style={S.btnGhost}>
                Trocar Arquivo
              </button>
              <div style={S.btnPrimary} className="flex items-center gap-2 opacity-80 cursor-default">
                <CheckCircle2 className="w-4 h-4" /> Arquivo Selecionado
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Prévia dos Dados</h3>
                <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => { setFilter('all'); setCurrentPage(1) }}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${filter === 'all' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => { setFilter('error'); setCurrentPage(1) }}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${filter === 'error' ? 'bg-red-950/50 text-red-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Erros ({data.filter(r => !r.__validation.isValid).length})
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-30 text-zinc-400 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">
                    Pág {currentPage} de {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-30 text-zinc-400 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[500px] rounded-xl border border-zinc-800">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-zinc-900/30">
                    <th className="p-4 text-[10px] font-bold text-420-500 uppercase tracking-widest border-b border-zinc-800 w-16">Status</th>
                    <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 w-16 text-center">#</th>
                    {headers.map(h => (
                      <th key={h} className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800">{h}</th>
                    ))}
                    <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 text-center sticky right-0 bg-zinc-900 z-10 shadow-[-4px_0_8px_rgba(0,0,0,0.2)]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row) => (
                    <tr key={row.__id} onClick={() => setEditingRow(row)} className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors group">
                      <td className="p-4">
                        {row.__validation.isValid ? (
                          <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />cursor-pointer 
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-xs text-zinc-600 font-mono text-center">{row.__id + 1}</td>
                      {headers.map(h => (
                        <td key={h} className="p-4 text-xs text-zinc-400">
                          { (() => {
                            const value = row[h];
                            if (!value && value !== 0) return '-';
                            if (h.toLowerCase().includes('valor') || h.toLowerCase().includes('total') || h.toLowerCase().includes('pago') || h.toLowerCase().includes('recebido')) {
                              const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/\\./g, '').replace(',', '.'));
                              if (isNaN(numValue)) return String(value);
                              return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            }
                            return String(value);
                          })() }
                        </td>
                      ))}
                      <td className="p-4 text-center sticky right-0 bg-zinc-900 group-hover:bg-zinc-800/80 transition-colors z-10 shadow-[-4px_0_8px_rgba(0,0,0,0.2)]">
                        {!row.__validation.isValid && (
                          <button
                            onClick={() => setEditingRow(row)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/10 text-green-500 border border-green-600/20 rounded-lg hover:bg-green-600/20 transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Settings2 className="w-3 h-3" /> Mapear
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-green-500" /> Configurar De-Para
              </h3>
              <button
                onClick={() => { setEditingRow(null); setSelectedCategory(''); }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Erro Identificado</label>
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
                  {editingRow.__validation.errors[0]}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Conta no ERP (Origem)</label>
                <div className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-sm text-white font-mono">
                  {editingRow.__validation.accountValue}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Categoria no Sistema (Destino)</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white outline-none focus:border-green-600 transition-all shadow-inner"
                >
                  <option value="">Selecione uma categoria...</option>
                  
                  {/* Categorias Fixas */}
                  {mappings.map(g => (
                    <optgroup key={g.group} label={g.group.toUpperCase()}>
                      <option value={g.group}>{g.group} (Novo Item)</option>
                      {g.items && g.items.map(item => (
                        <option key={item.id} value={item.categoria}>{item.categoria}</option>
                      ))}
                    </optgroup>
                  ))}

                  {/* Plano de Contas Real */}
                  {planoContas.length > 0 && (
                    <optgroup label="PLANO DE CONTAS (TODAS)">
                      {planoContas.map(conta => (
                        <option key={conta.id} value={conta.nome}>
                          {conta.codigo} - {conta.nome}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="text-[10px] text-zinc-500 mt-2">
                  Dica: Selecione uma categoria existente ou uma conta do seu plano de contas real.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-800 flex gap-3">
              <button
                onClick={() => { setEditingRow(null); setSelectedCategory(''); }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmMapping}
                disabled={!selectedCategory}
                className="flex-[2] bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:hover:bg-green-600 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-green-900/20"
              >
                Salvar e Validar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
