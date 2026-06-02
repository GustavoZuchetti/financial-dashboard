'use client'
import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const [logoUrl,      setLogoUrl]      = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = React.useRef(null)
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
          const [{ data: emps }, { data: users }, { data: settings }] = await Promise.all([
            supabase.from('empresas').select('id,nome,cnpj').eq('organization_id', p.organization_id).order('nome'),
            supabase.from('profiles').select('id,email,role,created_at').eq('organization_id', p.organization_id),
            supabase.from('org_settings').select('logo_url').eq('organization_id', p.organization_id).maybeSingle(),
          ])
          setEmpresas(emps || [])
          setUsuarios(users || [])
          if (settings?.logo_url) setLogoUrl(settings.logo_url)
        } else {
          const { data: emps } = await supabase.from('empresas').select('id,nome,cnpj').order('nome')
          setEmpresas(emps || [])
        }
      }
    }
    load()
  }, [])

  // ─── Upload de logo ────────────────────────────────────────────
  const uploadLogo = async (file) => {
    if (!file || !orgId) return
    setLogoUploading(true)
    try {
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `logos/${orgId}/logo.${ext}`
      const { error: upErr } = await supabase.storage.from('org-assets').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) { toast('Erro no upload: ' + upErr.message, 'error'); return }
      const { data: { publicUrl } } = supabase.storage.from('org-assets').getPublicUrl(path)
      // Salvar URL na tabela org_settings
      const { error: dbErr } = await supabase.from('org_settings').upsert(
        { organization_id: orgId, logo_url: publicUrl + `?v=${Date.now()}`, updated_at: new Date().toISOString() },
        { onConflict: 'organization_id' }
      )
      if (dbErr) { toast('Erro ao salvar logo: ' + dbErr.message, 'error'); return }
      setLogoUrl(publicUrl + `?v=${Date.now()}`)
      toast('✓ Logo atualizada com sucesso!')
    } finally { setLogoUploading(false) }
  }

  const removerLogo = async () => {
    if (!orgId || !confirm('Remover a logo da organização?')) return
    await supabase.from('org_settings').upsert(
      { organization_id: orgId, logo_url: null, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id' }
    )
    setLogoUrl(null)
    toast('Logo removida.')
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
    { v: 'perfil',      l: '👤 Perfil'            },
    { v: 'empresas',    l: '🏢 Empresas'          },
    { v: 'usuarios',    l: '👥 Usuários'          },
    { v: 'identidade',  l: '🎨 Identidade Visual' },
  ]

  return (
    <div style={{ color: 'var(--fs-text-1)' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fs-text-1)', margin: 0 }}>Configurações</h1>
        <p style={{ color: 'var(--fs-text-4)', fontSize: 13, margin: '4px 0 0' }}>Gerencie seu perfil, empresas e usuários</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--fs-surface)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--fs-border)' }}>
        {TABS.map(({ v, l }) => (
          <button key={v} onClick={() => setTab(v)} style={{
            padding: '8px 20px', borderRadius: 7, fontSize: 13, fontWeight: tab === v ? 700 : 400,
            color: tab === v ? 'var(--fs-text-1)' : 'var(--fs-text-4)',
            background: tab === v ? 'var(--fs-surface-2)' : 'transparent',
            border: tab === v ? '1px solid var(--fs-border)' : '1px solid transparent',
            cursor: 'pointer',
          }}>{l}</button>
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
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: 4 }}>Usuários da Organização</div>
            <div style={{ color: 'var(--fs-text-4)', fontSize: 13, marginBottom: 16 }}>{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''} cadastrado{usuarios.length !== 1 ? 's' : ''}</div>
            {usuarios.length === 0
              ? <p style={{ color: 'var(--fs-text-4)', fontSize: 13 }}>Nenhum usuário ainda. Envie um convite abaixo.</p>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fs-border)' }}>
                      {['E-mail', 'Perfil', 'Desde'].map(h => (
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
                              const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', u.id)
                              if (!error) setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x))
                              else toast('Erro: ' + error.message, 'error')
                            }}
                            style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:6, color:'var(--fs-text-1)', padding:'3px 8px', fontSize:11, fontWeight:700, cursor:'pointer', outline:'none' }}
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="org_admin">Administrador</option>
                            <option value="user">Usuário</option>
                          </select>
                        </td>
                        <td style={{ padding: '10px', color: 'var(--fs-text-4)', fontSize: 12 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}</td>
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
                ⚠️ Conta não vinculada a uma organização. Contate o administrador do sistema.
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
                {loading ? 'Gerando...' : '🔗 Gerar Link de Convite'}
              </button>
            </form>

            {inviteLink && (
              <div style={{ marginTop: 16, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: 'var(--fs-success)', fontWeight: 700, marginBottom: 8 }}>✅ Link gerado — válido por 7 dias:</div>
                <div style={{ fontSize: 12, color: 'var(--fs-text-2)', wordBreak: 'break-all', marginBottom: 8 }}>{inviteLink}</div>
                <button onClick={() => { navigator.clipboard.writeText(inviteLink); toast('✓ Link copiado!') }} style={{ ...btn('ghost'), padding: '6px 14px', fontSize: 12 }}>
                  📋 Copiar Link
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Tab: Identidade Visual ───────────────────────────── */}
      {tab === 'identidade' && (
        <>
          <div style={card}>
            <div style={cardTitle}>Logo da Organização</div>
            <p style={{ fontSize: 13, color: 'var(--fs-text-4)', marginBottom: 20, lineHeight: 1.6 }}>
              A logo será exibida na tela de login e no cabeçalho do sistema.
              Formatos aceitos: PNG, JPG ou SVG. Tamanho recomendado: 200×60px.
            </p>

            {/* Preview da logo atual */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'var(--fs-text-4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
                Logo Atual
              </div>
              <div style={{ width: 280, height: 90, background: 'var(--fs-bg)', border: '1px solid var(--fs-border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {logoUrl
                  ? <img src={logoUrl} alt="Logo da organização" style={{ maxWidth: '90%', maxHeight: '80px', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 12, color: 'var(--fs-text-4)' }}>Sem logo cadastrada</span>
                }
              </div>
            </div>

            {/* Upload */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]) }}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading || !orgId}
                style={{ ...btn('primary'), opacity: (logoUploading || !orgId) ? 0.6 : 1 }}
              >
                {logoUploading ? '⏳ Enviando...' : '📁 Selecionar Logo'}
              </button>
              {logoUrl && (
                <button onClick={removerLogo} style={{ ...btn('ghost'), color: 'var(--fs-danger)', borderColor: 'rgba(248,113,113,0.3)' }}>
                  🗑 Remover Logo
                </button>
              )}
            </div>

            {!orgId && (
              <p style={{ marginTop: 12, fontSize: 12, color: 'var(--fs-warning)' }}>
                ⚠️ Sua conta não está associada a uma organização. A logo requer uma organização configurada.
              </p>
            )}

            <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--fs-brand)', fontWeight: 700, marginBottom: 6 }}>⚙️ Pré-requisito de infraestrutura</div>
              <div style={{ fontSize: 12, color: 'var(--fs-text-3)', lineHeight: 1.7 }}>
                Esta funcionalidade requer um bucket público <strong>org-assets</strong> no Supabase Storage
                e a migration <code>20260601_org_settings.sql</code> executada no banco.
                Consulte o arquivo <code>supabase/migrations/</code> para os scripts necessários.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
