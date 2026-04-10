'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()

function KPICard({ title, value, delta, icon: Icon, positive }) {
  const isPos = delta >= 0
  return (
    <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-gray-400 text-xs font-medium">{title}</span>
        <div className="w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center">
          <Icon size={14} className="text-emerald-400" />
        </div>
      </div>
      <p className="text-white text-xl font-bold">{value}</p>
      {delta !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          <span>{Math.abs(delta).toFixed(1)}% vs mes anterior</span>
        </div>
      )}
    </div>
  )
}

function fmt(v) {
  if (!v && v !== 0) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
}

export default function DrePage() {
  const [ano, setAno] = useState(ANO_ATUAL)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
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
  }, [empresa, ano, mes])

  const loadDados = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('empresa_id', empresa)
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`)

      if (data) {
        processarDados(data)
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const processarDados = (lancamentos) => {
    const receitas = lancamentos.filter(l => l.tipo === 'receita')
    const custos = lancamentos.filter(l => l.tipo === 'custo')
    const despesas = lancamentos.filter(l => l.tipo === 'despesa')

    const totalReceita = receitas.reduce((s, l) => s + (l.valor || 0), 0)
    const totalCusto = custos.reduce((s, l) => s + (l.valor || 0), 0)
    const totalDespesa = despesas.reduce((s, l) => s + (l.valor || 0), 0)
    const lucroBruto = totalReceita - totalCusto
    const lucroLiquido = lucroBruto - totalDespesa
    const margem = totalReceita > 0 ? (lucroLiquido / totalReceita) * 100 : 0

    const mensal = MESES.map((m, i) => {
      const mesNum = i + 1
      const rec = lancamentos.filter(l => l.tipo === 'receita' && new Date(l.data).getMonth() + 1 === mesNum).reduce((s, l) => s + l.valor, 0)
      const cus = lancamentos.filter(l => l.tipo === 'custo' && new Date(l.data).getMonth() + 1 === mesNum).reduce((s, l) => s + l.valor, 0)
      const des = lancamentos.filter(l => l.tipo === 'despesa' && new Date(l.data).getMonth() + 1 === mesNum).reduce((s, l) => s + l.valor, 0)
      return { mes: m, receita: rec, lucro: rec - cus - des }
    })

    setDados({ totalReceita, totalCusto, totalDespesa, lucroBruto, lucroLiquido, margem, mensal })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-bold">DRE Geral</h1>
          <p className="text-gray-400 text-sm">Demonstracao do Resultado do Exercicio</p>
        </div>
        <div className="flex gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          >
            {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="bg-[#1a1a24] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          >
            {[ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dados ? (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <KPICard title="Receita Bruta" value={fmt(dados.totalReceita)} delta={5.2} icon={DollarSign} />
            <KPICard title="Lucro Bruto" value={fmt(dados.lucroBruto)} delta={3.1} icon={TrendingUp} />
            <KPICard title="Lucro Liquido" value={fmt(dados.lucroLiquido)} delta={-1.4} icon={TrendingDown} />
            <KPICard title="Margem Liquida" value={`${dados.margem.toFixed(1)}%`} icon={Percent} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-medium text-sm mb-4">Receita vs Lucro Mensal</h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={dados.mensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => fmt(v)} />
                  <Tooltip
                    contentStyle={{ background: '#12121a', border: '1px solid #1f1f2e', borderRadius: 8 }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(v) => fmt(v)}
                  />
                  <Bar dataKey="receita" fill="#10b981" radius={[4,4,0,0]} name="Receita" />
                  <Line type="monotone" dataKey="lucro" stroke="#f59e0b" strokeWidth={2} dot={false} name="Lucro" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-medium text-sm mb-4">Waterfall DRE</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={[
                  { name: 'Receita', valor: dados.totalReceita, fill: '#10b981' },
                  { name: 'CMV', valor: -dados.totalCusto, fill: '#ef4444' },
                  { name: 'Lc. Bruto', valor: dados.lucroBruto, fill: '#3b82f6' },
                  { name: 'Despesas', valor: -dados.totalDespesa, fill: '#ef4444' },
                  { name: 'Lc. Liquido', valor: dados.lucroLiquido, fill: dados.lucroLiquido >= 0 ? '#10b981' : '#ef4444' },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => fmt(v)} />
                  <Tooltip
                    contentStyle={{ background: '#12121a', border: '1px solid #1f1f2e', borderRadius: 8 }}
                    formatter={(v) => fmt(v)}
                  />
                  <Bar dataKey="valor" radius={[4,4,0,0]}>
                    {[{ fill: '#10b981' }, { fill: '#ef4444' }, { fill: '#3b82f6' }, { fill: '#ef4444' }, { fill: dados?.lucroLiquido >= 0 ? '#10b981' : '#ef4444' }].map((c, i) => (
                      <rect key={i} {...c} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-400">Nenhum dado encontrado para o periodo selecionado.</p>
        </div>
      )}
    </div>
  )
}
