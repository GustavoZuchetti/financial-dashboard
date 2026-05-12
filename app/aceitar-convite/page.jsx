'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AceitarConviteForm() {
  const params    = useSearchParams()
  const router    = useRouter()
  const token     = params.get('token')

  const [step,    setStep]    = useState('validando') // validando | form | sucesso | erro
  const [invite,  setInvite]  = useState(null)
  const [form,    setForm]    = useState({ nome: '', senha: '', confirma: '' })
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')

  // 1. Validar token ao carregar
  useEffect(() => {
    if (!token) { setStep('erro'); setMsg('Link inválido — token não encontrado.'); return }

    const validar = async () => {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .single()

      if (error || !data) { setStep('erro'); setMsg('Convite não encontrado ou já utilizado.'); return }
      if (data.used_at)   { setStep('erro'); setMsg('Este convite já foi utilizado.'); return }
      if (new Date(data.expires_at) < new Date()) { setStep('erro'); setMsg('Este convite expirou. Solicite um novo.'); return }

      setInvite(data)
      setStep('form')
    }
    validar()
  }, [token])

  // 2. Criar conta e aceitar convite
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.senha !== form.confirma) { setMsg('As senhas não coincidem.'); return }
    if (form.senha.length < 6) { setMsg('A senha deve ter ao menos 6 caracteres.'); return }

    setLoading(true); setMsg('')
    try {
      // Criar usuário no Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    invite.email,
        password: form.senha,
        options:  { data: { nome: form.nome } }
      })

      if (authErr) throw authErr

      const userId = authData.user?.id
      if (!userId) throw new Error('Erro ao criar usuário.')

      // Criar perfil vinculado à organização
      await supabase.from('profiles').upsert({
        id:              userId,
        organization_id: invite.organization_id,
        role:            invite.role,
        email:           invite.email,
        nome_display:    form.nome,
      })

      // Marcar convite como usado
      await supabase.from('invites').update({ used_at: new Date().toISOString() }).eq('token', token)

      setStep('sucesso')
    } catch (err) {
      setMsg(err.message || 'Erro ao criar conta.')
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    width: '100%', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
    padding: '11px 14px', color: '#f1f5f9', fontSize: 14,
    outline: 'none', boxSizing: 'border-box', marginBottom: 14,
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 440, background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 40 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', borderRadius: 13, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff' }}>FS</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Financial Dashboard</h1>
        </div>

        {/* Validando */}
        {step === 'validando' && (
          <div style={{ textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p>Validando seu convite...</p>
          </div>
        )}

        {/* Erro */}
        {step === 'erro' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
            <h2 style={{ color: '#f1f5f9', fontSize: 18, marginBottom: 8 }}>Convite inválido</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>{msg}</p>
            <p style={{ color: '#64748b', fontSize: 12 }}>Solicite um novo link de convite ao administrador do sistema.</p>
          </div>
        )}

        {/* Formulário */}
        {step === 'form' && invite && (
          <>
            <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Criar sua conta</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
              Você foi convidado como <strong style={{ color: '#60a5fa' }}>{invite.role === 'org_admin' ? 'Administrador' : 'Usuário'}</strong>
            </p>

            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>E-mail</label>
              <input style={{ ...inp, opacity: 0.6, cursor: 'not-allowed' }} value={invite.email} disabled />

              <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>Seu nome</label>
              <input style={inp} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Como quer ser chamado" required />

              <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>Senha</label>
              <input style={inp} type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} placeholder="Mínimo 6 caracteres" required />

              <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>Confirmar senha</label>
              <input style={inp} type="password" value={form.confirma} onChange={e => setForm({ ...form, confirma: e.target.value })} placeholder="Repita a senha" required />

              {msg && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '9px 12px', color: '#fca5a5', fontSize: 13, marginBottom: 14 }}>
                  ⚠️ {msg}
                </div>
              )}

              <button type="submit" disabled={loading} style={{ width: '100%', background: loading ? '#1e293b' : '#3b82f6', color: loading ? '#64748b' : '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}>
                {loading ? 'Criando conta...' : 'Criar conta e acessar'}
              </button>
            </form>
          </>
        )}

        {/* Sucesso */}
        {step === 'sucesso' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
            <h2 style={{ color: '#f1f5f9', fontSize: 20, marginBottom: 8 }}>Conta criada!</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>
              Sua conta foi criada com sucesso.
            </p>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 28 }}>
              Verifique seu e-mail <strong style={{ color: '#60a5fa' }}>{invite?.email}</strong> para confirmar e ativar o acesso.
            </p>
            <button onClick={() => router.push('/')} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Ir para o Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AceitarConvite() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f1117', color:'#94a3b8' }}>
        Carregando...
      </div>
    }>
      <AceitarConviteForm />
    </Suspense>
  )
}
