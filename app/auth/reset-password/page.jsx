'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [stage,    setStage]    = useState('loading') // loading | form | success | error
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState('')

  useEffect(() => {
    // Supabase detecta o token do link automaticamente (detectSessionInUrl: true)
    // e dispara o evento PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStage('form')
    })

    // Se não receber o evento em 4s, assumir que o link é inválido/expirado
    const timer = setTimeout(() => {
      setStage(s => s === 'loading' ? 'error' : s)
    }, 4000)

    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setMsg('As senhas não coincidem.'); return }
    if (password.length < 6)  { setMsg('A senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true); setMsg('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setMsg('Erro: ' + error.message); setLoading(false); return }
    setStage('success')
    setTimeout(() => router.push('/'), 2500)
  }

  return (
    <div data-theme="dark" style={{
      minHeight: '100vh', background: 'var(--fs-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--fs-font-body)', padding: '24px',
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18,
        padding: '40px 36px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,var(--fs-brand-dark),var(--fs-brand))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 14 }}>FS</div>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Facesign</span>
        </div>

        {/* Loading */}
        {stage === 'loading' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(var(--fs-brand-rgb),0.2)', borderTop: '3px solid var(--fs-brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ color: 'rgba(148,163,184,0.7)', fontSize: 14 }}>Validando link de recuperação...</div>
          </div>
        )}

        {/* Formulário de nova senha */}
        {stage === 'form' && (
          <>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, fontWeight: 400, color: 'var(--fs-text-1)', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
              Nova senha
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.65)', margin: '0 0 28px' }}>
              Escolha uma senha segura para sua conta.
            </p>

            {msg && (
              <div style={{ background: 'rgba(var(--fs-danger-rgb),0.08)', border: '1px solid rgba(var(--fs-danger-rgb),0.2)', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 18 }}>
                {msg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>Nova senha</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', color: 'var(--fs-text-1)', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>Confirmar senha</label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repita a nova senha" required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', color: 'var(--fs-text-1)', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <button type="submit" disabled={loading} style={{ marginTop: 6, width: '100%', background: 'linear-gradient(135deg,var(--fs-brand-dark),var(--fs-brand))', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}

        {/* Sucesso */}
        {stage === 'success' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ width: 52, height: 52, background: 'rgba(var(--fs-success-rgb),0.1)', border: '1px solid rgba(var(--fs-success-rgb),0.25)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: 22, color: 'var(--fs-success)' }}>✓</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: 8 }}>Senha alterada!</div>
            <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.65)' }}>Redirecionando para o login...</div>
          </div>
        )}

        {/* Link inválido */}
        {stage === 'error' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fs-danger)', marginBottom: 10 }}>Link inválido ou expirado</div>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.65)', marginBottom: 24, lineHeight: 1.6 }}>
              O link de recuperação expirou ou já foi utilizado. Solicite um novo.
            </p>
            <button onClick={() => router.push('/')} style={{ background: 'rgba(var(--fs-brand-rgb),0.1)', border: '1px solid rgba(var(--fs-brand-rgb),0.3)', color: 'var(--fs-brand-text)', borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Voltar ao login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
