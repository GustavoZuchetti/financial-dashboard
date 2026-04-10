'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User, Building2, Plus, Save } from 'lucide-react'

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState('empresas')
  const [empresas, setEmpresas] = useState([])
  const [perfil, setPerfil] = useState({ nome: '', email: '' })
  const [novaEmpresa, setNovaEmpresa] = useState({ nome: '', cnpj: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setPerfil({ nome: user.user_metadata?.nome || '', email: user.email || '' })
    const { data: emps } = await supabase.from('empresas').select('*').order('nome')
    if (emps) setEmpresas(emps)
    setLoading(false)
  }

  const handleSavePerfil = async () => {
    const { error } = await supabase.auth.updateUser({ data: { nome: perfil.nome } })
    setMsg(error ? 'Erro ao salvar' : 'Perfil atualizado!')
    setTimeout(() => setMsg(''), 3000)
  }

  const handleAddEmpresa = async () => {
    if (!novaEmpresa.nome) return
    const { error } = await supabase.from('empresas').insert(novaEmpresa)
    if (!error) { setNovaEmpresa({ nome: '', cnpj: '' }); loadData(); setMsg('Empresa adicionada!') }
    else setMsg('Erro ao adicionar empresa')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white text-xl font-bold">Configuracoes</h1>
        <p className="text-gray-400 text-sm">Gerencie perfil e empresas</p>
      </div>

      {msg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 mb-4">
          <p className="text-emerald-400 text-sm">{msg}</p>
        </div>
      )}

      <div className="flex gap-1 mb-6">
        {[{ id: 'empresas', icon: Building2, label: 'Empresas' }, { id: 'perfil', icon: User, label: 'Perfil' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === t.id ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'perfil' && (
        <div className="bg-[#12121a] border border-gray-800 rounded-xl p-6 max-w-lg">
          <h3 className="text-white font-medium text-sm mb-5">Dados do Perfil</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Nome</label>
              <input
                value={perfil.nome}
                onChange={e => setPerfil({ ...perfil, nome: e.target.value })}
                className="w-full bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">E-mail</label>
              <input value={perfil.email} disabled className="w-full bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-gray-500 text-sm" />
            </div>
            <button
              onClick={handleSavePerfil}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Save size={13} /> Salvar
            </button>
          </div>
        </div>
      )}

      {tab === 'empresas' && (
        <div className="space-y-4">
          <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-medium text-sm mb-4">Adicionar Empresa</h3>
            <div className="flex gap-3">
              <input
                placeholder="Nome da empresa"
                value={novaEmpresa.nome}
                onChange={e => setNovaEmpresa({ ...novaEmpresa, nome: e.target.value })}
                className="flex-1 bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
              <input
                placeholder="CNPJ (opcional)"
                value={novaEmpresa.cnpj}
                onChange={e => setNovaEmpresa({ ...novaEmpresa, cnpj: e.target.value })}
                className="w-44 bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleAddEmpresa}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus size={13} /> Adicionar
              </button>
            </div>
          </div>

          <div className="bg-[#12121a] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-medium text-sm">Empresas Cadastradas</h3>
            </div>
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Nome', 'CNPJ', 'Criado em'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-gray-400 text-xs font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empresas.map(e => (
                    <tr key={e.id} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-white text-sm">{e.nome}</td>
                      <td className="px-5 py-3 text-gray-400 text-sm font-mono">{e.cnpj || '-'}</td>
                      <td className="px-5 py-3 text-gray-400 text-sm">{new Date(e.created_at).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                  {empresas.length === 0 && (
                    <tr><td colSpan={3} className="px-5 py-10 text-center text-gray-500 text-sm">Nenhuma empresa cadastrada</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
