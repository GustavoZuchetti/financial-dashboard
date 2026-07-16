'use client'
// ═══ EM ATRASO — títulos vencidos e não liquidados (a receber e a pagar) ═══
// Regra do Caixa Efetivo: vencidos NÃO compõem o fluxo/saldos — esta página é
// a área de consulta e ação sobre eles (aging, dias de atraso, baixa, export).
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { supabase, getSelectedEntidadeIds } from '@/lib/supabase'
import { diasEntre, AGING_FAIXAS, agingFaixa } from '@/lib/fluxo-status'
import { downloadWorkbook, exportFilename } from '@/lib/export-excel'
import SvgIcon from '@/components/SvgIcon'
import EmptyState from '@/components/EmptyState'

const fC = (v) => {
  const n = Number(v) || 0
  const abs = Math.abs(n)
  if (abs >= 1e6) return `R$ ${(n/1e6).toFixed(2)}M`
  if (abs >= 1e3) return `R$ ${(n/1e3).toFixed(1)}k`
  return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}
const fCFull = (v) => (Number(v)||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
const fData  = (iso) => iso ? iso.split('-').reverse().join('/') : ''

export default function AtrasadosPage() {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [tipoFiltro, setTipo]   = useState('todos') // todos | entrada | saida
  const [busca, setBusca]       = useState('')
  const [empIds, setEmpIds]     = useState([])
  const [empresasMap, setEmpresasMap] = useState({})
  const [toast, setToast]       = useState(null)
  const showToast = (m, t='success') => { setToast({ m, t }); setTimeout(() => setToast(null), 3500) }

  const hoje = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = await getSelectedEntidadeIds()
      setEmpIds(ids || [])
      if (!ids?.length) { setRows([]); return }

      if (ids.length > 1) {
        const { data: emps } = await supabase.from('empresas').select('id,nome').in('id', ids)
        setEmpresasMap(Object.fromEntries((emps||[]).map(e => [e.id, e.nome])))
      } else setEmpresasMap({})

      // Vencidos: aberto/parcial com vencimento < hoje (paginado)
      let all = [], pg = 0
      while (true) {
        let q = supabase.from('fluxo_caixa')
          .select('id,empresa_id,data,descricao,categoria,tipo,valor,status,valor_liquidado,data_liquidacao')
          .in('status', ['aberto','parcial'])
          .lt('data', hoje)
          .order('data', { ascending: true })
          .range(pg*1000, (pg+1)*1000-1)
        q = ids.length > 1 ? q.in('empresa_id', ids) : q.eq('empresa_id', ids[0])
        const { data: batch = [] } = await q
        if (!batch?.length) break
        all = all.concat(batch)
        if (batch.length < 1000) break
        pg++
      }
      // Valor em atraso = restante não liquidado (parcial desconta a parte paga)
      setRows(all.map(r => {
        const v   = Math.abs(Number(r.valor) || 0)
        const liq = Math.min(Math.abs(Number(r.valor_liquidado) || 0), v)
        return { ...r, restante: v - liq, dias: diasEntre(r.data, hoje) }
      }).filter(r => r.restante > 0))
    } finally { setLoading(false) }
  }, [hoje])

  useEffect(() => { load() }, [load])

  const handleBaixar = async (r) => {
    const { error } = await supabase.from('fluxo_caixa')
      .update({ status: 'pago', data_liquidacao: hoje, valor_liquidado: r.valor })
      .eq('id', r.id)
    if (error) { showToast('Erro ao baixar: ' + error.message, 'error'); return }
    showToast(`Título baixado: ${r.descricao || 'sem descrição'}`, 'success')
    load()
  }

  // ─── Filtros de tela ─────────────────────────────────────────────────────
  const termo = busca.trim().toLowerCase()
  const filtrados = rows.filter(r =>
    (tipoFiltro === 'todos' || r.tipo === tipoFiltro) &&
    (!termo || (r.descricao||'').toLowerCase().includes(termo) || (r.categoria||'').toLowerCase().includes(termo)))

  // ─── Agregados ───────────────────────────────────────────────────────────
  const aReceber = filtrados.filter(r => r.tipo === 'entrada')
  const aPagar   = filtrados.filter(r => r.tipo === 'saida')
  const totReceber = aReceber.reduce((a, r) => a + r.restante, 0)
  const totPagar   = aPagar.reduce((a, r) => a + r.restante, 0)

  // Aging por faixa × tipo (para o gráfico e a leitura executiva)
  const aging = AGING_FAIXAS.map(f => ({ faixa: f.label, receber: 0, pagar: 0 }))
  filtrados.forEach(r => {
    const ix = AGING_FAIXAS.findIndex(f => r.dias <= f.max)
    const alvo = aging[ix === -1 ? aging.length - 1 : ix]
    if (r.tipo === 'entrada') alvo.receber += r.restante
    else alvo.pagar += r.restante
  })

  // ─── Export ──────────────────────────────────────────────────────────────
  const handleExport = () => {
    const resumo = [['Indicador', 'Valor (R$)'],
      ['Total a Receber em Atraso', Number(totReceber.toFixed(2))],
      ['Total a Pagar em Atraso',   Number(totPagar.toFixed(2))],
      ['Exposição líquida (Receber − Pagar)', Number((totReceber - totPagar).toFixed(2))],
      [],
      ['Aging', 'A Receber (R$)', 'A Pagar (R$)'],
      ...aging.map(a => [a.faixa, Number(a.receber.toFixed(2)), Number(a.pagar.toFixed(2))]),
    ]
    const det = [['Vencimento', 'Dias em Atraso', 'Faixa', 'Descrição', 'Categoria', 'Tipo', 'Situação', 'Entidade', 'Valor em Atraso (R$)']]
    ;[...filtrados].sort((a,b) => b.dias - a.dias).forEach(r => det.push([
      r.data, r.dias, agingFaixa(r.dias), r.descricao || '', r.categoria || '',
      r.tipo === 'entrada' ? 'A Receber' : 'A Pagar',
      r.status === 'parcial' ? 'Parcial' : 'Em aberto',
      empresasMap[r.empresa_id] || '', Number(r.restante.toFixed(2)),
    ]))
    downloadWorkbook([
      { name: 'Resumo',    aoa: resumo, colWidths: [34, 18, 18], currencyCols: [1, 2] },
      { name: 'Detalhado', aoa: det,    colWidths: [12, 12, 12, 44, 24, 12, 12, 30, 18], currencyCols: [8] },
    ], exportFilename('Fluxo_Caixa_Em_Atraso', hoje, hoje))
    showToast(`${filtrados.length} títulos exportados`, 'success')
  }

  if (!loading && !empIds.length) return (
    <EmptyState icon="building" title="Nenhuma entidade selecionada">
      Selecione uma entidade no topo para consultar os títulos em atraso.
    </EmptyState>
  )

  const isConsol = empIds.length > 1

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {toast && (
        <div style={{ position:'fixed', top:18, right:18, zIndex:60, background: toast.t==='error' ? 'var(--fs-danger)' : 'var(--fs-success)', color:'#fff', padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600, boxShadow:'0 8px 24px rgba(0,0,0,0.35)' }}>
          {toast.m}
        </div>
      )}

      <div>
        <h1 style={{ fontSize:24, fontWeight:800, color:'var(--fs-text-1)', margin:0 }}>Em Atraso</h1>
        <p style={{ fontSize:12.5, color:'var(--fs-text-4)', margin:'4px 0 0' }}>
          Títulos vencidos e não liquidados — fora do fluxo de caixa até a baixa. Referência: hoje, {fData(hoje)}.
        </p>
      </div>

      {/* Cards executivos */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>
        {[
          ['A Receber em Atraso', totReceber, aReceber.length, 'var(--fs-warning, var(--fs-warning))'],
          ['A Pagar em Atraso',   totPagar,   aPagar.length,   'var(--fs-danger)'],
          ['Exposição Líquida',   totReceber - totPagar, null, (totReceber - totPagar) >= 0 ? 'var(--fs-success)' : 'var(--fs-danger)'],
        ].map(([rot, val, qtd, cor]) => (
          <div key={rot} style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:6 }}>{rot}</div>
            <div className="fs-num" style={{ fontSize:22, fontWeight:800, color:cor }}>{fCFull(val)}</div>
            {qtd !== null && <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:2 }}>{qtd} título{qtd === 1 ? '' : 's'}</div>}
          </div>
        ))}
      </div>

      {/* Aging */}
      <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'16px 18px' }}>
        <div style={{ fontSize:13, fontWeight:800, color:'var(--fs-text-1)', marginBottom:12 }}>Aging — valor em atraso por faixa de dias</div>
        <div style={{ width:'100%', height:220 }}>
          <ResponsiveContainer>
            <BarChart data={aging} margin={{ top:4, right:8, left:8, bottom:4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-border)" vertical={false} />
              <XAxis dataKey="faixa" tick={{ fontSize:11, fill:'var(--fs-text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fC} tick={{ fontSize:10, fill:'var(--fs-text-4)' }} axisLine={false} tickLine={false} width={64} />
              <Tooltip formatter={(v, n) => [fCFull(v), n === 'receber' ? 'A Receber' : 'A Pagar']}
                contentStyle={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:8, fontSize:12 }} />
              <Legend formatter={(v) => v === 'receber' ? 'A Receber' : 'A Pagar'} wrapperStyle={{ fontSize:12 }} />
              <Bar dataKey="receber" name="receber" fill="var(--fs-warning, var(--fs-warning))" radius={[4,4,0,0]} isAnimationActive={false} />
              <Bar dataKey="pagar"   name="pagar"   fill="var(--fs-danger)" radius={[4,4,0,0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filtros + export */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <select value={tipoFiltro} onChange={e => setTipo(e.target.value)}
          style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-2)', fontSize:12.5, padding:'8px 10px' }}>
          <option value="todos">A Receber + A Pagar</option>
          <option value="entrada">Somente a Receber</option>
          <option value="saida">Somente a Pagar</option>
        </select>
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por descrição ou categoria..."
            style={{ width:'100%', background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', fontSize:12.5, padding:'8px 12px' }} />
        </div>
        <button onClick={handleExport} disabled={loading || !filtrados.length}
          style={{ display:'flex', alignItems:'center', gap:7, background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-2)', fontSize:12.5, fontWeight:600, padding:'8px 14px', cursor:'pointer' }}>
          <SvgIcon name="download" size={14} color="var(--fs-text-3)" /> Exportar Excel
        </button>
      </div>

      {/* Tabela detalhada */}
      <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns: isConsol ? '90px 1fr 160px 110px 90px 110px 120px 80px' : '90px 1fr 180px 110px 90px 130px 80px', gap:10, padding:'10px 16px', borderBottom:'1px solid var(--fs-border)' }}>
          {(isConsol
            ? ['Vencimento','Descrição','Entidade','Categoria','Dias','Faixa','Valor em Atraso','']
            : ['Vencimento','Descrição','Categoria','Dias','Faixa','Valor em Atraso','']
          ).map((h,i) => (
            <div key={h+i} style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', textAlign: h==='Valor em Atraso' ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>
        {loading ? (
          <div style={{ padding:32, textAlign:'center', color:'var(--fs-text-4)', fontSize:13 }}>Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding:32, textAlign:'center', color:'var(--fs-text-4)', fontSize:13 }}>
            Nenhum título em atraso — caixa em dia. ✓
          </div>
        ) : [...filtrados].sort((a,b) => b.dias - a.dias).map(r => (
          <div key={r.id} style={{ display:'grid', gridTemplateColumns: isConsol ? '90px 1fr 160px 110px 90px 110px 120px 80px' : '90px 1fr 180px 110px 90px 130px 80px', gap:10, padding:'9px 16px', borderBottom:'1px solid var(--fs-border)', alignItems:'center' }}>
            <div className="fs-num" style={{ fontSize:12, color:'var(--fs-text-3)' }}>{fData(r.data)}</div>
            <div style={{ fontSize:12.5, color:'var(--fs-text-1)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              <span style={{ display:'inline-block', width:3, height:14, borderRadius:2, background: r.tipo==='entrada' ? 'var(--fs-warning, var(--fs-warning))' : 'var(--fs-danger)', marginRight:8, verticalAlign:'-2px' }} />
              {r.descricao || <span style={{ color:'var(--fs-text-4)', fontStyle:'italic' }}>sem descrição</span>}
              {r.status === 'parcial' && <span style={{ marginLeft:8, fontSize:10, color:'var(--fs-text-4)' }}>parcial — resta {fC(r.restante)}</span>}
            </div>
            {isConsol && <div style={{ fontSize:11.5, color:'var(--fs-text-4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{empresasMap[r.empresa_id] || '—'}</div>}
            <div style={{ fontSize:12, color:'var(--fs-text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.categoria || 'Sem categoria'}</div>
            <div className="fs-num" style={{ fontSize:12.5, fontWeight:800, color: r.dias > 60 ? 'var(--fs-danger)' : r.dias > 30 ? 'var(--fs-warning, var(--fs-warning))' : 'var(--fs-text-2)' }}>{r.dias}d</div>
            <div style={{ fontSize:11.5, color:'var(--fs-text-4)' }}>{agingFaixa(r.dias)}</div>
            <div className="fs-num" style={{ fontSize:12.5, fontWeight:800, textAlign:'right', color: r.tipo==='entrada' ? 'var(--fs-warning, var(--fs-warning))' : 'var(--fs-danger)' }}>{fCFull(r.restante)}</div>
            <div style={{ textAlign:'right' }}>
              <button onClick={() => handleBaixar(r)} title="Marcar como liquidado hoje (baixa integral)"
                style={{ background:'transparent', border:'1px solid var(--fs-border)', borderRadius:6, color:'var(--fs-text-3)', fontSize:11, fontWeight:600, padding:'4px 10px', cursor:'pointer' }}>
                Baixar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
