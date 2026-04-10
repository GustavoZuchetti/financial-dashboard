'use client'
import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)

const MOCK_HISTORICO = [
  { name: 'Jan/26', receita: 191000, custos: 42000, ebitda: 30000, resLiq: -15000, resFinal: -25000 },
  { name: 'Fev/26', receita: 233000, custos: 40000, ebitda: 40000, resLiq: -18000, resFinal: -28000 },
  { name: 'Mar/26', receita: 226000, custos: 47000, ebitda: 35000, resLiq: -22000, resFinal: -32000 },
  { name: 'Abr/26', receita: 262000, custos: 42000, ebitda: 50000, resLiq: -25000, resFinal: -35000 }
]

const MOCK_CLIENTES = [
  { name: 'AEC CENTRO DE CONTATOS', valor: 572000 },
  { name: 'Ingressosa.com Ltda', valor: 90000 },
  { name: 'VX CONSULT E SERVICES', valor: 36000 },
  { name: 'OMINT SERVICOS DE SAUDE', valor: 34000 }
]

const S = {
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  sectionTitle: { fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', color: '#f3f4f6' }
}

export default function DREAnalise() {
  return (
    <div style={{ padding: '24px', color: '#e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>DRE Análise</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div style={S.card}>
          <h2 style={S.sectionTitle}>DRE Acumulado</h2>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_HISTORICO}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={fmt} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="ebitda" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="resFinal" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={S.card}>
          <h2 style={S.sectionTitle}>Receitas por Cliente</h2>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_CLIENTES} layout="vertical" margin={{ left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} width={120} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} formatter={(v) => fmt(v)} />
                <Bar dataKey="valor" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <h2 style={S.sectionTitle}>Evolução Operacional (%)</h2>
        <div style={{ height: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={MOCK_HISTORICO}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
              <Line type="monotone" dataKey="ebitda" stroke="#8b5cf6" strokeWidth={2} name="Margem EBITDA" />
              <Line type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={2} name="Margem Bruta" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
