'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { calcDRE, calcDREMap, DRE_LINES, fmtBRL } from '@/lib/dre-calc'

// ─── Modal de Drill-down ──────────────────────────────────────────────────────
function DrillModal({ item, lancamentos, clientes, onClose, periodo }) {
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
  const [clienteSel, setClienteSel] = useState(null) // drill dentro do modal: cliente selecionado

  // Se temos clientes, mostrar lista de clientes; se selecionou um cliente, mostrar lançamentos
  const clienteAtual = clienteSel ? (clientes || []).find(cl => cl.nome === clienteSel) : null
  const lancAtual = clienteAtual ? clienteAtual.lancamentos : (clientes ? [] : lancamentos)

  // Agrupar por mês para lançamentos individuais
  const byMonth = {}
  lancAtual.forEach(l => {
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
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:4 }}>
              {clienteSel
                ? <span style={{ cursor:'pointer', display:'flex', alignItems:'center', gap:6 }} onClick={() => setClienteSel(null)}>
                    <span style={{ color:'#3b82f6' }}>← {item.nome}</span>
                    <span style={{ color:'var(--fs-text-4)' }}>· {periodo}</span>
                  </span>
                : `Detalhamento · ${periodo}`
              }
            </div>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--fs-text-1)', marginBottom:4 }}>
              {clienteSel || item.nome}
            </div>
            <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:22, fontWeight:900, color:'#3b82f6' }}>{fmtBRL(clienteSel ? clienteAtual?.total || 0 : total)}</span>
              {clientes && !clienteSel
                ? <span style={{ fontSize:12, color:'var(--fs-text-4)' }}>{clientes.length} conta{clientes.length !== 1 ? 's' : ''} · {lancamentos.length} lançamentos</span>
                : <><span style={{ fontSize:12, color:'var(--fs-text-4)' }}>{lancAtual.length} lançamento{lancAtual.length !== 1 ? 's' : ''}</span>
                    {multiMes && <span style={{ fontSize:12, color:'var(--fs-text-4)' }}>· {meses.length} meses</span>}
                  </>
              }
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
          {clientes && !clienteSel ? (
            // LISTA DE CLIENTES: clicar em um cliente entra no drill de lançamentos
            clientes.map((cli, i) => (
              <div key={cli.nome}
                style={{ display:'grid', gridTemplateColumns:'1fr 130px 80px', gap:12, padding:'13px 24px', borderBottom: i < clientes.length-1 ? '1px solid var(--fs-border)' : 'none', alignItems:'center', cursor:'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(59,130,246,0.05)'; e.currentTarget.querySelector('.cli-hint').style.opacity='1' }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.querySelector('.cli-hint').style.opacity='0' }}
                onClick={() => setClienteSel(cli.nome)}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'#3b82f6', flexShrink:0 }} />
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--fs-text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cli.nome}</span>
                  <span style={{ fontSize:11, color:'var(--fs-text-4)', flexShrink:0 }}>{cli.count}×</span>
                  <span className="cli-hint" style={{ opacity:0, transition:'opacity 0.15s', fontSize:10, fontWeight:700, color:'#3b82f6', background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)', padding:'2px 7px', borderRadius:4, whiteSpace:'nowrap', flexShrink:0 }}>ver →</span>
                </div>
                <div style={{ textAlign:'right', fontSize:14, fontWeight:700, color:'var(--fs-text-1)', fontVariantNumeric:'tabular-nums' }}>{fmtBRL(cli.total)}</div>
                <div style={{ textAlign:'right', fontSize:11, color:'var(--fs-text-4)' }}>
                  {total > 0 ? (Math.abs(cli.total) / Math.abs(total) * 100).toFixed(1) + '%' : '—'}
                </div>
              </div>
            ))
          ) : (
            // LANÇAMENTOS: agrupados por mês quando período > 1 mês
            multiMes ? (
              meses.map(([key, mes]) => (
                <div key={key}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 24px 8px', background:'var(--fs-bg)', borderBottom:'1px solid var(--fs-border)', position:'sticky', top:0, zIndex:1 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:'var(--fs-text-2)', letterSpacing:'0.3px' }}>{mes.label}</span>
                    <div style={{ display:'flex', gap:12, fontSize:12 }}>
                      <span style={{ color:'var(--fs-text-4)' }}>{mes.items.length} lançamento{mes.items.length !== 1 ? 's' : ''}</span>
                      <span style={{ fontWeight:700, color:'#3b82f6' }}>{fmtBRL(mes.total)}</span>
                    </div>
                  </div>
                  {mes.items.map((l, i) => (
                    <LancRow key={l.id || i} l={l} isLast={i === mes.items.length - 1} />
                  ))}
                </div>
              ))
            ) : (
              lancAtual.map((l, i) => (
                <LancRow key={l.id || i} l={l} isLast={i === lancAtual.length - 1} />
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--fs-border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--fs-bg)', borderRadius:'0 0 16px 16px' }}>
          <span style={{ fontSize:12, color:'var(--fs-text-4)' }}>
            {clientes && !clienteSel
              ? `${clientes.length} contas · ${lancamentos.length} lançamentos`
              : `${lancAtual.length} lançamento${lancAtual.length !== 1 ? 's' : ''}`}
          </span>
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

  // Hierarquia: Categoria → Clientes (descricao)
  const buildHierarchy = (tipos) => {
    const relevant = (data || []).filter(l => tipos.includes(l.tipo))
    const byCat = {}
    relevant.forEach(l => {
      const cat = (l.categoria || 'Sem categoria').trim()
      if (!byCat[cat]) byCat[cat] = { nome: cat, clientes: {}, total: 0, lancamentos: [] }
      byCat[cat].total += Number(l.valor)
      byCat[cat].lancamentos.push(l)

      const cli = (l.descricao || l.categoria || '—').trim()
      if (!byCat[cat].clientes[cli]) byCat[cat].clientes[cli] = { nome: cli, total: 0, count: 0, lancamentos: [] }
      byCat[cat].clientes[cli].total += Number(l.valor)
      byCat[cat].clientes[cli].count++
      byCat[cat].clientes[cli].lancamentos.push(l)
    })
    return Object.values(byCat)
      .map(c => ({ ...c, clientes: Object.values(c.clientes).sort((a,b) => b.total - a.total) }))
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
          clientes={modal.clientes}
          periodo={periodoLabel}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 }}>Demonstrativos · Drill-down</div>
          <h1 style={{ fontSize:26, fontWeight:900, color:'var(--fs-text-1)', margin:0 }}>DRE Detalhado</h1>
          <p style={{ color:'var(--fs-text-4)', fontSize:12, margin:'3px 0 0' }}>Clique em qualquer linha ou conta para ver os lançamentos individuais</p>
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

                const totalLanc = hierarchy.reduce((a,c) => a + c.lancamentos.length, 0)
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
                    <td style={{ padding:'12px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{totalLanc > 0 ? totalLanc : '—'}</td>
                  </tr>,

                  // ── Categorias filhas (nível 2) ──────────────────────
                  ...(isExpLine ? hierarchy.map(cat => (
                    <tr key={`${line.key}-${cat.nome}`}
                      style={{ background:'rgba(255,255,255,0.02)', borderTop:'1px solid var(--fs-border)', cursor:'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setModal({ item: cat, lancamentos: cat.lancamentos, clientes: cat.clientes }) }}
                      onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.querySelector('.cat-hint').style.opacity='1' }}
                      onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.02)'; e.currentTarget.querySelector('.cat-hint').style.opacity='0' }}
                    >
                      <td style={{ padding:'11px 16px 11px 36px', display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ color:line.color, fontWeight:700, fontSize:13 }}>{cat.nome}</span>
                        <span style={{ fontSize:11, color:'var(--fs-text-4)' }}>{cat.clientes.length} conta{cat.clientes.length !== 1 ? 's' : ''}</span>
                        <span className="cat-hint" style={{ opacity:0, transition:'opacity 0.15s', fontSize:10, fontWeight:700, color:'#3b82f6', background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)', padding:'2px 8px', borderRadius:4, whiteSpace:'nowrap' }}>
                          ver contas →
                        </span>
                      </td>
                      <td style={{ padding:'11px 16px', textAlign:'right', fontWeight:700, color:'var(--fs-text-1)' }}>{fmtBRL(cat.total)}</td>
                      <td style={{ padding:'11px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{pct(cat.total)}</td>
                      <td style={{ padding:'11px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{cat.lancamentos.length}</td>
                    </tr>
                  )) : [])
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
