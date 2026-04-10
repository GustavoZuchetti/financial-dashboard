'use client'

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '24px', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 },
  kpiLabel: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 },
  kpiValue: { fontSize: 26, fontWeight: 800 },
  kpiSub: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #1e1e2e' },
  bar: (pct, cor) => ({ height: 8, borderRadius: 4, background: cor, width: `${pct}%`, maxWidth: '100%' }),
  barBg: { height: 8, borderRadius: 4, background: '#1e1e2e', marginTop: 6 },
}

const categorias = [
  { nome: 'Recebimentos de Clientes', tipo: 'entrada', valor: 850000, pct: 90 },
  { nome: 'Outras Entradas', tipo: 'entrada', valor: 45000, pct: 5 },
  { nome: 'Fornecedores', tipo: 'saida', valor: 280000, pct: 62 },
  { nome: 'Folha de Pagamento', tipo: 'saida', valor: 180000, pct: 40 },
  { nome: 'Impostos e Tributos', tipo: 'saida', valor: 95000, pct: 21 },
  { nome: 'Despesas Operacionais', tipo: 'saida', valor: 68000, pct: 15 },
  { nome: 'Investimentos (CAPEX)', tipo: 'saida', valor: 42000, pct: 9 },
]

export default function FluxoCaixaAnalise() {
  const totalEntradas = 895000
  const totalSaidas = 448500
  const saldo = totalEntradas - totalSaidas

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Analise do Fluxo de Caixa</h1>
        <p style={S.subtitle}>Analise detalhada de entradas, saidas e tendencias</p>
      </div>

      <div style={S.grid4}>
        <div style={S.card}>
          <div style={S.kpiLabel}>Total Entradas</div>
          <div style={{...S.kpiValue, color: '#00e676'}}>R$ 895 mil</div>
          <div style={S.kpiSub}>+12.5% vs mes anterior</div>
        </div>
        <div style={S.card}>
          <div style={S.kpiLabel}>Total Saidas</div>
          <div style={{...S.kpiValue, color: '#ef4444'}}>R$ 448,5 mil</div>
          <div style={S.kpiSub}>+5.2% vs mes anterior</div>
        </div>
        <div style={S.card}>
          <div style={S.kpiLabel}>Saldo Liquido</div>
          <div style={{...S.kpiValue, color: '#3b82f6'}}>R$ 446,5 mil</div>
          <div style={S.kpiSub}>Positivo</div>
        </div>
        <div style={S.card}>
          <div style={S.kpiLabel}>Indice de Cobertura</div>
          <div style={{...S.kpiValue, color: '#8b5cf6'}}>2.0x</div>
          <div style={S.kpiSub}>Entradas / Saidas</div>
        </div>
      </div>

      <div style={S.grid}>
        <div style={S.card}>
          <div style={S.cardTitle}>Composicao das Entradas</div>
          {categorias.filter(c => c.tipo === 'entrada').map((c, i) => (
            <div key={i} style={{marginBottom: 16}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom: 4}}>
                <span style={{fontSize: 13, color: '#e5e7eb'}}>{c.nome}</span>
                <span style={{fontSize: 13, fontWeight: 700, color: '#00e676'}}>R$ {c.valor.toLocaleString('pt-BR')}</span>
              </div>
              <div style={S.barBg}>
                <div style={S.bar(c.pct, '#00e676')} />
              </div>
              <div style={{fontSize: 11, color: '#6b7280', marginTop: 4}}>{c.pct}% do total</div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>Composicao das Saidas</div>
          {categorias.filter(c => c.tipo === 'saida').map((c, i) => (
            <div key={i} style={{marginBottom: 16}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom: 4}}>
                <span style={{fontSize: 13, color: '#e5e7eb'}}>{c.nome}</span>
                <span style={{fontSize: 13, fontWeight: 700, color: '#ef4444'}}>R$ {c.valor.toLocaleString('pt-BR')}</span>
              </div>
              <div style={S.barBg}>
                <div style={S.bar(c.pct, '#ef4444')} />
              </div>
              <div style={{fontSize: 11, color: '#6b7280', marginTop: 4}}>{c.pct}% do total saidas</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Indicadores de Saude Financeira</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: 24}}>
          {[
            { label: 'Indice de Liquidez Corrente', valor: '2.8x', status: 'ok', desc: 'Ativo Circulante / Passivo Circulante' },
            { label: 'Capital de Giro Liquido', valor: 'R$ 317 mil', status: 'ok', desc: 'AC - PC' },
            { label: 'Dias de Caixa Disponivel', valor: '28 dias', status: 'ok', desc: 'Caixa atual / Media diaria de saidas' },
            { label: 'Taxa de Queima (Burn Rate)', valor: 'R$ 14,9 mil/dia', status: 'ok', desc: 'Saidas medias por dia' },
            { label: 'Ciclo de Caixa', valor: '15 dias', status: 'ok', desc: 'PMR + PME - PMP' },
            { label: 'Free Cash Flow', valor: 'R$ 404,5 mil', status: 'ok', desc: 'Fluxo Operacional - CAPEX' },
          ].map((item, i) => (
            <div key={i} style={{padding: '16px', background: '#0a0a0f', borderRadius: 8}}>
              <div style={{fontSize: 11, color: '#6b7280', marginBottom: 6, textTransform:'uppercase'}}>{item.label}</div>
              <div style={{fontSize: 20, fontWeight: 800, color: '#00e676', marginBottom: 4}}>{item.valor}</div>
              <div style={{fontSize: 11, color: '#6b7280'}}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
