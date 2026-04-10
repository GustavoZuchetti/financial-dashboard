'use client'
import { useState } from 'react'

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, background: '#12121a', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab: (a) => ({ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: a ? 600 : 400, color: a ? '#fff' : '#6b7280', background: a ? '#1e1e2e' : 'transparent', border: 'none', cursor: 'pointer' }),
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '24px', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', color: '#6b7280', fontSize: 12, fontWeight: 600, padding: '10px 12px', borderBottom: '1px solid #1e1e2e', textTransform: 'uppercase' },
  td: { padding: '12px', borderBottom: '1px solid #1e1e2e', fontSize: 14, color: '#e5e7eb' },
  badge: (t) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: t === 'criacao' ? 'rgba(0,230,118,0.1)' : t === 'edicao' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)', color: t === 'criacao' ? '#00e676' : t === 'edicao' ? '#3b82f6' : '#ef4444' }),
  input: { width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  filterRow: { display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  kpi: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '20px 24px' },
  kpiLabel: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 },
  kpiValue: { fontSize: 22, fontWeight: 800, color: '#fff' },
}

const logs = [
  { id: 1, data: '30/04/2026 14:32', usuario: 'admin@empresa.com', acao: 'edicao', conta: '1.1.1 - Caixa e Equivalentes', detalhe: 'Saldo alterado de R$ 100.000 para R$ 125.000' },
  { id: 2, data: '30/04/2026 11:15', usuario: 'financeiro@empresa.com', acao: 'criacao', conta: '3.1.4 - Receita de Servicos', detalhe: 'Nova conta analitica criada' },
  { id: 3, data: '29/04/2026 16:45', usuario: 'admin@empresa.com', acao: 'edicao', conta: '2.1.3 - Impostos a Pagar', detalhe: 'Saldo alterado de R$ 42.000 para R$ 48.000' },
  { id: 4, data: '29/04/2026 09:20', usuario: 'controller@empresa.com', acao: 'edicao', conta: '1.2.1 - Imobilizado', detalhe: 'Saldo alterado de R$ 430.000 para R$ 450.000' },
  { id: 5, data: '28/04/2026 17:10', usuario: 'financeiro@empresa.com', acao: 'exclusao', conta: '3.2.1 - Outras Receitas (old)', detalhe: 'Conta removida do plano' },
  { id: 6, data: '28/04/2026 14:05', usuario: 'admin@empresa.com', acao: 'criacao', conta: '3.2.1 - Outras Receitas', detalhe: 'Conta recriada com novo codigo' },
  { id: 7, data: '27/04/2026 10:30', usuario: 'controller@empresa.com', acao: 'edicao', conta: '2.2.2 - Lucros Acumulados', detalhe: 'Saldo atualizado para R$ 137.000' },
  { id: 8, data: '26/04/2026 15:22', usuario: 'admin@empresa.com', acao: 'edicao', conta: '1.1.2 - Contas a Receber', detalhe: 'Saldo alterado de R$ 350.000 para R$ 380.000' },
]

export default function AuditoriaPage() {
  const [busca, setBusca] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('todos')

  const filtrados = logs.filter(l => {
    const matchBusca = l.conta.toLowerCase().includes(busca.toLowerCase()) || l.usuario.toLowerCase().includes(busca.toLowerCase()) || l.detalhe.toLowerCase().includes(busca.toLowerCase())
    const matchAcao = filtroAcao === 'todos' || l.acao === filtroAcao
    return matchBusca && matchAcao
  })

  const total = logs.length
  const criacoes = logs.filter(l => l.acao === 'criacao').length
  const edicoes = logs.filter(l => l.acao === 'edicao').length
  const exclusoes = logs.filter(l => l.acao === 'exclusao').length

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Auditoria do Plano de Contas</h1>
        <p style={S.subtitle}>Historico de alteracoes e log de acoes</p>
      </div>

      <div style={S.kpiRow}>
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Total de Registros</div>
          <div style={S.kpiValue}>{total}</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Criacoes</div>
          <div style={{...S.kpiValue, color: '#00e676'}}>{criacoes}</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Edicoes</div>
          <div style={{...S.kpiValue, color: '#3b82f6'}}>{edicoes}</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kpiLabel}>Exclusoes</div>
          <div style={{...S.kpiValue, color: '#ef4444'}}>{exclusoes}</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Log de Auditoria</div>
        <div style={S.filterRow}>
          <input style={{...S.input, maxWidth: 320}} placeholder="Buscar por conta, usuario ou detalhe..." value={busca} onChange={e => setBusca(e.target.value)} />
          <div style={S.tabs}>
            {['todos','criacao','edicao','exclusao'].map(a => (
              <button key={a} style={S.tab(filtroAcao === a)} onClick={() => setFiltroAcao(a)}>
                {a === 'todos' ? 'Todos' : a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Data / Hora</th>
              <th style={S.th}>Usuario</th>
              <th style={S.th}>Acao</th>
              <th style={S.th}>Conta</th>
              <th style={S.th}>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(l => (
              <tr key={l.id}>
                <td style={{...S.td, color: '#6b7280', fontSize: 12}}>{l.data}</td>
                <td style={S.td}>{l.usuario}</td>
                <td style={S.td}><span style={S.badge(l.acao)}>{l.acao}</span></td>
                <td style={{...S.td, fontWeight: 600}}>{l.conta}</td>
                <td style={{...S.td, color: '#9ca3af'}}>{l.detalhe}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <div style={{textAlign:'center', padding: 40, color: '#6b7280'}}>Nenhum registro encontrado</div>
        )}
      </div>
    </div>
  )
}
