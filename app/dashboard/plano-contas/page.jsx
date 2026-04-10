'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronRight, ChevronDown, Plus, Trash2 } from 'lucide-react'

export default function PlanoContasPage() {
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [empresa, setEmpresa] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [nova, setNova] = useState({ codigo: '', nome: '', tipo: 'receita', pai_id: null })

  useEffect(() => {
    const id = localStorage.getItem('empresa_id')
    setEmpresa(id)
  }, [])

  useEffect(() => {
    if (!empresa) return
    loadContas()
  }, [empresa])

  const loadContas = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('plano_contas')
      .select('*')
      .eq('empresa_id', empresa)
      .order('codigo')
    if (data) setContas(data)
    setLoading(false)
  }

  const raizes = contas.filter(c => !c.pai_id)
  const filhos = (paiId) => contas.filter(c => c.pai_id === paiId)

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const handleAdd = async () => {
    const { error } = await supabase.from('plano_contas').insert({ ...nova, empresa_id: empresa })
    if (!error) { setShowModal(false); setNova({ codigo: '', nome: '', tipo: 'receita', pai_id: null }); loadContas() }
  }

  const handleDelete = async (id) => {
    if (!confirm('Confirmar exclusao?')) return
    await supabase.from('plano_contas').delete().eq('id', id)
    loadContas()
  }

  const tipoColor = (tipo) => {
    const map = { receita: 'text-emerald-400 bg-emerald-400/10', custo: 'text-orange-400 bg-orange-400/10', despesa: 'text-red-400 bg-red-400/10', ativo: 'text-blue-400 bg-blue-400/10', passivo: 'text-purple-400 bg-purple-400/10' }
    return map[tipo] || 'text-gray-400 bg-gray-400/10'
  }

  function ContaRow({ conta, depth = 0 }) {
    const subs = filhos(conta.id)
    const isOpen = expanded[conta.id]
    return (
      <>
        <tr className="border-b border-gray-800/50 hover:bg-white/[0.02]">
          <td className="px-5 py-2.5">
            <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
              {subs.length > 0 ? (
                <button onClick={() => toggle(conta.id)} className="text-gray-400 hover:text-white">
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              ) : <span className="w-4" />}
              <span className="text-gray-400 text-xs font-mono">{conta.codigo}</span>
            </div>
          </td>
          <td className="px-5 py-2.5 text-white text-sm">{conta.nome}</td>
          <td className="px-5 py-2.5">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${tipoColor(conta.tipo)}`}>{conta.tipo}</span>
          </td>
          <td className="px-5 py-2.5">
            <button onClick={() => handleDelete(conta.id)} className="text-gray-600 hover:text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
          </td>
        </tr>
        {isOpen && subs.map(s => <ContaRow key={s.id} conta={s} depth={depth + 1} />)}
      </>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-bold">Plano de Contas</h1>
          <p className="text-gray-400 text-sm">Estrutura de contas contabeis</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Nova Conta
        </button>
      </div>

      <div className="bg-[#12121a] border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Codigo', 'Nome', 'Tipo', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-gray-400 text-xs font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {raizes.map(c => <ContaRow key={c.id} conta={c} />)}
              {raizes.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-500 text-sm">Nenhuma conta cadastrada</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-[#12121a] border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-medium mb-4">Nova Conta</h3>
            <div className="space-y-3">
              <input placeholder="Codigo (ex: 1.1.1)" value={nova.codigo} onChange={e => setNova({...nova, codigo: e.target.value})} className="w-full bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
              <input placeholder="Nome da conta" value={nova.nome} onChange={e => setNova({...nova, nome: e.target.value})} className="w-full bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
              <select value={nova.tipo} onChange={e => setNova({...nova, tipo: e.target.value})} className="w-full bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500">
                {['receita','custo','despesa','ativo','passivo'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={nova.pai_id || ''} onChange={e => setNova({...nova, pai_id: e.target.value || null})} className="w-full bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500">
                <option value="">Sem conta pai (raiz)</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-700 text-gray-400 hover:text-white py-2 rounded-lg text-sm transition-colors">Cancelar</button>
              <button onClick={handleAdd} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm transition-colors">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
