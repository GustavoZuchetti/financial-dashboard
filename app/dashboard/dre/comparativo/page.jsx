'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '@/lib/supabase'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const S = {
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  kpiTitle: { fontSize: '12px', color: '#9ca3af', marginBottom: '4px' },
  kpiValue: { fontSize: '18px', fontWeight: 'bold' },
  sectionTitle: { fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', color: '#f3f4f6' },
  input: { background: '#111827', border: '1px solid #374151', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '13px', outline: 'none' }
}

const KPICard = ({ title, value, color = '#3b82f6' }) => (
  <div style={{ ...S.card, padding: '12px' }}>
    <div style={S.kpiTitle}>{title}</div>
    <div style={{ ...S.kpiValue, color }}>{value}</div>
  </div>
)

const DREColumn = ({ title, startDate, endDate, waterfallData, kpis, onDateChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div style={{ ...S.card, padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: '#9ca3af' }}>Período 1:</span>
        <input type="date" style={S.input} value={startDate} onChange={(e) => onDateChange('start', e.target.value)} />
        <span style={{ color: '#9ca3af' }}>→</span>
        <input type="date" style={S.input} value={endDate} onChange={(e) => onDateChange('end', e.target.value)} />
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <KPICard title="Receita Bruta" value={fmtFull(kpis.receita)} />
      <KPICard title="Custos" value={fmtFull(kpis.custos)} color="#ef4444" />
      <KPICard title="EBITDA" value={fmtFull(kpis.ebitda)} color={kpis.ebitda >= 0 ? '#3b82f6' : '#ef4444'} />
      <KPICard title="Despesas" value={fmtFull(kpis.despesas)} color="#ef4444" />
    </div>
    <div style={S.card}>
      <h3 style={S.sectionTitle}>Estrutura de Resultado</h3>
      <div style={{ height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={fmt} />
            <Tooltip formatter={(v) => fmtFull(v)} contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
            <Bar dataKey="range">
              {waterfallData.map((entry, i) => (
                <Cell key={i} fill={entry.type === 'total' ? '#3b82f6' : '#ef4444'} fillOpacity={entry.type === 'total' ? 0.8 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
)

export default function DREComparativo() {
  const [periodo1Start, setPeriodo1Start] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
  });
  const [periodo1End, setPeriodo1End] = useState(new Date().toISOString().split('T')[0]);
  const [periodo2Start, setPeriodo2Start] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
  });
  const [periodo2End, setPeriodo2End] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
  });
  const [data1, setData1] = useState([]);
  const [data2, setData2] = useState([]);
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

      // Período 1
      const { data: lancamentos1 } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('data', periodo1Start)
        .lte('data', periodo1End);

      // Período 2
      const { data: lancamentos2 } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('data', periodo2Start)
        .lte('data', periodo2End);

      if (lancamentos1) setData1(lancamentos1);
      if (lancamentos2) setData2(lancamentos2);
      setLoading(false);
    };

    fetchData();
  }, [empresaId, periodo1Start, periodo1End, periodo2Start, periodo2End]);

  const calcularKPIs = (data) => {
    const receita = data.filter(d => d.tipo === 'receita').reduce((acc, curr) => acc + Number(curr.valor), 0);
    const custos = data.filter(d => d.tipo === 'custo').reduce((acc, curr) => acc + Number(curr.valor), 0);
    const despesas = data.filter(d => d.tipo === 'despesa').reduce((acc, curr) => acc + Number(curr.valor), 0);
    const ebitda = receita - custos;
    return { receita, custos, despesas, ebitda };
  };

  const calcularWaterfall = (kpis) => [
    { name: 'Receita', range: [0, kpis.receita], value: kpis.receita, type: 'total' },
    { name: 'Custos', range: [Math.max(0, kpis.ebitda), kpis.receita], value: -kpis.custos, type: 'negative' },
    { name: 'EBITDA', range: [0, Math.max(0, kpis.ebitda)], value: kpis.ebitda, type: 'total' },
    { name: 'Despesas', range: [Math.max(0, kpis.ebitda - kpis.despesas), Math.max(0, kpis.ebitda)], value: -kpis.despesas, type: 'negative' }
  ];

  const kpis1 = calcularKPIs(data1);
  const kpis2 = calcularKPIs(data2);
  const waterfall1 = calcularWaterfall(kpis1);
  const waterfall2 = calcularWaterfall(kpis2);

  return (
    <div style={{ padding: '24px', color: '#e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>DRE Comparativo</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#3b82f6' }}>Carregando dados...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <DREColumn 
            title="Período 1"
            startDate={periodo1Start}
            endDate={periodo1End}
            waterfallData={waterfall1}
            kpis={kpis1}
            onDateChange={(type, value) => {
              if (type === 'start') setPeriodo1Start(value);
              else setPeriodo1End(value);
            }}
          />
          <DREColumn 
            title="Período 2"
            startDate={periodo2Start}
            endDate={periodo2End}
            waterfallData={waterfall2}
            kpis={kpis2}
            onDateChange={(type, value) => {
              if (type === 'start') setPeriodo2Start(value);
              else setPeriodo2End(value);
            }}
          />
        </div>
      )}
    </div>
  )
}
