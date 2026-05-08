'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

// ─── Parser CSV robusto — sem depender do XLSX para separador ─────────────────
function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const firstLine = lines[0]
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ','

  const parseRow = (line) => {
    const cells = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQuote = !inQuote; continue }
      if (c === sep && !inQuote) { cells.push(cur.trim()); cur = ''; continue }
      cur += c
    }
    cells.push(cur.trim())
    return cells
  }

  const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
  return lines.slice(1).map(line => {
    const cells = parseRow(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (cells[i] || '').replace(/^"|"$/g, '').replace(/[\t\n\r]+/g, ' ').trim() })
    return obj
  }).filter(row => Object.values(row).some(v => v !== ''))
}

// ─── Parser XLSX (import estático no topo) ────────────────────────────────────
function parseXLSX(buffer) {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  return raw.map(row => {
    const r = {}
    Object.keys(row).forEach(k => { r[k.trim()] = typeof row[k] === 'string' ? row[k].trim() : String(row[k]) })
    return r
  })
}

// ─── Conversão de data BR → ISO ───────────────────────────────────────────────
function parseDateBR(s) {
  const str = String(s || '').trim()
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.split('T')[0]
  return new Date().toISOString().split('T')[0]
}

// ─── Parse de valor BR ────────────────────────────────────────────────────────
function parseValueBR(v) {
  const s = String(v || '0').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.abs(n)
}

