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
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    init()
  }, [])

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
        setUploadedData(data.map((row, i) => ({ ...row, __id: i, __desc: String(row['Descrição'] || row['descrição'] || '').trim() })))
      } catch (err) { alert('Erro ao ler arquivo') }
    }
    reader.readAsBinaryString(file)
  }

  const saveMapping = async () => {
    if (!selectedContaId || !editingRow) return
    try {
      const conta = planoContas.find(c => c.id === selectedContaId)
      await supabase.from('categoria_mappings').upsert({
        empresa_id: empresaId,
        categoria_origem: editingRow.__desc,
        conta_id: selectedContaId,
        tipo_destino: conta?.tipo || 'receita',
        ativo: true
      }, { onConflict: 'empresa_id,categoria_origem' })
      const { data: maps } = await supabase.from('categoria_mappings').select('*').eq('empresa_id', empresaId)
      setMappings(maps || [])
      setEditingRow(null)
    } catch (e) { alert('Erro ao salvar') }
  }

  const finalizeImport = async () => {
    setIsImporting(true)
    try {
      const toInsert = uploadedData.map(row => {
        const map = mappings.find(m => m.categoria_origem.toLowerCase() === row.__desc.toLowerCase())
        if (!map) return null
        let v = row['Valor Pago/Recebido'] || row['Valor'] || 0
        let valor = typeof v === 'number' ? v : parseFloat(String(v).replace(/\./g, '').replace(',', '.'))
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
      if (toInsert.length > 0) await supabase.from('lancamentos').insert(toInsert)
      alert('Importado com sucesso!')
      setUploadedData([])
    } catch (e) { alert('Erro na importação') } finally { setIsImporting(false) }
  }

  if (loading) return <div className="p-8 text-white">Carregando...</div>

  return (
    <div className="p-6 text-white max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Importação / De-Para</h1>
      
      <div className="bg-gray-900 p-4 rounded-lg mb-6 border border-gray-800">
        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Empresa</label>
        <select 
          className="w-full bg-black p-2 rounded border border-gray-700"
          value={empresaId || ''} 
          onChange={(e) => setEmpresaId(e.target.value)}
        >
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {uploadedData.length === 0 ? (
        <div 
          className="border-2 border-dashed border-gray-700 p-12 text-center rounded-lg cursor-pointer hover:border-blue-500"
          onClick={() => fileInputRef.current.click()}
        >
          <p>Clique para selecionar o arquivo CSV ou Excel</p>
          <input ref={fileInputRef} type="file" hidden onChange={handleFile} />
        </div>
      ) : (
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
          <div className="flex justify-between mb-4">
            <span>{uploadedData.length} registros</span>
            <button onClick={() => setUploadedData([])} className="text-red-500 text-sm">Remover</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="py-2 text-left">Descrição</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {uploadedData.slice(0, 100).map(row => {
                const map = mappings.find(m => m.categoria_origem.toLowerCase() === row.__desc.toLowerCase())
                return (
                  <tr key={row.__id} className="border-b border-gray-800/50">
                    <td className="py-2">{row.__desc}</td>
                    <td className="py-2">{map ? <span className="text-blue-400">Mapeado</span> : <span className="text-red-400">Pendente</span>}</td>
                    <td className="py-2 text-right">
                      {!map && <button onClick={() => setEditingRow(row)} className="text-blue-400">Configurar</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button 
            onClick={finalizeImport} 
            className="w-full bg-blue-600 py-3 rounded-lg mt-6 font-bold"
            disabled={isImporting}
          >
            {isImporting ? 'Importando...' : 'Finalizar Importação'}
          </button>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 p-6 rounded-lg w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Configurar De-Para</h2>
            <p className="text-sm text-gray-400 mb-2">Categoria no arquivo:</p>
            <div className="bg-black p-2 rounded mb-4">{editingRow.__desc}</div>
            <p className="text-sm text-gray-400 mb-2">Conta no sistema:</p>
            <select 
              className="w-full bg-black p-2 rounded border border-gray-700 mb-6"
              value={selectedContaId} 
              onChange={(e) => setSelectedContaId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {planoContas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setEditingRow(null)} className="flex-1 bg-gray-800 py-2 rounded">Cancelar</button>
              <button onClick={saveMapping} className="flex-1 bg-blue-600 py-2 rounded">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
