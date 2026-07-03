'use client'
import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SvgIcon from '@/components/SvgIcon'
import IntegracoesTab from '@/components/IntegracoesTab'

const inp = {
  width: '100%', background: 'var(--fs-input-bg)',
  border: '1px solid var(--fs-input-border)', borderRadius: 8,
  padding: '10px 14px', color: 'var(--fs-text-1)',   // ← sem hardcode de cor
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
const btn = (variant='primary') => ({
  background: variant === 'primary' ? 'var(--fs-brand)' : variant === 'danger'
    ? 'rgba(239,68,68,0.1)' : 'var(--fs-surface-2)',
  color: variant === 'primary' ? '#fff' : variant === 'danger'
    ? 'var(--fs-danger)' : 'var(--fs-text-2)',
  border: variant === 'danger' ? '1px solid rgba(239,68,68,0.2)'
    : variant === 'ghost' ? '1px solid var(--fs-border)' : 'none',
  borderRadius: 8, padding: '10px 20px', fontSize: 13,
  fontWeight: 700, cursor: 'pointer',
})
const card = {
  background: 'var(--fs-surface)', border: '1px solid var(--fs-border)',
  borderRadius: 12, padding: '24px', marginBottom: 16,
}
const cardTitle = {
  fontSize: 15, fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: 16,
}
const label = {
  display: 'block', color: 'var(--fs-text-2)', fontSize: 12,
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6,
}

export default function ConfiguracoesPage() {
  const searchParams = useSearchParams()
  const [tab,      setTab]      = useState(() => searchParams.get('tab') || 'perfil')
  const [perfil,   setPerfil]   = useState({ nome: '', email: '' })
  const [senha,    setSenha]    = useState('')
  const [empresa,  setEmpresa]  = useState({ nome: '', cnpj: '' })
  const [empresas, setEmpresas] = useState([])
  const [editEmp,  setEditEmp]  = useState(null) // { id, nome, cnpj }
  const [invite,   setInvite]   = useState({ email: '', role: 'org_admin' })
  const [inviteLink, setInviteLink] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [orgId,    setOrgId]    = useState(null)
  const [msg,      setMsg]      = useState({ text: '', tipo: '' })
  const [loading,  setLoading]  = useState(false)
  // ─── Logo da organização ───────────────────────────────────────
  const [logoUrl,        setLogoUrl]        = useState(null)
  const [logoUrlLight,   setLogoUrlLight]   = useState(null)
  const [logoUploading,  setLogoUploading]  = useState(null) // 'dark' | 'light' | null
  const logoInputRefDark  = React.useRef(null)
  const logoInputRefLight = React.useRef(null)
  // ─── Role do usuário logado e redefinição de senha ─────────────
  const [myRole,      setMyRole]      = useState(null)
  const [resetModal,  setResetModal]  = useState(null) // { userId, email } | null
  const [resetResult, setResetResult] = useState(null) // { email, password } | null
  const [resetting,   setResetting]   = useState(false)
  // ──────────────────────────────────────────────────────────────

  const toast = (text, tipo = 'success') => {
    setMsg({ text, tipo })
    setTimeout(() => setMsg({ text: '', tipo: '' }), 4000)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setPerfil({ nome: user.user_metadata?.nome || user.email?.split('@')[0] || '', email: user.email || '' })

        const { data: p } = await supabase.from('profiles').select('organization_id, role').eq('id', user.id).single()
        if (p?.organization_id) {
          setOrgId(p.organization_id)
          setMyRole(p.role)
          const [{ data: emps }, { data: orgRow }] = await Promise.all([
            supabase.from('empresas').select('id,nome,cnpj').eq('organization_id', p.organization_id).order('nome'),
            supabase.from('organizations').select('*').eq('id', p.organization_id).maybeSingle(),
          ])
          setEmpresas(emps || [])
          if (orgRow?.logo_url) setLogoUrl(orgRow.logo_url)
          if (orgRow?.logo_url_light) setLogoUrlLight(orgRow.logo_url_light)

          // Super admin vê TODOS os usuários do sistema (via API global)
          if (p.role === 'super_admin') {
            try {
              const { data: { session } } = await supabase.auth.getSession()
              const res = await fetch('/api/admin/list-all-users', {
                headers: { Authorization: `Bearer ${session?.access_token}` }
              })
              const json = await res.json()
              if (res.ok) {
                setUsuarios((json.users || []).map(u => ({
                  id: u.id, email: u.email, role: u.role,
                  created_at: u.created_at, org_nome: u.org_nome, has_profile: u.has_profile,
                })))
              }
            } catch (_e) {}
          } else {
            const { data: users } = await supabase.from('profiles')
              .select('id,email,role,created_at').eq('organization_id', p.organization_id)
            setUsuarios(users || [])
          }
        } else {
          // Usuário sem organization_id: não deve ver empresas de NENHUMA
          // organização (estado de perfil incompleto/inconsistente).
          setEmpresas([])
        }
      }
    }
    load()
  }, [])

  // ─── Upload de logo ────────────────────────────────────────────
  const uploadLogo = async (file, variant) => {
    if (!file || !orgId) return
    setLogoUploading(variant)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('variant', variant)
      const res = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (session ? session.access_token : '') },
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error || 'Erro no upload', 'error'); return }
      if (variant === 'light') setLogoUrlLight(json.logo_url)
      else setLogoUrl(json.logo_url)
      toast('Logo (' + (variant === 'light' ? 'tema claro' : 'tema escuro') + ') atualizada!')
    } catch (err) {
      toast('Erro: ' + err.message, 'error')
    } finally { setLogoUploading(null) }
  }

  const removerLogo = async (variant) => {
    if (!orgId || !confirm('Remover a logo do ' + (variant === 'light' ? 'tema claro' : 'tema escuro') + '?')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/upload-logo?variant=' + variant, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + (session ? session.access_token : '') },
      })
      if (!res.ok) { const j = await res.json(); toast(j.error || 'Erro ao remover', 'error'); return }
      if (variant === 'light') setLogoUrlLight(null)
      else setLogoUrl(null)
      toast('Logo removida.')
    } catch (err) {
      toast('Erro: ' + err.message, 'error')
    }
  }
  // ──────────────────────────────────────────────────────────────

  // ─── Redefinição de senha (super_admin) ───────────────────────
  const resetarSenha = async () => {
    if (!resetModal) return
    setResetting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId: resetModal.userId }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error || 'Erro ao redefinir', 'error'); return }
      setResetModal(null)
      setResetResult({ email: json.email, password: json.password })
    } finally { setResetting(false) }
  }
  // ──────────────────────────────────────────────────────────────

  const salvarPerfil = async (e) => {
    e.preventDefault(); setLoading(true)
    const updates = { data: { nome: perfil.nome } }
    if (senha) updates.password = senha
    const { error } = await supabase.auth.updateUser(updates)
    setLoading(false)
    toast(error ? 'Erro ao salvar: ' + error.message : '✓ Perfil atualizado!', error ? 'error' : 'success')
    if (!error) setSenha('')
  }

  const addEmpresa = async (e) => {
    e.preventDefault(); if (!empresa.nome.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = { nome: empresa.nome, cnpj: empresa.cnpj, user_id: user.id }
    if (orgId) payload.organization_id = orgId
    const { data, error } = await supabase.from('empresas').insert([payload]).select().single()
    setLoading(false)
    if (error) toast('Erro: ' + error.message, 'error')
    else { setEmpresas(prev => [...prev, data]); setEmpresa({ nome: '', cnpj: '' }); toast('✓ Empresa adicionada!') }
  }

  const salvarEmpresa = async () => {
    if (!editEmp) return; setLoading(true)
    const { error } = await supabase.from('empresas').update({ nome: editEmp.nome, cnpj: editEmp.cnpj }).eq('id', editEmp.id)
    setLoading(false)
    if (error) toast('Erro: ' + error.message, 'error')
    else {
      setEmpresas(prev => prev.map(e => e.id === editEmp.id ? editEmp : e))
      setEditEmp(null); toast('✓ Empresa atualizada!')
    }
  }

  const gerarConvite = async (e) => {
    e.preventDefault(); if (!invite.email.trim() || !orgId) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('invites').insert({
      organization_id: orgId, email: invite.email, role: invite.role, created_by: user.id
    }).select().single()
    setLoading(false)
    if (error) { toast('Erro: ' + error.message, 'error'); return }
    const link = `${window.location.origin}/aceitar-convite?token=${data.token}`
    setInviteLink(link); setInvite({ email: '', role: 'org_admin' })
    toast('✓ Link de convite gerado!')
  }

  const TABS = [
    { v: 'perfil',      l: 'Perfil',           icon: 'user'       },
    { v: 'empresas',    l: 'Empresas',          icon: 'building'   },
    { v: 'usuarios',    l: 'Usuários',          icon: 'users'      },
    { v: 'identidade',  l: 'Identidade Visual', icon: 'paintBrush' },
    ...(['admin','super_admin'].includes(myRole) ? [{ v: 'integracoes', l: 'Integrações (API)', icon: 'plug' }] : []),
  ]

  return (
    <div style={{ color: 'var(--fs-text-1)' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fs-text-1)', margin: 0 }}>Configurações</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--fs-surface)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--fs-border)' }}>
        {TABS.map(({ v, l, icon }) => (
          <button key={v} onClick={() => setTab(v)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: tab === v ? 700 : 400,
            color: tab === v ? 'var(--fs-text-1)' : 'var(--fs-text-4)',
            background: tab === v ? 'var(--fs-surface-2)' : 'transparent',
            border: tab === v ? '1px solid var(--fs-border)' : '1px solid transparent',
            cursor: 'pointer',
          }}>
            <SvgIcon name={icon} size={14} color={tab === v ? 'var(--fs-brand)' : 'currentColor'} />
            {l}
          </button>
        ))}
      </div>

      {/* Toast */}
      {msg.text && (
        <div style={{
          background: msg.tipo === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          border: `1px solid ${msg.tipo === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          borderRadius: 8, padding: '10px 14px',
          color: msg.tipo === 'error' ? 'var(--fs-danger)' : 'var(--fs-success)',
          fontSize: 13, marginBottom: 16,
        }}>{msg.text}</div>
      )}

      {/* ── Perfil ── */}
      {tab === 'perfil' && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: 4 }}>Dados do Perfil</div>
          <div style={{ color: 'var(--fs-text-4)', fontSize: 13, marginBottom: 20 }}>Atualize suas informações de acesso</div>
          <form onSubmit={salvarPerfil}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={label}>Nome</label>
                <input style={inp} value={perfil.nome} onChange={e => setPerfil({ ...perfil, nome: e.target.value })} placeholder="Seu nome" />
              </div>
              <div>
                <label style={label}>E-mail</label>
                <input style={{ ...inp, opacity: 0.6, cursor: 'not-allowed' }} value={perfil.email} disabled />
              </div>
            </div>
            <label style={label}>Nova Senha</label>
            <input style={{ ...inp, marginBottom: 20 }} type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Deixe em branco para não alterar" />
            <button type="submit" style={btn('primary')} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </div>
      )}

      {/* ── Empresas ── */}
      {tab === 'empresas' && (
        <>
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: 4 }}>Empresas Cadastradas</div>
            <div style={{ color: 'var(--fs-text-4)', fontSize: 13, marginBottom: 16 }}>{empresas.length} empresa{empresas.length !== 1 ? 's' : ''} vinculada{empresas.length !== 1 ? 's' : ''}</div>
            {empresas.length === 0
              ? <p style={{ color: 'var(--fs-text-4)', fontSize: 13 }}>Nenhuma empresa cadastrada.</p>
              : empresas.map(emp => (
                <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--fs-bg)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--fs-border)' }}>
                  {editEmp?.id === emp.id ? (
                    <div style={{ display: 'flex', gap: 10, flex: 1, marginRight: 10 }}>
                      <input style={{ ...inp, marginBottom: 0, flex: 2 }} value={editEmp.nome} onChange={e => setEditEmp({ ...editEmp, nome: e.target.value })} />
                      <input style={{ ...inp, marginBottom: 0, flex: 1 }} value={editEmp.cnpj || ''} onChange={e => setEditEmp({ ...editEmp, cnpj: e.target.value })} placeholder="CNPJ" />
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--fs-text-1)', fontSize: 14 }}>{emp.nome}</div>
                      <div style={{ color: 'var(--fs-text-4)', fontSize: 12, marginTop: 2 }}>CNPJ: {emp.cnpj || 'Não informado'}</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {editEmp?.id === emp.id ? (
                      <>
                        <button onClick={salvarEmpresa} style={{ ...btn('primary'), padding: '6px 14px', fontSize: 12 }}>✓ Salvar</button>
                        <button onClick={() => setEditEmp(null)} style={{ ...btn('ghost'), padding: '6px 12px', fontSize: 12 }}>Cancelar</button>
                      </>
                    ) : (
                      <button onClick={() => setEditEmp({ ...emp })} style={{ ...btn('ghost'), padding: '6px 14px', fontSize: 12 }}>Editar</button>
                    )}
                  </div>
                </div>
              ))
            }
          </div>

          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: 4 }}>+ Nova Empresa</div>
            <div style={{ color: 'var(--fs-text-4)', fontSize: 13, marginBottom: 20 }}>Cadastre uma nova empresa para gerenciar</div>
            <form onSubmit={addEmpresa}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={label}>Razão Social</label>
                  <input style={inp} value={empresa.nome} onChange={e => setEmpresa({ ...empresa, nome: e.target.value })} placeholder="Nome da empresa" required />
                </div>
                <div>
                  <label style={label}>CNPJ</label>
                  <input style={inp} value={empresa.cnpj} onChange={e => setEmpresa({ ...empresa, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
                </div>
              </div>
              <button type="submit" style={btn('primary')} disabled={loading || !empresa.nome.trim()}>
                {loading ? 'Adicionando...' : '+ Adicionar Empresa'}
              </button>
            </form>
          </div>
        </>
      )}

      {/* ── Usuários ── */}
      {tab === 'usuarios' && (
        <>
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: 4 }}>
              {myRole === 'super_admin' ? 'Todos os Usuários do Sistema' : 'Usuários da Organização'}
            </div>
            <div style={{ color: 'var(--fs-text-4)', fontSize: 13, marginBottom: 16 }}>{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''} cadastrado{usuarios.length !== 1 ? 's' : ''}</div>
            {usuarios.length === 0
              ? <p style={{ color: 'var(--fs-text-4)', fontSize: 13 }}>Nenhum usuário ainda. Envie um convite abaixo.</p>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fs-border)' }}>
                      {['E-mail', 'Perfil', 'Desde', ...(myRole === 'super_admin' ? ['Acesso'] : [])].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--fs-text-4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--fs-border)' }}>
                        <td style={{ padding: '10px', color: 'var(--fs-text-1)', fontWeight: 500 }}>{u.email || '—'}</td>
                        <td style={{ padding: '10px' }}>
                          <select
                            value={u.role}
                            onChange={async e => {
                              const newRole = e.target.value
                              const prev = u.role
                              const { data: { session } } = await supabase.auth.getSession()
                              const res = await fetch('/api/admin/update-role', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                                body: JSON.stringify({ userId: u.id, newRole }),
                              })
                              const json = await res.json()
                              if (res.ok) {
                                setUsuarios(prevList => prevList.map(x => x.id === u.id ? { ...x, role: newRole } : x))
                                toast('Permissão atualizada')
                              } else {
                                toast('Erro: ' + (json.error || 'falha ao atualizar'), 'error')
                                // reverter visualmente
                                setUsuarios(prevList => prevList.map(x => x.id === u.id ? { ...x, role: prev } : x))
                              }
                            }}
                            style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:6, color:'var(--fs-text-1)', padding:'3px 8px', fontSize:11, fontWeight:700, cursor:'pointer', outline:'none' }}
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="org_admin">Administrador</option>
                            <option value="user">Usuário</option>
                          </select>
                        </td>
                        <td style={{ padding: '10px', color: 'var(--fs-text-4)', fontSize: 12 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                        {myRole === 'super_admin' && (
                          <td style={{ padding: '10px' }}>
                            <button
                              onClick={() => setResetModal({ userId: u.id, email: u.email })}
                              style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:6, color:'#f59e0b', padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 }}
                            >
                              <SvgIcon name="lock" size={11} color="currentColor" /> Redefinir Senha
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>

          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: 4 }}>+ Convidar Usuário</div>
            <div style={{ color: 'var(--fs-text-4)', fontSize: 13, marginBottom: 20 }}>Gere um link de acesso para um novo usuário (válido por 7 dias)</div>
            {!orgId && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--fs-warning)', fontSize: 13, marginBottom: 16 }}>
                Conta não vinculada a uma organização. Contate o administrador do sistema.
              </div>
            )}
            <form onSubmit={gerarConvite} style={{ opacity: orgId ? 1 : 0.5, pointerEvents: orgId ? 'auto' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={label}>E-mail do Convidado</label>
                  <input style={inp} type="email" value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} placeholder="email@empresa.com" required />
                </div>
                <div>
                  <label style={label}>Perfil de Acesso</label>
                  <select style={{ ...inp }} value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value })}>
                    <option value="super_admin">Super Admin</option>
                    <option value="org_admin">Administrador</option>
                    <option value="user">Usuário</option>
                  </select>
                </div>
              </div>
              <button type="submit" style={btn('primary')} disabled={loading || !invite.email.trim()}>
                {loading ? 'Gerando...' : <><SvgIcon name="link" size={13} style={{marginRight:6}} />Gerar Link de Convite</>}
              </button>
            </form>

            {inviteLink && (
              <div style={{ marginTop: 16, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: 'var(--fs-success)', fontWeight: 700, marginBottom: 8 }}>Link gerado — válido por 7 dias:</div>
                <div style={{ fontSize: 12, color: 'var(--fs-text-2)', wordBreak: 'break-all', marginBottom: 8 }}>{inviteLink}</div>
                <button onClick={() => { navigator.clipboard.writeText(inviteLink); toast('Link copiado!') }} style={{ ...btn('ghost'), padding: '6px 14px', fontSize: 12, display:'flex', alignItems:'center', gap:6 }}>
                  <SvgIcon name="copy" size={13} /> Copiar Link
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Tab: Identidade Visual ───────────────────────────── */}
      {tab === 'integracoes' && ['admin','super_admin'].includes(myRole) && (
        <IntegracoesTab empresas={empresas} showToast={toast} />
      )}

      {tab === 'identidade' && (
        <>
          <div style={card}>
            <div style={cardTitle}>Logo da Organização</div>
            <p style={{ fontSize: 13, color: 'var(--fs-text-4)', marginBottom: 20, lineHeight: 1.6 }}>
              A logo será exibida na tela de login e no cabeçalho do sistema, acompanhando o tema ativo.
              Envie uma versão para cada tema — se apenas uma for enviada, ela será usada em ambos.
              Formatos: PNG, JPG ou SVG. Tamanho recomendado: 200×60px.
            </p>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {/* ── Logo Tema Escuro ── */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--fs-text-4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
                  Tema Escuro
                </div>
                <div style={{ width: 280, height: 90, background: '#0f172a', border: '1px solid var(--fs-border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 12 }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="Logo tema escuro" style={{ maxWidth: '90%', maxHeight: '80px', objectFit: 'contain' }} />
                    : <span style={{ fontSize: 12, color: '#7b96ab' }}>Sem logo cadastrada</span>
                  }
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    ref={logoInputRefDark}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0], 'dark'); e.target.value = '' }}
                  />
                  <button
                    onClick={() => logoInputRefDark.current?.click()}
                    disabled={!!logoUploading || !orgId}
                    style={{ ...btn('primary'), opacity: (logoUploading || !orgId) ? 0.6 : 1, display:'flex', alignItems:'center', gap:7, fontSize: 12, padding: '8px 14px' }}
                  >
                    <SvgIcon name="upload" size={13} color="#fff" />
                    {logoUploading === 'dark' ? 'Enviando...' : 'Selecionar'}
                  </button>
                  {logoUrl && (
                    <button onClick={() => removerLogo('dark')} style={{ ...btn('ghost'), color: 'var(--fs-danger)', borderColor: 'rgba(248,113,113,0.3)', display:'flex', alignItems:'center', gap:6, fontSize: 12, padding: '8px 12px' }}>
                      <SvgIcon name="trash" size={13} color="var(--fs-danger)" />
                      Remover
                    </button>
                  )}
                </div>
              </div>

              {/* ── Logo Tema Claro ── */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--fs-text-4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
                  Tema Claro
                </div>
                <div style={{ width: 280, height: 90, background: '#f8fafc', border: '1px solid var(--fs-border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 12 }}>
                  {logoUrlLight
                    ? <img src={logoUrlLight} alt="Logo tema claro" style={{ maxWidth: '90%', maxHeight: '80px', objectFit: 'contain' }} />
                    : <span style={{ fontSize: 12, color: '#64748b' }}>Sem logo cadastrada</span>
                  }
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    ref={logoInputRefLight}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0], 'light'); e.target.value = '' }}
                  />
                  <button
                    onClick={() => logoInputRefLight.current?.click()}
                    disabled={!!logoUploading || !orgId}
                    style={{ ...btn('primary'), opacity: (logoUploading || !orgId) ? 0.6 : 1, display:'flex', alignItems:'center', gap:7, fontSize: 12, padding: '8px 14px' }}
                  >
                    <SvgIcon name="upload" size={13} color="#fff" />
                    {logoUploading === 'light' ? 'Enviando...' : 'Selecionar'}
                  </button>
                  {logoUrlLight && (
                    <button onClick={() => removerLogo('light')} style={{ ...btn('ghost'), color: 'var(--fs-danger)', borderColor: 'rgba(248,113,113,0.3)', display:'flex', alignItems:'center', gap:6, fontSize: 12, padding: '8px 12px' }}>
                      <SvgIcon name="trash" size={13} color="var(--fs-danger)" />
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>

            {!orgId && (
              <p style={{ marginTop: 12, fontSize: 12, color: 'var(--fs-warning)' }}>
                Sua conta não está associada a uma organização. A logo requer uma organização configurada.
              </p>
            )}

          </div>
        </>
      )}
      {/* ─── Modal: Confirmar redefinição de senha ───────────────── */}
      {resetModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:14, padding:28, width:420, maxWidth:'90vw' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--fs-text-1)', marginBottom:10 }}>Redefinir senha</div>
            <p style={{ fontSize:13, color:'var(--fs-text-3)', marginBottom:20, lineHeight:1.6 }}>
              Será gerada uma nova senha aleatória para <strong style={{ color:'var(--fs-text-1)' }}>{resetModal.email}</strong>.
              A senha anterior deixará de funcionar imediatamente.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setResetModal(null)} style={{ ...btn('ghost'), padding:'8px 18px' }}>Cancelar</button>
              <button onClick={resetarSenha} disabled={resetting} style={{ ...btn('primary'), padding:'8px 18px', opacity: resetting ? 0.6 : 1 }}>
                {resetting ? 'Gerando...' : 'Confirmar e Gerar Nova Senha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Exibir nova senha ────────────────────────────── */}
      {resetResult && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:14, padding:28, width:440, maxWidth:'90vw' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#10b981', marginBottom:10 }}>Senha redefinida com sucesso</div>
            <p style={{ fontSize:13, color:'var(--fs-text-3)', marginBottom:16, lineHeight:1.6 }}>
              Compartilhe as credenciais abaixo com o usuário. Esta janela é a única oportunidade de visualizar a senha.
            </p>
            <div style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
              <div style={{ fontSize:12, color:'var(--fs-text-4)', marginBottom:4 }}>E-MAIL</div>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--fs-text-1)', marginBottom:12 }}>{resetResult.email}</div>
              <div style={{ fontSize:12, color:'var(--fs-text-4)', marginBottom:4 }}>NOVA SENHA</div>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--fs-text-1)', letterSpacing:2, fontFamily:'monospace' }}>{resetResult.password}</div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button
                onClick={() => { navigator.clipboard.writeText(`E-mail: ${resetResult.email}\nSenha: ${resetResult.password}`); toast('Credenciais copiadas!') }}
                style={{ ...btn('ghost'), padding:'8px 18px', display:'flex', alignItems:'center', gap:6 }}
              >
                <SvgIcon name="copy" size={13} /> Copiar Credenciais
              </button>
              <button onClick={() => setResetResult(null)} style={{ ...btn('primary'), padding:'8px 18px' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
