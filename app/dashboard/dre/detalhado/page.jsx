'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { calcDRE, calcDREMap, DRE_LINES, fmtBRL } from '@/lib/dre-calc'

// ─── Modal de Drill-down ──────────────────────────────────────────────────────
function DrillModal({ item, lancamentos, onClose, periodo }) {
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const isDark = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-theme') !== 'light' : true

  const total = lancamentos.reduce((a, l) => a + Number(l.valor), 0)

  // Agrupar por mês quando há múltiplos meses
  const byMonth = {}
  lancamentos.forEach(l => {
    if (!l.data) return
    const [y, m] = l.data.split('-')
    const key = `${y}-${m}`
    if (!byMonth[key]) byMonth[key] = { label: `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(m)-1]}/${y}`, items: [], total: 0 }
    byMonth[key].items.push(l)
    byMonth[key].total += Number(l.valor)
  })
  const meses = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]))
  const multiMes = meses.length > 1

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24, backdropFilter:'blur(3px)' }}>
      <div ref={ref} style={{
        background: isDark ? '#141824' : '#fff',
        border:'1px solid var(--fs-border)',
        borderRadius:16, width:'100%', maxWidth:780,
        maxHeight:'85vh', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header do modal */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--fs-border)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:4 }}>
              Detalhamento · {periodo}
            </div>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--fs-text-1)', marginBottom:4 }}>{item.nome}</div>
            <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:22, fontWeight:900, color:'#3b82f6' }}>{fmtBRL(total)}</span>
              <span style={{ fontSize:12, color:'var(--fs-text-4)' }}>{lancamentos.length} lançamento{lancamentos.length !== 1 ? 's' : ''}</span>
              {multiMes && <span style={{ fontSize:12, color:'var(--fs-text-4)' }}>· {meses.length} meses</span>}
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8,
            width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', color:'var(--fs-text-3)', fontSize:18, flexShrink:0,
          }}>×</button>
        </div>

        {/* Corpo — scroll */}
        <div style={{ overflowY:'auto', flex:1, padding:'0 0 8px' }}>
          {multiMes ? (
            // Vista agrupada por mês quando período > 1 mês
            meses.map(([key, mes]) => (
              <div key={key}>
                {/* Separador de mês */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px 8px', background:'var(--fs-bg)', borderBottom:'1px solid var(--fs-border)', position:'sticky', top:0, zIndex:1 }}>
                  <span style={{ fontSize:12, fontWeight:800, color:'var(--fs-text-2)', letterSpacing:'0.3px' }}>📅 {mes.label}</span>
                  <div style={{ display:'flex', gap:12, fontSize:12 }}>
                    <span style={{ color:'var(--fs-text-4)' }}>{mes.items.length} lançamento{mes.items.length !== 1 ? 's' : ''}</span>
                    <span style={{ fontWeight:700, color:'#3b82f6' }}>{fmtBRL(mes.total)}</span>
                  </div>
                </div>
                {/* Lançamentos do mês */}
                {mes.items.map((l, i) => (
                  <LancRow key={l.id || i} l={l} isLast={i === mes.items.length - 1} />
                ))}
              </div>
            ))
          ) : (
            // Vista plana quando é um único mês
            lancamentos.map((l, i) => (
              <LancRow key={l.id || i} l={l} isLast={i === lancamentos.length - 1} />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--fs-border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--fs-bg)', borderRadius:'0 0 16px 16px' }}>
          <span style={{ fontSize:12, color:'var(--fs-text-4)' }}>Total de {lancamentos.length} lançamentos</span>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <span style={{ fontSize:14, fontWeight:800, color:'#3b82f6' }}>{fmtBRL(total)}</span>
            <button onClick={onClose} style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:8, padding:'7px 18px', fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--fs-text-2)' }}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function LancRow({ l, isLast }) {
  const [, m, d] = (l.data || '').split('-')
  const dataFmt = l.data ? `${d}/${m}` : '—'
  return (
    <div style={{ display:'grid', gridTemplateColumns:'52px 1fr 120px', gap:12, padding:'11px 24px', borderBottom: isLast ? 'none' : '1px solid rgba(var(--fs-border-rgb,55,65,81),0.5)', alignItems:'center' }}
      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}
    >
      <div style={{ fontSize:12, fontWeight:600, color:'var(--fs-text-4)', fontVariantNumeric:'tabular-nums' }}>{dataFmt}</div>
      <div style={{ fontSize:13, color:'var(--fs-text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {l.descricao || l.categoria || '—'}
      </div>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--fs-text-1)', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
        {fmtBRL(Number(l.valor))}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DREDetalhado() {
  const [startDate, setStartDate] = useState(() => new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0])
  const [endDate,   setEndDate]   = useState(new Date().toISOString().split('T')[0])
  const [empresaId, setEmpresaId] = useState(null)
  const [isConsol,  setIsConsol]  = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [data,      setData]      = useState([])
  const [contas,    setContas]    = useState([])
  const [expanded,  setExpanded]  = useState({})
  const [modal,     setModal]     = useState(null) // { item, lancamentos }

  useEffect(() => {
    const id = localStorage.getItem('empresa_id')
    setEmpresaId(id); setIsConsol(id === 'todas')
    const h = () => { const nid=localStorage.getItem('empresa_id'); setEmpresaId(nid); setIsConsol(nid==='todas') }
    window.addEventListener('storage', h); return () => window.removeEventListener('storage', h)
  }, [])

  const fetchData = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const { data: pc } = await supabase.from('plano_contas').select('id,codigo,nome,tipo')
      setContas(pc || [])

      let q = supabase.from('lancamentos').select('id,tipo,valor,data,descricao,categoria,conta_id,empresa_id').range(0, 9999).gte('data', startDate).lte('data', endDate)
      if (isConsol) {
        const { data: ue } = await supabase.from('empresas').select('id').eq('user_id', (await supabase.auth.getSession()).data.session.user.id)
        if (ue?.length) q = q.in('empresa_id', ue.map(e => e.id))
      } else { q = q.eq('empresa_id', empresaId) }
      const { data: rows } = await q
      setData(rows || [])
    } finally { setLoading(false) }
  }, [empresaId, startDate, endDate, isConsol])

  useEffect(() => { fetchData() }, [fetchData])

  const toggle = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }))

  const v    = calcDRE(data)
  const vMap = calcDREMap(data)

  const buildHierarchy = (tipos) => {
    const relevant = (data || []).filter(l => tipos.includes(l.tipo))
    const byAccount = {}
    relevant.forEach(l => {
      const contaId = l.conta_id || '__sem_conta__'
      if (!byAccount[contaId]) {
        const conta = contas.find(c => c.id === contaId)
        byAccount[contaId] = {
          contaId, nome: conta ? `${conta.codigo} ${conta.nome}` : '— Sem conta mapeada',
          items: [], total: 0, lancamentos: []
        }
      }
      byAccount[contaId].lancamentos.push(l)
      byAccount[contaId].total += Number(l.valor)

      const k = (l.descricao || l.categoria || '—').trim()
      const existing = byAccount[contaId].items.find(i => i.nome === k)
      if (existing) { existing.total += Number(l.valor); existing.count++; existing.lancamentos.push(l) }
      else byAccount[contaId].items.push({ nome: k, total: Number(l.valor), count: 1, lancamentos: [l], data: l.data })
    })
    return Object.values(byAccount)
      .map(a => ({ ...a, items: a.items.sort((a,b) => b.total - a.total) }))
      .sort((a, b) => b.total - a.total)
  }

  const pct = (val) => v.rb > 0 ? (Math.abs(val) / v.rb * 100).toFixed(1) + '%' : '—'

  // Formatar período para exibir no modal
  const periodoLabel = (() => {
    const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const [sy, sm, sd] = startDate.split('-')
    const [ey, em, ed] = endDate.split('-')
    if (sy === ey && sm === em) return `${sd}/${sm}/${sy} – ${ed}/${em}/${ey}`
    return `${MESES[Number(sm)-1]}/${sy} – ${MESES[Number(em)-1]}/${ey}`
  })()

  const TH = ({ children, right }) => (
    <th style={{ padding:'10px 16px', textAlign: right?'right':'left', color:'var(--fs-text-4)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.7px', borderBottom:'1px solid var(--fs-border)', whiteSpace:'nowrap', background:'var(--fs-bg)' }}>
      {children}
    </th>
  )

  return (
    <div style={{ color:'var(--fs-text-1)' }}>

      {/* Modal */}
      {modal && (
        <DrillModal
          item={modal.item}
          lancamentos={modal.lancamentos}
          periodo={periodoLabel}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 }}>Demonstrativos · Drill-down</div>
          <h1 style={{ fontSize:26, fontWeight:900, color:'var(--fs-text-1)', margin:0 }}>DRE Detalhado</h1>
          <p style={{ color:'var(--fs-text-4)', fontSize:12, margin:'3px 0 0' }}>Clique em qualquer linha ou cliente para ver os lançamentos individuais</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', background:'var(--fs-surface)', padding:'8px 14px', borderRadius:10, border:'1px solid var(--fs-border)' }}>
          <span style={{ fontSize:12, color:'var(--fs-text-4)' }}>Período:</span>
          <input type="date" style={{ background:'transparent', border:'none', color:'var(--fs-text-1)', fontSize:12, outline:'none', colorScheme:'dark' }} value={startDate} onChange={e=>setStartDate(e.target.value)} />
          <span style={{ color:'var(--fs-text-4)' }}>→</span>
          <input type="date" style={{ background:'transparent', border:'none', color:'var(--fs-text-1)', fontSize:12, outline:'none', colorScheme:'dark' }} value={endDate} onChange={e=>setEndDate(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--fs-text-4)', fontSize:14 }}>Carregando lançamentos...</div>
      ) : (
        <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>
                <TH>Linha / Conta / Cliente</TH>
                <TH right>Valor</TH>
                <TH right>% Receita</TH>
                <TH right>Lançamentos</TH>
              </tr>
            </thead>
            <tbody>
              {DRE_LINES.map(line => {
                const lineValue = vMap[line.key] ?? 0
                const hierarchy = !line.isSubtotal ? buildHierarchy(line.tipos) : []
                const isExpLine = expanded[line.key]
                const hasData   = hierarchy.length > 0
                const isVisible = !line.isSubtotal || Math.abs(lineValue) > 0.001
                  || ['receita_liquida','lucro_bruto','ebitda','resultado_final'].includes(line.key)
                if (!isVisible) return null

                if (line.isSubtotal) {
                  return (
                    <tr key={line.key} style={{ background:'var(--fs-surface-2)', borderTop:'2px solid var(--fs-border)', borderBottom:'2px solid var(--fs-border)' }}>
                      <td style={{ padding:'13px 16px', fontWeight:800, color:line.color, fontSize:14 }}>{line.label}</td>
                      <td style={{ padding:'13px 16px', textAlign:'right', fontWeight:900, color: lineValue>=0 ? line.color : '#ef4444', fontSize:15 }}>{fmtBRL(lineValue)}</td>
                      <td style={{ padding:'13px 16px', textAlign:'right', color:'var(--fs-text-4)', fontWeight:600 }}>{pct(lineValue)}</td>
                      <td />
                    </tr>
                  )
                }

                const totalItems = hierarchy.reduce((a,c) => a + c.lancamentos.length, 0)
                return [
                  // ── Linha DRE ────────────────────────────────────────
                  <tr key={line.key}
                    style={{ borderTop:'1px solid var(--fs-border)', cursor: hasData?'pointer':'default' }}
                    onClick={() => hasData && toggle(line.key)}
                    onMouseEnter={e => { if (hasData) e.currentTarget.style.background='rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  >
                    <td style={{ padding:'12px 16px', fontWeight:700, color:'var(--fs-text-1)' }}>
                      <span style={{ marginRight:8, color: hasData ? line.color : 'var(--fs-text-4)', fontSize:11 }}>{hasData ? (isExpLine?'▼':'▶') : '  '}</span>
                      {line.label}
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'right', fontWeight:700, color: lineValue>=0 ? line.color : '#ef4444' }}>{fmtBRL(lineValue)}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', color:'var(--fs-text-4)' }}>{pct(lineValue)}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{totalItems > 0 ? totalItems : '—'}</td>
                  </tr>,

                  // ── Contas filhas ────────────────────────────────────
                  ...(isExpLine ? hierarchy.map(conta => {
                    const isExpConta = expanded[`${line.key}-${conta.contaId}`]
                    return [
                      <tr key={`${line.key}-${conta.contaId}`}
                        style={{ background:'rgba(255,255,255,0.02)', borderTop:'1px solid var(--fs-border)', cursor:'pointer' }}
                        onClick={() => toggle(`${line.key}-${conta.contaId}`)}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                      >
                        <td style={{ padding:'10px 16px 10px 36px', color:line.color, fontWeight:600 }}>
                          <span style={{ marginRight:8, fontSize:11, color:'var(--fs-text-4)' }}>{isExpConta?'▼':'▶'}</span>
                          {conta.nome}
                        </td>
                        <td style={{ padding:'10px 16px', textAlign:'right', fontWeight:700, color:'var(--fs-text-1)' }}>{fmtBRL(conta.total)}</td>
                        <td style={{ padding:'10px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{pct(conta.total)}</td>
                        <td style={{ padding:'10px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{conta.lancamentos.length}</td>
                      </tr>,

                      // ── Clientes/Categorias — CLICÁVEIS → MODAL ──────
                      ...(isExpConta ? conta.items.map((item, i) => (
                        <tr key={`${line.key}-${conta.contaId}-${i}`}
                          style={{ background:'var(--fs-bg)', borderTop:'1px solid rgba(var(--fs-border-rgb,55,65,81),0.5)', cursor:'pointer' }}
                          onClick={(e) => { e.stopPropagation(); setModal({ item, lancamentos: item.lancamentos }) }}
                          onMouseEnter={e => { e.currentTarget.style.background='rgba(59,130,246,0.06)'; e.currentTarget.querySelector('.drill-hint').style.opacity='1' }}
                          onMouseLeave={e => { e.currentTarget.style.background='var(--fs-bg)'; e.currentTarget.querySelector('.drill-hint').style.opacity='0' }}
                        >
                          <td style={{ padding:'8px 16px 8px 56px', color:'var(--fs-text-2)', display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {item.nome.substring(0, 60)}
                              {item.count > 1 && <span style={{ marginLeft:8, color:'var(--fs-text-4)', fontSize:11 }}>({item.count}×)</span>}
                            </span>
                            <span className="drill-hint" style={{ opacity:0, transition:'opacity 0.15s', fontSize:10, fontWeight:700, color:'#3b82f6', background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)', padding:'2px 7px', borderRadius:4, whiteSpace:'nowrap', flexShrink:0 }}>
                              ver detalhes →
                            </span>
                          </td>
                          <td style={{ padding:'8px 16px', textAlign:'right', color:'var(--fs-text-1)', fontWeight:600 }}>{fmtBRL(item.total)}</td>
                          <td style={{ padding:'8px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{pct(item.total)}</td>
                          <td style={{ padding:'8px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{item.count}</td>
                        </tr>
                      )) : [])
                    ]
                  }).flat() : [])
                ]
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:'var(--fs-bg)', borderTop:'2px solid var(--fs-border)' }}>
                <td style={{ padding:'10px 16px', color:'var(--fs-text-4)', fontSize:11 }}>
                  {data.length} lançamentos · {contas.length} contas · {periodoLabel}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
