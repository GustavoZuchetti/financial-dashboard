'use client'
// ─── Saldo de abertura e data de corte — por entidade ────────────────────────
// A âncora contábil do caixa. Ver lib/saldo-abertura.js para a semântica.
// Esta tela NÃO calcula saldo por conta própria: toda composição passa pelas
// funções da lib (regra canônica nº 7).
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/supabase-paginated'
import {
  ancoraVigente, saldoEm, resumoMensal, conferir, excluidoPeloCorte,
  consolidarAncoras, normalizarValor, ORIGENS,
} from '@/lib/saldo-abertura'
import SvgIcon from './SvgIcon'
import EmptyState from './EmptyState'

const authFetch = async (url, opts = {}) => {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, ...(opts.headers || {}) },
  })
  return r.json()
}

const fBRL = (v) => v == null ? '—'
  : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
const fData = (iso) => iso ? String(iso).split('-').reverse().join('/') : '—'
const fMes = (ym) => {
  const [a, m] = String(ym).split('-')
  return `${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][Number(m) - 1]}/${a}`
}
const hojeISO = () => new Date().toISOString().split('T')[0]

const card = { background: 'var(--fs-surface-2)', border: '1px solid var(--fs-border)', borderRadius: 12, padding: 20, marginBottom: 16 }
const cardTitle = { fontSize: 14, fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: 4 }
const hint = { fontSize: 12, color: 'var(--fs-text-4)', lineHeight: 1.6, marginBottom: 16 }
const label = { fontSize: 11, fontWeight: 700, color: 'var(--fs-text-4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, display: 'block' }
const input = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--fs-border)', background: 'var(--fs-surface-1)', color: 'var(--fs-text-1)', fontSize: 13, outline: 'none' }
const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--fs-text-4)', textTransform: 'uppercase', letterSpacing: 0.4, padding: '8px 10px', borderBottom: '1px solid var(--fs-border)' }
const td = { fontSize: 13, color: 'var(--fs-text-2)', padding: '9px 10px', borderBottom: '1px solid var(--fs-border)' }
const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

