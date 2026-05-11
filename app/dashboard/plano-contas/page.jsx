'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Estrutura DRE para agrupamento visual ────────────────────────────────────
const DRE_GROUPS = [
  { key: 'receita',             label: 'Receita Bruta',          cor: '#22c55e', icone: '💰', desc: 'Receitas operacionais de serviços/produtos' },
  { key: 'deducao',             label: 'Deduções',               cor: '#f97316', icone: '➖', desc: 'Impostos sobre receita, devoluções, descontos' },
  { key: 'custo',               label: 'Custos Variáveis',       cor: '#ef4444', icone: '🏭', desc: 'CMV, CPV — custos diretamente ligados à receita' },
  { key: 'despesa',             label: 'Despesas Fixas',         cor: '#f59e0b', icone: '📋', desc: 'Despesas operacionais fixas (salários, aluguel, etc.)' },
  { key: 'receita_financeira',  label: 'Receitas Financeiras',   cor: '#14b8a6', icone: '📈', desc: 'Juros recebidos, rendimentos financeiros' },
  { key: 'despesa_financeira',  label: 'Despesas Financeiras',   cor: '#8b5cf6', icone: '📉', desc: 'Juros pagos, IOF, tarifas bancárias' },
  { key: 'investimento',        label: 'Investimentos (CAPEX)',  cor: '#64748b', icone: '🏗️', desc: 'Aquisição de ativos, investimentos de longo prazo' },
  { key: 'entrada',             label: 'Entradas — Fluxo de Caixa', cor: '#3b82f6', icone: '⬇️', desc: 'Entradas de caixa (módulo FC)' },
  { key: 'saida',               label: 'Saídas — Fluxo de Caixa',  cor: '#ec4899', icone: '⬆️', desc: 'Saídas de caixa (módulo FC)' },
]

const TIPO_LABELS = Object.fromEntries(DRE_GROUPS.map(g => [g.key, g.label]))
const TIPO_CORES  = Object.fromEntries(DRE_GROUPS.map(g => [g.key, g.cor]))

const fmtTipo = (t) => TIPO_LABELS[t] || t

