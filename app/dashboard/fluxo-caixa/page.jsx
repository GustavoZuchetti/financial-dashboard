'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell, Legend } from 'recharts'
import { supabase } from '@/lib/supabase'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const S = {
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  kpiTitle: { fontSize: '14px', color: '#9ca3af', marginBottom: '8px' },
  kpiValue: { fontSize: '24px', fontWeight: 'bold' },
  sectionTitle: { fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#f3f4f6' },
  input: { background: '#111827', border: '1px solid #374151', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '13px', outline: 'none' }
}

const KPICard = ({ title, value, color = '#3b82f6' }) => (
  <div style={S.card}>
    <div style={S.kpiTitle}>{title}</div>
    <div style={{ ...S.kpiValue, color }}>{value}</div>
  </div>
)

export default function FluxoCaixaGeral() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState([]);
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
      const { data: fluxo, error } = await supabase
        .from('fluxo_caixa')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('data', startDate)
        .lte('data', endDate);

      if (!error && fluxo) {
        setData(fluxo);
      }
      setLoading(false);
    };

    fetchData();
  }, [empresaId, startDate, endDate]);

  const totalEntradas = data.filter(d => d.tipo === 'entrada').reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalSaidas = data.filter(d => d.tipo === 'saida').reduce((acc, curr) => acc + Number(curr.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  // Agrupar por mês para o gráfico
  const chartData = data.reduce((acc, curr) => {
    const date = new Date(curr.data);
    const month = date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
    let existing = acc.find(a => a.name === month);
    if (!existing) {
      existing = { name: month, entradas: 0, saidas: 0, saldo: 0 };
      acc.push(existing);
    }
    if (curr.tipo === 'entrada') existing.entradas += Number(curr.valor);
    else existing.saidas += Number(curr.valor);
    existing.saldo = existing.entradas - existing.saidas;
    return acc;
  }, []).sort((a, b) => {
    const [mA, yA] = a.name.split('/');
    const [mB, yB] = b.name.split('/');
    return new Date(`20${yA}-${mA}-01`) - new Date(`20${yB}-${mB}-01`);
  });

  return (
    <div style={{ padding: '24px', color: '#e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Fluxo de Caixa</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1f2937', padding: '8px 16px', borderRadius: '8px', border: '1px solid #374151' }}>
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>Período:</span>
            <input type="date" style={S.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span style={{ color: '#9ca3af' }}>→</span>
            <input type="date" style={S.input} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <KPICard title="Total Recebido" value={fmtFull(totalEntradas)} color="#3b82f6" />
        <KPICard title="Total Pago" value={fmtFull(totalSaidas)} color="#ef4444" />
        <KPICard title="Saldo do Período" value={fmtFull(saldo)} color={saldo >= 0 ? '#3b82f6' : '#ef4444'} />
      </div>

      <div style={S.card}>
        <h2 style={S.sectionTitle}>Evolução Mensal</h2>
        <div style={{ height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={fmt} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} formatter={(v) => fmtFull(v)} />
              <Legend verticalAlign="bottom" height={36}/>
              <Bar dataKey="entradas" fill="#3b82f6" barSize={40} radius={[4, 4, 0, 0]} name="Entradas" />
              <Bar dataKey="saidas" fill="#ef4444" barSize={40} radius={[4, 4, 0, 0]} name="Saídas" />
              <Line type="monotone" dataKey="saldo" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 6, fill: '#8b5cf6' }} name="Saldo" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {loading && <div style={{ textAlign: 'center', color: '#3b82f6', marginTop: '20px' }}>Carregando dados...</div>}
    </div>
  )
}