export default function SaldoAberturaTab({ empresas = [], showToast }) {
  const [ancoras, setAncoras]   = useState(null)
  const [migracaoPendente, setMigracaoPendente] = useState(false)
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id || '')
  const [salvando, setSalvando] = useState(false)
  const [registros, setRegistros] = useState(null)   // fluxo_caixa da entidade
  const [carregandoMov, setCarregandoMov] = useState(false)
  const [declarado, setDeclarado] = useState('')
  const [dataProva, setDataProva] = useState(hojeISO())
  const [grupoDeclarado, setGrupoDeclarado] = useState('')
  const [dataGrupo, setDataGrupo] = useState(hojeISO())

  const [form, setForm] = useState({
    data_corte: '', valor: '', origem: 'extrato_bancario', observacao: '', conciliado: true,
  })

  const carregar = useCallback(async () => {
    const r = await authFetch('/api/saldos-abertura')
    if (r.error) { showToast?.(r.error, 'error'); setAncoras([]); return }
    setMigracaoPendente(!!r.migracao_pendente)
    setAncoras(r.ancoras || [])
  }, [showToast])
  useEffect(() => { carregar() }, [carregar])

  // Movimentos da entidade — necessários para a prova de amarração
  const carregarMovimentos = useCallback(async () => {
    if (!empresaId) return
    setCarregandoMov(true)
    try {
      const rows = await fetchAllRows((ini, fim) => supabase
        .from('fluxo_caixa')
        .select('tipo,valor,data,status,valor_liquidado,data_liquidacao')
        .eq('empresa_id', empresaId)
        .order('data', { ascending: true })
        .order('id', { ascending: true })   // desempate estável: sem isto a
        .range(ini, fim))                   // paginação pode repetir ou pular
      setRegistros(rows || [])
    } catch (e) {
      showToast?.('Erro ao carregar movimentos: ' + e.message, 'error')
      setRegistros([])
    } finally { setCarregandoMov(false) }
  }, [empresaId, showToast])
  useEffect(() => { setRegistros(null); setDeclarado('') }, [empresaId])

  const daEntidade = (ancoras || []).filter(a => a.empresa_id === empresaId)
  const vigente    = ancoraVigente(daEntidade, dataProva)
  const nomeDe     = (id) => empresas.find(e => e.id === id)?.nome || '—'

  // Consolidado: soma das âncoras vigentes de TODAS as entidades da organização
  const consol = consolidarAncoras({
    entidades: empresas.map(e => ({
      empresa_id: e.id, nome: e.nome,
      ancoras: (ancoras || []).filter(a => a.empresa_id === e.id),
    })),
    data: dataGrupo,
  })
  const checkGrupo = consol.ok && normalizarValor(grupoDeclarado) !== null
    ? conferir({ calculado: consol.total, declarado: normalizarValor(grupoDeclarado) })
    : null

  const salvar = async () => {
    if (!empresaId) return showToast?.('Selecione a entidade', 'error')
    if (!form.data_corte) return showToast?.('Informe a data de corte', 'error')
    const v = normalizarValor(form.valor)
    if (v === null) return showToast?.('Valor inválido', 'error')

    setSalvando(true)
    const r = await authFetch('/api/saldos-abertura', {
      method: 'POST',
      body: JSON.stringify({ empresa_id: empresaId, ...form, valor: v }),
    })
    setSalvando(false)
    if (r.error) return showToast?.(r.error, 'error')
    showToast?.(`Saldo de abertura de ${fData(form.data_corte)} gravado: ${fBRL(v)}`, 'success')
    setForm(f => ({ ...f, valor: '', observacao: '' }))
    carregar()
  }

  const remover = async (id, data_corte) => {
    if (!window.confirm(`Remover a âncora de ${fData(data_corte)}?\n\nOs saldos exibidos passarão a usar a âncora anterior, ou ficarão indisponíveis se não houver nenhuma.`)) return
    const r = await authFetch(`/api/saldos-abertura?id=${id}`, { method: 'DELETE' })
    if (r.error) return showToast?.(r.error, 'error')
    showToast?.('Âncora removida', 'success')
    carregar()
  }

  // ── Prova de amarração ────────────────────────────────────────────────────
  const prova = registros && vigente
    ? saldoEm({ ancoras: daEntidade, registros, data: dataProva })
    : null
  const check = prova?.ok ? conferir({ calculado: prova.saldo, declarado: normalizarValor(declarado) }) : null
  const excluido = registros && vigente
    ? excluidoPeloCorte({ registros, dataCorte: vigente.data_corte })
    : null
  const mensal = registros && vigente
    ? resumoMensal({ ancoras: daEntidade, registros, de: vigente.data_corte, ate: dataProva })
    : null

  if (ancoras === null) return <div style={{ padding: 40, color: 'var(--fs-text-4)', fontSize: 13 }}>Carregando...</div>
  if (!empresas.length) return <EmptyState icon="building" title="Nenhuma entidade cadastrada">Cadastre uma empresa antes de definir o saldo de abertura.</EmptyState>
  if (migracaoPendente) return (
    <div style={{ ...card, border: '1px solid var(--fs-warning)' }}>
      <div style={{ ...cardTitle, color: 'var(--fs-warning)' }}>Migração pendente</div>
      <div style={{ ...hint, marginBottom: 0 }}>
        A tabela <code>saldos_abertura</code> ainda não existe no banco. Execute
        <strong> supabase/migrations/20260812_saldos_abertura.sql</strong> no SQL Editor do Supabase
        e recarregue esta página.
        <br /><br />
        Até lá os saldos das telas de caixa ficam indisponíveis — por decisão de projeto, o sistema
        não exibe um número que não consegue certificar.
      </div>
    </div>
  )

  return (
    <div>
      <div style={card}>
        <div style={cardTitle}>Como funciona a data de corte</div>
        <div style={hint}>
          O saldo de abertura é a âncora contábil do caixa: uma posição certificada contra extrato numa data.
          A partir dela, o saldo de qualquer dia é <strong>abertura + movimentos efetivos do período</strong>.
          Nada anterior à data de corte volta a ser somado — os lançamentos antigos permanecem na base para
          DRE por competência e comparativos, mas ficam fora da composição do saldo.
          <br /><br />
          A data de corte representa o saldo <strong>na abertura daquele dia</strong>: os movimentos do próprio dia ainda contam.
          Para registrar o saldo inicial de julho/2026, use <strong>01/07/2026</strong>.
          <br /><br />
          Cada fechamento mensal é uma nova âncora. A vigente para uma data é sempre a de data de corte mais recente que não a ultrapassa.
        </div>
      </div>

      {/* ── Consolidado do grupo ─────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}>Consolidado do grupo</div>
        <div style={hint}>
          O consolidado é a <strong>soma das âncoras certificadas de cada entidade</strong> — nunca uma âncora única
          gravada no grupo. Gravar um saldo consolidado numa entidade infla a tela dela e zera as demais.
          Informe abaixo o saldo consolidado do extrato e confira se as entidades somam exatamente esse valor.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={label}>Conferir na data</label>
            <input type="date" style={input} value={dataGrupo} onChange={e => setDataGrupo(e.target.value)} />
          </div>
          <div>
            <label style={label}>Consolidado do extrato (R$)</label>
            <input style={input} placeholder="499.772,00" value={grupoDeclarado} inputMode="decimal"
              onChange={e => setGrupoDeclarado(e.target.value)} />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Entidade</th><th style={th}>Data de corte</th>
              <th style={{ ...th, textAlign: 'right' }}>Saldo de abertura</th><th style={th}>Certificação</th>
            </tr></thead>
            <tbody>
              {consol.linhas.map(l => (
                <tr key={l.empresa_id}>
                  <td style={td}>{l.nome}</td>
                  <td style={td}>{l.ancora ? fData(l.ancora.data_corte) : '—'}</td>
                  <td style={num}>
                    {l.ancora ? fBRL(l.valor)
                      : <span style={{ color: 'var(--fs-warning)' }}>sem âncora</span>}
                  </td>
                  <td style={td}>
                    {!l.ancora ? '—'
                      : l.ancora.conciliado_em
                        ? <span style={{ color: 'var(--fs-success)' }}>Conferido</span>
                        : <span style={{ color: 'var(--fs-warning)' }}>Provisório</span>}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700, color: 'var(--fs-text-1)' }} colSpan={2}>Soma das entidades</td>
                <td style={{ ...num, fontWeight: 700, color: 'var(--fs-text-1)', fontSize: 15 }}>
                  {consol.ok ? fBRL(consol.total) : <span style={{ color: 'var(--fs-warning)', fontSize: 13 }}>indisponível</span>}
                </td>
                <td style={td}></td>
              </tr>
              {checkGrupo?.ok && (
                <tr>
                  <td style={{ ...td, fontWeight: 700, color: checkGrupo.fecha ? 'var(--fs-success)' : 'var(--fs-danger)' }} colSpan={2}>
                    {checkGrupo.fecha ? 'Fecha com o consolidado declarado' : 'Diferença contra o consolidado declarado'}
                  </td>
                  <td style={{ ...num, fontWeight: 700, color: checkGrupo.fecha ? 'var(--fs-success)' : 'var(--fs-danger)' }}>
                    {fBRL(checkGrupo.diferenca)}
                  </td>
                  <td style={td}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!consol.ok && consol.faltando.length > 0 && (
          <div style={{ marginTop: 14, border: '1px solid var(--fs-warning)', borderRadius: 8, padding: 14, background: 'rgba(var(--fs-warning-rgb),0.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-warning)', marginBottom: 6 }}>Consolidado indisponível</div>
            <div style={{ fontSize: 12, color: 'var(--fs-text-3)', lineHeight: 1.7 }}>
              Sem âncora vigente em {fData(dataGrupo)} para: <strong>{consol.faltando.map(f => f.nome).join(', ')}</strong>.
              Um consolidado parcial subestima o caixa do grupo — por isso o total fica indisponível até que
              todas as entidades tenham saldo de abertura registrado.
            </div>
          </div>
        )}
        {consol.ok && consol.naoCertificadas.length > 0 && (
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--fs-warning)' }}>
            Ainda não conferidas contra extrato: <strong>{consol.naoCertificadas.join(', ')}</strong>.
            O consolidado é provisório enquanto houver âncora não certificada.
          </div>
        )}
      </div>

      {/* ── Entidade ─────────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}>Entidade</div>
        <div style={hint}>O saldo de abertura é sempre por entidade. O consolidado é a soma — nunca o contrário.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {empresas.map(e => (
            <button key={e.id} onClick={() => setEmpresaId(e.id)} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              fontWeight: empresaId === e.id ? 700 : 400,
              color: empresaId === e.id ? 'var(--fs-text-1)' : 'var(--fs-text-4)',
              background: empresaId === e.id ? 'var(--fs-surface-1)' : 'transparent',
              border: `1px solid ${empresaId === e.id ? 'var(--fs-brand)' : 'var(--fs-border)'}`,
            }}>{e.nome}</button>
          ))}
        </div>
      </div>

      {/* ── Cadastro da âncora ───────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}>Registrar saldo de abertura</div>
        <div style={hint}>
          Informe a posição de caixa conferida contra extrato bancário (bancos + caixa das contas da entidade)
          na abertura da data escolhida.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={label}>Data de corte</label>
            <input type="date" style={input} value={form.data_corte}
              onChange={e => setForm(f => ({ ...f, data_corte: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Saldo na abertura (R$)</label>
            <input style={input} placeholder="499.772,00" value={form.valor} inputMode="decimal"
              onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
          </div>
          <div>
            <label style={label}>Origem</label>
            <select style={input} value={form.origem}
              onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}>
              {Object.entries(ORIGENS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Observação</label>
          <input style={input} placeholder="Ex.: extrato consolidado Itaú + Bradesco + caixa, conferido em 12/08"
            value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fs-text-2)', cursor: 'pointer', marginBottom: 16 }}>
          <input type="checkbox" checked={form.conciliado}
            onChange={e => setForm(f => ({ ...f, conciliado: e.target.checked }))} />
          Conferido contra extrato bancário — registra você e a data como responsável pela certificação
        </label>
        {form.valor && normalizarValor(form.valor) !== null && (
          <div style={{ fontSize: 13, color: 'var(--fs-text-3)', marginBottom: 14 }}>
            Será gravado: <strong style={{ color: 'var(--fs-text-1)' }}>{fBRL(normalizarValor(form.valor))}</strong>
          </div>
        )}
        <button onClick={salvar} disabled={salvando} style={{
          padding: '9px 20px', borderRadius: 8, border: 'none', cursor: salvando ? 'default' : 'pointer',
          background: 'var(--fs-brand)', color: '#fff', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 7, opacity: salvando ? 0.6 : 1,
        }}>
          <SvgIcon name="save" size={14} color="#fff" />
          {salvando ? 'Gravando...' : 'Gravar saldo de abertura'}
        </button>
      </div>

      {/* ── Âncoras da entidade ──────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}>Âncoras de {nomeDe(empresaId)}</div>
        <div style={hint}>Uma linha por data de corte. A vigente para hoje aparece destacada.</div>
        {!daEntidade.length ? (
          <div style={{ fontSize: 13, color: 'var(--fs-text-4)', padding: '12px 0' }}>
            Nenhuma âncora registrada. Enquanto não houver, os saldos desta entidade ficam indisponíveis —
            por decisão de projeto o sistema não exibe um número que não consegue certificar.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Data de corte</th><th style={{ ...th, textAlign: 'right' }}>Valor</th>
                <th style={th}>Origem</th><th style={th}>Certificação</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {daEntidade.map(a => {
                  const ehVigente = vigente?.id === a.id
                  return (
                    <tr key={a.id} style={ehVigente ? { background: 'var(--fs-hover-2)' } : undefined}>
                      <td style={{ ...td, fontWeight: ehVigente ? 700 : 400, color: ehVigente ? 'var(--fs-text-1)' : 'var(--fs-text-2)' }}>
                        {fData(a.data_corte)}{ehVigente ? ' · vigente' : ''}
                      </td>
                      <td style={{ ...num, fontWeight: ehVigente ? 700 : 400 }}>{fBRL(a.valor)}</td>
                      <td style={td}>{ORIGENS[a.origem] || a.origem}</td>
                      <td style={td}>
                        {a.conciliado_em
                          ? <span style={{ color: 'var(--fs-success)' }}>Conferido em {fData(String(a.conciliado_em).split('T')[0])}</span>
                          : <span style={{ color: 'var(--fs-warning)' }}>Provisório — não conferido</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button onClick={() => remover(a.id, a.data_corte)} title="Remover âncora"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                          <SvgIcon name="trash" size={14} color="var(--fs-text-4)" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Prova de amarração ───────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardTitle}>Prova de amarração</div>
        <div style={hint}>
          Confere o saldo calculado pelo sistema contra o valor do extrato numa data.
          É esta prova que valida a escolha da data de corte antes de o número ir ao painel.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={label}>Conferir na data</label>
            <input type="date" style={input} value={dataProva}
              onChange={e => setDataProva(e.target.value)} />
          </div>
          <div>
            <label style={label}>Saldo do extrato (R$)</label>
            <input style={input} placeholder="209.627,00" value={declarado} inputMode="decimal"
              onChange={e => setDeclarado(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={carregarMovimentos} disabled={carregandoMov || !vigente} style={{
              padding: '9px 18px', borderRadius: 8, cursor: (carregandoMov || !vigente) ? 'default' : 'pointer',
              background: 'var(--fs-surface-1)', color: 'var(--fs-text-1)', fontSize: 13, fontWeight: 700,
              border: '1px solid var(--fs-border)', display: 'flex', alignItems: 'center', gap: 7,
              opacity: (carregandoMov || !vigente) ? 0.5 : 1,
            }}>
              <SvgIcon name="refresh" size={14} />
              {carregandoMov ? 'Calculando...' : 'Calcular'}
            </button>
          </div>
        </div>

        {!vigente && (
          <div style={{ fontSize: 13, color: 'var(--fs-warning)' }}>
            Nenhuma âncora vigente em {fData(dataProva)}. Registre um saldo de abertura com data de corte igual ou anterior a essa data.
          </div>
        )}

        {prova?.ok && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <tbody>
                <tr><td style={td}>Saldo de abertura em {fData(prova.ancora.data_corte)}</td>
                    <td style={num}>{fBRL(prova.ancora.valor)}</td></tr>
                <tr><td style={td}>(+) Entradas efetivas até {fData(dataProva)}</td>
                    <td style={{ ...num, color: 'var(--fs-success)' }}>{fBRL(prova.entradas)}</td></tr>
                <tr><td style={td}>(−) Saídas efetivas até {fData(dataProva)}</td>
                    <td style={{ ...num, color: 'var(--fs-danger)' }}>{fBRL(prova.saidas)}</td></tr>
                <tr><td style={{ ...td, fontWeight: 700, color: 'var(--fs-text-1)' }}>(=) Saldo calculado</td>
                    <td style={{ ...num, fontWeight: 700, color: 'var(--fs-text-1)', fontSize: 15 }}>{fBRL(prova.saldo)}</td></tr>
                {check?.ok && (
                  <tr>
                    <td style={{ ...td, fontWeight: 700, color: check.fecha ? 'var(--fs-success)' : 'var(--fs-danger)' }}>
                      {check.fecha ? 'Fecha com o extrato' : 'Diferença contra o extrato'}
                    </td>
                    <td style={{ ...num, fontWeight: 700, color: check.fecha ? 'var(--fs-success)' : 'var(--fs-danger)' }}>
                      {fBRL(check.diferenca)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {(prova.aproximados > 0 || prova.semSinal > 0 || (excluido && excluido.liquido !== 0)) && (
              <div style={{ border: '1px solid var(--fs-warning)', borderRadius: 8, padding: 14, marginBottom: 16, background: 'rgba(var(--fs-warning-rgb),0.06)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-warning)', marginBottom: 8 }}>Pontos de atenção</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--fs-text-3)', lineHeight: 1.8 }}>
                  {prova.aproximados > 0 && (
                    <li><strong>{prova.aproximados}</strong> efeito(s) sem data de liquidação, posicionados pelo vencimento — data aproximada, valor correto.</li>
                  )}
                  {prova.semSinal > 0 && (
                    <li><strong>{prova.semSinal}</strong> registro(s) de tipo não reconhecido, deixados fora da soma. Investigar antes de fechar.</li>
                  )}
                  {excluido && excluido.liquido !== 0 && (
                    <li>O corte exclui <strong>{fBRL(excluido.liquido)}</strong> líquidos anteriores a {fData(vigente.data_corte)} ({fBRL(excluido.entradas)} de entradas, {fBRL(excluido.saidas)} de saídas). Esse valor já está embutido no saldo de abertura — se ele parecer grande demais para ser passado antigo, a data de corte pode estar mal escolhida.</li>
                  )}
                </ul>
              </div>
            )}

            {mensal?.ok && mensal.meses.length > 0 && (
              <>
                <div style={{ ...cardTitle, marginTop: 8 }}>Conferência mensal</div>
                <div style={hint}>O fechamento de cada mês é a abertura do seguinte. Confira mês a mês contra o extrato.</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th style={th}>Mês</th>
                      <th style={{ ...th, textAlign: 'right' }}>Abertura</th>
                      <th style={{ ...th, textAlign: 'right' }}>Entradas</th>
                      <th style={{ ...th, textAlign: 'right' }}>Saídas</th>
                      <th style={{ ...th, textAlign: 'right' }}>Líquido</th>
                      <th style={{ ...th, textAlign: 'right' }}>Fechamento</th>
                    </tr></thead>
                    <tbody>
                      {mensal.meses.map(m => (
                        <tr key={m.mes}>
                          <td style={td}>{fMes(m.mes)}</td>
                          <td style={num}>{fBRL(m.abertura)}</td>
                          <td style={{ ...num, color: 'var(--fs-success)' }}>{fBRL(m.entradas)}</td>
                          <td style={{ ...num, color: 'var(--fs-danger)' }}>{fBRL(m.saidas)}</td>
                          <td style={{ ...num, color: m.liquido >= 0 ? 'var(--fs-success)' : 'var(--fs-danger)' }}>{fBRL(m.liquido)}</td>
                          <td style={{ ...num, fontWeight: 700, color: 'var(--fs-text-1)' }}>{fBRL(m.fechamento)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