// ─── Badge de tipo ────────────────────────────────────────────────────────────
function TipoBadge({ tipo }) {
  const cor = TIPO_CORES[tipo] || '#64748b'
  return (
    <span style={{ background: cor + '18', color: cor, border: `1px solid ${cor}40`, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {fmtTipo(tipo)}
    </span>
  )
}

// ─── Modal de edição/criação ───────────────────────────────────────────────────
function ContaModal({ conta, empresas, onSave, onClose }) {
  const [form, setForm] = useState({ codigo: conta?.codigo || '', nome: conta?.nome || '', tipo: conta?.tipo || 'receita', empresa_id: conta?.empresa_id || empresas[0]?.id || '' })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.nome.trim() || !form.tipo || !form.empresa_id) return
    setSaving(true)
    try {
      if (conta?.id) {
        await supabase.from('plano_contas').update({ codigo: form.codigo, nome: form.nome.toUpperCase(), tipo: form.tipo }).eq('id', conta.id)
      } else {
        await supabase.from('plano_contas').insert({ ...form, nome: form.nome.toUpperCase() })
      }
      onSave()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:16, padding:28, width:'100%', maxWidth:480, boxShadow:'var(--fs-shadow-lg)' }}>
        <h2 style={{ fontSize:18, fontWeight:800, color:'var(--fs-text-1)', marginBottom:20 }}>
          {conta?.id ? 'Editar Conta' : 'Nova Conta'}
        </h2>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12, marginBottom:16 }}>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--fs-text-4)', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Código</label>
            <input value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value})} placeholder="Ex: 1.1" style={{ width:'100%', background:'var(--fs-input-bg)', border:'1px solid var(--fs-input-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'9px 12px', fontSize:13, outline:'none' }} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--fs-text-4)', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Nome da Conta</label>
            <input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} placeholder="Ex: RECEITA DE SERVIÇOS" style={{ width:'100%', background:'var(--fs-input-bg)', border:'1px solid var(--fs-input-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'9px 12px', fontSize:13, outline:'none' }} />
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:11, color:'var(--fs-text-4)', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Linha do DRE / Classificação</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {DRE_GROUPS.map(g => (
              <button key={g.key} onClick={() => setForm({...form, tipo: g.key})}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderRadius:8, border:`2px solid ${form.tipo===g.key ? g.cor : 'var(--fs-border)'}`, background: form.tipo===g.key ? g.cor+'18' : 'var(--fs-surface-2)', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
                <span style={{ fontSize:16 }}>{g.icone}</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color: form.tipo===g.key ? g.cor : 'var(--fs-text-1)' }}>{g.label}</div>
                  <div style={{ fontSize:10, color:'var(--fs-text-4)' }}>{g.desc.substring(0,30)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {empresas.length > 1 && (
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:11, color:'var(--fs-text-4)', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Empresa</label>
            <select value={form.empresa_id} onChange={e=>setForm({...form,empresa_id:e.target.value})} style={{ width:'100%', background:'var(--fs-input-bg)', border:'1px solid var(--fs-input-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'9px 12px', fontSize:13, outline:'none' }}>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        )}

        <div style={{ display:'flex', gap:12 }}>
          <button onClick={onClose} style={{ flex:1, background:'var(--fs-surface-2)', color:'var(--fs-text-1)', border:'1px solid var(--fs-border)', borderRadius:8, padding:'11px', fontSize:14, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving||!form.nome.trim()} style={{ flex:2, background:saving||!form.nome.trim()?'var(--fs-surface-3)':'var(--fs-brand)', color:saving||!form.nome.trim()?'var(--fs-text-4)':'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:14, fontWeight:700, cursor:saving||!form.nome.trim()?'not-allowed':'pointer' }}>
            {saving ? '⏳ Salvando...' : conta?.id ? 'Salvar Alterações' : 'Criar Conta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function PlanoContasPage() {
  const [contas,       setContas]       = useState([])
  const [mappings,     setMappings]     = useState([])
  const [empresas,     setEmpresas]     = useState([])
  const [empresaFiltro,setEmpresaFiltro]= useState('')
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState(null) // null | 'new' | conta
  const [busca,        setBusca]        = useState('')
  const [viewMode,     setViewMode]     = useState('dre') // 'dre' | 'lista'
  const [expandedGroups, setExpandedGroups] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: emps }, { data: pcs }, { data: maps }] = await Promise.all([
        supabase.from('empresas').select('*').order('nome'),
        supabase.from('plano_contas').select('*').order('codigo'),
        supabase.from('categoria_mappings').select('conta_id, categoria_origem'),
      ])
      setEmpresas(emps || [])
      setContas(pcs || [])
      setMappings(maps || [])
      if (emps?.length && !empresaFiltro) setEmpresaFiltro(emps[0].id)
    } finally { setLoading(false) }
  }, [empresaFiltro])

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('Remover esta conta?')) return
    await supabase.from('plano_contas').delete().eq('id', id)
    load()
  }

  const toggleGroup = (key) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))

  // Filtrar contas pela empresa selecionada e busca
  const contasFiltradas = contas.filter(c =>
    (!empresaFiltro || c.empresa_id === empresaFiltro) &&
    (!busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || c.codigo?.includes(busca))
  )

  // Agrupar por tipo DRE
  const grouped = {}
  DRE_GROUPS.forEach(g => { grouped[g.key] = [] })
  contasFiltradas.forEach(c => {
    if (grouped[c.tipo]) grouped[c.tipo].push(c)
    else grouped['receita'] = [...(grouped['receita']||[]), c]
  })

  // Contagem de De-Para por conta
  const mapCount = {}
  mappings.forEach(m => { mapCount[m.conta_id] = (mapCount[m.conta_id] || 0) + 1 })

  return (
    <div style={{ color:'var(--fs-text-1)', padding:4 }}>
      {modal && (
        <ContaModal
          conta={modal === 'new' ? null : modal}
          empresas={empresas.filter(e => !empresaFiltro || e.id === empresaFiltro)}
          onSave={() => { setModal(null); load() }}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--fs-text-1)', margin:0 }}>Plano de Contas</h1>
          <p style={{ color:'var(--fs-text-4)', fontSize:13, margin:'3px 0 0' }}>Estrutura de contas vinculada ao DRE</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          {/* Filtro empresa */}
          <select value={empresaFiltro} onChange={e => setEmpresaFiltro(e.target.value)}
            style={{ background:'var(--fs-input-bg)', border:'1px solid var(--fs-input-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'7px 12px', fontSize:13, outline:'none' }}>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          {/* Toggle view */}
          <div style={{ display:'flex', background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:8, overflow:'hidden' }}>
            {[{k:'dre',l:'📊 DRE'},{k:'lista',l:'📋 Lista'}].map(v => (
              <button key={v.k} onClick={() => setViewMode(v.k)}
                style={{ padding:'7px 14px', border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: viewMode===v.k ? 'var(--fs-brand)' : 'transparent', color: viewMode===v.k ? '#fff' : 'var(--fs-text-4)' }}>
                {v.l}
              </button>
            ))}
          </div>
          <button onClick={() => setModal('new')} style={{ background:'var(--fs-brand)', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            + Nova Conta
          </button>
        </div>
      </div>

      {/* Busca */}
      <div style={{ marginBottom:20 }}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar conta por nome ou código..."
          style={{ width:'100%', background:'var(--fs-input-bg)', border:'1px solid var(--fs-input-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'10px 14px', fontSize:13, outline:'none' }} />
      </div>

      {loading ? (
        <div style={{ color:'var(--fs-text-4)', padding:40, textAlign:'center' }}>Carregando...</div>
      ) : viewMode === 'dre' ? (
        // ── VISÃO DRE AGRUPADA ────────────────────────────────────────────────
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {DRE_GROUPS.map((grupo, gi) => {
            const items = grouped[grupo.key] || []
            if (items.length === 0 && !busca) return null
            const isExpanded = expandedGroups[grupo.key] !== false // default aberto
            const totalMaps = items.reduce((a, c) => a + (mapCount[c.id] || 0), 0)

            return (
              <div key={grupo.key} style={{ background:'var(--fs-surface)', border:`1px solid var(--fs-border)`, borderRadius:12, overflow:'hidden', borderLeft:`4px solid ${grupo.cor}` }}>
                {/* Header do grupo */}
                <div onClick={() => toggleGroup(grupo.key)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer', background: isExpanded ? `${grupo.cor}08` : 'transparent', userSelect:'none' }}>
                  <span style={{ fontSize:20 }}>{grupo.icone}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:grupo.cor }}>{grupo.label}</span>
                      <span style={{ background:grupo.cor+'20', color:grupo.cor, border:`1px solid ${grupo.cor}40`, padding:'1px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                        {items.length} conta{items.length!==1?'s':''}
                      </span>
                      {totalMaps > 0 && (
                        <span style={{ background:'rgba(59,130,246,0.1)', color:'var(--fs-brand)', border:'1px solid rgba(59,130,246,0.2)', padding:'1px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                          {totalMaps} De-Para
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:12, color:'var(--fs-text-4)', marginTop:2 }}>{grupo.desc}</div>
                  </div>
                  <div style={{ fontSize:16, color:'var(--fs-text-4)', transition:'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</div>
                </div>

                {/* Contas do grupo */}
                {isExpanded && (
                  <div>
                    {items.length === 0 ? (
                      <div style={{ padding:'12px 20px', color:'var(--fs-text-4)', fontSize:13, fontStyle:'italic', borderTop:'1px solid var(--fs-border)' }}>
                        Nenhuma conta nesta categoria — clique em "+ Nova Conta" para adicionar
                      </div>
                    ) : (
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderTop:'1px solid var(--fs-border)' }}>
                            <th style={{ padding:'8px 16px', textAlign:'left', fontSize:11, color:'var(--fs-text-4)', fontWeight:700, textTransform:'uppercase', width:80 }}>Código</th>
                            <th style={{ padding:'8px 16px', textAlign:'left', fontSize:11, color:'var(--fs-text-4)', fontWeight:700, textTransform:'uppercase' }}>Nome da Conta</th>
                            <th style={{ padding:'8px 16px', textAlign:'center', fontSize:11, color:'var(--fs-text-4)', fontWeight:700, textTransform:'uppercase', width:100 }}>De-Para</th>
                            <th style={{ padding:'8px 16px', textAlign:'center', fontSize:11, color:'var(--fs-text-4)', fontWeight:700, textTransform:'uppercase', width:120 }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((conta, i) => {
                            const mCount = mapCount[conta.id] || 0
                            return (
                              <tr key={conta.id} style={{ borderTop:'1px solid var(--fs-border)', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                <td style={{ padding:'10px 16px', color:'var(--fs-text-4)', fontSize:13, fontFamily:'monospace' }}>{conta.codigo || '—'}</td>
                                <td style={{ padding:'10px 16px' }}>
                                  <div style={{ fontSize:13, fontWeight:600, color:'var(--fs-text-1)' }}>{conta.nome}</div>
                                  {mCount > 0 && (
                                    <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:2 }}>
                                      {(() => {
                                        const cats = mappings.filter(m => m.conta_id === conta.id).map(m => m.categoria_origem)
                                        return cats.slice(0,3).join(', ') + (cats.length > 3 ? ` +${cats.length-3}` : '')
                                      })()}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding:'10px 16px', textAlign:'center' }}>
                                  {mCount > 0 ? (
                                    <span style={{ background:'rgba(59,130,246,0.1)', color:'var(--fs-brand)', border:'1px solid rgba(59,130,246,0.25)', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                                      {mCount} ✓
                                    </span>
                                  ) : (
                                    <span style={{ color:'var(--fs-text-4)', fontSize:12 }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding:'10px 16px', textAlign:'center' }}>
                                  <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                                    <button onClick={() => setModal(conta)}
                                      style={{ background:'var(--fs-surface-2)', border:'1px solid var(--fs-border)', color:'var(--fs-text-2)', padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                                      Editar
                                    </button>
                                    <button onClick={() => handleDelete(conta.id)}
                                      style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', color:'var(--fs-danger)', padding:'5px 10px', borderRadius:6, fontSize:12, cursor:'pointer' }}>
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        // ── VISÃO LISTA PLANA ────────────────────────────────────────────────
        <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead style={{ background:'var(--fs-bg)' }}>
              <tr>
                <th style={{ padding:'10px 16px', textAlign:'left', color:'var(--fs-text-4)', fontSize:11, fontWeight:700, textTransform:'uppercase', width:80 }}>Código</th>
                <th style={{ padding:'10px 16px', textAlign:'left', color:'var(--fs-text-4)', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Nome</th>
                <th style={{ padding:'10px 16px', textAlign:'left', color:'var(--fs-text-4)', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Classificação DRE</th>
                <th style={{ padding:'10px 16px', textAlign:'center', color:'var(--fs-text-4)', fontSize:11, fontWeight:700, textTransform:'uppercase', width:100 }}>De-Para</th>
                <th style={{ padding:'10px 16px', textAlign:'center', color:'var(--fs-text-4)', fontSize:11, fontWeight:700, textTransform:'uppercase', width:120 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contasFiltradas.map((conta, i) => (
                <tr key={conta.id} style={{ borderTop:'1px solid var(--fs-border)', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding:'10px 16px', color:'var(--fs-text-4)', fontSize:13, fontFamily:'monospace' }}>{conta.codigo || '—'}</td>
                  <td style={{ padding:'10px 16px', color:'var(--fs-text-1)', fontSize:13, fontWeight:600 }}>{conta.nome}</td>
                  <td style={{ padding:'10px 16px' }}><TipoBadge tipo={conta.tipo} /></td>
                  <td style={{ padding:'10px 16px', textAlign:'center', color:'var(--fs-text-4)', fontSize:12 }}>{mapCount[conta.id] || '—'}</td>
                  <td style={{ padding:'10px 16px', textAlign:'center' }}>
                    <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                      <button onClick={() => setModal(conta)} style={{ background:'var(--fs-surface-2)', border:'1px solid var(--fs-border)', color:'var(--fs-text-2)', padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>Editar</button>
                      <button onClick={() => handleDelete(conta.id)} style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', color:'var(--fs-danger)', padding:'5px 10px', borderRadius:6, fontSize:12, cursor:'pointer' }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumo */}
      {!loading && (
        <div style={{ marginTop:20, display:'flex', gap:10, flexWrap:'wrap' }}>
          {DRE_GROUPS.filter(g => (grouped[g.key]||[]).length > 0).map(g => (
            <div key={g.key} style={{ display:'flex', alignItems:'center', gap:6, background:`${g.cor}12`, border:`1px solid ${g.cor}30`, borderRadius:8, padding:'5px 12px', fontSize:12 }}>
              <span>{g.icone}</span>
              <span style={{ color:g.cor, fontWeight:700 }}>{g.label}:</span>
              <span style={{ color:'var(--fs-text-2)' }}>{(grouped[g.key]||[]).length}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
