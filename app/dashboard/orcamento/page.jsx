'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()

function fmt(v) {
  if (!v && v !== 0) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
}

export default function OrcamentoPage() {
  const [ano, setAno] = useState(ANO_ATUAL)
  const [dados, setDados] = useState([])
  const [loading, setLoading] = useState(true)
  const [empresa, setEmpresa] = useState(null)
  const [editando, setEditando] = useState(null)

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
    const { data: orc } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('empresa_id', empresa)
      .eq('ano', ano)

    const { data: lanc } = await supabase
      .from('lancamentos')
      .select('*')
      .eq('empresa_id', empresa)
      .gte('data', `${ano}-01-01`)
      .lte('data', `${ano}-12-31`)

    const mesData = MESES.map((mes, i) => {
      const mesNum = i + 1
      const orcMes = orc?.find(o => o.mes === mesNum)
      const realizado = lanc?.filter(l => new Date(l.data).getMonth() + 1 === mesNum && l.tipo === 'receita').reduce((s, l) => s + l.valor, 0) || 0
      return {
        mes,
        mesNum,
        orcado: orcMes?.valor_orcado || 0,
        realizado,
        variacao: orcMes?.valor_orcado ? ((realizado - orcMes.valor_orcado) / orcMes.valor_orcado * 100) : 0
      }
    })
    setDados(mesData)
    setLoading(false)
  }

  const totalOrcado = dados.reduce((s, d) => s + d.orcado, 0)
  const totalRealizado = dados.reduce((s, d) => s + d.realizado, 0)
  const variacaoTotal = totalOrcado > 0 ? ((totalRealizado - totalOrcado) / totalOrcado * 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-bold">Orcamento</h1>
          <p className="text-gray-400 text-sm">Planejado vs Realizado por periodo</p>
        </div>
        <select
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        >
          {[ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1">Total Orcado</p>
          <p className="text-white text-xl font-bold">{fmt(totalOrcado)}</p>
        </div>
        <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1">Total Realizado</p>
          <p className="text-emerald-400 text-xl font-bold">{fmt(totalRealizado)}</p>
        </div>
        <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1">Variacao</p>
          <p className={`text-xl font-bold ${variacaoTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {variacaoTotal >= 0 ? '+' : ''}{variacaoTotal.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-white font-medium text-sm mb-4">Orcado vs Realizado por Mes</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
            <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => fmt(v)} />
            <Tooltip
              contentStyle={{ background: '#12121a', border: '1px solid #1f1f2e', borderRadius: 8 }}
              formatter={(v) => fmt(v)}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            <Bar dataKey="orcado" fill="#6366f1" radius={[4,4,0,0]} name="Orcado" />
            <Bar dataKey="realizado" fill="#10b981" radius={[4,4,0,0]} name="Realizado" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#12121a] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-medium text-sm">Detalhamento Mensal</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-5 py-3 text-left text-gray-400 text-xs font-medium">Mes</th>
              <th className="px-5 py-3 text-right text-gray-400 text-xs font-medium">Orcado</th>
              <th className="px-5 py-3 text-right text-gray-400 text-xs font-medium">Realizado</th>
              <th className="px-5 py-3 text-right text-gray-400 text-xs font-medium">Variacao</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d) => (
              <tr key={d.mes} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                <td className="px-5 py-3 text-white text-sm">{d.mes}</td>
                <td className="px-5 py-3 text-right text-gray-300 text-sm">{fmt(d.orcado)}</td>
                <td className="px-5 py-3 text-right text-white text-sm">{fmt(d.realizado)}</td>
                <td className={`px-5 py-3 text-right text-sm font-medium ${d.variacao >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {d.variacao >= 0 ? '+' : ''}{d.variacao.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
