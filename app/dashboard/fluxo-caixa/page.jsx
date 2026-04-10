'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp } from 'lucide-react'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()

function fmt(v) {
  if (!v && v !== 0) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
}

export default function FluxoCaixaPage() {
  const [ano, setAno] = useState(ANO_ATUAL)
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [empresa, setEmpresa] = useState(null)

  useEffect(() => {
    const id = localStorage.getItem('empresa_id')
    setEmpresa(id)
  }, [])

  useEffect(() => {
    if (!empresa) return
    loadDados()
  }, [empresa, ano])

  const loadDados = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('fluxo_caixa')
        .select('*')
        .eq('empresa_id', empresa)
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`)
        .order('data')

      if (data) processarDados(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const processarDados = (items) => {
    const entradas = items.filter(i => i.tipo === 'entrada')
    const saidas = items.filter(i => i.tipo === 'saida')
    const totalEntradas = entradas.reduce((s, i) => s + (i.valor || 0), 0)
    const totalSaidas = saidas.reduce((s, i) => s + (i.valor || 0), 0)
    const saldo = totalEntradas - totalSaidas

    let saldoAcum = 0
    const mensal = MESES.map((m, idx) => {
      const mesNum = idx + 1
      const ent = items.filter(i => i.tipo === 'entrada' && new Date(i.data).getMonth() + 1 === mesNum).reduce((s, i) => s + i.valor, 0)
      const sai = items.filter(i => i.tipo === 'saida' && new Date(i.data).getMonth() + 1 === mesNum).reduce((s, i) => s + i.valor, 0)
      saldoAcum += (ent - sai)
      return { mes: m, entradas: ent, saidas: sai, saldo: ent - sai, acumulado: saldoAcum }
    })

    setDados({ totalEntradas, totalSaidas, saldo, mensal })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-bold">Fluxo de Caixa</h1>
          <p className="text-gray-400 text-sm">Entradas, saidas e saldo acumulado</p>
        </div>
        <select
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        >
          {[ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dados ? (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-2">
                <span className="text-gray-400 text-xs">Total Entradas</span>
                <ArrowUpCircle size={16} className="text-emerald-400" />
              </div>
              <p className="text-emerald-400 text-xl font-bold">{fmt(dados.totalEntradas)}</p>
            </div>
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-2">
                <span className="text-gray-400 text-xs">Total Saidas</span>
                <ArrowDownCircle size={16} className="text-red-400" />
              </div>
              <p className="text-red-400 text-xl font-bold">{fmt(dados.totalSaidas)}</p>
            </div>
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-2">
                <span className="text-gray-400 text-xs">Saldo Liquido</span>
                <Wallet size={16} className="text-blue-400" />
              </div>
              <p className={`text-xl font-bold ${dados.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(dados.saldo)}</p>
            </div>
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-2">
                <span className="text-gray-400 text-xs">Saldo Acumulado</span>
                <TrendingUp size={16} className="text-purple-400" />
              </div>
              <p className="text-purple-400 text-xl font-bold">{fmt(dados.mensal[dados.mensal.length-1]?.acumulado)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-medium text-sm mb-4">Entradas vs Saidas por Mes</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dados.mensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => fmt(v)} />
                  <Tooltip
                    contentStyle={{ background: '#12121a', border: '1px solid #1f1f2e', borderRadius: 8 }}
                    formatter={(v) => fmt(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Bar dataKey="entradas" fill="#10b981" radius={[4,4,0,0]} name="Entradas" />
                  <Bar dataKey="saidas" fill="#ef4444" radius={[4,4,0,0]} name="Saidas" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-medium text-sm mb-4">Saldo Acumulado</h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={dados.mensal}>
                  <defs>
                    <linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => fmt(v)} />
                  <Tooltip
                    contentStyle={{ background: '#12121a', border: '1px solid #1f1f2e', borderRadius: 8 }}
                    formatter={(v) => fmt(v)}
                  />
                  <Area type="monotone" dataKey="acumulado" stroke="#10b981" fill="url(#gradAcum)" strokeWidth={2} name="Acumulado" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-400">Nenhum dado encontrado.</p>
        </div>
      )}
    </div>
  )
}
