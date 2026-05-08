'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

// ─── Parsers ──────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ','
  const parseRow = (line) => {
    const cells = []; let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; continue }
      if (line[i] === sep && !inQ) { cells.push(cur.trim()); cur = ''; continue }
      cur += line[i]
    }
    cells.push(cur.trim()); return cells
  }
  const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
  return lines.slice(1).map(line => {
    const cells = parseRow(line); const obj = {}
    headers.forEach((h, i) => { obj[h] = (cells[i] || '').replace(/^"|"$/g, '').replace(/[\t\n\r]+/g, ' ').trim() })
    return obj
  }).filter(row => Object.values(row).some(v => v !== ''))
}

function parseXLSX(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  return raw.map(row => {
    const r = {}
    Object.keys(row).forEach(k => { r[k.trim()] = typeof row[k] === 'string' ? row[k].trim() : String(row[k]) })
    return r
  })
}

function parseDateBR(s) {
  const str = String(s || '').trim()
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.split('T')[0]
  return new Date().toISOString().split('T')[0]
}

function parseValueBR(v) {
  const n = parseFloat(String(v || '0').replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : Math.abs(n)
}

const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t) }, [onClose])
  const colors = { success: 'var(--fs-success)', error: 'var(--fs-danger)', info: 'var(--fs-brand)' }
  const icons  = { success: '✓', error: '✕', info: 'ℹ' }
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: 'var(--fs-surface)', border: `1px solid ${colors[type]}`, borderRadius: 10, padding: '12px 18px', color: 'var(--fs-text-1)', fontSize: 13, fontWeight: 600, maxWidth: 400, boxShadow: 'var(--fs-shadow-lg)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: colors[type], fontSize: 16 }}>{icons[type] || 'ℹ'}</span>
      <span style={{ flex: 1 }}>{msg}</span>
      <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--fs-text-4)', fontSize: 18, lineHeight: 1 }}>×</span>
    </div>
  )
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────
function DropZone({ onFile, label, sublabel, fileRef }) {
  const [isDragging, setIsDragging] = useState(false)
  return (
    <div
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={e => { e.preventDefault(); setIsDragging(false); onFile(e.dataTransfer.files?.[0]) }}
      onClick={() => fileRef.current?.click()}
      style={{
        border: `2px dashed ${isDragging ? 'var(--fs-brand)' : 'var(--fs-border)'}`,
        borderRadius: 16, padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
        background: isDragging ? 'rgba(var(--fs-brand-rgb),0.06)' : 'var(--fs-surface)',
        transition: 'all 0.2s', marginBottom: 20,
      }}
    >
      <div style={{ width: 52, height: 52, background: 'rgba(var(--fs-brand-rgb),0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <svg width="24" height="24" fill="none" stroke="var(--fs-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
      </div>
      <p style={{ color: 'var(--fs-text-1)', fontWeight: 700, fontSize: 15, margin: '0 0 5px' }}>{label}</p>
      <p style={{ color: 'var(--fs-text-4)', fontSize: 13, margin: 0 }}>{sublabel}</p>
      <input ref={fileRef} type="file" hidden accept=".csv,.xlsx,.xls" onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

// ─── Tabela de Preview ────────────────────────────────────────────────────────
function PreviewTable({ data, mappings, onEdit, onRemove, modulo }) {
  const pendentes = (data || []).filter(r => !(mappings || []).find(m => m.categoria_origem?.toLowerCase() === (r.__desc || '').toLowerCase()))
  const mapeados  = (data || []).length - pendentes.length

  return (
    <div style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
      {/* Resumo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Total',     val: data.length,        rgb: '59,130,246'  },
            { label: 'Mapeados',  val: mapeados,           rgb: '16,185,129'  },
            { label: 'Pendentes', val: pendentes.length,   rgb: '245,158,11'  },
          ].map(k => (
            <div key={k.label} style={{ background: `rgba(${k.rgb},0.1)`, border: `1px solid rgba(${k.rgb},0.2)`, borderRadius: 8, padding: '7px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: `rgb(${k.rgb})` }}>{k.val}</div>
              <div style={{ fontSize: 10, color: 'var(--fs-text-4)', textTransform: 'uppercase' }}>{k.label}</div>
            </div>
          ))}
        </div>
        <button onClick={onRemove} style={{ background: 'rgba(var(--fs-danger-rgb),0.08)', border: '1px solid rgba(var(--fs-danger-rgb),0.2)', borderRadius: 8, color: 'var(--fs-danger)', padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Remover arquivo
        </button>
      </div>

      {pendentes.length > 0 && (
        <div style={{ background: 'var(--fs-warning-bg)', border: '1px solid rgba(var(--fs-warning-rgb),0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--fs-warning)' }}>
          ⚠️ {pendentes.length} categoria(s) sem mapeamento — serão importadas com tipo padrão. Clique em "Configurar" para mapear.
        </div>
      )}

      <div style={{ maxHeight: 360, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--fs-border)', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--fs-bg)' }}>
            <tr>
              {['Categoria', 'Nome / Cliente', 'Valor', 'Data', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Valor' ? 'right' : 'left', color: 'var(--fs-text-4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--fs-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data || []).map(row => {
              const map = (mappings || []).find(m => m.categoria_origem?.toLowerCase() === (row.__desc || '').toLowerCase())
              return (
                <tr key={row.__id} style={{ borderBottom: '1px solid var(--fs-border)' }}>
                  <td style={{ padding: '9px 12px', color: 'var(--fs-text-1)', fontWeight: 600 }}>{row.__desc || '—'}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--fs-text-2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.nome || '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--fs-success)', fontWeight: 700 }}>{fmtBRL(row.valor)}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--fs-text-2)' }}>{row.data}</td>
                  <td style={{ padding: '9px 12px' }}>
                    {map
                      ? <span style={{ background: 'var(--fs-success-bg)', color: 'var(--fs-success)', border: '1px solid rgba(var(--fs-success-rgb),0.3)', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>✓ {map.tipo_destino?.toUpperCase()}</span>
                      : <span style={{ background: 'var(--fs-warning-bg)', color: 'var(--fs-warning)', border: '1px solid rgba(var(--fs-warning-rgb),0.3)', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>PENDENTE</span>
                    }
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <button onClick={() => onEdit(row)}
                      style={{ background: map ? 'transparent' : 'var(--fs-brand)', color: map ? 'var(--fs-text-4)' : '#fff', border: map ? '1px solid var(--fs-border)' : 'none', padding: '4px 11px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {map ? 'Alterar' : 'Configurar'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Modal De-Para ────────────────────────────────────────────────────────────
function MappingModal({ row, planoContas, modulo, onSave, onClose, saving }) {
  const [selectedContaId, setSelectedContaId] = useState('')

  // Filtrar contas por módulo
  const contasFiltradas = (planoContas || []).filter(c => {
    if (modulo === 'dre') return ['receita','custo','despesa'].includes(c.tipo)
    if (modulo === 'fluxo') return ['entrada','saida','fluxo_entrada','fluxo_saida'].includes(c.tipo)
    return true
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: 'var(--fs-shadow-lg)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--fs-text-1)', marginBottom: 6 }}>Configurar Mapeamento</h2>
        <p style={{ fontSize: 12, color: 'var(--fs-text-4)', marginBottom: 20 }}>
          Módulo: <strong style={{ color: 'var(--fs-brand)' }}>{modulo === 'dre' ? 'DRE — Demonstrativos' : 'Fluxo de Caixa'}</strong>
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--fs-text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Categoria no arquivo</label>
          <div style={{ background: 'var(--fs-surface-2)', border: '1px solid var(--fs-border)', borderRadius: 8, padding: '10px 14px', color: 'var(--fs-brand)', fontWeight: 700, fontSize: 14 }}>{row.__desc}</div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--fs-text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Conta de destino (Plano de Contas)</label>
          <select
            style={{ background: 'var(--fs-input-bg)', border: '1px solid var(--fs-input-border)', borderRadius: 8, color: 'var(--fs-text-1)', padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none' }}
            value={selectedContaId}
            onChange={e => setSelectedContaId(e.target.value)}
          >
            <option value="">Selecione uma conta...</option>
            {contasFiltradas.map(c => (
              <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>
            ))}
          </select>
          {contasFiltradas.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--fs-warning)', marginTop: 6 }}>
              ⚠️ Nenhuma conta encontrada para este módulo. Verifique o Plano de Contas.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: 'var(--fs-surface-2)', color: 'var(--fs-text-1)', border: '1px solid var(--fs-border)', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={() => selectedContaId && onSave(selectedContaId)} disabled={!selectedContaId || saving}
            style={{ flex: 2, background: selectedContaId ? 'var(--fs-brand)' : 'var(--fs-surface-3)', color: selectedContaId ? '#fff' : 'var(--fs-text-4)', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: selectedContaId ? 'pointer' : 'not-allowed' }}>
            {saving ? '⏳ Salvando...' : 'Salvar Mapeamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function ImportacaoPage() {
  const [activeTab,      setActiveTab]      = useState('dre')
  const [empresaId,      setEmpresaId]      = useState(null)
  const [empresas,       setEmpresas]       = useState([])
  const [planoContas,    setPlanoContas]    = useState([])
  const [mappingsDre,    setMappingsDre]    = useState([])
  const [mappingsFluxo,  setMappingsFluxo]  = useState([])
  const [dataDre,        setDataDre]        = useState([])
  const [dataFluxo,      setDataFluxo]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [isImporting,    setIsImporting]    = useState(false)
  const [savingMapping,  setSavingMapping]  = useState(false)
  const [editingRow,     setEditingRow]     = useState(null)
  const [toast,          setToast]          = useState(null)
  const [confirmModal,   setConfirmModal]   = useState(null) // { modulo, periodo, count, onConfirm }
  const fileRefDre   = useRef(null)
  const fileRefFluxo = useRef(null)

  const showToast = useCallback((msg, type = 'info') => setToast({ msg, type }), [])

  const loadMappings = useCallback(async (id) => {
    if (!id) return
    const { data } = await supabase.from('categoria_mappings').select('*').eq('empresa_id', id)
    const all = data || []
    setMappingsDre(all.filter(m => ['receita','custo','despesa'].includes(m.tipo_destino)))
    setMappingsFluxo(all.filter(m => ['entrada','saida','fluxo_entrada','fluxo_saida'].includes(m.tipo_destino)))
  }, [])

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
  const processFile = useCallback(async (file, modulo) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv','xlsx','xls'].includes(ext)) { showToast('Use .csv ou .xlsx', 'error'); return }
    showToast(`Processando ${file.name}...`, 'info')
    try {
      const buffer = await file.arrayBuffer()
      const rows = ext === 'csv'
        ? parseCSV(new TextDecoder('utf-8').decode(buffer))
        : parseXLSX(buffer)
      if (!rows.length) { showToast('Arquivo vazio ou inválido.', 'error'); return }

      const processed = rows.map((row, i) => ({
        __id:    i,
        __desc:  (row['Descrição'] || row['descricao'] || row['Categoria'] || row['categoria'] || '').trim(),
        nome:    (row['Nome'] || row['nome'] || '').replace(/[\t\n\r]+/g, ' ').trim(),
        valor:   parseValueBR(row['Valor Pago/Recebido'] || row['Valor Pago'] || row['Valor'] || row['valor'] || 0),
        data:    parseDateBR(
          modulo === 'dre'
            ? (row['Competência'] || row['Competencia'] || row['competência'] || row['Data'] || row['data'] || '')
            : (row['Liquidação']  || row['Liquidacao']  || row['Data']        || row['data'] || '')
        ),
        tipoCsv: (row['Tipo'] || '').toLowerCase(),
        original: row,
      })).filter(r => r.__desc || r.valor > 0)

      if (modulo === 'dre') setDataDre(processed)
      else                  setDataFluxo(processed)
      showToast(`${processed.length} registros carregados!`, 'success')
    } catch (err) {
      showToast('Erro ao processar: ' + err.message, 'error')
    }
  }, [showToast])

  // ─── Salvar mapeamento ────────────────────────────────────────────────────
  const saveMapping = async (contaId) => {
    if (!editingRow || !contaId) return
    setSavingMapping(true)
    try {
      const conta = (planoContas || []).find(c => c.id === contaId)
      const tipo  = conta?.tipo || (activeTab === 'fluxo' ? 'entrada' : 'receita')
      await supabase.from('categoria_mappings').delete()
        .eq('empresa_id', empresaId).eq('categoria_origem', editingRow.__desc)
      const { error } = await supabase.from('categoria_mappings').insert({
        empresa_id: empresaId, categoria_origem: editingRow.__desc,
        conta_id: contaId, tipo_destino: tipo,
      })
      if (error) throw error
      await loadMappings(empresaId)
      setEditingRow(null)
      showToast('Mapeamento salvo!', 'success')
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'error')
    } finally {
      setSavingMapping(false)
    }
  }

  // ─── Verificar duplicatas por período ────────────────────────────────────────
  const checkDuplicates = async (toInsert, tabela) => {
    if (!toInsert.length || !empresaId) return { hasDupe: false, count: 0 }
    const datas = toInsert.map(r => r.data).filter(Boolean).sort()
    if (!datas.length) return { hasDupe: false, count: 0 }
    const minDt = datas[0]
    const maxDt = datas[datas.length - 1]
    try {
      const { count, error } = await supabase
        .from(tabela)
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .gte('data', minDt)
        .lte('data', maxDt)
      if (error) throw error
      const total = count || 0
      const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
      return { hasDupe: total > 0, count: total, minDt, maxDt, periodo: `${fmt(minDt)} a ${fmt(maxDt)}` }
    } catch (e) {
      console.error('checkDuplicates:', e.message)
      return { hasDupe: false, count: 0 }
    }
  }

  // ─── Executar importação (único ponto de insert/delete) ──────────────────────
  const executeImport = async ({ toInsert, tabela, modulo, replace, minDt, maxDt }) => {
    setIsImporting(true)
    try {
      // PASSO 1: se substituição, deletar registros existentes no período
      if (replace && minDt && maxDt) {
        const { error: delError } = await supabase
          .from(tabela)
          .delete()
          .eq('empresa_id', empresaId)
          .gte('data', minDt)
          .lte('data', maxDt)
        if (delError) throw new Error('Erro ao remover dados antigos: ' + delError.message)
      }

      // PASSO 2: inserir novos registros em lotes de 100
      for (let i = 0; i < toInsert.length; i += 100) {
        const { error } = await supabase.from(tabela).insert(toInsert.slice(i, i + 100))
        if (error) throw new Error('Erro ao inserir registros: ' + error.message)
      }

      // PASSO 3: se Fluxo de Caixa, atualizar Ciclo Financeiro por mês
      if (modulo === 'fluxo') {
        const porMes = {}
        toInsert.forEach(r => {
          const d = new Date(r.data + 'T00:00:00')
          const key = `${d.getFullYear()}-${d.getMonth() + 1}`
          if (!porMes[key]) porMes[key] = { ano: d.getFullYear(), mes: d.getMonth() + 1, entradas: 0, saidas: 0, cnt_e: 0, cnt_s: 0 }
          if (r.tipo === 'entrada') { porMes[key].entradas += r.valor; porMes[key].cnt_e++ }
          else                      { porMes[key].saidas   += r.valor; porMes[key].cnt_s++ }
        })
        for (const v of Object.values(porMes)) {
          const pmr = v.cnt_e > 0 ? Math.round(v.entradas / v.cnt_e) : 0
          const pmp = v.cnt_s > 0 ? Math.round(v.saidas   / v.cnt_s) : 0
          const { data: ex } = await supabase.from('ciclo_financeiro')
            .select('id').eq('empresa_id', empresaId).eq('ano', v.ano).eq('mes', v.mes).limit(1)
          if (ex?.length) {
            await supabase.from('ciclo_financeiro').update({ pmr, pmp })
              .eq('empresa_id', empresaId).eq('ano', v.ano).eq('mes', v.mes)
          } else {
            await supabase.from('ciclo_financeiro').insert({
              empresa_id: empresaId, ano: v.ano, mes: v.mes,
              pmr, pmp, pme: 0, ciclo_operacional: pmr, ciclo_financeiro_valor: pmr - pmp,
            })
          }
        }
      }

      const label = modulo === 'dre' ? 'lançamentos no DRE' : 'registros no Fluxo de Caixa'
      const extra = modulo === 'fluxo' ? ' · Ciclo Financeiro atualizado.' : ''
      showToast(`✓ ${toInsert.length} ${label} importados!${extra}`, 'success')
      if (modulo === 'dre') setDataDre([])
      else                  setDataFluxo([])
      setConfirmModal(null)
    } catch (e) {
      console.error('executeImport:', e)
      showToast('Erro na importação: ' + e.message, 'error')
    } finally {
      setIsImporting(false)
    }
  }

  // ─── Construir payload do DRE ──────────────────────────────────────────────
  const buildDrePayload = () =>
    (dataDre || []).map(row => {
      const map = (mappingsDre || []).find(m => m.categoria_origem?.toLowerCase() === (row.__desc || '').toLowerCase())
      let tipo = map?.tipo_destino || (row.tipoCsv.includes('pagar') ? 'despesa' : 'receita')
      if (!['receita','custo','despesa'].includes(tipo)) tipo = 'receita'
      return { empresa_id: empresaId, data: row.data, descricao: row.nome || row.__desc || '', valor: row.valor, tipo, conta_id: map?.conta_id || null, categoria: row.__desc || '' }
    }).filter(r => r.valor > 0)

  // ─── Construir payload do Fluxo de Caixa ──────────────────────────────────
  const buildFluxoPayload = () =>
    (dataFluxo || []).map(row => {
      const map = (mappingsFluxo || []).find(m => m.categoria_origem?.toLowerCase() === (row.__desc || '').toLowerCase())
      let tipo = map?.tipo_destino || (row.tipoCsv.includes('pagar') || row.tipoCsv.includes('saida') ? 'saida' : 'entrada')
      tipo = tipo.replace('fluxo_', '')
      if (!['entrada','saida'].includes(tipo)) tipo = 'entrada'
      return { empresa_id: empresaId, data: row.data, descricao: row.nome || row.__desc || '', valor: row.valor, tipo, conta_id: map?.conta_id || null, categoria: row.__desc || '' }
    }).filter(r => r.valor > 0)

  // ─── Importar DRE ─────────────────────────────────────────────────────────
  const importDre = async () => {
    if (!empresaId) { showToast('Selecione uma empresa.', 'error'); return }
    const toInsert = buildDrePayload()
    if (!toInsert.length) { showToast('Nenhum lançamento válido para importar.', 'error'); return }
    const dupe = await checkDuplicates(toInsert, 'lancamentos')
    if (dupe.hasDupe) {
      showToast(`⚠️ Já existem ${dupe.count} lançamentos no período ${dupe.periodo}`, 'error')
      setConfirmModal({ toInsert, tabela: 'lancamentos', modulo: 'dre', ...dupe })
      return
    }
    await executeImport({ toInsert, tabela: 'lancamentos', modulo: 'dre', replace: false })
  }

  // ─── Importar Fluxo de Caixa ──────────────────────────────────────────────
  const importFluxo = async () => {
    if (!empresaId) { showToast('Selecione uma empresa.', 'error'); return }
    const toInsert = buildFluxoPayload()
    if (!toInsert.length) { showToast('Nenhum registro válido para importar.', 'error'); return }
    const dupe = await checkDuplicates(toInsert, 'fluxo_caixa')
    if (dupe.hasDupe) {
      showToast(`⚠️ Já existem ${dupe.count} registros no período ${dupe.periodo}`, 'error')
      setConfirmModal({ toInsert, tabela: 'fluxo_caixa', modulo: 'fluxo', ...dupe })
      return
    }
    await executeImport({ toInsert, tabela: 'fluxo_caixa', modulo: 'fluxo', replace: false })
  }

    // ─── Modal de Confirmação de Substituição ─────────────────────────────────
  const ConfirmReplaceModal = () => {
    if (!confirmModal) return null
    const isFluxo = confirmModal.modulo === 'fluxo'
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
        <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:16, padding:28, width:'100%', maxWidth:460, boxShadow:'var(--fs-shadow-lg)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <div style={{ width:44, height:44, background:'var(--fs-warning-bg)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>⚠️</div>
            <div>
              <h2 style={{ fontSize:17, fontWeight:800, color:'var(--fs-text-1)', margin:0 }}>Dados existentes detectados</h2>
              <p style={{ fontSize:12, color:'var(--fs-text-4)', margin:'2px 0 0' }}>Conflito de período encontrado</p>
            </div>
          </div>

          <div style={{ background:'var(--fs-warning-bg)', border:'1px solid rgba(var(--fs-warning-rgb),0.3)', borderRadius:8, padding:'12px 14px', marginBottom:20 }}>
            <p style={{ fontSize:13, color:'var(--fs-text-2)', margin:'0 0 6px' }}>
              Já existem <strong style={{ color:'var(--fs-warning)' }}>{confirmModal.count} registros</strong> na base para o período:
            </p>
            <p style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-1)', margin:0 }}>
              📅 {confirmModal.periodo}
            </p>
          </div>

          <p style={{ fontSize:13, color:'var(--fs-text-3)', marginBottom:20 }}>
            O que deseja fazer com os dados existentes?
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button
              onClick={() => executeImport({ ...confirmModal, replace: true })}
              style={{ background:'var(--fs-danger)', color:'#fff', border:'none', borderRadius:9, padding:'12px', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
            >
              🔄 Substituir — apagar os {confirmModal.count} existentes e importar os novos
            </button>
            <button
              onClick={() => setConfirmModal(null)}
              style={{ background:'var(--fs-surface-2)', color:'var(--fs-text-1)', border:'1px solid var(--fs-border)', borderRadius:9, padding:'12px', fontSize:14, fontWeight:600, cursor:'pointer' }}
            >
              Cancelar — manter os dados existentes
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ color: 'var(--fs-text-1)', maxWidth: 960 }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmReplaceModal />
      {editingRow && (
        <MappingModal
          row={editingRow} planoContas={planoContas}
          modulo={activeTab} saving={savingMapping}
          onSave={saveMapping} onClose={() => setEditingRow(null)}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fs-text-1)', margin: 0 }}>Importação de Dados</h1>
        <p style={{ color: 'var(--fs-text-4)', fontSize: 13, margin: '4px 0 0' }}>
          Importe arquivos CSV ou XLSX do ERP Bling para o sistema financeiro
        </p>
      </div>

      {/* Empresa */}
      <div style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--fs-text-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Empresa</label>
        <select
          style={{ background: 'var(--fs-input-bg)', border: '1px solid var(--fs-input-border)', borderRadius: 8, color: 'var(--fs-text-1)', padding: '8px 12px', fontSize: 13, width: '100%', outline: 'none' }}
          value={empresaId || ''}
          onChange={e => handleEmpresaChange(e.target.value)}
        >
          {(empresas || []).map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'dre',   icon: '📊', label: 'DRE',           sub: 'Receitas, Custos e Despesas'      },
          { key: 'fluxo', icon: '💵', label: 'Fluxo de Caixa', sub: 'Entradas e Saídas + Ciclo Fin.'  },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '12px 24px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? 'var(--fs-brand)' : 'transparent',
              transition: 'all 0.2s', minWidth: 200,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: activeTab === tab.key ? '#fff' : 'var(--fs-text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab.icon} {tab.label}
            </span>
            <span style={{ fontSize: 11, color: activeTab === tab.key ? 'rgba(255,255,255,0.75)' : 'var(--fs-text-4)', marginTop: 2 }}>
              {tab.sub}
            </span>
          </button>
        ))}
      </div>

      {/* Info card por módulo */}
      <div style={{ background: activeTab === 'dre' ? 'rgba(var(--fs-brand-rgb),0.06)' : 'rgba(var(--fs-success-rgb),0.06)', border: `1px solid ${activeTab === 'dre' ? 'rgba(var(--fs-brand-rgb),0.2)' : 'rgba(var(--fs-success-rgb),0.2)'}`, borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13 }}>
        {activeTab === 'dre' ? (
          <span style={{ color: 'var(--fs-text-2)' }}>
            <strong style={{ color: 'var(--fs-brand)' }}>DRE:</strong> Os lançamentos serão salvos na tabela de <strong>Demonstrativos</strong> (receitas, custos e despesas), alimentando o DRE, Análise e Comparativo.
          </span>
        ) : (
          <span style={{ color: 'var(--fs-text-2)' }}>
            <strong style={{ color: 'var(--fs-success)' }}>Fluxo de Caixa:</strong> Os lançamentos serão salvos em <strong>Fluxo de Caixa</strong> (entradas/saídas) e o <strong>Ciclo Financeiro</strong> será atualizado automaticamente por período.
          </span>
        )}
      </div>

      {/* Área de upload */}
      {activeTab === 'dre' ? (
        dataDre.length === 0 ? (
          <DropZone
            onFile={f => processFile(f, 'dre')} fileRef={fileRefDre}
            label="Arraste ou clique para selecionar — DRE"
            sublabel="CSV (Bling) ou XLSX com Receitas, Custos e Despesas"
          />
        ) : (
          <>
            <PreviewTable data={dataDre} mappings={mappingsDre} modulo="dre"
              onEdit={row => setEditingRow(row)}
              onRemove={() => setDataDre([])}
            />
            <button onClick={importDre} disabled={isImporting}
              style={{ width: '100%', background: isImporting ? 'var(--fs-surface-3)' : 'var(--fs-brand)', color: isImporting ? 'var(--fs-text-4)' : '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 800, cursor: isImporting ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
              {isImporting ? '⏳ Importando...' : `📊 Importar ${dataDre.length} Lançamentos no DRE`}
            </button>
          </>
        )
      ) : (
        dataFluxo.length === 0 ? (
          <DropZone
            onFile={f => processFile(f, 'fluxo')} fileRef={fileRefFluxo}
            label="Arraste ou clique para selecionar — Fluxo de Caixa"
            sublabel="CSV (Bling) ou XLSX com Entradas e Saídas financeiras"
          />
        ) : (
          <>
            <PreviewTable data={dataFluxo} mappings={mappingsFluxo} modulo="fluxo"
              onEdit={row => setEditingRow(row)}
              onRemove={() => setDataFluxo([])}
            />
            <div style={{ background: 'var(--fs-success-bg)', border: '1px solid rgba(var(--fs-success-rgb),0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--fs-success)' }}>
              ℹ️ Além do Fluxo de Caixa, o <strong>Ciclo Financeiro</strong> será atualizado automaticamente para cada mês presente nos dados.
            </div>
            <button onClick={importFluxo} disabled={isImporting}
              style={{ width: '100%', background: isImporting ? 'var(--fs-surface-3)' : 'var(--fs-success)', color: isImporting ? 'var(--fs-text-4)' : '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 800, cursor: isImporting ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
              {isImporting ? '⏳ Importando...' : `💵 Importar ${dataFluxo.length} Registros no Fluxo de Caixa`}
            </button>
          </>
        )
      )}
    </div>
  )
}
