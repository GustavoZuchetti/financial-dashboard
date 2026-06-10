'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/lib/org-context'
import SvgIcon from '@/components/SvgIcon'

export default function AdminUsuariosPage() {
  const router = useRouter()
  const { profile, isSuperAdmin, loading: orgLoading } = useOrg()

  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [resetModal,  setResetModal]  = useState(null)
  const [resetResult, setResetResult] = useState(null)
  const [resetting,   setResetting]   = useState(false)
  const [error,       setError]       = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/list-all-users', {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); return }
      setUsers(json.users || [])
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (!orgLoading && isSuperAdmin) load() }, [orgLoading, isSuperAdmin])

  const resetarSenha = async () => {
    if (!resetModal) return
    setResetting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: resetModal.id }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); return }
      setResetModal(null)
      setResetResult({ email: json.email, password: json.password })
    } finally { setResetting(false) }
  }

  if (orgLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'40vh', color:'var(--fs-text-4)', fontSize:14 }}>
      Carregando...
    </div>
  )

  if (!isSuperAdmin) return (
    <div style={{ textAlign:'center', padding:80, color:'var(--fs-text-4)' }}>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:8, color:'var(--fs-text-2)' }}>Acesso restrito</div>
      <div style={{ fontSize:14 }}>Esta área é exclusiva para Super Admin.</div>
    </div>
  )

  const filtered = users.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.org_nome?.toLowerCase().includes(search.toLowerCase())
  )

  const roleLabel = r => ({ super_admin: 'Super Admin', org_admin: 'Admin', user: 'Usuário' }[r] || r || '—')
  const roleColor = r => ({ super_admin: '#a78bfa', org_admin: '#60a5fa', user: 'var(--fs-text-3)' }[r] || 'var(--fs-text-4)')

  return (
    <div style={{ color:'var(--fs-text-1)' }}>
      {/* Header */}
      <div style={{ marginBottom:28, display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, margin:0 }}>Gerenciamento Global de Usuários</h1>
          <p style={{ color:'var(--fs-text-4)', fontSize:13, margin:'4px 0 0' }}>
            Todos os usuários do sistema — {users.length} cadastrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={load} style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, color:'var(--fs-text-1)', cursor:'pointer', display:'flex', alignItems:'center', gap:7 }}>
          <SvgIcon name="refresh" size={13} color="var(--fs-brand)" /> Atualizar
        </button>
      </div>

      {error && (
        <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 16px', color:'#f87171', fontSize:13, marginBottom:16 }}>
          {error}
        </div>
      )}

      {/* Alertas de usuários sem perfil */}
      {users.filter(u => !u.has_profile).length > 0 && (
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'flex-start', gap:10 }}>
          <SvgIcon name="alert" size={16} color="#f59e0b" style={{ marginTop:1, flexShrink:0 }} />
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#f59e0b', marginBottom:3 }}>
              {users.filter(u => !u.has_profile).length} usuário(s) sem perfil cadastrado
            </div>
            <div style={{ fontSize:12, color:'var(--fs-text-3)', lineHeight:1.6 }}>
              Esses usuários existem no sistema de autenticação mas não possuem perfil no banco — sem role, sem organização, sem acesso às empresas. Verifique se o convite foi concluído corretamente.
            </div>
          </div>
        </div>
      )}

      {/* Busca */}
      <div style={{ marginBottom:16 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por e-mail ou organização..."
          style={{ width:'100%', background:'var(--fs-input-bg)', border:'1px solid var(--fs-input-border)', borderRadius:10, padding:'10px 14px', color:'var(--fs-text-1)', fontSize:13, outline:'none', boxSizing:'border-box' }}
        />
      </div>

      {/* Tabela */}
      <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--fs-text-4)', fontSize:13 }}>Carregando usuários...</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--fs-border)', background:'var(--fs-bg)' }}>
                {['E-mail', 'Organização', 'Role', 'Último Acesso', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:'var(--fs-text-4)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:'var(--fs-text-4)' }}>Nenhum usuário encontrado</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} style={{ borderBottom:'1px solid var(--fs-border)' }}>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontWeight:600, color:'var(--fs-text-1)' }}>{u.email || '—'}</div>
                    <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:2 }}>{u.id.slice(0,8)}…</div>
                  </td>
                  <td style={{ padding:'12px 14px', color: u.org_nome ? 'var(--fs-text-2)' : 'var(--fs-text-4)', fontStyle: u.org_nome ? 'normal' : 'italic' }}>
                    {u.org_nome || 'Sem organização'}
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    {u.has_profile ? (
                      <span style={{ fontSize:11, fontWeight:700, color: roleColor(u.role), background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:99, padding:'2px 8px' }}>
                        {roleLabel(u.role)}
                      </span>
                    ) : (
                      <span style={{ fontSize:11, fontWeight:700, color:'#f59e0b', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:99, padding:'2px 8px' }}>
                        Sem perfil
                      </span>
                    )}
                  </td>
                  <td style={{ padding:'12px 14px', color:'var(--fs-text-4)', fontSize:12 }}>
                    {u.last_sign_in ? new Date(u.last_sign_in).toLocaleString('pt-BR') : 'Nunca'}
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    {u.confirmed ? (
                      <span style={{ fontSize:11, color:'#10b981', display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', display:'inline-block' }} /> Confirmado
                      </span>
                    ) : (
                      <span style={{ fontSize:11, color:'#f59e0b', display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background:'#f59e0b', display:'inline-block' }} /> Pendente
                      </span>
                    )}
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    <button
                      onClick={() => setResetModal(u)}
                      style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:6, color:'#f59e0b', padding:'5px 12px', fontSize:11, fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5 }}
                    >
                      <SvgIcon name="lock" size={11} color="currentColor" /> Redefinir Senha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal confirmar */}
      {resetModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:14, padding:28, width:440, maxWidth:'90vw' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--fs-text-1)', marginBottom:10 }}>Redefinir senha</div>
            <p style={{ fontSize:13, color:'var(--fs-text-3)', lineHeight:1.7, marginBottom:20 }}>
              Será gerada uma nova senha aleatória para<br />
              <strong style={{ color:'var(--fs-text-1)' }}>{resetModal.email}</strong>.<br />
              A senha anterior deixará de funcionar imediatamente.
            </p>
            {!resetModal.has_profile && (
              <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#f59e0b', marginBottom:16 }}>
                Este usuário não tem perfil cadastrado. Redefina a senha e, após o login, verifique se o perfil e organização estão configurados corretamente.
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setResetModal(null)} style={{ background:'transparent', border:'1px solid var(--fs-border)', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:600, color:'var(--fs-text-2)', cursor:'pointer' }}>Cancelar</button>
              <button onClick={resetarSenha} disabled={resetting} style={{ background:'#1d4ed8', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer', opacity: resetting ? 0.6 : 1 }}>
                {resetting ? 'Gerando...' : 'Confirmar e Gerar Nova Senha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal resultado */}
      {resetResult && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:14, padding:28, width:460, maxWidth:'90vw' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#10b981', marginBottom:10 }}>Senha redefinida com sucesso</div>
            <p style={{ fontSize:13, color:'var(--fs-text-3)', marginBottom:16, lineHeight:1.6 }}>
              Compartilhe as credenciais abaixo. Esta é a única oportunidade de visualizar a senha.
            </p>
            <div style={{ background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:10, padding:'16px', marginBottom:20 }}>
              <div style={{ fontSize:11, color:'var(--fs-text-4)', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>E-mail</div>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--fs-text-1)', marginBottom:14 }}>{resetResult.email}</div>
              <div style={{ fontSize:11, color:'var(--fs-text-4)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px' }}>Nova Senha</div>
              <div style={{ fontSize:22, fontWeight:800, color:'var(--fs-text-1)', letterSpacing:3, fontFamily:'monospace', background:'var(--fs-surface)', padding:'10px 14px', borderRadius:8, border:'1px solid var(--fs-border)' }}>
                {resetResult.password}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button
                onClick={() => { navigator.clipboard.writeText(`E-mail: ${resetResult.email}\nSenha: ${resetResult.password}`); }}
                style={{ background:'transparent', border:'1px solid var(--fs-border)', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:600, color:'var(--fs-text-1)', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
              >
                <SvgIcon name="copy" size={13} /> Copiar Credenciais
              </button>
              <button onClick={() => setResetResult(null)} style={{ background:'#1d4ed8', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
