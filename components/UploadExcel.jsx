'use client'
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

const isValidFile = (file) => {
  if (!file) return false
  const name = file.name.toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.csv')
}

const getFileIcon = (file) => {
  if (!file) return '📄'
  return file.name.toLowerCase().endsWith('.csv') ? '📋' : '📄'
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const getFileTypeBadge = (file) => {
  if (!file) return ''
  return file.name.toLowerCase().endsWith('.csv') ? 'CSV (UTF-8)' : 'Excel (.xlsx)'
}

const S = {
  uploadArea: (isDragging) => ({
    border: `2px dashed ${isDragging ? '#00ff88' : '#00e676'}`,
    borderRadius: 12,
    padding: 40,
    textAlign: 'center',
    cursor: 'pointer',
    background: isDragging ? '#1a1a24' : '#12121a',
    transition: 'all 0.3s',
  }),
  uploadIcon: { fontSize: 48, marginBottom: 16 },
  uploadText: { color: '#e5e7eb', fontSize: 16, fontWeight: 600, marginBottom: 8 },
  uploadSubtext: { color: '#6b7280', fontSize: 13 },
  fileInfo: { background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: 16, marginTop: 20 },
  fileName: { color: '#e5e7eb', fontSize: 14, fontWeight: 600, marginBottom: 4 },
  fileMeta: { color: '#6b7280', fontSize: 12, marginBottom: 12 },
  btnUpload: { background: '#00e676', color: '#000', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnDisabled: { background: '#374151', color: '#6b7280', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'not-allowed' },
  btnNovo: { background: 'transparent', color: '#6b7280', border: '1px solid #374151', borderRadius: 8, padding: '12px 24px', fontSize: 14, cursor: 'pointer', marginLeft: 12 },
  hiddenInput: { display: 'none' },
  alertError: { background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '12px 16px', marginTop: 16, color: '#fca5a5', fontSize: 13 },
  alertSuccess: { background: '#021f0e', border: '1px solid #14532d', borderRadius: 8, padding: '12px 16px', marginTop: 16, color: '#86efac', fontSize: 13 },
  alertLoading: { background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 8, padding: '12px 16px', marginTop: 16, color: '#93c5fd', fontSize: 13 },
  previewBox: { background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, marginTop: 16, overflow: 'hidden' },
  previewHeader: { background: '#111827', padding: '8px 16px', color: '#9ca3af', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' },
  previewTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  previewTh: { padding: '8px 12px', background: '#1f2937', color: '#d1d5db', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #374151' },
  previewTd: { padding: '6px 12px', color: '#9ca3af', borderBottom: '1px solid #1f2937' },
  previewMore: { padding: '8px 16px', color: '#6b7280', fontSize: 11, textAlign: 'center', background: '#0a0a0f' },
}

export default function UploadExcel({ onFileSelect }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState(null)
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [statusMsg, setStatusMsg] = useState('')
  const [previewData, setPreviewData] = useState(null) // { headers, rows, totalRows }
  const fileInputRef = useRef(null)

  const resetStatus = () => {
    setStatus(null)
    setStatusMsg('')
    setPreviewData(null)
  }

  const handleFileChosen = (file) => {
    if (file && isValidFile(file)) {
      setSelectedFile(file)
      setFileError(null)
      resetStatus()
    } else if (file) {
      setFileError('Formato inválido. Aceito apenas .xlsx ou .csv (UTF-8).')
    }
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileChosen(e.dataTransfer.files[0])
  }
  const handleFileChange = (e) => handleFileChosen(e.target.files[0])
  const handleClick = () => fileInputRef.current?.click()

  const handleUpload = async () => {
    if (!selectedFile) return
    setStatus('loading')
    setStatusMsg('Processando arquivo...')
    setPreviewData(null)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const isCSV = selectedFile.name.toLowerCase().endsWith('.csv')

      let workbook
      if (isCSV) {
        // Le CSV com encoding UTF-8
        const decoder = new TextDecoder('utf-8')
        const text = decoder.decode(arrayBuffer)
        workbook = XLSX.read(text, { type: 'string' })
      } else {
        workbook = XLSX.read(arrayBuffer, { type: 'array' })
      }

      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error('Nenhuma planilha encontrada no arquivo.')

      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      if (!rows || rows.length === 0) {
        throw new Error('O arquivo está vazio ou sem dados válidos.')
      }

      const headers = Object.keys(rows[0])
      const totalRows = rows.length
      const previewRows = rows.slice(0, 5)

      setPreviewData({ headers, rows: previewRows, totalRows })
      setStatus('success')
      setStatusMsg(`✅ Arquivo lido com sucesso! ${totalRows} registro(s) encontrado(s) na planilha "${sheetName}".`)

      if (onFileSelect) {
        onFileSelect({ file: selectedFile, data: rows, headers, sheetName })
      }
    } catch (err) {
      setStatus('error')
      setStatusMsg(`❌ Erro ao processar o arquivo: ${err.message}`)
    }
  }

  const handleNovoArquivo = () => {
    setSelectedFile(null)
    resetStatus()
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleFileChange}
        style={S.hiddenInput}
      />

      {/* Zona de drop - oculta apos sucesso */}
      {status !== 'success' && (
        <div
          style={S.uploadArea(isDragging)}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div style={S.uploadIcon}>📄</div>
          <div style={S.uploadText}>Arraste e solte ou clique para selecionar</div>
          <div style={S.uploadSubtext}>Aceito: .xlsx (Excel) ou .csv (UTF-8)</div>
        </div>
      )}

      {/* Mensagem de formato invalido */}
      {fileError && (
        <div style={S.alertError}>⚠️ {fileError}</div>
      )}

      {/* Card do arquivo selecionado */}
      {selectedFile && status !== 'success' && (
        <div style={S.fileInfo}>
          <div style={S.fileName}>{getFileIcon(selectedFile)} {selectedFile.name}</div>
          <div style={S.fileMeta}>
            Formato: {getFileTypeBadge(selectedFile)} &nbsp;·&nbsp; Tamanho: {formatFileSize(selectedFile.size)}
          </div>
          <button
            style={status === 'loading' ? S.btnDisabled : S.btnUpload}
            onClick={handleUpload}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Processando...' : 'Importar Arquivo'}
          </button>
          <button style={S.btnNovo} onClick={handleNovoArquivo}>
            Cancelar
          </button>
        </div>
      )}

      {/* Alerta de loading */}
      {status === 'loading' && (
        <div style={S.alertLoading}>
          ⏳ {statusMsg}
        </div>
      )}

      {/* Alerta de erro */}
      {status === 'error' && (
        <div style={S.alertError}>
          {statusMsg}
          <div style={{ marginTop: 12 }}>
            <button style={S.btnNovo} onClick={handleNovoArquivo}>Tentar novamente</button>
          </div>
        </div>
      )}

      {/* Alerta de sucesso + preview */}
      {status === 'success' && (
        <div>
          <div style={S.alertSuccess}>
            {statusMsg}
            <button style={{ ...S.btnNovo, marginLeft: 16, marginTop: 8, display: 'inline-block' }} onClick={handleNovoArquivo}>
              Importar outro arquivo
            </button>
          </div>

          {previewData && previewData.headers.length > 0 && (
            <div style={S.previewBox}>
              <div style={S.previewHeader}>PRÉVIA DOS DADOS ({previewData.totalRows} linha{previewData.totalRows !== 1 ? 's' : ''})</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.previewTable}>
                  <thead>
                    <tr>
                      {previewData.headers.map((h, i) => (
                        <th key={i} style={S.previewTh}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, ri) => (
                      <tr key={ri}>
                        {previewData.headers.map((h, ci) => (
                          <td key={ci} style={S.previewTd}>{String(row[h] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.totalRows > 5 && (
                <div style={S.previewMore}>... e mais {previewData.totalRows - 5} linha(s) não exibidas</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
