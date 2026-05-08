'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { CheckCircle2, AlertCircle, Plus, Upload, FileText, Trash2 } from 'lucide-react'

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
  const fileInputRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: emps } = await supabase.from('empresas').select('*').order('nome')
        const allEmps = emps || []
        setEmpresas(allEmps)
        
        const savedId = localStorage.getItem('empresa_id')
        const initialId = (savedId && allEmps.some(e => e.id === savedId)) ? savedId : allEmps[0]?.id
        setEmpresaId(initialId)
        
        const { data: plano } = await supabase.from('plano_contas').select('*').order('nome')
        setPlanoContas(plano || [])

        if (initialId) {
          const { data: maps } = await supabase.from('categoria_mappings').select('*').eq('empresa_id', initialId)
          setMappings(maps || [])
        }
      } catch (e) { 
        console.error('Erro na inicialização:', e) 
      } finally { 
        setLoading(false) 
      }
    }
    init()
  }, [])

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    try {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const bstr = evt.target.result
          const wb = XLSX.read(bstr, { type: 'binary' })
          const wsname = wb.SheetNames[0]
          const ws = wb.Sheets[wsname]
          const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
          
          const processed = data.map((row, idx) => ({
            ...row,
            __id: idx,
            __desc: String(row['Descrição'] || row['descrição'] || '').trim()
          }))
          setUploadedData(processed)
        } catch (err) {
          alert('Erro ao ler o conteúdo do arquivo: ' + err.message)
        }
      }
      reader.readAsBinaryString(file)
    } catch (err) {
      alert('Erro ao carregar o arquivo: ' + err.message)
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
      setSelectedContaId('')
    } catch (e) { 
      alert('Erro ao salvar mapeamento: ' + e.message) 
    }
  }

  const finalizeImport = async () => {
    setIsImporting(true)
    try {
      const toInsert = uploadedData.map(row => {
        const map = mappings.find(m => m.categoria_origem.toLowerCase() === row.__desc.toLowerCase())
        if (!map) return null
        
        let valorRaw = row['Valor Pago/Recebido'] || row['Valor'] || 0
        let valor = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw).replace(/\./g, '').replace(',', '.'))

        return {
          empresa_id: empresaId,
          data: row['Data'] || row['data'] || new Date().toISOString(),
          descricao: row['Nome'] || row['nome'] || '',
          valor: isNaN(valor) ? 0 : valor,
          tipo: map.tipo_destino,
          conta_id: map.conta_id,
          categoria: row.__desc
        }
      }).filter(Boolean)

      if (toInsert.length === 0) throw new Error('Nenhum dado mapeado para importar.')
      const { error } = await supabase.from('lancamentos').insert(toInsert)
      if (error) throw error
      alert(`${toInsert.length} registros importados com sucesso!`)
      setUploadedData([])
    } catch (e) { 
      alert('Erro na importação: ' + e.message) 
    } finally { 
      setIsImporting(false) 
    }
  }

  if (loading) return <div className="p-8 text-white">Carregando sistema...</div>

  return (
    <div className="p-6 text-gray-200 max-w-6xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-8 text-white">Importação / De-Para</h1>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
        <label className="block mb-2 text-gray-400 text-xs font-bold uppercase tracking-wider">Empresa Selecionada</label>
        <select 
          className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-600"
          value={empresaId || ''} 
          onChange={(e) => { setEmpresaId(e.target.value); localStorage.setItem('empresa_id', e.target.value) }}
        >
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {uploadedData.length === 0 ? (
        <div 
          className="border-2 border-dashed border-gray-800 rounded-2xl p-16 text-center cursor-pointer hover:border-blue-600 transition-all bg-gray-900/40"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={56} className="text-blue-600 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-white mb-2">Selecione seu arquivo CSV ou Excel</h3>
          <p className="text-gray-500 text-sm">O sistema usará a coluna "Descrição" para o mapeamento automático</p>
          <input ref={fileInputRef} type="file" hidden onChange={handleFile} accept=".csv,.xlsx" />
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <FileText className="text-blue-600" />
              <span className="font-bold text-white">{uploadedData.length} registros encontrados</span>
            </div>
            <button 
              onClick={() => setUploadedData([])} 
              className="text-red-500 hover:text-red-400 text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <Trash2 size={18} /> Remover Arquivo
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="p-4">Descrição (Categoria)</th>
                  <th className="p-4">Valor</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {uploadedData.slice(0, 50).map(row => {
                  const isMapped = mappings.some(m => m.categoria_origem.toLowerCase() === row.__desc.toLowerCase())
                  return (
                    <tr key={row.__id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="p-4 text-gray-200">{row.__desc || '-'}</td>
                      <td className="p-4 text-gray-400">{row['Valor'] || row['Valor Pago/Recebido'] || '-'}</td>
                      <td className="p-4">
                        {isMapped ? 
                          <span className="text-blue-500 font-bold text-[10px] flex items-center gap-1"><CheckCircle2 size={12}/> MAPEADO</span> : 
                          <span className="text-red-500 font-bold text-[10px] flex items-center gap-1"><AlertCircle size={12}/> PENDENTE</span>
                        }
                      </td>
                      <td className="p-4 text-right">
                        {!isMapped && (
                          <button 
                            onClick={() => setEditingRow(row)} 
                            className="text-blue-500 hover:text-blue-400 font-bold text-xs"
                          >
                            Configurar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button 
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl mt-8 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
            onClick={finalizeImport} 
            disabled={isImporting}
          >
            {isImporting ? '⏳ Importando...' : '🚀 Finalizar Importação'}
          </button>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-6">Configurar De-Para</h3>
            <div className="mb-6">
              <label className="block mb-2 text-gray-500 text-[10px] font-black uppercase tracking-widest">Categoria no Arquivo</label>
              <div className="bg-black p-4 rounded-xl border border-gray-800 text-white font-bold">{editingRow.__desc}</div>
            </div>
            <div className="mb-8">
              <label className="block mb-2 text-gray-500 text-[10px] font-black uppercase tracking-widest">Conta no Sistema (Destino)</label>
              <select 
                className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600 appearance-none"
                value={selectedContaId} 
                onChange={(e) => setSelectedContaId(e.target.value)}
              >
                <option value="">Selecione uma conta...</option>
                {planoContas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setEditingRow(null)} 
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-4 rounded-xl font-bold transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={saveMapping} 
                disabled={!selectedContaId} 
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