// ─── Toast simples inline ─────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t) }, [onClose])
  const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' }
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: 'var(--fs-surface)', border: `1px solid ${colors[type] || colors.info}`, borderRadius: 10, padding: '12px 18px', color: 'var(--fs-text-1)', fontSize: 13, fontWeight: 600, maxWidth: 400, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: colors[type] || colors.info, fontSize: 16 }}>{type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span style={{ flex: 1 }}>{msg}</span>
      <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--fs-text-4)', fontSize: 18, lineHeight: 1 }}>×</span>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function ImportacaoPage() {
  const [empresaId,       setEmpresaId]       = useState(null)
  const [empresas,        setEmpresas]        = useState([])
  const [planoContas,     setPlanoContas]     = useState([])
  const [mappings,        setMappings]        = useState([])
  const [uploadedData,    setUploadedData]    = useState([])
  const [loading,         setLoading]         = useState(true)
  const [isImporting,     setIsImporting]     = useState(false)
  const [editingRow,      setEditingRow]      = useState(null)
  const [selectedContaId, setSelectedContaId] = useState('')
  const [toast,           setToast]           = useState(null)
  const [isDragging,      setIsDragging]      = useState(false)
  const fileInputRef = useRef(null)

  const showToast = useCallback((msg, type = 'info') => setToast({ msg, type }), [])

  // ─── Carregar mappings por empresa ────────────────────────────────────────
  const loadMappings = useCallback(async (id) => {
    if (!id) return
    const { data, error } = await supabase
      .from('categoria_mappings')
      .select('*')
      .eq('empresa_id', id)
    if (!error) setMappings(data || [])
  }, [])

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [{ data: emps }, { data: plano }] = await Promise.all([
          supabase.from('empresas').select('*').order('nome'),
          supabase.from('plano_contas').select('*').order('nome'),
        ])
        setEmpresas(emps || [])
        setPlanoContas(plano || [])
        const savedId = localStorage.getItem('empresa_id')
        const validId = (emps || []).find(e => e.id === savedId) ? savedId : emps?.[0]?.id
        if (validId) { setEmpresaId(validId); await loadMappings(validId) }
      } catch (e) {
        showToast('Erro ao carregar dados: ' + e.message, 'error')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [loadMappings, showToast])

  const handleEmpresaChange = async (id) => {
    setEmpresaId(id)
    await loadMappings(id)
  }

  // ─── Processar arquivo ────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      showToast('Formato não suportado. Use .csv ou .xlsx', 'error'); return
    }
    showToast(`Processando ${file.name}...`, 'info')
    try {
      const buffer = await file.arrayBuffer()
      let rows = []
      if (ext === 'csv') {
        rows = parseCSV(new TextDecoder('utf-8').decode(buffer))
      } else {
        rows = parseXLSX(buffer)
      }

      if (rows.length === 0) { showToast('Arquivo vazio ou formato inválido.', 'error'); return }

      const processed = rows.map((row, i) => {
        const desc  = (row['Descrição'] || row['descricao'] || row['Categoria'] || row['categoria'] || '').trim()
        const nome  = (row['Nome'] || row['nome'] || '').replace(/[\t\n\r]+/g, ' ').trim()
        const valor = parseValueBR(row['Valor Pago/Recebido'] || row['Valor Pago'] || row['Valor'] || row['valor'] || 0)
        const data  = parseDateBR(row['Liquidação'] || row['Data'] || row['data'] || '')
        const tipoCsv = (row['Tipo'] || '').toLowerCase()
        return { __id: i, __desc: desc, nome, valor, data, tipoCsv, original: row }
      }).filter(r => r.__desc || r.valor > 0)

      setUploadedData(processed)
      showToast(`${processed.length} registros carregados com sucesso!`, 'success')
    } catch (err) {
      console.error('Erro ao processar:', err)
      showToast('Erro ao processar arquivo: ' + err.message, 'error')
    }
  }, [showToast])

  const handleFileInput = (e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }
  const handleDrop      = (e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files?.[0]) }

  // ─── Salvar mapeamento — delete + insert (evita conflito de onConflict) ────
  const saveMapping = async () => {
    if (!selectedContaId || !editingRow) return
    try {
      const conta = (planoContas || []).find(c => c.id === selectedContaId)
      const tipo  = conta?.tipo || 'receita'

      // Remover mapeamento anterior para esta categoria (se existir)
      await supabase
        .from('categoria_mappings')
        .delete()
        .eq('empresa_id', empresaId)
        .eq('categoria_origem', editingRow.__desc)

      // Inserir novo mapeamento limpo
      const { error } = await supabase.from('categoria_mappings').insert({
        empresa_id:       empresaId,
        categoria_origem: editingRow.__desc,
        conta_id:         selectedContaId,
        tipo_destino:     tipo,
      })
      if (error) throw error

      await loadMappings(empresaId)
      setEditingRow(null)
      setSelectedContaId('')
      showToast('Mapeamento salvo com sucesso!', 'success')
    } catch (e) {
      console.error('Erro ao salvar mapeamento:', e)
      showToast('Erro ao salvar mapeamento: ' + e.message, 'error')
    }
  }

  // ─── Finalizar importação ─────────────────────────────────────────────────
  const finalizeImport = async () => {
    if (!empresaId) { showToast('Selecione uma empresa antes de importar.', 'error'); return }
    setIsImporting(true)
    try {
      const toInsert = (uploadedData || []).map(row => {
        const map  = (mappings || []).find(m =>
          m.categoria_origem?.toLowerCase() === (row.__desc || '').toLowerCase()
        )
        let tipo = map?.tipo_destino || (row.tipoCsv.includes('pagar') ? 'despesa' : 'receita')
        if (!['receita', 'custo', 'despesa'].includes(tipo)) tipo = 'receita'
        return {
          empresa_id: empresaId,
          data:       row.data,
          descricao:  row.nome || row.__desc || '',
          valor:      row.valor,
          tipo,
          conta_id:   map?.conta_id || null,
          categoria:  row.__desc || '',
        }
      }).filter(r => r.valor > 0)

      if (toInsert.length === 0) {
        showToast('Nenhum lançamento com valor válido para importar.', 'error')
        setIsImporting(false); return
      }

      for (let i = 0; i < toInsert.length; i += 100) {
        const { error } = await supabase.from('lancamentos').insert(toInsert.slice(i, i + 100))
        if (error) throw error
      }

      showToast(`${toInsert.length} lançamentos importados com sucesso!`, 'success')
      setUploadedData([])
    } catch (e) {
      console.error('Erro na importação:', e)
      showToast('Erro na importação: ' + e.message, 'error')
    } finally {
      setIsImporting(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div style={{ color: '#3b82f6', fontSize: 14 }}>Carregando...</div>
    </div>
  )

  const pendentes = (uploadedData || []).filter(r =>
    !(mappings || []).find(m => m.categoria_origem?.toLowerCase() === (r.__desc || '').toLowerCase())
  )
  const mapeados = (uploadedData || []).length - pendentes.length

  return (
    <div style={{ color: 'var(--fs-text-1)', maxWidth: 900 }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fs-text-1)', margin: 0 }}>Importação de Lançamentos</h1>
        <p style={{ color: 'var(--fs-text-4)', fontSize: 13, margin: '4px 0 0' }}>CSV ou XLSX do ERP Bling — separador detectado automaticamente</p>
      </div>

      {/* Empresa */}
      <div style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fs-text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Empresa</label>
        <select
          style={{ background: 'var(--fs-input-bg)', border: '1px solid var(--fs-input-border)', borderRadius: 8, color: 'var(--fs-text-1)', padding: '9px 12px', fontSize: 13, width: '100%', outline: 'none' }}
          value={empresaId || ''}
          onChange={e => handleEmpresaChange(e.target.value)}
        >
          {(empresas || []).map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {/* Drop zone */}
      {uploadedData.length === 0 ? (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: `2px dashed ${isDragging ? '#3b82f6' : 'var(--fs-border)'}`, borderRadius: 16, padding: '64px 24px', textAlign: 'center', cursor: 'pointer', background: isDragging ? 'rgba(59,130,246,0.06)' : '#1e293b', transition: 'all 0.2s', marginBottom: 20 }}
        >
          <div style={{ width: 56, height: 56, background: 'rgba(59,130,246,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="28" height="28" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          </div>
          <p style={{ color: 'var(--fs-text-1)', fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>Arraste ou clique para selecionar</p>
          <p style={{ color: 'var(--fs-text-4)', fontSize: 13, margin: 0 }}>Suporta .csv (Bling) e .xlsx</p>
          <input ref={fileInputRef} type="file" hidden accept=".csv,.xlsx,.xls" onChange={handleFileInput} />
        </div>
      ) : (
        <div style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
          {/* Resumo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Total',     val: uploadedData.length, color: '#3b82f6' },
                { label: 'Mapeados',  val: mapeados,            color: '#10b981' },
                { label: 'Pendentes', val: pendentes.length,    color: '#f59e0b' },
              ].map(k => (
                <div key={k.label} style={{ background: `rgba(${k.color === '#3b82f6' ? '59,130,246' : k.color === '#10b981' ? '16,185,129' : '245,158,11'},0.1)`, border: `1px solid rgba(${k.color === '#3b82f6' ? '59,130,246' : k.color === '#10b981' ? '16,185,129' : '245,158,11'},0.2)`, borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 10, color: 'var(--fs-text-4)', textTransform: 'uppercase' }}>{k.label}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setUploadedData([])} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Remover arquivo
            </button>
          </div>

          {pendentes.length > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#fbbf24' }}>
              ⚠️ {pendentes.length} categoria(s) sem mapeamento — serão importadas como <strong>receita</strong>. Clique em "Configurar" para mapear.
            </div>
          )}

          {/* Tabela */}
          <div style={{ maxHeight: 380, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--fs-border)', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--fs-bg)' }}>
                <tr>
                  {['Descrição (Categoria)', 'Nome / Cliente', 'Valor', 'Data', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Valor' ? 'right' : 'left', color: 'var(--fs-text-4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--fs-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(uploadedData || []).map(row => {
                  const map = (mappings || []).find(m => m.categoria_origem?.toLowerCase() === (row.__desc || '').toLowerCase())
                  return (
                    <tr key={row.__id} style={{ borderBottom: '1px solid var(--fs-border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--fs-text-1)', fontWeight: 600 }}>{row.__desc || '—'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--fs-text-2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.nome || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor)}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--fs-text-2)' }}>{row.data}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {map
                          ? <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>✓ MAPEADO</span>
                          : <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>PENDENTE</span>
                        }
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => { setEditingRow(row); setSelectedContaId('') }}
                          style={{ background: map ? 'transparent' : '#2563eb', color: map ? 'var(--fs-text-4)' : '#fff', border: map ? '1px solid var(--fs-border)' : 'none', padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {map ? 'Alterar' : 'Configurar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={finalizeImport} disabled={isImporting}
            style={{ width: '100%', background: isImporting ? '#1e3a5f' : '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 800, cursor: isImporting ? 'not-allowed' : 'pointer' }}
          >
            {isImporting ? '⏳ Importando...' : `✓ Importar ${uploadedData.length} Lançamentos`}
          </button>
        </div>
      )}

      {/* Modal De-Para */}
      {editingRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--fs-text-1)', marginBottom: 20 }}>Configurar Mapeamento</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--fs-text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Categoria no arquivo</label>
              <div style={{ background: 'var(--fs-input-bg)', border: '1px solid var(--fs-input-border)', borderRadius: 8, padding: '10px 14px', color: '#3b82f6', fontWeight: 700, fontSize: 14 }}>{editingRow.__desc}</div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--fs-text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Conta de destino</label>
              <select
                style={{ background: 'var(--fs-input-bg)', border: '1px solid var(--fs-input-border)', borderRadius: 8, color: 'var(--fs-text-1)', padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none' }}
                value={selectedContaId}
                onChange={e => setSelectedContaId(e.target.value)}
              >
                <option value="">Selecione uma conta...</option>
                {(planoContas || []).map(c => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { setEditingRow(null); setSelectedContaId('') }}
                style={{ flex: 1, background: 'var(--fs-surface-3)', color: 'var(--fs-text-1)', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={saveMapping} disabled={!selectedContaId}
                style={{ flex: 2, background: selectedContaId ? '#2563eb' : '#1e3a5f', color: 'var(--fs-text-1)', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: selectedContaId ? 'pointer' : 'not-allowed' }}>
                Salvar Mapeamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
