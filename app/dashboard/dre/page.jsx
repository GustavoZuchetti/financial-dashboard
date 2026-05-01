'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Line, ComposedChart } from 'recharts'
import { supabase } from '@/lib/supabase'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const S = {
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  kpiTitle: { fontSize: '13px', color: '#9ca3af', marginBottom: '8px' },
  kpiValue: { fontSize: '22px', fontWeight: 'bold' },
  sectionTitle: { fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f3f4f6' },
  input: { background: '#111827', border: '1px solid #374151', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '13px', outline: 'none' }
}

const KPICard = ({ title, value, color = '#3b82f6' }) => (
  <div style={S.card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={S.kpiTitle}>{title}</div>
        <div style={{ ...S.kpiValue, color }}>{value}</div>
      </div>
      <div style={{ color: '#6b7280', fontSize: '12px' }}>ⓘ</div>
    </div>
  </div>
)

export default function DREGeral() {
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
      const { data: lancamentos, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('data', startDate)
        .lte('data', endDate);

      if (!error && lancamentos) {
        setData(lancamentos);
      }
      setLoading(false);
    };

    fetchData();
  }, [empresaId, startDate, endDate]);

  // Lógica simplificada para os gráficos baseada nos dados reais
  const totalReceita = data.filter(d => d.tipo === 'receita').reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalDespesa = data.filter(d => d.tipo === 'despesa').reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalCusto = data.filter(d => d.tipo === 'custo').reduce((acc, curr) => acc + Number(curr.valor), 0);
  const ebitda = totalReceita - totalCusto - totalDespesa;

  const waterfallData = [
    { name: 'Receita Bruta', range: [0, totalReceita], value: totalReceita, type: 'total' },
    { name: 'Custos', range: [totalReceita - totalCusto, totalReceita], value: -totalCusto, type: 'negative' },
    { name: 'Lucro Bruto', range: [0, totalReceita - totalCusto], value: totalReceita - totalCusto, type: 'total' },
    { name: 'Despesas', range: [Math.max(0, ebitda), totalReceita - totalCusto], value: -totalDespesa, type: 'negative' },
    { name: 'EBITDA', range: [0, Math.max(0, ebitda)], value: ebitda, type: 'total' }
  ];

  return (
    <div style={{ color: '#e5e7eb', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>DRE</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1f2937', padding: '8px 16px', borderRadius: '8px', border: '1px solid #374151' }}>
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>Período:</span>
            <input type="date" style={S.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span style={{ color: '#9ca3af' }}>→</span>
            <input type="date" style={S.input} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <KPICard title="Receita Bruta" value={fmtFull(totalReceita)} color="#3b82f6" />
        <KPICard title="Custos Totais" value={fmtFull(totalCusto)} color="#ef4444" />
        <KPICard title="Despesas Totais" value={fmtFull(totalDespesa)} color="#ef4444" />
        <KPICard title="EBITDA" value={fmtFull(ebitda)} color={ebitda >= 0 ? '#3b82f6' : '#ef4444'} />
      </div>

      <div style={{ ...S.card, marginBottom: '24px' }}>
        <h2 style={S.sectionTitle}>Fluxo do Resultado</h2>
        <div style={{ height: '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfallData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} formatter={(v) => fmtFull(v)} />
              <Bar dataKey="range" radius={[2, 2, 0, 0]}>
                {waterfallData.map((entry, i) => (
                  <Cell key={i} fill={entry.type === 'total' ? '#3b82f6' : entry.type === 'positive' ? '#3b82f6' : '#ef4444'} fillOpacity={entry.type === 'total' ? 0.8 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {loading && <div style={{ textAlign: 'center', color: '#3b82f6' }}>Carregando dados...</div>}
    </div>
  )
}
