'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { calcDRE, calcDREMap, DRE_LINES, fmtBRL } from '@/lib/dre-calc'

export default function DREDetalhado() {
  const [startDate, setStartDate] = useState(() => new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0])
  const [endDate,   setEndDate]   = useState(new Date().toISOString().split('T')[0])
  const [empresaId, setEmpresaId] = useState(null)
  const [isConsol,  setIsConsol]  = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [data,      setData]      = useState([])
  const [contas,    setContas]    = useState([])
  const [expanded,  setExpanded]  = useState({})

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
      // Carregar plano_contas para exibição dos nomes
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

  // ─── Calcular valores DRE (idêntico à Visão Geral) ────────────────
  const v    = calcDRE(data)
  const vMap = calcDREMap(data)

  // ─── Construir hierarquia de lançamentos por linha DRE ────────────
  const buildHierarchy = (tipos) => {
    const relevant = (data || []).filter(l => tipos.includes(l.tipo))
    const byAccount = {}
    relevant.forEach(l => {
      const contaId = l.conta_id || '__sem_conta__'
      if (!byAccount[contaId]) {
        const conta = contas.find(c => c.id === contaId)
        byAccount[contaId] = {
          contaId, nome: conta ? `${conta.codigo} ${conta.nome}` : '— Sem conta mapeada',
          items: [], total: 0
        }
      }
      byAccount[contaId].items.push(l)
      byAccount[contaId].total += Number(l.valor)
    })
    return Object.values(byAccount)
      .map(a => ({ ...a, items: Object.values(
        a.items.reduce((acc, l) => {
          const k = (l.descricao || l.categoria || '—').trim()
          if (!acc[k]) acc[k] = { nome: k, total: 0, count: 0, data: l.data }
          acc[k].total += Number(l.valor); acc[k].count++; return acc
        }, {})
      ).sort((a,b) => b.total - a.total)}))
      .sort((a, b) => b.total - a.total)
  }

  // ─── Percentual sobre Receita Bruta ──────────────────────────────
  const pct = (val) => v.rb > 0 ? (Math.abs(val) / v.rb * 100).toFixed(1) + '%' : '—'

  const TH = ({ children, right }) => (
    <th style={{ padding:'8px 12px', textAlign: right?'right':'left', color:'var(--fs-text-4)', fontSize:11, fontWeight:700, textTransform:'uppercase', borderBottom:'1px solid var(--fs-border)', whiteSpace:'nowrap' }}>
      {children}
    </th>
  )

  return (
    <div style={{ color:'var(--fs-text-1)' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--fs-text-1)', margin:0 }}>DRE Detalhado</h1>
          <p style={{ color:'var(--fs-text-4)', fontSize:13, margin:'3px 0 0' }}>Drill-down por conta contábil • Números idênticos à Visão Geral</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', background:'var(--fs-surface)', padding:'7px 14px', borderRadius:8, border:'1px solid var(--fs-border)' }}>
          <span style={{ fontSize:12, color:'var(--fs-text-4)' }}>Período:</span>
          <input type="date" style={{ background:'var(--fs-input-bg)',border:'1px solid var(--fs-input-border)',borderRadius:6,color:'var(--fs-text-1)',padding:'5px 8px',fontSize:12,outline:'none' }} value={startDate} onChange={e=>setStartDate(e.target.value)} />
          <span style={{ color:'var(--fs-text-4)' }}>→</span>
          <input type="date" style={{ background:'var(--fs-input-bg)',border:'1px solid var(--fs-input-border)',borderRadius:6,color:'var(--fs-text-1)',padding:'5px 8px',fontSize:12,outline:'none' }} value={endDate} onChange={e=>setEndDate(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--fs-text-4)' }}>Carregando...</div>
      ) : (
        <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead style={{ background:'var(--fs-bg)' }}>
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

                // Subtotais não tem filhos
                if (line.isSubtotal) {
                  return (
                    <tr key={line.key} style={{ background:'var(--fs-surface-2)', borderTop:'2px solid var(--fs-border)', borderBottom:'2px solid var(--fs-border)' }}>
                      <td style={{ padding:'12px 16px', fontWeight:800, color:line.color, fontSize:14 }}>{line.label}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', fontWeight:900, color: lineValue>=0 ? line.color : '#ef4444', fontSize:15 }}>{fmtBRL(lineValue)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', color:'var(--fs-text-4)', fontWeight:600 }}>{pct(lineValue)}</td>
                      <td />
                    </tr>
                  )
                }

                const totalItems = hierarchy.reduce((a,c) => a + c.items.length, 0)
                return [
                  // ── Linha DRE ───────────────────────────────────────
                  <tr key={line.key} style={{ borderTop:'1px solid var(--fs-border)', cursor: hasData?'pointer':'default', background:'transparent' }}
                    onClick={() => hasData && toggle(line.key)}>
                    <td style={{ padding:'11px 16px', fontWeight:700, color:'var(--fs-text-1)' }}>
                      <span style={{ marginRight:8, color: hasData ? line.color : 'var(--fs-text-4)', fontSize:12 }}>{hasData ? (isExpLine?'▼':'▶') : '  '}</span>
                      {line.label}
                    </td>
                    <td style={{ padding:'11px 16px', textAlign:'right', fontWeight:700, color: lineValue>=0 ? line.color : '#ef4444' }}>{fmtBRL(lineValue)}</td>
                    <td style={{ padding:'11px 16px', textAlign:'right', color:'var(--fs-text-4)' }}>{pct(lineValue)}</td>
                    <td style={{ padding:'11px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{totalItems > 0 ? `${totalItems}` : '—'}</td>
                  </tr>,

                  // ── Contas filhas ─────────────────────────────────
                  ...(isExpLine ? hierarchy.map(conta => {
                    const isExpConta = expanded[`${line.key}-${conta.contaId}`]
                    return [
                      <tr key={`${line.key}-${conta.contaId}`}
                        style={{ background:'var(--fs-surface-2)', borderTop:'1px solid var(--fs-border)', cursor:'pointer' }}
                        onClick={() => toggle(`${line.key}-${conta.contaId}`)}>
                        <td style={{ padding:'9px 16px 9px 36px', color: line.color, fontWeight:600 }}>
                          <span style={{ marginRight:8, fontSize:11, color:'var(--fs-text-4)' }}>{isExpConta?'▼':'▶'}</span>
                          {conta.nome}
                        </td>
                        <td style={{ padding:'9px 16px', textAlign:'right', fontWeight:700, color:'var(--fs-text-1)' }}>{fmtBRL(conta.total)}</td>
                        <td style={{ padding:'9px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{pct(conta.total)}</td>
                        <td style={{ padding:'9px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{conta.items.length}</td>
                      </tr>,

                      // ── Clientes/Categorias filhas ──────────────
                      ...(isExpConta ? conta.items.map((item, i) => (
                        <tr key={`${line.key}-${conta.contaId}-${i}`}
                          style={{ background:'var(--fs-bg)', borderTop:'1px solid var(--fs-border)' }}>
                          <td style={{ padding:'7px 16px 7px 56px', color:'var(--fs-text-2)' }}>
                            {item.nome.substring(0, 50)}
                            {item.count > 1 && <span style={{ marginLeft:8, color:'var(--fs-text-4)', fontSize:11 }}>({item.count}×)</span>}
                          </td>
                          <td style={{ padding:'7px 16px', textAlign:'right', color:'var(--fs-text-1)', fontWeight:500 }}>{fmtBRL(item.total)}</td>
                          <td style={{ padding:'7px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{pct(item.total)}</td>
                          <td style={{ padding:'7px 16px', textAlign:'right', color:'var(--fs-text-4)', fontSize:11 }}>{item.count}</td>
                        </tr>
                      )) : [])
                    ]
                  }).flat() : [])
                ]
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:'var(--fs-surface-3)', borderTop:'2px solid var(--fs-border)' }}>
                <td style={{ padding:'10px 16px', color:'var(--fs-text-4)', fontSize:11 }}>
                  {data.length} lançamentos • {contas.length} contas
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
