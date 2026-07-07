
'use client'
// ─── Integrações via API (Bling) — configuração por entidade ─────────────────
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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

export default function IntegracoesTab({ empresas, showToast }) {
  const [estado, setEstado] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [sync, setSync] = useState({})      // { [integId]: { rodando, log } }
  const [form, setForm] = useState({})      // { [empresaId]: { client_id, client_secret } }

  const carregar = useCallback(async () => {
    const r = await authFetch('/api/integracoes')
    if (r.error) { showToast?.(r.error, 'error'); return }
    setEstado(r)
  }, [showToast])
  useEffect(() => { carregar() }, [carregar])

  // Feedback do retorno do OAuth (?bling=ok|erro_*)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('bling')
    if (!q) return
    if (q === 'ok') showToast?.('Bling conectado com sucesso', 'success')
    else showToast?.('Falha na conexão com o Bling — verifique as credenciais e o Redirect URI', 'error')
    window.history.replaceState({}, '', '/dashboard/configuracoes?tab=integracoes')
  }, [showToast])

  const salvar = async (empresaId, extra = {}) => {
    setSalvando(true)
    const f = form[empresaId] || {}
    const r = await authFetch('/api/integracoes', {
      method: 'POST',
      body: JSON.stringify({ empresa_id: empresaId, client_id: f.client_id, client_secret: f.client_secret, ...extra }),
    })
    setSalvando(false)
    if (r.error) { showToast?.(r.error, 'error'); return }
    showToast?.('Integração atualizada', 'success')
    setForm(fm => ({ ...fm, [empresaId]: {} }))
    carregar()
  }

  const enriquecer = async (integ) => {
    setSync(sx => ({ ...sx, [integ.id]: { rodando: true, log: 'Enriquecendo títulos (nomes, categorias, competência, datas)...' } }))
    let feitos = 0, erros = 0, guarda = 0, primeira = true, avisoEscopo = null
    try {
      while (guarda++ < 500) {
        const r = await authFetch('/api/integracoes/bling/enrich', {
          method: 'POST',
          body: JSON.stringify({ integracao_id: integ.id, setup: primeira }),
        })
        primeira = false
        if (r.error) throw new Error(r.error)
        feitos += r.processados || 0; erros += r.erros || 0
        if (r.escopo_contatos && r.escopo_contatos !== 'ok') avisoEscopo = r.escopo_contatos
        setSync(sx => ({ ...sx, [integ.id]: { rodando: true, log: `Enriquecidos ${feitos} · restantes ${r.restantes}${erros ? ` · ${erros} erros` : ''}` } }))
        if (r.concluido) break
      }
      const fim = `Enriquecimento concluído: ${feitos} títulos${erros ? ` · ${erros} erros` : ''}${avisoEscopo ? ` · ATENÇÃO: ${avisoEscopo}` : ''}`
      setSync(sx => ({ ...sx, [integ.id]: { rodando: false, log: fim } }))
      showToast?.(avisoEscopo ? 'Concluído com aviso de escopo — veja o card' : `Enriquecimento concluído: ${feitos} títulos`, avisoEscopo ? 'error' : 'success')
    } catch (e) {
      setSync(sx => ({ ...sx, [integ.id]: { rodando: false, log: `Erro: ${e.message}` } }))
      showToast?.('Erro no enriquecimento: ' + e.message, 'error')
    }
    carregar()
  }

  const sincronizar = async (integ, modulo) => {
    // Anti-duplicidade título CSV × título API: oferecer substituição dos
    // registros de origem arquivo (sem doc_ref) desta entidade
    const limpar = window.confirm(
      `Substituir os registros de ${modulo === 'dre' ? 'DRE' : 'Fluxo de Caixa'} importados por ARQUIVO desta entidade pelos dados da API?\n\n` +
      `Recomendado: a API traz o histórico completo e evita duplicidade com importações antigas por CSV.\n\n` +
      `OK = substituir (remove os registros sem vínculo com a API antes de gravar)\nCancelar = manter e apenas adicionar/atualizar os vindos da API`)
    setSync(sx => ({ ...sx, [integ.id]: { rodando: true, log: `Sincronizando ${modulo.toUpperCase()}...` } }))
    let fase = 0, pagina = 1, total = 0, pend = 0, guarda = 0
    try {
      while (guarda++ < 60) {
        const r = await authFetch('/api/integracoes/bling/sync', {
          method: 'POST',
          body: JSON.stringify({ integracao_id: integ.id, modulo, fase, pagina, limpar_origem_arquivo: limpar && fase === 0 && pagina === 1 }),
        })
        if (r.error) throw new Error(r.error)
        total += r.gravados || 0; pend += r.total_pendencias || 0
        setSync(sx => ({ ...sx, [integ.id]: { rodando: true, log: `${r.recurso} · pág. ${r.pagina} · ${total} gravados${pend ? ` · ${pend} pendências` : ''}` } }))
        if (!r.hasMore) break
        fase = r.next.fase; pagina = r.next.pagina
      }
      setSync(sx => ({ ...sx, [integ.id]: { rodando: false, log: `Concluído: ${total} títulos gravados${pend ? ` · ${pend} pendências (ver último resultado)` : ''}` } }))
      showToast?.(`Sincronização ${modulo.toUpperCase()} concluída: ${total} títulos`, 'success')
    } catch (e) {
      setSync(sx => ({ ...sx, [integ.id]: { rodando: false, log: `Erro: ${e.message}` } }))
      showToast?.('Erro na sincronização: ' + e.message, 'error')
    }
    carregar()
  }

  if (!estado) return <div style={{ padding: 40, color: 'var(--fs-text-4)', fontSize: 13 }}>Carregando integrações...</div>

  const { liberacao, integracoes } = estado
  const nadaLiberado = !liberacao.dre && !liberacao.fluxo

  if (nadaLiberado) return (
    <EmptyState icon="plug" title="Importação via API não liberada">
      A liberação da integração via API (Bling) é feita pela administração do sistema, por módulo (DRE e/ou Fluxo de Caixa). Solicite a liberação para habilitar esta área.
    </EmptyState>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12.5, color: 'var(--fs-text-4)', lineHeight: 1.6 }}>
        Módulos liberados pela administração:{' '}
        {liberacao.dre && <b style={{ color: 'var(--fs-text-2)' }}>DRE</b>}{liberacao.dre && liberacao.fluxo && ' · '}
        {liberacao.fluxo && <b style={{ color: 'var(--fs-text-2)' }}>Fluxo de Caixa</b>}.
        Com um módulo ativo via API, a importação por arquivo desse módulo é desabilitada para evitar duplicidade.
      </div>

      {empresas.map(emp => {
        const integ = integracoes.find(i => i.empresa_id === emp.id)
        const f = form[emp.id] || {}
        const st = sync[integ?.id] || {}
        return (
          <div key={emp.id} style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{emp.nome}</div>
              {integ?.conectado
                ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-success)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: '3px 10px' }}>Bling conectado</span>
                : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-text-4)', background: 'var(--fs-hover-2)', borderRadius: 20, padding: '3px 10px' }}>Não conectado</span>}
            </div>

            {/* Credenciais do app Bling */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end', marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--fs-text-4)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>Client ID</label>
                <input value={f.client_id ?? ''} onChange={e => setForm(fm => ({ ...fm, [emp.id]: { ...f, client_id: e.target.value } }))}
                  placeholder={integ?.credenciais_ok ? '•••••• (configurado)' : 'Client ID do app Bling'}
                  style={{ width: '100%', background: 'var(--fs-bg)', border: '1px solid var(--fs-border)', borderRadius: 8, color: 'var(--fs-text-1)', fontSize: 13, padding: '9px 12px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--fs-text-4)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 5 }}>Client Secret</label>
                <input type="password" value={f.client_secret ?? ''} onChange={e => setForm(fm => ({ ...fm, [emp.id]: { ...f, client_secret: e.target.value } }))}
                  placeholder={integ?.credenciais_ok ? '•••••• (configurado)' : 'Client Secret do app Bling'}
                  style={{ width: '100%', background: 'var(--fs-bg)', border: '1px solid var(--fs-border)', borderRadius: 8, color: 'var(--fs-text-1)', fontSize: 13, padding: '9px 12px', outline: 'none' }} />
              </div>
              <button onClick={() => salvar(emp.id)} disabled={salvando || (!f.client_id && !f.client_secret)}
                style={{ background: 'var(--fs-bg)', border: '1px solid var(--fs-border)', borderRadius: 8, padding: '9px 16px', color: 'var(--fs-text-2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: (salvando || (!f.client_id && !f.client_secret)) ? 0.5 : 1 }}>
                Salvar
              </button>
            </div>

            {integ?.credenciais_ok && !integ?.conectado && integ?.authorize_url && (
              <a href={integ.authorize_url}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#3b82f6', color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', marginBottom: 14 }}>
                <SvgIcon name="plug" size={14} color="#fff" />
                Conectar ao Bling (OAuth)
              </a>
            )}

            {integ?.conectado && (
              <>
                {/* Módulos — apenas os liberados pela administração */}
                <div style={{ display: 'flex', gap: 18, marginBottom: 14, flexWrap: 'wrap' }}>
                  {[['dre', 'DRE (lançamentos)', liberacao.dre, integ.modulo_dre_ativo],
                    ['fluxo', 'Fluxo de Caixa', liberacao.fluxo, integ.modulo_fluxo_ativo]].map(([mod, rot, lib, ativo]) => (
                    <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: lib ? 'var(--fs-text-2)' : 'var(--fs-text-4)', cursor: lib ? 'pointer' : 'not-allowed' }}>
                      <input type="checkbox" checked={!!ativo} disabled={!lib}
                        onChange={e => salvar(emp.id, mod === 'dre' ? { modulo_dre_ativo: e.target.checked } : { modulo_fluxo_ativo: e.target.checked })} />
                      Importar {rot} via API {!lib && '(não liberado)'}
                    </label>
                  ))}
                </div>

                {/* Sincronização */}
                {!integ.modulo_dre_ativo && !integ.modulo_fluxo_ativo && (
                  <div style={{ fontSize: 12, color: 'var(--fs-text-4)', background: 'var(--fs-hover)', border: '1px dashed var(--fs-border)', borderRadius: 8, padding: '10px 14px' }}>
                    Ative ao menos um módulo acima para habilitar o botão de sincronização.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {integ.modulo_fluxo_ativo && (
                    <button onClick={() => sincronizar(integ, 'fluxo')} disabled={st.rodando}
                      style={{ background: 'var(--fs-bg)', border: '1px solid var(--fs-border)', borderRadius: 8, padding: '8px 14px', color: 'var(--fs-text-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: st.rodando ? 0.5 : 1 }}>
                      Sincronizar Fluxo agora
                    </button>
                  )}
                  {integ.modulo_dre_ativo && (
                    <button onClick={() => sincronizar(integ, 'dre')} disabled={st.rodando}
                      style={{ background: 'var(--fs-bg)', border: '1px solid var(--fs-border)', borderRadius: 8, padding: '8px 14px', color: 'var(--fs-text-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: st.rodando ? 0.5 : 1 }}>
                      Sincronizar DRE agora
                    </button>
                  )}
                  {(integ.modulo_fluxo_ativo || integ.modulo_dre_ativo) && (
                    <button onClick={() => enriquecer(integ)} disabled={st.rodando}
                      title="Completa nome do cliente/fornecedor, categoria, competência, data de pagamento e parciais buscando o detalhe de cada título"
                      style={{ background: 'var(--fs-bg)', border: '1px solid var(--fs-border)', borderRadius: 8, padding: '8px 14px', color: 'var(--fs-text-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: st.rodando ? 0.5 : 1 }}>
                      Enriquecer dados
                    </button>
                  )}
                  {integ.ultima_sync && !st.log && (
                    <span style={{ fontSize: 11.5, color: 'var(--fs-text-4)' }}>
                      Última sincronização: {new Date(integ.ultima_sync).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
                {st.log && <div style={{ marginTop: 10, fontSize: 12, color: st.log.startsWith('Erro') ? 'var(--fs-danger)' : 'var(--fs-text-3)', fontFamily: 'var(--fs-font-body)' }}>{st.log}</div>}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
