'use client'
// ─── Natureza das Categorias ────────────────────────────────────────────────
// Onde o Controller decide o que entra nos KPIs operacionais.
//
// Auditoria de 11/09/2026: transferências entre FACE, JAM e JB somavam 44,0%
// das entradas e 44,3% das saídas no consolidado. É o mesmo dinheiro circulando
// dentro do grupo. O Índice de Cobertura, com ~44% do mesmo valor nos dois
// lados, convergia para 1,0 por construção matemática.
//
// A classificação é por NOME de categoria e vive na organização, porque cada
// cliente tem sua nomenclatura — nenhuma lista fixa de nomes resolveria.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/supabase-paginated'
import {
  NATUREZAS, NATUREZA_PADRAO, indexarNaturezas, pendentesDeClassificacao,
} from '@/lib/natureza-categoria'
import SvgIcon from './SvgIcon'

const authFetch = async (url, opts = {}) => {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, ...(opts.headers || {}) },
  })
  return r.json().catch(() => ({ error: 'Resposta inválida do servidor' }))
}

const fBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)

const card  = { background: 'var(--fs-surface-2)', border: '1px solid var(--fs-border)', borderRadius: 12, padding: 20, marginBottom: 16 }
const titulo = { fontSize: 14, fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: 4 }
const hint  = { fontSize: 12, color: 'var(--fs-text-4)', lineHeight: 1.7, marginBottom: 16 }
const th    = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--fs-text-4)', textTransform: 'uppercase', letterSpacing: 0.4, padding: '8px 10px', borderBottom: '1px solid var(--fs-border)' }
const td    = { fontSize: 13, color: 'var(--fs-text-2)', padding: '9px 10px', borderBottom: '1px solid var(--fs-border)' }
const num   = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const sel   = { padding: '6px 10px', borderRadius: 7, border: '1px solid var(--fs-border)', background: 'var(--fs-surface-1)', color: 'var(--fs-text-1)', fontSize: 12.5, outline: 'none', cursor: 'pointer' }

const COR = {
  operacional: 'var(--fs-success)',
  transferencia_interna: 'var(--fs-brand)',
  aporte_socio: 'var(--fs-purple)',
  emprestimo: 'var(--fs-warning)',
}

