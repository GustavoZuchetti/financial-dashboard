'use client'
import { useState, useEffect, useCallback } from 'react'
import EmptyState from '@/components/EmptyState'
import { supabase, getSelectedEntidadeIds } from '@/lib/supabase'
import SvgIcon from '@/components/SvgIcon'
import { getStatusInfo, efeitosCaixa, dataEfetiva } from '@/lib/fluxo-status'
import { useOrg } from '@/lib/org-context'
import { downloadWorkbook, exportFilename } from '@/lib/export-excel'

// ─── Formatadores ─────────────────────────────────────────────────────────────
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const fC = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '—'
  const n = Number(v), a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a >= 1e6) return `${s}R$\u00a0${(a/1e6).toFixed(2)}M`
  if (a >= 1e3) return `${s}R$\u00a0${(a/1e3).toFixed(1)}k`
  return `${s}R$\u00a0${a.toFixed(0)}`
}
const fCFull = (v) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(v)||0)
const fDateBR = (iso) => {
  if (!iso) return '—'
  const [y,m,d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const pad2 = (n) => String(n).padStart(2,'0')

// ─── Componentes utilitários ──────────────────────────────────────────────────
const Badge = ({ tipo }) => {
  const map = {
    entrada:            { label:'Entrada',        bg:'rgba(34,197,94,0.12)',   color:'#22c55e' },
    saida:              { label:'Saída',           bg:'rgba(239,68,68,0.12)',   color:'#ef4444' },
    receita:            { label:'Receita',         bg:'rgba(34,197,94,0.12)',   color:'#22c55e' },
    despesa:            { label:'Despesa',         bg:'rgba(239,68,68,0.12)',   color:'#ef4444' },
    custo:              { label:'Custo',           bg:'rgba(245,158,11,0.12)',  color:'#f59e0b' },
    receita_financeira: { label:'Rec. Financeira', bg:'rgba(20,184,166,0.12)',  color:'#14b8a6' },
    despesa_financeira: { label:'Desp. Financeira',bg:'rgba(139,92,246,0.12)', color:'#8b5cf6' },
  }
  const s = map[tipo] || { label: tipo, bg:'rgba(100,116,139,0.12)', color:'#64748b' }
  return (
    <span style={{ background:s.bg, color:s.color, fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:5, whiteSpace:'nowrap' }}>
      {s.label}
    </span>
  )
}

const Toast = ({ msg, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const bg = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:1000, background:bg, color:'#fff', borderRadius:10, padding:'12px 20px', fontSize:13, fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,0.4)', display:'flex', alignItems:'center', gap:10, maxWidth:360 }}>
      <span>{msg}</span>
      <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#fff', cursor:'pointer', fontSize:16, lineHeight:1, padding:0, marginLeft:4 }}>✕</button>
    </div>
  )
}

// ─── Modal de confirmação de exclusão ─────────────────────────────────────────
const ConfirmModal = ({ item, onConfirm, onCancel, loading }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
    <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:14, padding:28, maxWidth:420, width:'100%', boxShadow:'0 8px 40px rgba(0,0,0,0.5)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:'rgba(239,68,68,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </div>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:'var(--fs-text-1)' }}>Confirmar exclusão</div>
          <div style={{ fontSize:12, color:'var(--fs-text-4)', marginTop:2 }}>Esta ação não pode ser desfeita</div>
        </div>
      </div>

      <div style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, padding:'12px 14px', marginBottom:20, fontSize:13 }}>
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'6px 12px' }}>
          <span style={{ color:'var(--fs-text-4)' }}>Data</span>
          <span style={{ color:'var(--fs-text-1)', fontWeight:600 }}>{fDateBR(item?.data)}</span>
          <span style={{ color:'var(--fs-text-4)' }}>Descrição</span>
          <span style={{ color:'var(--fs-text-1)', fontWeight:600 }}>{item?.descricao || '—'}</span>
          <span style={{ color:'var(--fs-text-4)' }}>Valor</span>
          <span style={{ color:'var(--fs-text-1)', fontWeight:600 }}>{fCFull(item?.valor)}</span>
          <span style={{ color:'var(--fs-text-4)' }}>Tipo</span>
          <span><Badge tipo={item?.tipo} /></span>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onCancel} disabled={loading} style={{ padding:'9px 20px', borderRadius:8, border:'1px solid var(--fs-border)', background:'transparent', color:'var(--fs-text-2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          Cancelar
        </button>
        <button onClick={onConfirm} disabled={loading} style={{ padding:'9px 20px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', fontSize:13, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display:'flex', alignItems:'center', gap:6 }}>
          {loading ? 'Excluindo...' : 'Excluir registro'}
        </button>
      </div>
    </div>
  </div>
)

// ─── Modal exclusão em lote ───────────────────────────────────────────────────
const BulkModal = ({ count, periodo, onConfirm, onCancel, loading }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
    <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:14, padding:28, maxWidth:440, width:'100%', boxShadow:'0 8px 40px rgba(0,0,0,0.5)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:'rgba(239,68,68,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </div>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:'var(--fs-text-1)' }}>Excluir em lote</div>
          <div style={{ fontSize:12, color:'var(--fs-text-4)', marginTop:2 }}>Operação irreversível</div>
        </div>
      </div>

      <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'12px 14px', marginBottom:20 }}>
        <div style={{ fontSize:13, color:'var(--fs-text-1)' }}>
          Você está prestes a excluir <strong style={{ color:'#ef4444' }}>{count} registro{count !== 1 ? 's' : ''}</strong> do período{' '}
          <strong style={{ color:'var(--fs-text-1)' }}>{periodo}</strong>.
        </div>
        <div style={{ fontSize:12, color:'var(--fs-text-4)', marginTop:6 }}>
          Esta ação não pode ser desfeita. Os dados serão permanentemente removidos do banco.
        </div>
      </div>

      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onCancel} disabled={loading} style={{ padding:'9px 20px', borderRadius:8, border:'1px solid var(--fs-border)', background:'transparent', color:'var(--fs-text-2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          Cancelar
        </button>
        <button onClick={onConfirm} disabled={loading} style={{ padding:'9px 20px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', fontSize:13, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Excluindo...' : `Excluir ${count} registro${count !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function GestaoFluxoCaixaPage() {
  const { profile, isSuperAdmin, loading: orgLoading } = useOrg()

  // Verificar se é admin (super_admin ou org_admin)
  const isAdmin = isSuperAdmin || profile?.role === 'org_admin'

  const now      = new Date()
  const curYear  = now.getFullYear()
  const today    = now.toISOString().split('T')[0]

  const [loading,    setLoading]    = useState(true)
  const [delLoading, setDelLoading] = useState(false)
  const [empresaId,  setEmpresaId]  = useState(null)
  const [empNome,    setEmpNome]    = useState('')
  const [isConsol,   setIsConsol]   = useState(false)

  const [registros,  setRegistros]  = useState([])
  const [total,      setTotal]      = useState(0)

  // Filtros
  // Padrão: últimos 30 dias — o seletor nasce dizendo o que a tela mostra
  const [startDate,  setStartDate]  = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const [endDate,    setEndDate]    = useState(today)
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [statusFiltro, setStatusFiltro] = useState('todos') // todos|abertos|vencidos|pagos
  const [busca,      setBusca]      = useState('')
  const [page,       setPage]       = useState(0)
  const PAGE_SIZE = 50

  // Seleção múltipla
  const [selected,   setSelected]   = useState(new Set())

  // Saldo inicial
  const [saldoInicial,    setSaldoInicial]    = useState('')
  const [saldoInicialDB,  setSaldoInicialDB]  = useState(0)
  const [editSaldo,       setEditSaldo]       = useState(false)

  // Totais globais (sem filtro de período)
  const [totalGlobalE,    setTotalGlobalE]    = useState(0)
  const [totalGlobalS,    setTotalGlobalS]    = useState(0)
  const [totalPeriodo,    setTotalPeriodo]    = useState(0)  // registros no período (todos, não só a página)
  const [saldoAnterior,   setSaldoAnterior]   = useState(0)  // saldo de partida (antes do período)
  const [indicadores,     setIndicadores]     = useState({ recebido:0, aReceber:0, atrasoReceber:0, pago:0, aPagar:0, atrasoPagar:0 })

  // Modal edição
  const [editItem,     setEditItem]     = useState(null)   // registro sendo editado
  const [editForm,     setEditForm]     = useState({})
  const [editLoading,  setEditLoading]  = useState(false)

  // Modal novo lançamento
  const [novoModal,    setNovoModal]    = useState(false)
  const [novoForm,     setNovoForm]     = useState({ data: today, descricao:'', tipo:'saida', valor:'', categoria:'' })
  const [novoLoading,  setNovoLoading]  = useState(false)

  // Modais
  const [delItem,    setDelItem]    = useState(null)
  const [bulkModal,  setBulkModal]  = useState(false)
  const [toast,      setToast]      = useState(null)

  const showToast = (msg, type = 'info') => setToast({ msg, type })

  useEffect(() => {
    const id = localStorage.getItem('empresa_id') || ''
    setEmpresaId(id); setIsConsol(id === 'todas')
    const h = () => { const nid = localStorage.getItem('empresa_id')||''; setEmpresaId(nid); setIsConsol(nid==='todas') }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const load = useCallback(async () => {
    if (!empresaId) { setLoading(false); return }
    setLoading(true)
    try {
      let empIds = await getSelectedEntidadeIds()
      if (isConsol || empIds.length > 1) {
        setEmpNome('')
      } else if (empIds.length === 1) {
        const { data: e } = await supabase.from('empresas').select('nome').eq('id', empIds[0]).single()
        setEmpNome(e?.nome || '')
      }
      if (!empIds.length) { setLoading(false); return }

      let q = supabase
        .from('fluxo_caixa')
        .select('id,data,descricao,tipo,valor,categoria,created_at,status,data_liquidacao,valor_liquidado', { count:'exact' })
        .gte('data', startDate)
        .lte('data', endDate)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })

      q = isConsol ? q.in('empresa_id', empIds) : q.eq('empresa_id', empIds[0])

      if (tipoFiltro !== 'todos') q = q.eq('tipo', tipoFiltro)
      const hoje = new Date().toISOString().split('T')[0]
      if (statusFiltro === 'abertos')  q = q.in('status', ['aberto','parcial'])
      if (statusFiltro === 'vencidos') q = q.in('status', ['aberto','parcial']).lt('data', hoje)
      if (statusFiltro === 'pagos')    q = q.eq('status', 'pago')

      const { data, count, error } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (error) throw error

      setRegistros(data || [])
      setTotal(count || 0)
      setSelected(new Set())

      // Totais globais — paginação completa para passar do limite de 1000 do Supabase
      // Totais do PERÍODO (todos os registros filtrados, não só a página) —
      // acompanham período, tipo, situação e busca
      const hojeP = new Date().toISOString().split('T')[0]
      let gEntradas = 0, gSaidas = 0, gCount = 0, gPage = 0, gDone = false
      const ind = { recebido:0, aReceber:0, atrasoReceber:0, pago:0, aPagar:0, atrasoPagar:0 }
      while (!gDone) {
        let qP = supabase.from('fluxo_caixa').select('tipo,valor,descricao,categoria,status,data,valor_liquidado')
          .gte('data', startDate).lte('data', endDate)
          .range(gPage * 1000, (gPage + 1) * 1000 - 1)
        qP = isConsol ? qP.in('empresa_id', empIds) : qP.eq('empresa_id', empIds[0])
        if (tipoFiltro !== 'todos') qP = qP.eq('tipo', tipoFiltro)
        if (statusFiltro === 'abertos')  qP = qP.in('status', ['aberto','parcial'])
        if (statusFiltro === 'vencidos') qP = qP.in('status', ['aberto','parcial']).lt('data', hojeP)
        if (statusFiltro === 'pagos')    qP = qP.eq('status', 'pago')
        const { data: pBatch = [] } = await qP
        if (!pBatch || pBatch.length === 0) break
        const termo = busca.trim().toLowerCase()
        pBatch.forEach(r => {
          if (termo && !((r.descricao||'').toLowerCase().includes(termo) || (r.categoria||'').toLowerCase().includes(termo))) return
          gCount++
          const v = Number(r.valor) || 0
          const liq = Number(r.valor_liquidado) || 0
          const st = r.status || 'aberto'
          const vencido = ['aberto','parcial'].includes(st) && r.data < hojeP
          if (r.tipo === 'entrada') {
            gEntradas += v
            if (st === 'pago') ind.recebido += v
            else if (st === 'parcial') { ind.recebido += liq; ind.aReceber += (v - liq); if (vencido) ind.atrasoReceber += (v - liq) }
            else if (st === 'aberto') { ind.aReceber += v; if (vencido) ind.atrasoReceber += v }
          } else {
            gSaidas += v
            if (st === 'pago') ind.pago += v
            else if (st === 'parcial') { ind.pago += liq; ind.aPagar += (v - liq); if (vencido) ind.atrasoPagar += (v - liq) }
            else if (st === 'aberto') { ind.aPagar += v; if (vencido) ind.atrasoPagar += v }
          }
        })
        if (pBatch.length < 1000) gDone = true
        gPage++
      }
      setTotalGlobalE(gEntradas)
      setTotalGlobalS(gSaidas)
      setTotalPeriodo(gCount)
      setIndicadores(ind)

      // Saldo de PARTIDA do período em CAIXA EFETIVO: efeitos (liquidações e
      // vencimentos futuros — na prática só liquidações) anteriores ao início.
      // Busca por venc OU liquidação antes do início e filtra pelos efeitos.
      let base = 0, aPage = 0, aDone = false
      while (!aDone) {
        let qA = supabase.from('fluxo_caixa')
          .select('tipo,valor,data,status,valor_liquidado,data_liquidacao')
          .or(`data.lt.${startDate},data_liquidacao.lt.${startDate}`)
          .range(aPage * 1000, (aPage + 1) * 1000 - 1)
        qA = isConsol ? qA.in('empresa_id', empIds) : qA.eq('empresa_id', empIds[0])
        const { data: aBatch = [] } = await qA
        if (!aBatch || aBatch.length === 0) break
        aBatch.forEach(r => {
          efeitosCaixa(r).filter(e => e.data < startDate).forEach(e => {
            base += r.tipo === 'entrada' ? e.valor : -e.valor
          })
        })
        if (aBatch.length < 1000) aDone = true
        aPage++
      }
      setSaldoAnterior(base)

      // Saldo inicial configurado
      const { data: cfg } = await supabase.from('empresa_config')
        .select('valor').eq('empresa_id', empIds[0]).eq('chave', 'saldo_inicial').single()
      setSaldoInicialDB(Number(cfg?.valor || 0))
      setSaldoInicial(cfg?.valor || '')

    } catch(e) { console.error('GestaoFluxo:', e); showToast('Erro ao carregar dados', 'error') }
    finally { setLoading(false) }
  }, [empresaId, isConsol, startDate, endDate, tipoFiltro, statusFiltro, busca, page])

  useEffect(() => { if (empresaId !== null) load() }, [load, empresaId])

  // ─── Excluir registro único ─────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!delItem) return
    setDelLoading(true)
    try {
      const { error } = await supabase.from('fluxo_caixa').delete().eq('id', delItem.id)
      if (error) throw error
      showToast('Registro excluído com sucesso', 'success')
      setDelItem(null)
      load()
    } catch(e) {
      showToast('Erro ao excluir: ' + e.message, 'error')
    } finally { setDelLoading(false) }
  }

  // ─── Excluir selecionados ───────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    setDelLoading(true)
    try {
      const ids = [...selected]
      const { error } = await supabase.from('fluxo_caixa').delete().in('id', ids)
      if (error) throw error
      showToast(`${ids.length} registro${ids.length > 1 ? 's excluídos' : ' excluído'} com sucesso`, 'success')
      setBulkModal(false)
      setSelected(new Set())
      load()
    } catch(e) {
      showToast('Erro ao excluir: ' + e.message, 'error')
    } finally { setDelLoading(false) }
  }

  // ─── Baixa rápida: marcar título como liquidado hoje ───────────────────────
  const handleBaixar = async (r) => {
    const hoje = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('fluxo_caixa')
      .update({ status: 'pago', data_liquidacao: hoje, valor_liquidado: r.valor })
      .eq('id', r.id)
    if (error) { showToast('Erro ao baixar: ' + error.message, 'error'); return }
    showToast(`Título baixado: ${r.descricao || 'sem descrição'}`, 'success')
    load()
  }

  // ─── Exportação Excel ───────────────────────────────────────────────────────
  const [exportLoading, setExportLoading] = useState(false)
  const handleExport = async () => {
    setExportLoading(true)
    try {
      const empIds = await getSelectedEntidadeIds()
      if (!empIds.length) return

      // Busca completa (paginada) com os MESMOS filtros da tela — não apenas a página atual
      let rows = [], pg = 0, done = false
      while (!done) {
        let q = supabase.from('fluxo_caixa')
          .select('data,descricao,categoria,tipo,valor,status,data_liquidacao,valor_liquidado')
          .gte('data', startDate).lte('data', endDate)
          .order('data', { ascending: true })
          .order('created_at', { ascending: true })
          .range(pg * 1000, (pg + 1) * 1000 - 1)
        q = isConsol ? q.in('empresa_id', empIds) : q.eq('empresa_id', empIds[0])
        if (tipoFiltro !== 'todos') q = q.eq('tipo', tipoFiltro)
        const hojeX = new Date().toISOString().split('T')[0]
        if (statusFiltro === 'abertos')  q = q.in('status', ['aberto','parcial'])
        if (statusFiltro === 'vencidos') q = q.in('status', ['aberto','parcial']).lt('data', hojeX)
        if (statusFiltro === 'pagos')    q = q.eq('status', 'pago')
        const { data: batch, error } = await q
        if (error) throw error
        rows = rows.concat(batch || [])
        if (!batch || batch.length < 1000) done = true
        pg++
      }
      // Filtro de busca textual (aplicado client-side, como na tela)
      const termo = busca.trim().toLowerCase()
      if (termo) rows = rows.filter(r =>
        (r.descricao || '').toLowerCase().includes(termo) || (r.categoria || '').toLowerCase().includes(termo))

      // Aba 1 — Resumo
      const entradas = rows.filter(r => r.tipo === 'entrada').reduce((a, r) => a + Number(r.valor), 0)
      const saidas   = rows.filter(r => r.tipo === 'saida').reduce((a, r) => a + Number(r.valor), 0)
      const resumoAoa = [
        ['Extrato — Fluxo de Caixa', ''],
        ['Entidade', empNome || 'Consolidado'],
        ['Período', `${startDate} a ${endDate}`],
        ['Filtro de tipo', tipoFiltro === 'todos' ? 'Todos' : tipoFiltro],
        ['Registros exportados', rows.length],
        ['', ''],
        ['Entradas (R$)', Number(entradas.toFixed(2))],
        ['Saídas (R$)', Number(saidas.toFixed(2))],
        ['Resultado do período (R$)', Number((entradas - saidas).toFixed(2))],
        ['Saldo inicial configurado (R$)', Number(Number(saldoInicialDB).toFixed(2))],
      ]

      // Aba 2 — Extrato com saldo acumulado (partindo do saldo inicial)
      // ═══ CAIXA EFETIVO no export (mesma semântica da tela) ═══
      // Liquidado → data efetiva; a vencer → vencimento; vencido → só aparece
      // sob o filtro "Vencidos", sem compor o saldo acumulado
      const consultandoVencidosX = statusFiltro === 'vencidos'
      const linhas = []
      rows.forEach(r => {
        const dEf = dataEfetiva(r)
        if (!dEf && !consultandoVencidosX) return   // vencido/cancelado: fora
        const efeitoTotal = efeitosCaixa(r).reduce((a, e) => a + e.valor, 0)
        linhas.push({ r, dExib: dEf || r.data, efeitoTotal, foraDoCaixa: !dEf })
      })
      linhas.sort((a, b) => a.dExib > b.dExib ? 1 : a.dExib < b.dExib ? -1 : 0)

      const extratoAoa = [['Data Efetiva', 'Vencimento', 'Descrição', 'Categoria', 'Tipo', 'Situação', 'Dias em Atraso', 'Entrada (R$)', 'Saída (R$)', 'Saldo Acumulado (R$)']]
      let acum = (Number(saldoInicialDB) || 0) + (Number(saldoAnterior) || 0)
      linhas.forEach(({ r, dExib, efeitoTotal, foraDoCaixa }) => {
        if (!foraDoCaixa) acum += r.tipo === 'entrada' ? efeitoTotal : -efeitoTotal
        const stX = getStatusInfo(r)
        const v = Number(r.valor)
        extratoAoa.push([
          dExib || '', r.data || '', r.descricao || '', r.categoria || '',
          r.tipo === 'entrada' ? 'Entrada' : 'Saída',
          stX.label, stX.diasVencido || '',
          r.tipo === 'entrada' ? Number(v.toFixed(2)) : '',
          r.tipo === 'saida'   ? Number(v.toFixed(2)) : '',
          foraDoCaixa ? '' : Number(acum.toFixed(2)),
        ])
      })

      downloadWorkbook([
        { name: 'Resumo',  aoa: resumoAoa,  colWidths: [32, 22], currencyCols: [1] },
        { name: 'Extrato', aoa: extratoAoa, colWidths: [13, 13, 46, 24, 10, 20, 12, 16, 16, 20], currencyCols: [7, 8, 9] },
      ], exportFilename('Fluxo_Caixa_Gestao', startDate, endDate))
      showToast(`${rows.length} registros exportados para Excel`, 'success')
    } catch (e) {
      console.error('Export:', e)
      showToast('Erro ao exportar: ' + e.message, 'error')
    } finally { setExportLoading(false) }
  }

  // ─── Seleção ────────────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }
  const toggleAll = () => {
    if (selected.size === registros.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(registros.map(r=>r.id)))
    }
  }

  // ─── Salvar saldo inicial ───────────────────────────────────────────────────
  const handleSaveSaldo = async () => {
    const val = parseFloat(String(saldoInicial).replace(',', '.')) || 0
    await supabase.from('empresa_config')
      .upsert({ empresa_id: empresaId, chave: 'saldo_inicial', valor: String(val), updated_at: new Date().toISOString() },
              { onConflict: 'empresa_id,chave' })
    setSaldoInicialDB(val)
    setEditSaldo(false)
    showToast('Saldo inicial salvo com sucesso!', 'success')
  }

  // ─── Inserir novo lançamento manual ──────────────────────────────────────────
  const handleNovoLancamento = async () => {
    const val = parseFloat(String(novoForm.valor).replace(/\./g,'').replace(',','.'))
    if (!novoForm.data || !novoForm.descricao.trim() || !val || val <= 0) {
      showToast('Preencha data, descrição e valor.', 'error'); return
    }
    setNovoLoading(true)
    const { error } = await supabase.from('fluxo_caixa').insert({
      empresa_id:  empresaId,
      data:        novoForm.data,
      descricao:   novoForm.descricao.trim(),
      tipo:        novoForm.tipo,
      valor:       val,
      categoria:   novoForm.categoria.trim() || null,
      created_at:  new Date().toISOString(),
    })
    setNovoLoading(false)
    if (error) { showToast('Erro ao inserir: ' + error.message, 'error'); return }
    showToast(`Lançamento inserido: ${novoForm.tipo === 'entrada' ? '+' : '-'}R$ ${val.toFixed(2)}`, 'success')
    setNovoModal(false)
    setNovoForm({ data: today, descricao:'', tipo:'saida', valor:'', categoria:'' })
    load()
  }

  // ─── Abrir modal de edição ───────────────────────────────────────────────────
  const openEdit = (r) => {
    setEditItem(r)
    setEditForm({
      data:      r.data,
      descricao: r.descricao || '',
      tipo:      r.tipo,
      valor:     String(Number(r.valor).toFixed(2)).replace('.', ','),
      categoria: r.categoria || '',
    })
  }

  // ─── Salvar edição ────────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    const val = parseFloat(String(editForm.valor).replace(/\./g,'').replace(',','.'))
    if (!editForm.data || !editForm.descricao.trim() || !val || val <= 0) {
      showToast('Preencha data, descrição e valor.', 'error'); return
    }
    setEditLoading(true)
    const { error } = await supabase.from('fluxo_caixa').update({
      data:      editForm.data,
      descricao: editForm.descricao.trim(),
      tipo:      editForm.tipo,
      valor:     val,
      categoria: editForm.categoria.trim() || null,
    }).eq('id', editItem.id)
    setEditLoading(false)
    if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return }
    showToast('Lançamento atualizado!', 'success')
    setEditItem(null)
    load()
  }

  // ─── Filtro local por busca ──────────────────────────────────────────────────
  const filtrados = registros.filter(r => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return (r.descricao||'').toLowerCase().includes(q) || (r.categoria||'').toLowerCase().includes(q)
  })

  // ─── Totais da página ────────────────────────────────────────────────────────
  const totalEntradas = filtrados.filter(r=>r.tipo==='entrada').reduce((a,c)=>a+Number(c.valor),0)
  const totalSaidas   = filtrados.filter(r=>r.tipo==='saida').reduce((a,c)=>a+Number(c.valor),0)

  // ─── Saldo acumulado dia a dia (extrato bancário) ───────────────────────────
  const extratoComSaldo = (() => {
    // ═══ CAIXA EFETIVO ═══
    // Liquidados → data efetiva de pagamento/recebimento; a vencer → vencimento
    // (caixa futuro); VENCIDOS não liquidados → fora do fluxo (só aparecem sob
    // o filtro "Vencidos", agrupados por vencimento, sem afetar saldos)
    const consultandoVencidos = statusFiltro === 'vencidos'
    const porDia = {}
    filtrados.forEach(r => {
      const dEf = dataEfetiva(r)
      const dExib = dEf || (consultandoVencidos ? r.data : null)
      if (!dExib) return // vencido/cancelado: fora do extrato
      if (!porDia[dExib]) porDia[dExib] = []
      porDia[dExib].push(r)
    })

    // Saldo do dia: saldo inicial + histórico efetivo anterior + efeitos do período
    let saldoAcum = saldoInicialDB + saldoAnterior
    const resultado = []
    Object.keys(porDia).sort().forEach(data => {
      const lancamentos = porDia[data]
      lancamentos.forEach(r => {
        // Contribuição EFETIVA neste dia (parcial: só a parte com efeito na data)
        efeitosCaixa(r).filter(e => e.data === data).forEach(e => {
          saldoAcum += r.tipo === 'entrada' ? e.valor : -e.valor
        })
      })
      resultado.push({ data, lancamentos, saldoDia: consultandoVencidos ? null : saldoAcum })
    })
    return resultado
  })()

  // ─── Labels do período selecionado ──────────────────────────────────────────
  const periodoLabel = (() => {
    const s = startDate.split('-')
    const e = endDate.split('-')
    return `${s[2]}/${s[1]}/${s[0]} – ${e[2]}/${e[1]}/${e[0]}`
  })()

  // ─── Guards de acesso ─────────────────────────────────────────────────────
  // Aguarda o perfil carregar antes de avaliar isAdmin — evita bloqueio indevido
  if (orgLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'40vh', color:'var(--fs-text-4)', fontSize:14 }}>
      Carregando permissões da organização...
    </div>
  )

  if (!isAdmin) return (
    <div style={{ textAlign:'center', padding:'80px 24px', color:'var(--fs-text-4)' }}>
      <div style={{ fontSize:32, marginBottom:16, color:'var(--fs-text-4)' }}>—</div>
      <div style={{ fontSize:18, fontWeight:700, color:'var(--fs-text-2)', marginBottom:8 }}>Acesso restrito</div>
      <div style={{ fontSize:14 }}>Esta página é acessível somente para administradores da organização.</div>
    </div>
  )

  if (!empresaId) return (
    <EmptyState icon="building" title="Nenhuma entidade selecionada">
      Escolha uma entidade do grupo no seletor do menu lateral para abrir o extrato.
    </EmptyState>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ color:'var(--fs-text-1)', width:'100%' }}>

      {/* Toasts */}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}

      {/* Modal Edição */}
      {editItem && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:24 }}>
          <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:16, padding:28, width:'100%', maxWidth:440, boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--fs-text-1)', marginBottom:4 }}>Editar Lançamento</div>
            <div style={{ fontSize:12, color:'var(--fs-text-4)', marginBottom:20 }}>ID: {editItem.id?.substring(0,8)}...</div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Tipo */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>Tipo *</div>
                <div style={{ display:'flex', gap:8 }}>
                  {[['entrada','Entrada','#22c55e'],['saida','Saída','#ef4444']].map(([v,l,clr])=>(
                    <button key={v} onClick={()=>setEditForm(f=>({...f,tipo:v}))} style={{ flex:1, padding:'8px', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.15s', border: editForm.tipo===v ? `2px solid ${clr}` : '2px solid var(--fs-border)', background: editForm.tipo===v ? `rgba(${v==='entrada'?'34,197,94':'239,68,68'},0.12)` : 'var(--fs-bg)', color: editForm.tipo===v ? clr : 'var(--fs-text-3)' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Data */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>Data *</div>
                <input type="date" value={editForm.data} onChange={e=>setEditForm(f=>({...f,data:e.target.value}))}
                  style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'8px 10px', fontSize:13, outline:'none', colorScheme:'dark', width:'100%' }} />
              </div>
              {/* Descrição */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>Descrição *</div>
                <input value={editForm.descricao} onChange={e=>setEditForm(f=>({...f,descricao:e.target.value}))}
                  style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'8px 10px', fontSize:13, outline:'none', width:'100%' }} />
              </div>
              {/* Valor */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>Valor (R$) *</div>
                <input value={editForm.valor} onChange={e=>setEditForm(f=>({...f,valor:e.target.value}))}
                  style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'8px 10px', fontSize:13, outline:'none', width:'100%' }} />
              </div>
              {/* Categoria */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>Categoria</div>
                <input value={editForm.categoria} onChange={e=>setEditForm(f=>({...f,categoria:e.target.value}))}
                  style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'8px 10px', fontSize:13, outline:'none', width:'100%' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={()=>setEditItem(null)} style={{ background:'transparent', border:'1px solid var(--fs-border)', color:'var(--fs-text-2)', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
              <button onClick={handleSaveEdit} disabled={editLoading} style={{ background:editLoading?'rgba(59,130,246,0.5)':'#3b82f6', border:'none', color:'#fff', borderRadius:8, padding:'8px 20px', fontSize:13, fontWeight:700, cursor:editLoading?'default':'pointer' }}>
                {editLoading ? 'Salvando...' : '✓ Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Lançamento */}
      {novoModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:24 }}>
          <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:16, padding:28, width:'100%', maxWidth:440, boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--fs-text-1)', marginBottom:20 }}>Novo Lançamento Manual</div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Tipo */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>Tipo *</div>
                <div style={{ display:'flex', gap:8 }}>
                  {[['entrada','A Receber','#22c55e'],['saida','A Pagar','#ef4444']].map(([v,l,clr])=>(
                    <button key={v} onClick={()=>setNovoForm(f=>({...f,tipo:v}))} style={{ flex:1, padding:'8px', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.15s', border: novoForm.tipo===v ? `2px solid ${clr}` : '2px solid var(--fs-border)', background: novoForm.tipo===v ? `rgba(${v==='entrada'?'34,197,94':'239,68,68'},0.12)` : 'var(--fs-bg)', color: novoForm.tipo===v ? clr : 'var(--fs-text-3)' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Data */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>Data *</div>
                <input type="date" value={novoForm.data} onChange={e=>setNovoForm(f=>({...f,data:e.target.value}))}
                  style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'8px 10px', fontSize:13, outline:'none', colorScheme:'dark', width:'100%' }} />
              </div>
              {/* Descrição */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>Descrição *</div>
                <input value={novoForm.descricao} onChange={e=>setNovoForm(f=>({...f,descricao:e.target.value}))}
                  placeholder="Ex: Pagamento Fornecedor XYZ"
                  style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'8px 10px', fontSize:13, outline:'none', width:'100%' }} />
              </div>
              {/* Valor */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>Valor (R$) *</div>
                <input value={novoForm.valor} onChange={e=>setNovoForm(f=>({...f,valor:e.target.value}))}
                  placeholder="Ex: 1.500,00"
                  style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'8px 10px', fontSize:13, outline:'none', width:'100%' }} />
              </div>
              {/* Categoria */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>Categoria</div>
                <input value={novoForm.categoria} onChange={e=>setNovoForm(f=>({...f,categoria:e.target.value}))}
                  placeholder="Ex: Fornecedor, Pessoal, Banco..."
                  style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'8px 10px', fontSize:13, outline:'none', width:'100%' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={()=>{setNovoModal(false);setNovoForm({data:today,descricao:'',tipo:'saida',valor:'',categoria:''})}} style={{ background:'transparent', border:'1px solid var(--fs-border)', color:'var(--fs-text-2)', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
              <button onClick={handleNovoLancamento} disabled={novoLoading} style={{ background: novoLoading?'rgba(59,130,246,0.5)':'#3b82f6', border:'none', color:'#fff', borderRadius:8, padding:'8px 20px', fontSize:13, fontWeight:700, cursor:novoLoading?'default':'pointer' }}>
                {novoLoading ? 'Salvando...' : '✓ Inserir Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais */}
      {delItem  && <ConfirmModal item={delItem} onConfirm={handleDelete} onCancel={()=>setDelItem(null)} loading={delLoading} />}
      {bulkModal && (
        <BulkModal
          count={selected.size}
          periodo={periodoLabel}
          onConfirm={handleBulkDelete}
          onCancel={()=>setBulkModal(false)}
          loading={delLoading}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
          <h1 style={{ fontSize:28, fontWeight:800, margin:0 }}>Gestão de Registros</h1>
          <span style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
            <span style={{display:'inline-flex',alignItems:'center',gap:5}}><SvgIcon name="lock" size={12} color="currentColor" />Admin only</span>
          </span>
        </div>
        <div style={{ fontSize:12, color:'var(--fs-text-4)' }}>
          {empNome || 'Consolidado'} · Visualize, filtre, inclua e exclua registros do fluxo de caixa
        </div>
      </div>

      {/* ── Barra de filtros ───────────────────────────────────────────────── */}
      <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'14px 18px', marginBottom:16, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>

        {/* Período */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:11, color:'var(--fs-text-4)', fontWeight:600 }}>Período</span>
          <input type="date" value={startDate} onChange={e=>{setStartDate(e.target.value);setPage(0)}}
            style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:7, color:'var(--fs-text-2)', fontSize:12, padding:'5px 8px', outline:'none', colorScheme:'dark' }} />
          <SvgIcon name="arrowRight" size={11} color="var(--fs-text-4)" />
          <input type="date" value={endDate} onChange={e=>{setEndDate(e.target.value);setPage(0)}}
            style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:7, color:'var(--fs-text-2)', fontSize:12, padding:'5px 8px', outline:'none', colorScheme:'dark' }} />
        </div>

        {/* Tipo */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:11, color:'var(--fs-text-4)', fontWeight:600 }}>Tipo</span>
          <select value={tipoFiltro} onChange={e=>{setTipoFiltro(e.target.value);setPage(0)}}
            style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:7, color:'var(--fs-text-2)', fontSize:12, padding:'5px 8px', outline:'none' }}>
            <option value="todos">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
          <select value={statusFiltro} onChange={e=>{setStatusFiltro(e.target.value);setPage(0)}}
            style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:7, color:'var(--fs-text-2)', fontSize:12, padding:'5px 8px', outline:'none' }}>
            <option value="todos">Todas as situações</option>
            <option value="abertos">Em aberto</option>
            <option value="vencidos">Vencidos</option>
            <option value="pagos">Liquidados</option>
          </select>
        </div>

        {/* Busca */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, minWidth:200 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--fs-text-4)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input placeholder="Buscar por descrição ou categoria..."
            value={busca} onChange={e=>setBusca(e.target.value)}
            style={{ background:'transparent', border:'none', color:'var(--fs-text-2)', fontSize:12, outline:'none', flex:1 }} />
        </div>

        {/* Botão exportar Excel */}
        <button onClick={handleExport} disabled={exportLoading || loading} title="Exportar registros filtrados para Excel"
          style={{ display:'flex', alignItems:'center', gap:6, background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, padding:'7px 14px', color:'var(--fs-text-2)', fontSize:12, fontWeight:700, cursor: (exportLoading || loading) ? 'not-allowed' : 'pointer', whiteSpace:'nowrap', marginLeft:'auto', opacity: (exportLoading || loading) ? 0.6 : 1 }}>
          <SvgIcon name="download" size={13} color="currentColor" />
          {exportLoading ? 'Exportando...' : 'Exportar Excel'}
        </button>

        {/* Botão novo lançamento */}
        <button onClick={()=>setNovoModal(true)} style={{ display:'flex', alignItems:'center', gap:6, background:'#3b82f6', border:'none', borderRadius:8, padding:'7px 14px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Lançamento
        </button>

        {/* Botão excluir selecionados */}
        {selected.size > 0 && (
          <button onClick={()=>setBulkModal(true)}
            style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'6px 14px', color:'#ef4444', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            Excluir {selected.size} selecionado{selected.size > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── Totalizadores ─────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:10, marginBottom:10, flexWrap:'wrap' }}>
        {[
          { label:'Total de registros', value: String(total),                     color:'var(--fs-text-1)' },
          { label:'Entradas (período)', value: fC(totalGlobalE),                   color:'#22c55e' },
          { label:'Saídas (período)',   value: fC(totalGlobalS),                   color:'#ef4444' },
          { label:'Saldo (período)',    value: fC(totalGlobalE - totalGlobalS),    color: totalGlobalE >= totalGlobalS ? '#22c55e' : '#ef4444' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'10px 16px', flex:1, minWidth:140 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Saldo Corrente + Saldo Inicial ────────────────────────────────────── */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        {/* Indicadores decisórios do período (por status de liquidação) */}
        <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'12px 18px', flex:2, minWidth:420 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:10 }}>
            <span style={{display:'flex',alignItems:'center',gap:7}}><SvgIcon name="wallet" size={14} color="var(--fs-brand)" />Indicadores do Período</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:'10px 18px' }}>
            {[
              ['Recebido',           indicadores.recebido,      'var(--fs-success)'],
              ['A Receber',          indicadores.aReceber,      'var(--fs-text-2)'],
              ['Atraso (Receber)',   indicadores.atrasoReceber, indicadores.atrasoReceber > 0 ? 'var(--fs-danger)' : 'var(--fs-text-4)'],
              ['Pago',               indicadores.pago,          'var(--fs-success)'],
              ['A Pagar',            indicadores.aPagar,        'var(--fs-text-2)'],
              ['Atraso (Pagar)',     indicadores.atrasoPagar,   indicadores.atrasoPagar > 0 ? 'var(--fs-danger)' : 'var(--fs-text-4)'],
            ].map(([rot, val, cor]) => (
              <div key={rot}>
                <div style={{ fontSize:9.5, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:2 }}>{rot}</div>
                <div style={{ fontSize:15, fontWeight:800, color:cor }} className="fs-num">{fC(val)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Saldo inicial configurável */}
        <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'12px 18px', flex:1, minWidth:220 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:6 }}>
            <span style={{display:'flex',alignItems:'center',gap:7}}><SvgIcon name="bank" size={14} color="var(--fs-brand)" />Saldo Inicial</span>
          </div>
          {editSaldo ? (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input
                value={saldoInicial}
                onChange={e=>setSaldoInicial(e.target.value)}
                placeholder="Ex: 50000,00"
                style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:7, color:'var(--fs-text-1)', padding:'6px 10px', fontSize:13, outline:'none', flex:1 }}
                onKeyDown={e => e.key === 'Enter' && handleSaveSaldo()}
                autoFocus
              />
              <button onClick={handleSaveSaldo} style={{ background:'#3b82f6', border:'none', color:'#fff', borderRadius:7, padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Salvar</button>
              <button onClick={()=>setEditSaldo(false)} style={{ background:'transparent', border:'1px solid var(--fs-border)', color:'var(--fs-text-3)', borderRadius:7, padding:'6px 10px', fontSize:12, cursor:'pointer' }}>✕</button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ fontSize:18, fontWeight:800, color:'var(--fs-text-1)' }}>{fC(saldoInicialDB) || 'R$ 0'}</div>
              <button onClick={()=>setEditSaldo(true)} style={{ background:'transparent', border:'1px solid var(--fs-border)', color:'var(--fs-text-3)', borderRadius:6, padding:'3px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                Editar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Extrato bancário — superfície densa, sem moldura de card ─────────── */}
      <div style={{ background:'var(--fs-surface)', borderTop:'2px solid var(--fs-border-2)', borderBottom:'1px solid var(--fs-border)' }}>

        {/* Cabeçalho */}
        <div style={{ display:'grid', gridTemplateColumns:'40px 1fr 140px 100px 132px 116px 130px 96px', gap:8, padding:'11px 16px', borderBottom:'2px solid var(--fs-border)', background:'var(--fs-bg)' }}>
          <div><input type="checkbox" checked={registros.length > 0 && selected.size === registros.length} onChange={toggleAll} style={{ cursor:'pointer', accentColor:'#3b82f6', width:14, height:14 }} /></div>
          {['Descrição','Categoria','Tipo','Situação','Valor','Saldo do Dia',''].map(h=>(
            <div key={h} style={{ fontSize:10, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.7px', display:'flex', alignItems:'center', justifyContent: h==='Valor'||h==='Saldo do Dia' ? 'flex-end' : 'flex-start' }}>{h}</div>
          ))}
        </div>

        {/* Corpo */}
        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'var(--fs-text-4)', fontSize:13 }}>Carregando...</div>
        ) : extratoComSaldo.length === 0 ? (
          busca ? (
            <EmptyState compact icon="search" title={`Nenhum registro contém “${busca}”`}>
              Nenhuma descrição ou categoria corresponde à busca no período de {startDate.split('-').reverse().join('/')} a {endDate.split('-').reverse().join('/')}.
            </EmptyState>
          ) : (
            <EmptyState compact icon="inbox" title="Sem movimentações no período"
              actionHref="/dashboard/importacao" actionLabel="Importar extrato do Bling">
              Nenhum lançamento entre {startDate.split('-').reverse().join('/')} e {endDate.split('-').reverse().join('/')}
              {tipoFiltro !== 'todos' ? ` com o filtro “${tipoFiltro}” ativo` : ''}. Ajuste o período ou importe o extrato.
            </EmptyState>
          )
        ) : extratoComSaldo.map(({ data, lancamentos, saldoDia }, gi) => (
          <div key={data}>
            {/* Separador de data */}
            <div style={{ display:'flex', alignItems:'center', padding:'5px 16px', background:'var(--fs-bg)', borderBottom:'1px solid var(--fs-border)', borderTop: gi > 0 ? '1px solid var(--fs-border)' : 'none' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'var(--fs-text-3)', letterSpacing:'0.4px' }}>
                {fDateBR(data)}
              </div>
              <div style={{ marginLeft:'auto', display:'flex', gap:16, fontSize:11 }}>
                <span style={{ color:'#22c55e', fontWeight:700 }}>
                  +{fC(lancamentos.filter(r=>r.tipo==='entrada').reduce((a,c)=>a+Number(c.valor),0))}
                </span>
                <span style={{ color:'#ef4444', fontWeight:700 }}>
                  -{fC(lancamentos.filter(r=>r.tipo==='saida').reduce((a,c)=>a+Number(c.valor),0))}
                </span>
              </div>
            </div>

            {/* Lançamentos do dia */}
            {lancamentos.map((r, li) => {
              const isEntrada = r.tipo === 'entrada'
              const isSel     = selected.has(r.id)
              const isLast    = li === lancamentos.length - 1
              return (
                <div key={r.id}
                  style={{ display:'grid', gridTemplateColumns:'40px 1fr 140px 100px 132px 116px 130px 96px', gap:8, padding:'6px 16px', minHeight:36,
                    borderBottom: isLast ? 'none' : '1px solid rgba(var(--fs-border-rgb,55,65,81),0.5)',
                    background: isSel ? 'rgba(59,130,246,0.06)' : 'transparent',
                    alignItems:'center', transition:'background 0.1s',
                  }}
                  onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background='var(--fs-hover)' }}
                  onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background='transparent' }}
                >
                  <div><input type="checkbox" checked={isSel} onChange={()=>toggleSelect(r.id)} style={{ cursor:'pointer', accentColor:'#3b82f6', width:14, height:14 }} /></div>

                  {/* Descrição */}
                  <div style={{ fontSize:12.5, color:'var(--fs-text-1)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:3, height:16, borderRadius:2, background: isEntrada ? 'var(--fs-success)' : 'var(--fs-danger)', flexShrink:0 }} />
                    {r.descricao || <span style={{ color:'var(--fs-text-4)', fontStyle:'italic' }}>sem descrição</span>}
                    {r.data_liquidacao && r.data && r.data_liquidacao !== r.data && ['pago','parcial'].includes(r.status) && (
                      <span title="Data de vencimento original do título" style={{ marginLeft:8, fontSize:10, color:'var(--fs-text-4)', fontWeight:500 }}>
                        venc. {r.data.split('-').reverse().slice(0,2).join('/')}
                      </span>
                    )}
                  </div>

                  {/* Categoria */}
                  <div style={{ fontSize:12, color:'var(--fs-text-4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.categoria || '—'}</div>

                  {/* Tipo */}
                  <div><Badge tipo={r.tipo} /></div>

                  {/* Situação (vencido derivado + dias) */}
                  <div>
                    {(() => { const st = getStatusInfo(r); return (
                      <span title={st.label} style={{ display:'inline-block', maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:10.5, fontWeight:700, color:st.color, background:st.bg, border:`1px solid ${st.color}`, borderRadius:20, padding:'2px 8px', opacity:0.95 }}>
                        {st.label}
                      </span>
                    )})()}
                  </div>

                  {/* Valor */}
                  <div className="fs-num" style={{ fontSize:12.5, fontWeight:700, color: isEntrada ? 'var(--fs-success)' : 'var(--fs-danger)', textAlign:'right' }}>
                    {isEntrada ? '+' : '-'}{fC(Math.abs(Number(r.valor)))}
                  </div>

                  {/* Saldo do dia (só na última linha do grupo) */}
                  <div style={{ textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                    {isLast ? (
                      saldoDia === null ? (
                        <span title="Vencidos não compõem o saldo de caixa" style={{ fontSize:12, color:'var(--fs-text-4)' }}>—</span>
                      ) : (
                      <span className="fs-num" style={{ fontSize:12.5, fontWeight:800, color: saldoDia >= 0 ? 'var(--fs-text-1)' : 'var(--fs-danger)', borderBottom:'2px solid ' + (saldoDia >= 0 ? 'var(--fs-success)' : 'var(--fs-danger)'), paddingBottom:1 }}>
                        {fC(saldoDia)}
                      </span>
                      )
                    ) : (
                      <span style={{ fontSize:11, color:'var(--fs-border)' }}>·</span>
                    )}
                  </div>

                  {/* Baixar + Editar + Excluir */}
                  <div style={{ display:'flex', justifyContent:'center', gap:4 }}>
                    {(r.status || 'aberto') !== 'pago' && (r.status || 'aberto') !== 'cancelado' && (
                      <button onClick={()=>handleBaixar(r)} title="Baixar (marcar como liquidado hoje)"
                        style={{ background:'transparent', border:'1px solid transparent', borderRadius:6, padding:'5px 6px', cursor:'pointer', color:'var(--fs-text-4)', transition:'all 0.15s', display:'flex', alignItems:'center' }}
                        onMouseEnter={e=>{ e.currentTarget.style.background='rgba(34,197,94,0.1)'; e.currentTarget.style.color='var(--fs-success)'; e.currentTarget.style.borderColor='rgba(34,197,94,0.25)' }}
                        onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--fs-text-4)'; e.currentTarget.style.borderColor='transparent' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      </button>
                    )}
                    <button onClick={()=>openEdit(r)} title="Editar"
                      style={{ background:'transparent', border:'1px solid transparent', borderRadius:6, padding:'5px 6px', cursor:'pointer', color:'var(--fs-text-4)', transition:'all 0.15s', display:'flex', alignItems:'center' }}
                      onMouseEnter={e=>{ e.currentTarget.style.background='rgba(59,130,246,0.1)'; e.currentTarget.style.color='#60a5fa'; e.currentTarget.style.borderColor='rgba(59,130,246,0.2)' }}
                      onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--fs-text-4)'; e.currentTarget.style.borderColor='transparent' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={()=>setDelItem(r)} title="Excluir"
                      style={{ background:'transparent', border:'1px solid transparent', borderRadius:6, padding:'5px 6px', cursor:'pointer', color:'var(--fs-text-4)', transition:'all 0.15s', display:'flex', alignItems:'center' }}
                      onMouseEnter={e=>{ e.currentTarget.style.background='rgba(239,68,68,0.1)'; e.currentTarget.style.color='#ef4444'; e.currentTarget.style.borderColor='rgba(239,68,68,0.2)' }}
                      onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--fs-text-4)'; e.currentTarget.style.borderColor='transparent' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* ── Paginação ──────────────────────────────────────────────────────────── */}
      {total > PAGE_SIZE && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, padding:'0 2px' }}>
          <div style={{ fontSize:12, color:'var(--fs-text-4)' }}>
            Exibindo {page * PAGE_SIZE + 1}–{Math.min((page+1) * PAGE_SIZE, total)} de {total} registros
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
              style={{ padding:'6px 14px', borderRadius:7, border:'1px solid var(--fs-border)', background:'var(--fs-surface)', color: page===0 ? 'var(--fs-text-4)' : 'var(--fs-text-1)', fontSize:12, fontWeight:600, cursor: page===0 ? 'not-allowed' : 'pointer' }}>
              ← Anterior
            </button>
            <button onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PAGE_SIZE >= total}
              style={{ padding:'6px 14px', borderRadius:7, border:'1px solid var(--fs-border)', background:'var(--fs-surface)', color: (page+1)*PAGE_SIZE>=total ? 'var(--fs-text-4)' : 'var(--fs-text-1)', fontSize:12, fontWeight:600, cursor: (page+1)*PAGE_SIZE>=total ? 'not-allowed' : 'pointer' }}>
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
