'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Ícones SVG profissionais (sem emojis) ────────────────────────────────────
const Icon = ({ d, color, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)
const ICONS = {
  receita:            'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  deducao:            'M5 12h14',
  custo:              'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z',
  despesa:            'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  receita_financeira: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  despesa_financeira: 'M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6',
  imposto_lucro:      'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  investimento:       'M2 20h20M6 20V10M12 20V4M18 20v-6',
  entrada:            'M12 5v14M5 12l7 7 7-7',
  saida:              'M12 19V5M5 12l7-7 7 7',
  edit:               'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:              'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2',
  eye:                'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  plus:               'M12 5v14M5 12h14',
  list:               'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2M9 12h6M9 16h4',
  chart:              'M18 20V10M12 20V4M6 20v-6',
  map:                'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
}

const DRE_GROUPS = [
  { key: 'receita',            label: 'Receita Bruta',             cor: '#22c55e', desc: 'Receitas operacionais de serviços/produtos' },
  { key: 'deducao',            label: 'Deduções',                  cor: '#f97316', desc: 'Impostos sobre receita, devoluções, descontos' },
  { key: 'custo',              label: 'Custos Variáveis',          cor: '#ef4444', desc: 'CMV, CPV — custos diretamente ligados à receita' },
  { key: 'despesa',            label: 'Despesas Fixas',            cor: '#f59e0b', desc: 'Despesas operacionais fixas (salários, aluguel, etc.)' },
  { key: 'receita_financeira', label: 'Receitas Financeiras',      cor: '#14b8a6', desc: 'Juros recebidos, rendimentos financeiros' },
  { key: 'despesa_financeira', label: 'Despesas Financeiras',      cor: '#8b5cf6', desc: 'Juros pagos, IOF, tarifas bancárias' },
  { key: 'imposto_lucro',      label: 'Impostos sobre Lucro',      cor: '#f97316', desc: 'IR, CSLL e outros impostos sobre o lucro' },
  { key: 'investimento',       label: 'Investimentos (CAPEX)',     cor: '#64748b', desc: 'Aquisição de ativos, investimentos de longo prazo' },
  { key: 'entrada',            label: 'Entradas — Fluxo de Caixa', cor: '#3b82f6', desc: 'Entradas de caixa (módulo FC)' },
  { key: 'saida',              label: 'Saídas — Fluxo de Caixa',   cor: '#ec4899', desc: 'Saídas de caixa (módulo FC)' },
]
const TIPO_LABELS = Object.fromEntries(DRE_GROUPS.map(g => [g.key, g.label]))
const TIPO_CORES  = Object.fromEntries(DRE_GROUPS.map(g => [g.key, g.cor]))

export default function PlanoContasPage() {
  const [empresaId,   setEmpresaId]   = useState(null)
  const [empresas,    setEmpresas]    = useState([])
  const [contas,      setContas]      = useState([])
  const [mappings,    setMappings]    = useState([])
  const [view,        setView]        = useState('dre')
  const [editando,    setEditando]    = useState(null)
  const [nova,        setNova]        = useState({ codigo:'', nome:'', tipo:'receita', descricao:'' })
  const [loading,     setLoading]     = useState(false)
  const [msg,         setMsg]         = useState('')
  const [showAdd,     setShowAdd]     = useState(false)
  const [contaDetalhes, setContaDetalhes] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({})
  const toggleGroup = (key) => setExpandedGroups(p => ({...p, [key]: p[key] === false ? true : false}))
  const isOpen = (key) => expandedGroups[key] !== false

  const toast = (t, ok=true) => { setMsg(t); setTimeout(() => setMsg(''), 3500) }

  useEffect(() => {
    const id = localStorage.getItem('empresa_id') || ''
    setEmpresaId(id === 'todas' ? null : id)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {})
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const id = localStorage.getItem('empresa_id') || ''
    setEmpresaId(id === 'todas' ? null : id)
    supabase.from('empresas').select('id,nome').order('nome').then(({ data }) => setEmpresas(data || []))
    const h = () => {
      const nid = localStorage.getItem('empresa_id') || ''
      setEmpresaId(nid === 'todas' ? null : nid)
    }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const load = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from('plano_contas').select('id,codigo,nome,tipo,descricao').eq('empresa_id', empresaId).order('codigo'),
      supabase.from('categoria_mappings').select('id,categoria_origem,tipo_destino,conta_id').eq('empresa_id', empresaId),
    ])
    setContas(c || [])
    setMappings(m || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { load() }, [load])

  const salvar = async () => {
    if (!nova.codigo || !nova.nome || !empresaId) return
    setLoading(true)
    if (editando) {
      await supabase.from('plano_contas').update({ codigo: nova.codigo, nome: nova.nome, tipo: nova.tipo, descricao: nova.descricao }).eq('id', editando)
      toast('Conta atualizada')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('plano_contas').insert([{ ...nova, empresa_id: empresaId, user_id: user.id }])
      toast('Conta adicionada')
    }
    setNova({ codigo:'', nome:'', tipo:'receita', descricao:'' }); setEditando(null); setShowAdd(false)
    load()
  }

  const excluir = async (id) => {
    if (!confirm('Excluir esta conta? Os De-Para vinculados também serão removidos.')) return
    await supabase.from('categoria_mappings').delete().eq('conta_id', id)
    await supabase.from('plano_contas').delete().eq('id', id)
    toast('Conta excluída'); load()
  }

  const iniciarEdicao = (c) => {
    setNova({ codigo: c.codigo, nome: c.nome, tipo: c.tipo, descricao: c.descricao || '' })
    setEditando(c.id); setShowAdd(true)
  }

  const cancelar = () => { setNova({ codigo:'', nome:'', tipo:'receita', descricao:'' }); setEditando(null); setShowAdd(false) }

  const inp = { background:'var(--fs-input-bg)', border:'1px solid var(--fs-input-border)', borderRadius:7, color:'var(--fs-text-1)', padding:'9px 12px', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }

  // ─── Modal de detalhes da conta ───────────────────────────────────
  const ContaModal = () => {
    if (!contaDetalhes) return null
    const mps = mappings.filter(m => m.conta_id === contaDetalhes.id)
    return (
      <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center' }}
           onClick={() => setContaDetalhes(null)}>
        <div style={{ background:'var(--fs-surface)',border:'1px solid var(--fs-border)',borderRadius:12,padding:28,maxWidth:500,width:'90%' }}
             onClick={e => e.stopPropagation()}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
            <div>
              <div style={{ fontSize:11,color:'var(--fs-text-4)',fontWeight:700,textTransform:'uppercase',marginBottom:4 }}>Código {contaDetalhes.codigo}</div>
              <div style={{ fontSize:17,fontWeight:800,color:'var(--fs-text-1)' }}>{contaDetalhes.nome}</div>
              <span style={{ display:'inline-block',marginTop:6,background:`${TIPO_CORES[contaDetalhes.tipo]}20`,color:TIPO_CORES[contaDetalhes.tipo],border:`1px solid ${TIPO_CORES[contaDetalhes.tipo]}40`,padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700 }}>
                {TIPO_LABELS[contaDetalhes.tipo]}
              </span>
            </div>
            <button onClick={() => setContaDetalhes(null)} style={{ background:'transparent',border:'none',color:'var(--fs-text-4)',fontSize:18,cursor:'pointer',lineHeight:1 }}>✕</button>
          </div>
          {contaDetalhes.descricao && <p style={{ color:'var(--fs-text-2)',fontSize:13,marginBottom:16 }}>{contaDetalhes.descricao}</p>}
          <div style={{ fontSize:12,fontWeight:700,color:'var(--fs-text-4)',textTransform:'uppercase',marginBottom:8 }}>De-Para vinculados ({mps.length})</div>
          {mps.length === 0
            ? <p style={{ color:'var(--fs-text-4)',fontSize:13 }}>Nenhum De-Para configurado para esta conta.</p>
            : mps.map(m => (
              <div key={m.id} style={{ background:'var(--fs-bg)',borderRadius:7,padding:'8px 12px',marginBottom:6,fontSize:12,color:'var(--fs-text-2)' }}>
                {m.categoria_origem}
              </div>
            ))}
        </div>
      </div>
    )
  }

  // ─── Formulário de nova/editar conta ─────────────────────────────
  const FormConta = () => (
    <div style={{ background:'var(--fs-surface)',border:'1px solid var(--fs-border)',borderRadius:12,padding:24,marginBottom:20 }}>
      <div style={{ fontSize:15,fontWeight:700,color:'var(--fs-text-1)',marginBottom:16 }}>
        {editando ? 'Editar Conta' : 'Nova Conta'}
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 2fr 1fr',gap:12,marginBottom:12 }}>
        <div>
          <label style={{ display:'block',fontSize:11,color:'var(--fs-text-4)',fontWeight:700,textTransform:'uppercase',marginBottom:5 }}>Código</label>
          <input style={inp} value={nova.codigo} onChange={e=>setNova({...nova,codigo:e.target.value})} placeholder="1.1" />
        </div>
        <div>
          <label style={{ display:'block',fontSize:11,color:'var(--fs-text-4)',fontWeight:700,textTransform:'uppercase',marginBottom:5 }}>Nome da Conta</label>
          <input style={inp} value={nova.nome} onChange={e=>setNova({...nova,nome:e.target.value})} placeholder="Ex: Receita de Serviços" />
        </div>
        <div>
          <label style={{ display:'block',fontSize:11,color:'var(--fs-text-4)',fontWeight:700,textTransform:'uppercase',marginBottom:5 }}>Tipo</label>
          <select style={inp} value={nova.tipo} onChange={e=>setNova({...nova,tipo:e.target.value})}>
            {DRE_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom:16 }}>
        <label style={{ display:'block',fontSize:11,color:'var(--fs-text-4)',fontWeight:700,textTransform:'uppercase',marginBottom:5 }}>Descrição (opcional)</label>
        <input style={inp} value={nova.descricao} onChange={e=>setNova({...nova,descricao:e.target.value})} placeholder="Descrição da conta..." />
      </div>
      <div style={{ display:'flex',gap:8 }}>
        <button onClick={salvar} disabled={!nova.codigo||!nova.nome||loading}
          style={{ background:'var(--fs-brand)',color:'#fff',border:'none',borderRadius:8,padding:'9px 20px',fontSize:13,fontWeight:700,cursor:'pointer' }}>
          {editando ? 'Salvar Alterações' : 'Adicionar Conta'}
        </button>
        <button onClick={cancelar}
          style={{ background:'transparent',color:'var(--fs-text-2)',border:'1px solid var(--fs-border)',borderRadius:8,padding:'9px 16px',fontSize:13,cursor:'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ color:'var(--fs-text-1)', width:'100%' }}>
      <ContaModal />

      {/* Header */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:12 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,color:'var(--fs-text-1)',margin:0 }}>Plano de Contas</h1>
          <p style={{ color:'var(--fs-text-4)',fontSize:13,margin:'4px 0 0' }}>
            {contas.length} conta{contas.length !== 1?'s':''} cadastrada{contas.length !== 1?'s':''}
            {mappings.length > 0 && ` · ${mappings.length} De-Para`}
          </p>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          {/* Toggle de visualização */}
          <div style={{ display:'flex',background:'var(--fs-surface)',border:'1px solid var(--fs-border)',borderRadius:8,padding:3,gap:2 }}>
            {[{v:'dre',l:'Visão DRE',i:ICONS.chart},{v:'lista',l:'Lista',i:ICONS.list}].map(({v,l,i}) => (
              <button key={v} onClick={() => setView(v)}
                style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:6,fontSize:12,fontWeight:view===v?700:400,background:view===v?'var(--fs-surface-2)':'transparent',color:view===v?'var(--fs-text-1)':'var(--fs-text-4)',border:view===v?'1px solid var(--fs-border)':'1px solid transparent',cursor:'pointer' }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={i} />
                </svg>
                {l}
              </button>
            ))}
          </div>
          {!showAdd && (
            <button onClick={() => setShowAdd(true)}
              style={{ display:'flex',alignItems:'center',gap:6,background:'var(--fs-brand)',color:'#fff',border:'none',borderRadius:8,padding:'9px 16px',fontSize:13,fontWeight:700,cursor:'pointer' }}>
              <Icon d={ICONS.plus} color="#fff" size={14} /> Nova Conta
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div style={{ background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:8,padding:'9px 14px',color:'var(--fs-success)',fontSize:13,marginBottom:16 }}>
          {msg}
        </div>
      )}

      {showAdd && <FormConta />}

      {!empresaId ? (
        <div style={{ textAlign:'center',padding:60,color:'var(--fs-text-4)' }}>Selecione uma empresa no menu lateral.</div>
      ) : loading ? (
        <div style={{ textAlign:'center',padding:60,color:'var(--fs-text-4)' }}>Carregando...</div>
      ) : contas.length === 0 ? (
        <div style={{ textAlign:'center',padding:60,color:'var(--fs-text-4)' }}>
          <p style={{ marginBottom:16 }}>Nenhuma conta cadastrada para esta empresa.</p>
          <button onClick={() => setShowAdd(true)} style={{ background:'var(--fs-brand)',color:'#fff',border:'none',borderRadius:8,padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer' }}>
            Adicionar primeira conta
          </button>
        </div>
      ) : view === 'dre' ? (
        // ── Visão DRE: agrupado por tipo ─────────────────────────────
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          {DRE_GROUPS.map(grupo => {
            const gc = contas.filter(c => c.tipo === grupo.key)
            if (gc.length === 0) return null
            const mCount = mappings.filter(m => gc.some(c => c.id === m.conta_id)).length
            const open = isOpen(grupo.key)
            return (
              <div key={grupo.key} style={{ background:'var(--fs-surface)',border:'1px solid var(--fs-border)',borderRadius:12,overflow:'hidden' }}>
                {/* Header do grupo */}
                <div onClick={() => toggleGroup(grupo.key)}
                  style={{ display:'flex',alignItems:'center',gap:12,padding:'14px 20px',cursor:'pointer',borderLeft:`4px solid ${grupo.cor}`,background:'var(--fs-surface)' }}>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,background:`${grupo.cor}18`,borderRadius:8,flexShrink:0 }}>
                    <Icon d={ICONS[grupo.key] || ICONS.receita} color={grupo.cor} size={15} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <span style={{ fontWeight:700,color:'var(--fs-text-1)',fontSize:14 }}>{grupo.label}</span>
                      <span style={{ background:`${grupo.cor}18`,color:grupo.cor,border:`1px solid ${grupo.cor}30`,padding:'1px 8px',borderRadius:20,fontSize:11,fontWeight:700 }}>{gc.length} conta{gc.length!==1?'s':''}</span>
                      {mCount > 0 && <span style={{ background:'rgba(59,130,246,0.1)',color:'var(--fs-brand)',border:'1px solid rgba(59,130,246,0.2)',padding:'1px 8px',borderRadius:20,fontSize:11,fontWeight:700 }}>{mCount} De-Para</span>}
                    </div>
                    <div style={{ fontSize:12,color:'var(--fs-text-4)',marginTop:2 }}>{grupo.desc}</div>
                  </div>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--fs-text-4)" strokeWidth="2" style={{ transform:open?'rotate(180deg)':'none',transition:'transform 0.2s',flexShrink:0 }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
                {/* Contas do grupo */}
                {open && (
                  <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
                    <thead style={{ background:'var(--fs-bg)' }}>
                      <tr style={{ borderTop:'1px solid var(--fs-border)' }}>
                        {['Código','Nome da Conta','Descrição','De-Para','Ações'].map((h,i) => (
                          <th key={h} style={{ padding:'8px 16px',textAlign:i>=3?'center':'left',color:'var(--fs-text-4)',fontSize:11,fontWeight:700,textTransform:'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gc.map((conta, idx) => {
                        const mps = mappings.filter(m => m.conta_id === conta.id)
                        return (
                          <tr key={conta.id} style={{ borderTop:'1px solid var(--fs-border)',background:idx%2===0?'transparent':'var(--fs-bg)' }}>
                            <td style={{ padding:'11px 16px',fontWeight:700,color:grupo.cor,fontSize:12,whiteSpace:'nowrap' }}>{conta.codigo}</td>
                            <td style={{ padding:'11px 16px',fontWeight:600,color:'var(--fs-text-1)' }}>{conta.nome}</td>
                            <td style={{ padding:'11px 16px',color:'var(--fs-text-4)',fontSize:12 }}>{conta.descricao || '—'}</td>
                            <td style={{ padding:'11px 16px',textAlign:'center' }}>
                              {mps.length > 0 ? (
                                <button onClick={() => setContaDetalhes(conta)}
                                  style={{ background:'rgba(59,130,246,0.1)',color:'var(--fs-brand)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:6,padding:'3px 10px',fontSize:11,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4 }}>
                                  <Icon d={ICONS.eye} color="var(--fs-brand)" size={12} />
                                  {mps.length}
                                </button>
                              ) : <span style={{ color:'var(--fs-text-4)',fontSize:11 }}>—</span>}
                            </td>
                            <td style={{ padding:'11px 16px',textAlign:'center' }}>
                              <div style={{ display:'inline-flex',gap:6 }}>
                                <button onClick={() => iniciarEdicao(conta)}
                                  style={{ display:'inline-flex',alignItems:'center',gap:5,background:'transparent',border:'1px solid var(--fs-border)',borderRadius:7,padding:'5px 10px',fontSize:12,color:'var(--fs-text-2)',cursor:'pointer',fontWeight:600 }}>
                                  <Icon d={ICONS.edit} color="var(--fs-text-2)" size={12} /> Editar
                                </button>
                                <button onClick={() => excluir(conta.id)}
                                  style={{ display:'inline-flex',alignItems:'center',background:'transparent',border:'1px solid rgba(239,68,68,0.2)',borderRadius:7,padding:'5px 8px',fontSize:12,color:'var(--fs-danger)',cursor:'pointer' }}>
                                  <Icon d={ICONS.trash} color="var(--fs-danger)" size={13} />
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
            )
          })}
        </div>
      ) : (
        // ── Visão Lista: tabela flat ──────────────────────────────────
        <div style={{ background:'var(--fs-surface)',border:'1px solid var(--fs-border)',borderRadius:12,overflow:'hidden' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead style={{ background:'var(--fs-bg)' }}>
              <tr style={{ borderBottom:'1px solid var(--fs-border)' }}>
                {['Código','Nome','Tipo','Descrição','Ações'].map((h,i) => (
                  <th key={h} style={{ padding:'10px 16px',textAlign:i>=4?'center':'left',color:'var(--fs-text-4)',fontSize:11,fontWeight:700,textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contas.map((conta, idx) => (
                <tr key={conta.id} style={{ borderBottom:'1px solid var(--fs-border)',background:idx%2===0?'transparent':'var(--fs-bg)' }}>
                  <td style={{ padding:'10px 16px',fontWeight:700,color:TIPO_CORES[conta.tipo],fontSize:12 }}>{conta.codigo}</td>
                  <td style={{ padding:'10px 16px',fontWeight:600,color:'var(--fs-text-1)' }}>{conta.nome}</td>
                  <td style={{ padding:'10px 16px' }}>
                    <span style={{ background:`${TIPO_CORES[conta.tipo]}18`,color:TIPO_CORES[conta.tipo],border:`1px solid ${TIPO_CORES[conta.tipo]}30`,padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700 }}>
                      {TIPO_LABELS[conta.tipo]}
                    </span>
                  </td>
                  <td style={{ padding:'10px 16px',color:'var(--fs-text-4)',fontSize:12 }}>{conta.descricao || '—'}</td>
                  <td style={{ padding:'10px 16px',textAlign:'center' }}>
                    <div style={{ display:'inline-flex',gap:6 }}>
                      <button onClick={() => iniciarEdicao(conta)}
                        style={{ display:'inline-flex',alignItems:'center',gap:5,background:'transparent',border:'1px solid var(--fs-border)',borderRadius:7,padding:'5px 10px',fontSize:12,color:'var(--fs-text-2)',cursor:'pointer',fontWeight:600 }}>
                        <Icon d={ICONS.edit} color="var(--fs-text-2)" size={12} /> Editar
                      </button>
                      <button onClick={() => excluir(conta.id)}
                        style={{ display:'inline-flex',alignItems:'center',background:'transparent',border:'1px solid rgba(239,68,68,0.2)',borderRadius:7,padding:'5px 8px',fontSize:12,color:'var(--fs-danger)',cursor:'pointer' }}>
                        <Icon d={ICONS.trash} color="var(--fs-danger)" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