export default function NaturezaCategoriasTab({ empresas = [], showToast }) {
  const [naturezas, setNaturezas] = useState(null)
  const [migracaoPendente, setMigracaoPendente] = useState(false)
  const [lancamentos, setLancamentos] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    const r = await authFetch('/api/categorias-natureza')
    if (r.error) { showToast?.(r.error, 'error'); setNaturezas([]); return }
    setMigracaoPendente(!!r.migracao_pendente)
    setNaturezas(r.naturezas || [])
  }, [showToast])
  useEffect(() => { carregar() }, [carregar])

  // Volume por categoria: é o que define a ordem da fila de trabalho.
  // Com 20 ou 30 classificações o grosso do valor é coberto.
  const carregarVolumes = useCallback(async () => {
    const ids = empresas.map(e => e.id)
    if (!ids.length) { setLancamentos([]); return }
    try {
      const rows = await fetchAllRows((ini, fim) => supabase
        .from('fluxo_caixa').select('categoria,valor,tipo')
        .in('empresa_id', ids).order('id', { ascending: true }).range(ini, fim))
      setLancamentos(rows || [])
    } catch (e) { showToast?.('Erro ao carregar volumes: ' + e.message, 'error'); setLancamentos([]) }
  }, [empresas, showToast])
  useEffect(() => { carregarVolumes() }, [carregarVolumes])

  const mapa = useMemo(() => indexarNaturezas(naturezas || []), [naturezas])
  const pendentes = useMemo(
    () => lancamentos ? pendentesDeClassificacao(lancamentos, mapa) : [],
    [lancamentos, mapa])

  const classificar = async (categoria, natureza) => {
    setSalvando(true)
    const r = natureza === NATUREZA_PADRAO && (naturezas || []).some(n => n.categoria.toLowerCase() === categoria.toLowerCase())
      ? await authFetch(`/api/categorias-natureza?categoria=${encodeURIComponent(categoria)}`, { method: 'DELETE' })
      : await authFetch('/api/categorias-natureza', { method: 'POST', body: JSON.stringify({ categoria, natureza }) })
    setSalvando(false)
    if (r.error) return showToast?.(r.error, 'error')
    showToast?.(`"${categoria}" → ${NATUREZAS[natureza]?.rotulo || natureza}`, 'success')
    carregar()
  }

  const aplicarSugestoes = async () => {
    const comSugestao = pendentes.filter(p => p.sugestao)
    if (!comSugestao.length) return showToast?.('Nenhuma sugestão disponível', 'info')
    if (!window.confirm(
      `Aplicar ${comSugestao.length} sugestão(ões)?\n\n` +
      comSugestao.slice(0, 10).map(p => `· ${p.categoria} → ${NATUREZAS[p.sugestao].rotulo}`).join('\n') +
      (comSugestao.length > 10 ? `\n… e mais ${comSugestao.length - 10}` : '') +
      '\n\nVocê pode alterar qualquer uma depois.')) return
    setSalvando(true)
    const r = await authFetch('/api/categorias-natureza', {
      method: 'POST',
      body: JSON.stringify({ itens: comSugestao.map(p => ({ categoria: p.categoria, natureza: p.sugestao })) }),
    })
    setSalvando(false)
    if (r.error) return showToast?.(r.error, 'error')
    showToast?.(`${r.gravados} categoria(s) classificada(s)`, 'success')
    carregar()
  }

  if (naturezas === null || lancamentos === null)
    return <div style={{ padding: 40, color: 'var(--fs-text-4)', fontSize: 13 }}>Carregando...</div>

  if (migracaoPendente) return (
    <div style={{ ...card, border: '1px solid var(--fs-warning)' }}>
      <div style={{ ...titulo, color: 'var(--fs-warning)' }}>Migração pendente</div>
      <div style={{ ...hint, marginBottom: 0 }}>
        Execute <strong>supabase/migrations/20260915_categorias_natureza.sql</strong> no
        SQL Editor do Supabase e recarregue esta página.
      </div>
    </div>
  )

  const classificadas = (naturezas || []).filter(n =>
    !busca || n.categoria.toLowerCase().includes(busca.toLowerCase()))
  const excluidasDoKpi = (naturezas || []).filter(n => n.natureza !== NATUREZA_PADRAO)
  const volumeExcluido = pendentes.length === 0 ? null : null

  return (
    <div>
      <div style={card}>
        <div style={titulo}>Por que classificar</div>
        <div style={{ ...hint, marginBottom: 0 }}>
          Transferências entre as entidades do grupo aparecem nos dois lados do fluxo — saem de uma
          empresa e entram em outra. No consolidado elas se anulam, mas o sistema somava as duas pontas.
          Na medição de 11/09/2026 isso representava <strong>44% das entradas e 44,3% das saídas</strong>.
          <br /><br />
          O indicador mais afetado é o <strong>Índice de Cobertura</strong>: com o mesmo valor dos dois
          lados, ele converge para 1,0 por construção matemática, não por desempenho.
          <br /><br />
          Categorias marcadas como não-operacionais saem dos indicadores de desempenho, mas
          <strong> continuam no saldo de caixa</strong> — transferência recebida está no banco, e tirá-la
          do saldo criaria divergência contra o extrato.
        </div>
      </div>

      {/* ── Fila de trabalho ──────────────────────────────────────────────── */}
      {pendentes.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={titulo}>{pendentes.length} categoria(s) sem classificação</div>
              <div style={hint}>
                Ordenadas por volume — classificando as primeiras você cobre o grosso do valor.
                Sem classificação, a categoria é tratada como <strong>operacional</strong>.
              </div>
            </div>
            {pendentes.some(p => p.sugestao) && (
              <button onClick={aplicarSugestoes} disabled={salvando} style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid var(--fs-border)',
                background: 'var(--fs-surface-1)', color: 'var(--fs-text-1)', fontSize: 12.5,
                fontWeight: 700, cursor: salvando ? 'default' : 'pointer', whiteSpace: 'nowrap',
              }}>Revisar {pendentes.filter(p => p.sugestao).length} sugestão(ões)</button>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Categoria</th>
                <th style={{ ...th, textAlign: 'right' }}>Lançamentos</th>
                <th style={{ ...th, textAlign: 'right' }}>Volume</th>
                <th style={th}>Classificar como</th>
              </tr></thead>
              <tbody>
                {pendentes.slice(0, 40).map(p => (
                  <tr key={p.categoria}>
                    <td style={td}>
                      {p.categoria}
                      {p.sugestao && (
                        <span style={{ marginLeft: 8, fontSize: 10.5, color: COR[p.sugestao], border: `1px solid ${COR[p.sugestao]}`, borderRadius: 5, padding: '1px 6px' }}>
                          sugestão: {NATUREZAS[p.sugestao].rotulo}
                        </span>
                      )}
                    </td>
                    <td style={num}>{p.lancamentos}</td>
                    <td style={num}>{fBRL(p.valor)}</td>
                    <td style={td}>
                      <select style={sel} defaultValue="" disabled={salvando}
                        onChange={e => e.target.value && classificar(p.categoria, e.target.value)}>
                        <option value="" disabled>escolher…</option>
                        {Object.entries(NATUREZAS).map(([k, v]) => (
                          <option key={k} value={k}>{v.rotulo}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pendentes.length > 40 && (
              <div style={{ fontSize: 11.5, color: 'var(--fs-text-4)', marginTop: 10 }}>
                Exibindo as 40 de maior volume, de {pendentes.length}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Já classificadas ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={titulo}>Categorias classificadas</div>
          <input placeholder="Buscar categoria…" value={busca} onChange={e => setBusca(e.target.value)}
            style={{ padding: '7px 11px', borderRadius: 8, border: '1px solid var(--fs-border)', background: 'var(--fs-surface-1)', color: 'var(--fs-text-1)', fontSize: 12.5, outline: 'none', width: 220 }} />
        </div>
        <div style={hint}>
          {excluidasDoKpi.length} fora dos indicadores operacionais · {(naturezas || []).length - excluidasDoKpi.length} operacionais.
        </div>
        {classificadas.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--fs-text-4)', padding: '10px 0' }}>
            Nenhuma categoria classificada ainda. Tudo é tratado como operacional.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Categoria</th><th style={th}>Natureza</th>
                <th style={th}>Nos indicadores?</th><th style={th}>Alterar</th>
              </tr></thead>
              <tbody>
                {classificadas.map(n => (
                  <tr key={n.id}>
                    <td style={td}>{n.categoria}</td>
                    <td style={{ ...td, color: COR[n.natureza] || 'var(--fs-text-2)', fontWeight: 600 }}>
                      {NATUREZAS[n.natureza]?.rotulo || n.natureza}
                    </td>
                    <td style={td}>
                      {NATUREZAS[n.natureza]?.kpi
                        ? <span style={{ color: 'var(--fs-success)' }}>Sim</span>
                        : <span style={{ color: 'var(--fs-text-4)' }}>Não — só no saldo</span>}
                    </td>
                    <td style={td}>
                      <select style={sel} value={n.natureza} disabled={salvando}
                        onChange={e => classificar(n.categoria, e.target.value)}>
                        {Object.entries(NATUREZAS).map(([k, v]) => (
                          <option key={k} value={k}>{v.rotulo}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={titulo}>O que cada natureza significa</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(NATUREZAS).map(([k, v]) => (
              <tr key={k}>
                <td style={{ ...td, width: 190, color: COR[k], fontWeight: 600 }}>{v.rotulo}</td>
                <td style={td}>{v.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
