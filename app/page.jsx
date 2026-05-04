'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [focus, setFocus] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('E-mail ou senha incorretos.'); setLoading(false) }
    else router.push('/dashboard/dre')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-20px) scale(1.05)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,30px) scale(1.03)} }
        @keyframes float3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,20px)  scale(1.04)} }
        .inp { width:100%; background:#1a2540; border:1px solid; border-radius:10px; padding:12px 14px; color:#f1f5f9; font-size:14px; outline:none; box-sizing:border-box; transition:border-color 0.2s, box-shadow 0.2s; }
        .inp:focus { border-color:#3b82f6 !important; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }
        .btn-login { width:100%; background:linear-gradient(135deg,#1d4ed8,#3b82f6); color:#fff; border:none; border-radius:10px; padding:13px; font-size:15px; font-weight:700; cursor:pointer; transition:all 0.2s; letter-spacing:0.3px; }
        .btn-login:hover:not(:disabled) { background:linear-gradient(135deg,#1e40af,#2563eb); transform:translateY(-1px); box-shadow:0 8px 25px rgba(59,130,246,0.35); }
        .btn-login:active { transform:translateY(0); }
        .btn-login:disabled { opacity:0.65; cursor:not-allowed; transform:none; }
      `}</style>

      {/* Orbs decorativos de fundo */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-15%', left:'-10%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', animation:'float1 12s ease-in-out infinite' }} />
        <div style={{ position:'absolute', bottom:'-10%', right:'-5%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)', animation:'float2 15s ease-in-out infinite' }} />
        <div style={{ position:'absolute', top:'40%', right:'20%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)', animation:'float3 10s ease-in-out infinite' }} />
        {/* Grid sutil */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(59,130,246,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.03) 1px,transparent 1px)', backgroundSize:'60px 60px', opacity:0.6 }} />
      </div>

      {/* Painel esquerdo — branding */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px 80px', position:'relative' }}>
        <div style={{ maxWidth:480 }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:48 }}>
            <div style={{ width:48, height:48, background:'linear-gradient(135deg,#1d4ed8,#3b82f6)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:22, boxShadow:'0 8px 24px rgba(59,130,246,0.4)' }}>FS</div>
            <span style={{ fontSize:24, fontWeight:800, color:'#fff', letterSpacing:'-0.5px' }}>Facesign</span>
          </div>

          <h1 style={{ fontSize:42, fontWeight:900, color:'#fff', lineHeight:1.1, marginBottom:16, letterSpacing:'-1px' }}>
            Gestão financeira<br />
            <span style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>estratégica</span>
          </h1>
          <p style={{ fontSize:16, color:'#475569', lineHeight:1.7, marginBottom:48 }}>
            Demonstrativos executivos, fluxo de caixa e orçamento em tempo real para as entidades FACE, JAM e JB.
          </p>

          {/* Métricas decorativas */}
          <div style={{ display:'flex', gap:24 }}>
            {[
              { label:'Entidades', value:'3' },
              { label:'Módulos', value:'7+' },
              { label:'Atualização', value:'Real-time' },
            ].map(m => (
              <div key={m.label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'12px 16px', textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800, color:'#3b82f6', marginBottom:2 }}>{m.value}</div>
                <div style={{ fontSize:11, color:'#475569', textTransform:'uppercase', letterSpacing:'0.8px' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Divisória */}
      <div style={{ width:1, background:'linear-gradient(to bottom, transparent, rgba(59,130,246,0.15) 30%, rgba(59,130,246,0.15) 70%, transparent)', margin:'40px 0' }} />

      {/* Painel direito — formulário */}
      <div style={{ width:460, display:'flex', alignItems:'center', justifyContent:'center', padding:48, position:'relative' }}>
        <div style={{ width:'100%', maxWidth:360 }}>
          <div style={{ marginBottom:32 }}>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#fff', marginBottom:6 }}>Acessar plataforma</h2>
            <p style={{ fontSize:14, color:'#475569' }}>Entre com suas credenciais para continuar</p>
          </div>

          {error && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'10px 14px', color:'#fca5a5', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
              <span>✕</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#94a3b8', marginBottom:6 }}>E-mail</label>
              <input
                className="inp"
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocus('email')} onBlur={() => setFocus(null)}
                style={{ borderColor: focus === 'email' ? '#3b82f6' : '#334155' }}
                placeholder="seu@email.com" required
              />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#94a3b8', marginBottom:6 }}>Senha</label>
              <input
                className="inp"
                type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocus('password')} onBlur={() => setFocus(null)}
                style={{ borderColor: focus === 'password' ? '#3b82f6' : '#334155' }}
                placeholder="••••••••" required
              />
            </div>
            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? (
                <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                  <span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.8s linear infinite', display:'inline-block' }} />
                  Entrando...
                </span>
              ) : 'Entrar na plataforma →'}
            </button>
          </form>

          <p style={{ textAlign:'center', color:'#1e293b', fontSize:12, marginTop:24 }}>
            Facesign © {new Date().getFullYear()} — Uso Interno Confidencial
          </p>
        </div>
      </div>
    </div>
  )
}
