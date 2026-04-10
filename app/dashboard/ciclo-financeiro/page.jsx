'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()

export default function CicloFinanceiroPage() {
  const [ano, setAno] = useState(ANO_ATUAL)
  const [dados, setDados] = useState([])
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
    const { data } = await supabase
      .from('ciclo_financeiro')
      .select('*')
      .eq('empresa_id', empresa)
      .eq('ano', ano)
      .order('mes')

    if (data) {
      const mesData = MESES.map((mes, i) => {
        const mesNum = i + 1
        const d = data.find(r => r.mes === mesNum)
        return {
          mes,
          pmp: d?.pmp || 0,
          pme: d?.pme || 0,
          pmr: d?.pmr || 0,
          ciclo: d ? (d.pme + d.pmr - d.pmp) : 0
        }
      })
      setDados(mesData)
    }
    setLoading(false)
  }

  const ultimo = dados[dados.length - 1] || {}

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-bold">Ciclo Financeiro</h1>
          <p className="text-gray-400 text-sm">PMP, PME, PMR e Ciclo de Caixa</p>
        </div>
        <select
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        >
          {[ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'PMP', desc: 'Prazo Medio de Pagamento', value: ultimo.pmp, color: 'text-blue-400' },
          { label: 'PME', desc: 'Prazo Medio de Estoque', value: ultimo.pme, color: 'text-yellow-400' },
          { label: 'PMR', desc: 'Prazo Medio de Recebimento', value: ultimo.pmr, color: 'text-purple-400' },
          { label: 'Ciclo de Caixa', desc: 'PME + PMR - PMP', value: ultimo.ciclo, color: ultimo.ciclo > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map((item) => (
          <div key={item.label} className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs mb-0.5">{item.label}</p>
            <p className="text-gray-500 text-xs mb-2">{item.desc}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{Math.round(item.value || 0)}<span className="text-sm font-normal text-gray-400 ml-1">dias</span></p>
          </div>
        ))}
      </div>

      <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5 mb-4">
        <h3 className="text-white font-medium text-sm mb-4">Evolucao Anual</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
            <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} unit=" d" />
            <Tooltip
              contentStyle={{ background: '#12121a', border: '1px solid #1f1f2e', borderRadius: 8 }}
              formatter={(v) => [`${Math.round(v)} dias`]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            <Line type="monotone" dataKey="pmp" stroke="#3b82f6" strokeWidth={2} dot={false} name="PMP" />
            <Line type="monotone" dataKey="pme" stroke="#f59e0b" strokeWidth={2} dot={false} name="PME" />
            <Line type="monotone" dataKey="pmr" stroke="#a855f7" strokeWidth={2} dot={false} name="PMR" />
            <Line type="monotone" dataKey="ciclo" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 2" dot={false} name="Ciclo Caixa" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#12121a] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-medium text-sm">Detalhamento por Mes</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {['Mes','PMP (dias)','PME (dias)','PMR (dias)','Ciclo (dias)'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-gray-400 text-xs font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.map((d) => (
              <tr key={d.mes} className="border-b border-gray-800/50 hover:bg-white/[0.02]">
                <td className="px-5 py-3 text-white text-sm">{d.mes}</td>
                <td className="px-5 py-3 text-blue-400 text-sm">{Math.round(d.pmp)}</td>
                <td className="px-5 py-3 text-yellow-400 text-sm">{Math.round(d.pme)}</td>
                <td className="px-5 py-3 text-purple-400 text-sm">{Math.round(d.pmr)}</td>
                <td className={`px-5 py-3 text-sm font-medium ${d.ciclo > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{Math.round(d.ciclo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
