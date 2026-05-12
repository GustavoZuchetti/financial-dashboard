'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Estrutura DRE para agrupamento visual ────────────────────────────────────
const DRE_GROUPS = [
  { key: 'receita',             label: 'Receita Bruta',          cor: '#22c55e', icone: '💰', desc: 'Receitas operacionais de serviços/produtos' },
  { key: 'deducao',             label: 'Deduções',               cor: '#f97316', icone: '➖', desc: 'Impostos sobre receita, devoluções, descontos' },
  { key: 'custo',               label: 'Custos Variáveis',       cor: '#ef4444', icone: '🏭', desc: 'CMV, CPV — custos diretamente ligados à receita' },
  { key: 'despesa',             label: 'Despesas Fixas',         cor: '#f59e0b', icone: '📋', desc: 'Despesas operacionais fixas (salários, aluguel, etc.)' },
  { key: 'receita_financeira',  label: 'Receitas Financeiras',   cor: '#14b8a6', icone: '📈', desc: 'Juros recebidos, rendimentos financeiros' },
  { key: 'despesa_financeira',  label: 'Despesas Financeiras',   cor: '#8b5cf6', icone: '📉', desc: 'Juros pagos, IOF, tarifas bancárias' },
  { key: 'imposto_lucro',       label: 'Impostos sobre Lucro',   cor: '#f97316', icone: '🏛️', desc: 'IR, CSLL e outros impostos sobre o lucro' },
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
    <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'var(--fs-surface)', borderRadius:12, padding:24, maxWidth:500, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:'0 0 16px', color:'var(--fs-text-1)' }}>
          {conta ? 'Editar Conta' : 'Nova Conta'}
        </h2>
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--fs-text-4)', marginBottom:6 }}>Código</label>
            <input value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value})}
              style={{ width:'100%', background:'var(--fs-input-bg)', border:'1px solid var(--fs-input-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'10px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--fs-text-4)', marginBottom:6 }}>Nome da Conta</label>
            <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})}
              style={{ width:'100%', background:'var(--fs-input-bg)', border:'1px solid var(--fs-input-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'10px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--fs-text-4)', marginBottom:6 }}>Tipo DRE</label>
            <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}
              style={{ width:'100%', background:'var(--fs-input-bg)', border:'1px solid var(--fs-input-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'10px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }}>
              {DRE_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--fs-text-4)', marginBottom:6 }}>Empresa</label>
            <select value={form.empresa_id} onChange={e => setForm({...form, empresa_id: e.target.value})}
              style={{ width:'100%', background:'var(--fs-input-bg)', border:'1px solid var(--fs-input-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'10px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }}>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose}
            style={{ background:'var(--fs-surface-2)', border:'1px solid var(--fs-border)', color:'var(--fs-text-2)', padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ background:'var(--fs-brand)', color:'#fff', border:'none', padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar'}
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
  const [expandedMappings, setExpandedMappings] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: emps }, { data: pcs }, { data: maps }] = await Promise.all([
        supabase.from('empresas').select('id,nome').order('nome'),
        supabase.from('plano_contas').select('id,nome,tipo,codigo,empresa_id').order('codigo'),
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
  const toggleMappingDetail = (contaId) => setExpandedMappings(prev => ({ ...prev, [contaId]: !prev[contaId] }))

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
                              <React.Fragment key={conta.id}>
                                <tr style={{ borderTop:'1px solid var(--fs-border)', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
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
                                      <button onClick={() => toggleMappingDetail(conta.id)}
                                        title={expandedMappings[conta.id] ? 'Ocultar categorias' : 'Ver categorias mapeadas'}
                                        onMouseEnter={(e) => { e.target.style.background = 'rgba(59,130,246,0.1)'; e.target.style.color = 'var(--fs-brand)' }}
                                        onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--fs-text-3)' }}
                                        style={{ background:'transparent', color:'var(--fs-text-3)', border:'none', padding:'4px 8px', borderRadius:6, fontSize:16, cursor:'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', minWidth:32, minHeight:32 }}>
                                        👁️
                                      </button>
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
                                {expandedMappings[conta.id] && mCount > 0 && (
                                  <tr style={{ borderTop:'1px solid var(--fs-border)', background:'rgba(59,130,246,0.05)' }}>
                                    <td colSpan="4" style={{ padding:'12px 16px' }}>
                                      <div style={{ fontSize:12, fontWeight:600, color:'var(--fs-text-4)', marginBottom:8 }}>Categorias mapeadas para esta conta:</div>
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                                        {mappings.filter(m => m.conta_id === conta.id).map((m, idx) => (
                                          <span key={idx} style={{ background:'var(--fs-surface-2)', border:'1px solid var(--fs-border)', color:'var(--fs-text-1)', padding:'4px 10px', borderRadius:6, fontSize:12, fontWeight:500 }}>
                                            {m.categoria_origem}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
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
        // ── VISÃO LISTA SIMPLES ────────────────────────────────────────────────
        <table style={{ width:'100%', borderCollapse:'collapse', background:'var(--fs-surface)', borderRadius:12, overflow:'hidden', border:'1px solid var(--fs-border)' }}>
          <thead>
            <tr style={{ background:'var(--fs-surface-2)', borderBottom:'1px solid var(--fs-border)' }}>
              <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase' }}>Código</th>
              <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase' }}>Nome</th>
              <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase' }}>Tipo</th>
              <th style={{ padding:'12px 16px', textAlign:'center', fontSize:12, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase' }}>De-Para</th>
              <th style={{ padding:'12px 16px', textAlign:'center', fontSize:12, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {contasFiltradas.map((conta, i) => {
              const mCount = mapCount[conta.id] || 0
              return (
                <React.Fragment key={conta.id}>
                  <tr style={{ borderTop:'1px solid var(--fs-border)', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding:'12px 16px', color:'var(--fs-text-4)', fontSize:13, fontFamily:'monospace' }}>{conta.codigo || '—'}</td>
                    <td style={{ padding:'12px 16px', color:'var(--fs-text-1)', fontSize:13, fontWeight:600 }}>{conta.nome}</td>
                    <td style={{ padding:'12px 16px' }}><TipoBadge tipo={conta.tipo} /></td>
                    <td style={{ padding:'12px 16px', textAlign:'center' }}>
                      {mCount > 0 ? (
                        <button onClick={() => toggleMappingDetail(conta.id)}
                          title={expandedMappings[conta.id] ? 'Ocultar categorias' : 'Ver categorias mapeadas'}
                          onMouseEnter={(e) => { e.target.style.background = 'rgba(59,130,246,0.1)'; e.target.style.color = 'var(--fs-brand)' }}
                          onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--fs-text-3)' }}
                          style={{ background:'transparent', color:'var(--fs-text-3)', border:'none', padding:'4px 8px', borderRadius:6, fontSize:16, cursor:'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', minWidth:32, minHeight:32 }}>
                          👁️
                        </button>
                      ) : (
                        <span style={{ color:'var(--fs-text-4)', fontSize:12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'center' }}>
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
                  {expandedMappings[conta.id] && mCount > 0 && (
                    <tr style={{ borderTop:'1px solid var(--fs-border)', background:'rgba(59,130,246,0.05)' }}>
                      <td colSpan="5" style={{ padding:'12px 16px' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--fs-text-4)', marginBottom:8 }}>Categorias mapeadas para esta conta:</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                          {mappings.filter(m => m.conta_id === conta.id).map((m, idx) => (
                            <span key={idx} style={{ background:'var(--fs-surface-2)', border:'1px solid var(--fs-border)', color:'var(--fs-text-1)', padding:'4px 10px', borderRadius:6, fontSize:12, fontWeight:500 }}>
                              {m.categoria_origem}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
