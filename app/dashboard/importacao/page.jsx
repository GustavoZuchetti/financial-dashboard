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
  const [status, setStatus] = useState('Pronto para importar')
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
        console.error('Erro ao carregar dados:', e)
      } finally { 
        setLoading(false) 
      }
    }
    init()
  }, [])

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setStatus(`Processando: ${file.name}...`)
    const reader = new FileReader()
    
    reader.onload = (evt) => {
      try {
        const isCsv = file.name.toLowerCase().endsWith('.csv')
        let workbook
        if (isCsv) {
          const text = new TextDecoder('utf-8').decode(evt.target.result).replace(/^\uFEFF/, '')
          const sep = text.split('\n')[0].includes(';') ? ';' : ','
          workbook = XLSX.read(text, { type: 'string', FS: sep })
        } else {
          workbook = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' })
        }
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        // Converter para JSON com suporte a cabeçalhos flexíveis
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
        // Normalizar: trim em chaves e valores string
        const json = rawJson.map(row => {
          const r = {}
          Object.keys(row).forEach(k => { r[k.trim()] = typeof row[k] === 'string' ? row[k].trim() : row[k] })
          return r
        })
        
        if (json.length === 0) {
          setStatus('Arquivo vazio.')
          return
        }

        const processed = json.map((row, i) => {
          // Buscar descrição em várias colunas possíveis
          const desc = row['Descrição'] || row['descricao'] || row['Categoria'] || row['categoria'] || row['DESCRIÇÃO'] || ''
          const nome = row['Nome'] || row['nome'] || row['NOME'] || ''
          const valor = row['Valor'] || row['valor'] || row['Valor Pago/Recebido'] || 0
          // Converter data DD/MM/YYYY → YYYY-MM-DD para o banco
          const rawDate = row['Liquidação'] || row['Data'] || row['data'] || row['DATA'] || ''
          const parseBR = (s) => {
            const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
            if (m) return `${m[3]}-${m[2]}-${m[1]}`
            if (String(s).match(/^\d{4}-\d{2}-\d{2}/)) return String(s).split('T')[0]
            return new Date().toISOString().split('T')[0]
          }
          const data = parseBR(rawDate)

          return {
            __id: i,
            __desc: String(desc).trim(),
            nome: String(nome).trim(),
            valor: valor,
            data: data,
            original: row
          }
        })

        setUploadedData(processed)
        setStatus(`${processed.length} registros carregados.`)
      } catch (err) {
        console.error('Erro ao processar arquivo:', err)
        setStatus('Erro ao processar arquivo.')
        alert('Erro ao processar arquivo. Verifique o formato.')
      }
    }
    
    reader.readAsArrayBuffer(file)
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
      setStatus('Mapeamento salvo!')
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
        
        let valor = typeof row.valor === 'number' ? row.valor : parseFloat(String(row.valor).replace(/\./g, '').replace(',', '.'))
        
        return {
          empresa_id: empresaId,
          data: row.data || new Date().toISOString().split('T')[0],
          descricao: row.nome || '',
          valor: isNaN(valor) ? 0 : valor,
          tipo: map.tipo_destino,
          conta_id: map.conta_id,
          categoria: row.__desc
        }
      }).filter(Boolean)
      
      if (toInsert.length > 0) {
        const { error } = await supabase.from('lancamentos').insert(toInsert)
        if (error) throw error
        alert(`${toInsert.length} registros importados com sucesso!`)
        setUploadedData([])
      } else {
        alert('Nenhum registro mapeado para importar.')
      }
    } catch (e) { 
      alert('Erro na importação: ' + e.message) 
    } finally { 
      setIsImporting(false) 
    }
  }

  if (loading) return <div className="p-8 text-white font-bold">Carregando...</div>

  return (
    <div className="p-6 text-white max-w-5xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black tracking-tighter">IMPORTAÇÃO / DE-PARA</h1>
        <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full uppercase tracking-widest">
          {status}
        </span>
      </div>
      
      <div className="bg-gray-900 p-6 rounded-2xl mb-8 border border-gray-800 shadow-xl">
        <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Empresa Selecionada</label>
        <select 
          className="w-full bg-black p-4 rounded-xl border border-gray-800 text-white font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all"
          value={empresaId || ''} 
          onChange={(e) => setEmpresaId(e.target.value)}
        >
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {uploadedData.length === 0 ? (
        <div 
          className="border-2 border-dashed border-gray-800 p-20 text-center rounded-3xl cursor-pointer hover:border-blue-600 bg-gray-900/40 transition-all group"
          onClick={() => fileInputRef.current.click()}
        >
          <div className="bg-blue-600/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Selecione seu arquivo</h2>
          <p className="text-gray-500 text-sm">Suporta XLSX, XLS e CSV (UTF-8)</p>
          <input ref={fileInputRef} type="file" hidden onChange={handleFile} accept=".csv,.xlsx,.xls" />
        </div>
      ) : (
        <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xl font-black">{uploadedData.length} REGISTROS</span>
            </div>
            <button onClick={() => setUploadedData([])} className="bg-red-500/10 text-red-500 px-4 py-2 rounded-lg text-[10px] font-black hover:bg-red-500/20 transition-all">REMOVER ARQUIVO</button>
          </div>
          
          <div className="max-h-[500px] overflow-y-auto rounded-2xl border border-gray-800 bg-black/50">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-black text-gray-500 sticky top-0 z-10">
                <tr>
                  <th className="p-5 font-black uppercase text-[10px] tracking-widest">Descrição no Arquivo</th>
                  <th className="p-5 font-black uppercase text-[10px] tracking-widest">Status</th>
                  <th className="p-5 font-black uppercase text-[10px] tracking-widest text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {uploadedData.map(row => {
                  const map = mappings.find(m => m.categoria_origem.toLowerCase() === (row.__desc || '').toLowerCase())
                  return (
                    <tr key={row.__id} className="hover:bg-white/5 transition-colors">
                      <td className="p-5 text-gray-300 font-medium">{row.__desc}</td>
                      <td className="p-5">
                        {map ? 
                          <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full text-[10px] font-black">MAPEADO</span> : 
                          <span className="bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-[10px] font-black">PENDENTE</span>
                        }
                      </td>
                      <td className="p-5 text-right">
                        {!map && <button onClick={() => setEditingRow(row)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-black text-[10px] transition-all">CONFIGURAR</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          <button 
            onClick={finalizeImport} 
            className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl mt-10 font-black text-xl transition-all shadow-2xl shadow-blue-900/40 active:scale-[0.98]"
            disabled={isImporting}
          >
            {isImporting ? 'PROCESSANDO...' : 'FINALIZAR IMPORTAÇÃO'}
          </button>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 z-50">
          <div className="bg-gray-900 p-10 rounded-[2.5rem] w-full max-w-lg border border-gray-800 shadow-2xl">
            <h2 className="text-3xl font-black mb-8 tracking-tighter">CONFIGURAR DE-PARA</h2>
            <div className="mb-8">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Categoria Detectada</p>
              <div className="bg-black p-6 rounded-2xl border border-gray-800 font-bold text-blue-400 text-lg">{editingRow.__desc}</div>
            </div>
            <div className="mb-10">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Conta de Destino (DRE)</p>
              <select 
                className="w-full bg-black p-6 rounded-2xl border border-gray-800 text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/20 transition-all appearance-none"
                value={selectedContaId} 
                onChange={(e) => setSelectedContaId(e.target.value)}
              >
                <option value="">Selecione uma conta...</option>
                {planoContas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="flex gap-6">
              <button onClick={() => setEditingRow(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 py-5 rounded-2xl font-black transition-all">CANCELAR</button>
              <button onClick={saveMapping} className="flex-1 bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black transition-all shadow-lg shadow-blue-900/20">SALVAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
