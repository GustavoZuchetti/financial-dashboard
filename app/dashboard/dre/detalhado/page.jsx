'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)
const fmtFull = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0 }).format(v)

const S = {
  card: { backgroundColor: '#1f2937', borderRadius: '8px', padding: '20px', border: '1px solid #374151' },
  kpiTitle: { fontSize: '13px', color: '#9ca3af', marginBottom: '8px' },
  kpiValue: { fontSize: '22px', fontWeight: 'bold' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px' },
  th: { textAlign: 'left', color: '#9ca3af', fontSize: '11px', fontWeight: '600', padding: '12px', borderBottom: '1px solid #374151', textTransform: 'uppercase' },
  td: { padding: '12px', borderBottom: '1px solid #1f2937', fontSize: '13px' },
  rowTotal: { fontWeight: 'bold', backgroundColor: '#111827' },
  expandBtn: { cursor: 'pointer', marginRight: '8px', color: '#3b82f6' },
  input: { background: '#111827', border: '1px solid #374151', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '13px', outline: 'none' }
}

const KPICard = ({ title, value, color = '#3b82f6' }) => (
  <div style={S.card}>
    <div style={S.kpiTitle}>{title}</div>
    <div style={{ ...S.kpiValue, color }}>{value}</div>
  </div>
)

export default function DREDetalhado() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [expanded, setExpanded] = useState({});
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

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // Agrupar dados por categoria
  const categoriaMap = {};
  data.forEach(item => {
    if (!categoriaMap[item.categoria]) {
      categoriaMap[item.categoria] = { receita: 0, despesa: 0 };
    }
    if (item.tipo === 'receita') {
      categoriaMap[item.categoria].receita += Number(item.valor);
    } else {
      categoriaMap[item.categoria].despesa += Number(item.valor);
    }
  });

  const totalReceita = Object.values(categoriaMap).reduce((acc, curr) => acc + curr.receita, 0);
  const totalDespesa = Object.values(categoriaMap).reduce((acc, curr) => acc + curr.despesa, 0);
  const resultado = totalReceita - totalDespesa;

  // Estrutura de linhas por categoria
  const rows = Object.entries(categoriaMap).map(([cat, values], idx) => ({
    id: idx,
    name: cat || 'Não Classificado',
    receita: values.receita,
    despesa: values.despesa,
    resultado: values.receita - values.despesa,
    level: 0,
    type: values.receita > 0 ? 'pos' : 'neg'
  }));

  return (
    <div style={{ padding: '24px', color: '#e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>DRE Detalhado</h1>
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
        <KPICard title="Receita Total" value={fmt(totalReceita)} color="#3b82f6" />
        <KPICard title="Despesa Total" value={fmt(totalDespesa)} color="#ef4444" />
        <KPICard title="Resultado" value={fmt(resultado)} color={resultado >= 0 ? '#3b82f6' : '#ef4444'} />
      </div>

      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Categoria</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Receita</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Despesa</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ ...S.td, textAlign: 'center', color: '#3b82f6' }}>Carregando dados...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ ...S.td, textAlign: 'center', color: '#9ca3af' }}>Nenhum dado para este período.</td>
                </tr>
              ) : (
                <>
                  {rows.map(row => (
                    <tr key={row.id} style={S.rowTotal}>
                      <td style={{ ...S.td, paddingLeft: 12 }}>{row.name}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: row.receita > 0 ? '#3b82f6' : '#9ca3af' }}>
                        {fmtFull(row.receita)}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', color: row.despesa > 0 ? '#ef4444' : '#9ca3af' }}>
                        {fmtFull(row.despesa)}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 'bold', color: row.resultado >= 0 ? '#3b82f6' : '#ef4444' }}>
                        {fmtFull(row.resultado)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ ...S.rowTotal, backgroundColor: '#0f172a' }}>
                    <td style={{ ...S.td, paddingLeft: 12, fontWeight: 'bold' }}>TOTAL</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 'bold', color: '#3b82f6' }}>
                      {fmtFull(totalReceita)}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }}>
                      {fmtFull(totalDespesa)}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 'bold', color: resultado >= 0 ? '#3b82f6' : '#ef4444' }}>
                      {fmtFull(resultado)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
