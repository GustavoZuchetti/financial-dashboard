'use client'
import { useState, useRef } from 'react'

const ACCEPTED_TYPES = ['.xlsx', '.csv']

const isValidFile = (file) => {
  if (!file) return false
  const name = file.name.toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.csv')
}

const getFileIcon = (file) => {
  if (!file) return '📄'
  return file.name.toLowerCase().endsWith('.csv') ? '📋' : '📄'
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
  fileSize: { color: '#6b7280', fontSize: 12, marginBottom: 12 },
  fileType: { color: '#6b7280', fontSize: 12, marginBottom: 12 },
  btnUpload: { background: '#00e676', color: '#000', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  hiddenInput: { display: 'none' },
  errorText: { color: '#f87171', fontSize: 13, marginTop: 8 },
}

export default function UploadExcel({ onFileSelect }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && isValidFile(file)) {
      setSelectedFile(file)
      setError(null)
    } else if (file) {
      setError('Formato inválido. Aceito apenas .xlsx ou .csv (UTF-8).')
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file && isValidFile(file)) {
      setSelectedFile(file)
      setError(null)
    } else if (file) {
      setError('Formato inválido. Aceito apenas .xlsx ou .csv (UTF-8).')
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleUpload = () => {
    if (selectedFile && onFileSelect) {
      onFileSelect(selectedFile)
    }
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

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleFileChange}
        style={S.hiddenInput}
      />

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

      {error && (
        <div style={S.errorText}>⚠️ {error}</div>
      )}

      {selectedFile && (
        <div style={S.fileInfo}>
          <div style={S.fileName}>{getFileIcon(selectedFile)} {selectedFile.name}</div>
          <div style={S.fileType}>Formato: {getFileTypeBadge(selectedFile)}</div>
          <div style={S.fileSize}>Tamanho: {formatFileSize(selectedFile.size)}</div>
          <button style={S.btnUpload} onClick={handleUpload}>
            Importar Arquivo
          </button>
        </div>
      )}
    </div>
  )
}
