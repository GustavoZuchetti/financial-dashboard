'use client'
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import { supabase } from '@/lib/supabase'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)

const S = {
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  sectionTitle: { fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', color: '#f3f4f6' },
  input: { background: '#111827', border: '1px solid #374151', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '13px', outline: 'none' }
}

export default function DREAnalise() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [historico, setHistorico] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState(null);

  useEffect(() => {
    const savedId = localStorage.getItem('empresa_id');
    if (savedId) setEmpresaId(savedId);
  }, []);

  useEffect(() => {
    if (!empresaId) return;

    const fetchData = async () => {
      setLoading(true);
      const { data: lancamentos } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('data', startDate)
        .lte('data', endDate);

      if (lancamentos) {
        // Agrupar por mês
        const meses = {};
        lancamentos.forEach(item => {
          const date = new Date(item.data);
          const month = date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
          if (!meses[month]) {
            meses[month] = { receita: 0, custos: 0, despesas: 0 };
          }
          if (item.tipo === 'receita') meses[month].receita += Number(item.valor);
          else if (item.tipo === 'custo') meses[month].custos += Number(item.valor);
          else meses[month].despesas += Number(item.valor);
        });

        const historicoData = Object.entries(meses).map(([name, values]) => ({
          name,
          receita: values.receita,
          custos: values.custos,
          ebitda: values.receita - values.custos,
          resFinal: values.receita - values.custos - values.despesas
        }));

        setHistorico(historicoData);

        // Agrupar por cliente (descrição)
        const clientesMap = {};
        lancamentos.filter(l => l.tipo === 'receita').forEach(item => {
          const cliente = item.descricao || 'Não identificado';
          if (!clientesMap[cliente]) clientesMap[cliente] = 0;
          clientesMap[cliente] += Number(item.valor);
        });

        const clientesData = Object.entries(clientesMap)
          .map(([name, valor]) => ({ name, valor }))
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 5);

        setClientes(clientesData);
      }
      setLoading(false);
    };

    fetchData();
  }, [empresaId, startDate, endDate]);

  return (
    <div style={{ padding: '24px', color: '#e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>DRE Análise</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1f2937', padding: '8px 16px', borderRadius: '8px', border: '1px solid #374151' }}>
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>Período:</span>
            <input type="date" style={S.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span style={{ color: '#9ca3af' }}>→</span>
            <input type="date" style={S.input} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div style={S.card}>
          <h2 style={S.sectionTitle}>Evolução Mensal</h2>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historico}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={fmt} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} formatter={(v) => fmt(v)} />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="receita" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Receita" />
                <Line type="monotone" dataKey="ebitda" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="EBITDA" />
                <Line type="monotone" dataKey="resFinal" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Resultado Final" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={S.card}>
          <h2 style={S.sectionTitle}>Top Receitas</h2>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientes} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} width={100} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} formatter={(v) => fmt(v)} />
                <Bar dataKey="valor" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <h2 style={S.sectionTitle}>Evolução Operacional</h2>
        <div style={{ height: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historico}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} formatter={(v) => fmt(v)} />
              <Legend />
              <Line type="monotone" dataKey="ebitda" stroke="#8b5cf6" strokeWidth={2} name="EBITDA" />
              <Line type="monotone" dataKey="receita" stroke="#3b82f6" strokeWidth={2} name="Receita" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', color: '#3b82f6', marginTop: '20px' }}>Carregando dados...</div>}
    </div>
  )
}
