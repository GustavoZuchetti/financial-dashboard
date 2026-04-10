'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  container: { width: '100%', maxWidth: 400 },
  header: { textAlign: 'center', marginBottom: 32 },
  logoWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 },
  logoIcon: { width: 44, height: 44, background: '#00e676', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#000', fontSize: 20 },
  title: { fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 32 },
  cardTitle: { fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 24 },
  error: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 14, marginBottom: 16 },
  label: { display: 'block', color: '#9ca3af', fontSize: 13, fontWeight: 500, marginBottom: 6 },
  input: { width: '100%', background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  inputFocus: { borderColor: '#00e676' },
  fieldWrap: { marginBottom: 16 },
  btn: (loading) => ({ width: '100%', background: loading ? '#065f46' : '#00e676', color: loading ? '#a7f3d0' : '#000', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8, transition: 'all 0.2s' }),
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [focusField, setFocusField] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard/dre')
    }
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <div style={S.logoWrap}>
            <div style={S.logoIcon}>F</div>
            <h1 style={S.title}>Financial Dashboard</h1>
          </div>
          <p style={S.subtitle}>Plataforma de gestao financeira estrategica</p>
        </div>

        <div style={S.card}>
          <h2 style={S.cardTitle}>Entrar na sua conta</h2>
          {error && <div style={S.error}>{error}</div>}
          <form onSubmit={handleLogin}>
            <div style={S.fieldWrap}>
              <label style={S.label}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocusField('email')}
                onBlur={() => setFocusField(null)}
                style={{ ...S.input, ...(focusField === 'email' ? S.inputFocus : {}) }}
                placeholder="seu@email.com"
                required
              />
            </div>
            <div style={S.fieldWrap}>
              <label style={S.label}>Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocusField('password')}
                onBlur={() => setFocusField(null)}
                style={{ ...S.input, ...(focusField === 'password' ? S.inputFocus : {}) }}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" style={S.btn(loading)} disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#374151', fontSize: 12, marginTop: 16 }}>
          Financial Dashboard &copy; 2026
        </p>
      </div>
    </div>
  )
}
