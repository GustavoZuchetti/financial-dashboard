'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [orgLogo, setOrgLogo] = useState(null)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLink, setForgotLink] = useState(null)

  useEffect(() => {
    setMounted(true)
    // Aviso de sessão expirada por inatividade
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('expired') === '1') {
        setError('Sua sessão foi encerrada por inatividade. Faça login novamente.')
      }
    }
    supabase.from('org_settings').select('logo_url').not('logo_url', 'is', null).limit(1).maybeSingle()
      .then(({ data }) => { if (data?.logo_url) setOrgLogo(data.logo_url) })
      .catch(() => {})
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('E-mail ou senha incorretos.'); setLoading(false) }
    else router.push('/dashboard/dre')
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    if (!email) { setError('Informe o e-mail cadastrado.'); return }
    setLoading(true); setError(null)
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo }),
      })
      const json = await res.json()
      if (!res.ok) { setError((json.error || 'Erro ao gerar link. Tente novamente.')); return }
      // Se gerou link direto (sem email), exibir na tela
      if (json.method === 'link' && json.link) setForgotLink(json.link)
      setForgotSent(true)
    } catch (err) {
      setError('Erro de conexão: ' + (err?.message || 'verifique sua internet.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080e1a',
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=DM+Serif+Display:ital@0;1&display=swap');

        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.8; transform: scale(1.04); }
        }
        @keyframes drift1 {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          33%     { transform: translate(40px,-30px) rotate(5deg); }
          66%     { transform: translate(-20px,20px) rotate(-3deg); }
        }
        @keyframes drift2 {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          33%     { transform: translate(-30px,40px) rotate(-4deg); }
          66%     { transform: translate(30px,-15px) rotate(6deg); }
        }

        .fs-login-wrap { opacity: 0; }
        .fs-login-wrap.mounted { animation: fadeIn 0.6s ease forwards; }

        .brand-section { animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.1s both; }
        .form-section  { animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.25s both; }

        .inp-field {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 13px 16px;
          color: #f1f5f9;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .inp-field::placeholder { color: rgba(148,163,184,0.5); }
        .inp-field:focus {
          border-color: rgba(59,130,246,0.6);
          background: rgba(59,130,246,0.05);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .btn-primary {
          width: 100%;
          background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 14px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          letter-spacing: 0.3px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }
        .btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .btn-primary:hover:not(:disabled)::before { opacity: 1; }
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(59,130,246,0.4);
        }
        .btn-primary:active { transform: translateY(0); box-shadow: none; }
        .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        .stat-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 14px 18px;
          backdrop-filter: blur(8px);
          transition: border-color 0.2s, background 0.2s;
        }
        .stat-card:hover {
          border-color: rgba(59,130,246,0.25);
          background: rgba(59,130,246,0.05);
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          color: rgba(148,163,184,0.8);
          font-size: 13px;
          font-weight: 400;
          letter-spacing: 0.1px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .feature-item:last-child { border-bottom: none; }
        .feature-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #3b82f6;
          flex-shrink: 0;
          box-shadow: 0 0 6px rgba(59,130,246,0.6);
        }

        .divider-line {
          width: 1px;
          background: linear-gradient(to bottom, transparent 0%, rgba(59,130,246,0.15) 30%, rgba(59,130,246,0.15) 70%, transparent 100%);
        }

        .shimmer-text {
          background: linear-gradient(90deg, #60a5fa 0%, #a78bfa 40%, #60a5fa 80%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }

        @media (max-width: 768px) {
          .login-layout { flex-direction: column !important; }
          .brand-section { display: none !important; }
          .divider-line { display: none !important; }
          .form-section { width: 100% !important; padding: 32px 24px !important; }
        }
      `}</style>

      {/* ── Fundo: noise + malha de gradientes ── */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        {/* Gradiente base */}
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(29,78,216,0.12) 0%, transparent 60%)' }} />
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 80% at 80% 20%, rgba(139,92,246,0.07) 0%, transparent 55%)' }} />
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 50% 50% at 75% 80%, rgba(16,185,129,0.04) 0%, transparent 50%)' }} />

        {/* Formas geométricas flutuantes */}
        <div style={{
          position:'absolute', top:'8%', left:'8%',
          width:320, height:320,
          border:'1px solid rgba(59,130,246,0.08)',
          borderRadius:'40% 60% 55% 45% / 45% 35% 65% 55%',
          animation:'drift1 20s ease-in-out infinite',
        }} />
        <div style={{
          position:'absolute', bottom:'10%', right:'30%',
          width:200, height:200,
          border:'1px solid rgba(139,92,246,0.07)',
          borderRadius:'55% 45% 40% 60% / 60% 50% 50% 40%',
          animation:'drift2 16s ease-in-out infinite',
        }} />

        {/* Grid sutil */}
        <div style={{
          position:'absolute', inset:0,
          backgroundImage:'linear-gradient(rgba(59,130,246,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.025) 1px,transparent 1px)',
          backgroundSize:'80px 80px',
        }} />

        {/* Linha horizontal decorativa */}
        <div style={{
          position:'absolute', top:'50%', left:0, right:0, height:1,
          background:'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.08) 25%, rgba(59,130,246,0.08) 75%, transparent 100%)',
        }} />
      </div>

      {/* ── Layout principal ── */}
      <div className={`fs-login-wrap${mounted ? ' mounted' : ''}`}
        style={{ display:'flex', width:'100%', position:'relative' }}>

        {/* ═══ PAINEL ESQUERDO — Branding ═══ */}
        <div className="brand-section" style={{
          flex:1, display:'flex', flexDirection:'column',
          justifyContent:'center', padding:'60px 72px',
        }}>
          <div style={{ maxWidth:500 }}>

            {/* Logo */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:56 }}>
              {orgLogo
                ? <img src={orgLogo} alt="Logo" style={{ height:42, maxWidth:160, objectFit:'contain' }} />
                : <>
                    <div style={{
                      width:42, height:42,
                      background:'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
                      borderRadius:12,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:800, color:'#fff', fontSize:16,
                      letterSpacing:'-0.5px',
                      boxShadow:'0 4px 16px rgba(59,130,246,0.35)',
                      fontFamily:"'DM Sans', sans-serif",
                    }}>FS</div>
                    <span style={{
                      fontSize:18, fontWeight:700, color:'rgba(255,255,255,0.9)',
                      letterSpacing:'-0.3px',
                      fontFamily:"'DM Sans', sans-serif",
                    }}>Facesign</span>
                  </>
              }
            </div>

            {/* Headline */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize:11, fontWeight:600,
                color:'rgba(59,130,246,0.8)',
                letterSpacing:'2px',
                textTransform:'uppercase',
                marginBottom:14,
                fontFamily:"'DM Sans', sans-serif",
              }}>Plataforma Financeira</div>
              <h1 style={{
                fontFamily:"'DM Serif Display', Georgia, serif",
                fontSize:52, fontWeight:400,
                color:'rgba(241,245,249,0.95)',
                lineHeight:1.08,
                letterSpacing:'-1.5px',
                margin:0,
              }}>
                Inteligência<br />
                <em style={{ fontStyle:'italic' }}>financeira</em>{' '}
                <span className="shimmer-text">em tempo real</span>
              </h1>
            </div>

            <p style={{
              fontSize:15, color:'rgba(148,163,184,0.7)',
              lineHeight:1.75, marginBottom:44,
              fontWeight:300, maxWidth:400,
              fontFamily:"'DM Sans', sans-serif",
            }}>
              Visualize, analise e decida com base em dados financeiros consolidados — de múltiplas entidades, em um único painel executivo.
            </p>

            {/* Features */}
            <div style={{
              background:'rgba(255,255,255,0.02)',
              border:'1px solid rgba(255,255,255,0.06)',
              borderRadius:14, padding:'8px 16px',
              marginBottom:40, backdropFilter:'blur(8px)',
            }}>
              {[
                'DRE consolidado com drill-down por categoria',
                'Fluxo de caixa com projeção e análise de liquidez',
                'Ciclo financeiro: PMR, PMP e capital de giro',
                'Importação automatizada do ERP Bling',
                'Orçamento vs. Realizado com variação %',
              ].map(f => (
                <div key={f} className="feature-item">
                  <div className="feature-dot" />
                  {f}
                </div>
              ))}
            </div>

            {/* Stats */}
            <div style={{ display:'flex', gap:14 }}>
              {[
                { label:'Módulos', value:'7+', icon:'◈' },
                { label:'Entidades', value:'Multi', icon:'◎' },
                { label:'Atualização', value:'Tempo real', icon:'◉' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div style={{ fontSize:10, color:'rgba(59,130,246,0.7)', marginBottom:4, letterSpacing:'0.5px', fontFamily:"'DM Sans', sans-serif" }}>{s.icon} {s.label.toUpperCase()}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:'rgba(241,245,249,0.9)', fontFamily:"'DM Sans', sans-serif" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ Divisória ═══ */}
        <div className="divider-line" style={{ margin:'48px 0' }} />

        {/* ═══ PAINEL DIREITO — Formulário ═══ */}
        <div className="form-section" style={{
          width:480,
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:'48px 56px',
          position:'relative',
        }}>

          {/* Glow atrás do card */}
          <div style={{
            position:'absolute',
            inset:0,
            background:'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(29,78,216,0.08) 0%, transparent 70%)',
            pointerEvents:'none',
          }} />

          <div style={{ width:'100%', maxWidth:360, position:'relative' }}>

            {/* Header do form */}
            <div style={{ marginBottom:36 }}>
              <h2 style={{
                fontFamily:"'DM Serif Display', Georgia, serif",
                fontSize:30, fontWeight:400,
                color:'rgba(241,245,249,0.95)',
                letterSpacing:'-0.5px',
                margin:'0 0 8px',
              }}>
                {forgotMode ? (forgotSent ? 'Verifique o e-mail' : 'Recuperar acesso') : 'Bem-vindo'}
              </h2>
              <p style={{
                fontSize:13.5, color:'rgba(148,163,184,0.65)',
                fontFamily:"'DM Sans', sans-serif",
                fontWeight:400, margin:0,
              }}>
                {forgotMode
                  ? (forgotSent ? `Enviamos um link para ${email}` : 'Informe seu e-mail para receber o link de redefinição')
                  : 'Acesse com suas credenciais para continuar'
                }
              </p>
            </div>

            {/* Erro */}
            {error && (
              <div style={{
                background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)',
                borderRadius:10, padding:'11px 14px', color:'#fca5a5', fontSize:13, marginBottom:20,
                display:'flex', alignItems:'center', gap:8, fontFamily:"'DM Sans', sans-serif",
              }}>
                <span style={{ fontSize:15 }}>⚠</span> {error}
              </div>
            )}

            {/* ── Modo: link enviado ── */}
            {forgotSent ? (
              <div style={{ textAlign:'center', padding:'12px 0' }}>
                <div style={{ width:52, height:52, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px', fontSize:22, color:'#10b981' }}>✓</div>

                {forgotLink ? (
                  /* Link gerado diretamente — exibir na tela */
                  <>
                    <div style={{ fontSize:15, fontWeight:700, color:'rgba(241,245,249,0.9)', marginBottom:8, fontFamily:"'DM Sans', sans-serif" }}>
                      Link de recuperação gerado
                    </div>
                    <p style={{ fontSize:13, color:'rgba(148,163,184,0.65)', lineHeight:1.7, marginBottom:20, fontFamily:"'DM Sans', sans-serif" }}>
                      Clique no botão abaixo para redefinir sua senha agora:
                    </p>
                    <a href={forgotLink}
                      style={{ display:'block', background:'linear-gradient(135deg,#1d4ed8,#3b82f6)', color:'#fff', borderRadius:10, padding:'13px 20px', fontSize:14, fontWeight:600, textDecoration:'none', marginBottom:16, fontFamily:"'DM Sans', sans-serif" }}>
                      Redefinir minha senha →
                    </a>
                    <p style={{ fontSize:11, color:'rgba(148,163,184,0.4)', lineHeight:1.6, marginBottom:20, fontFamily:"'DM Sans', sans-serif" }}>
                      Este link é de uso único e expira em 24 horas.
                    </p>
                  </>
                ) : (
                  /* E-mail enviado normalmente */
                  <p style={{ fontSize:13, color:'rgba(148,163,184,0.65)', lineHeight:1.7, marginBottom:24, fontFamily:"'DM Sans', sans-serif" }}>
                    Acesse o link enviado para <strong style={{ color:'rgba(241,245,249,0.8)' }}>{email}</strong> e siga as instruções para criar uma nova senha.
                  </p>
                )}

                <button onClick={() => { setForgotMode(false); setForgotSent(false); setForgotLink(null); setError(null) }}
                  style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(148,163,184,0.8)', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" }}>
                  Voltar ao login
                </button>
              </div>
            ) : forgotMode ? (
              /* ── Modo: esqueci minha senha ── */
              <form onSubmit={handleForgot} style={{ display:'flex', flexDirection:'column', gap:0 }}>
                <div style={{ marginBottom:24 }}>
                  <label style={{ display:'block', fontSize:12.5, fontWeight:500, color:'rgba(148,163,184,0.7)', marginBottom:7, letterSpacing:'0.3px', fontFamily:"'DM Sans', sans-serif", textTransform:'uppercase' }}>E-mail</label>
                  <input
                    className="inp-field" type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com" autoFocus required
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading
                    ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontFamily:"'DM Sans', sans-serif" }}>
                        <span style={{ width:15, height:15, border:'2px solid rgba(255,255,255,0.25)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.75s linear infinite', display:'inline-block' }} />
                        Enviando...
                      </span>
                    : <span style={{ fontFamily:"'DM Sans', sans-serif" }}>Enviar link de recuperação</span>
                  }
                </button>
                <button type="button" onClick={() => { setForgotMode(false); setError(null) }}
                  style={{ marginTop:14, background:'transparent', border:'none', color:'rgba(148,163,184,0.6)', fontSize:13, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" }}>
                  ← Voltar ao login
                </button>
              </form>
            ) : (
              /* ── Modo: login normal ── */
              <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:0 }}>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:'block', fontSize:12.5, fontWeight:500, color:'rgba(148,163,184,0.7)', marginBottom:7, letterSpacing:'0.3px', fontFamily:"'DM Sans', sans-serif", textTransform:'uppercase' }}>E-mail</label>
                  <input
                    className="inp-field" type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nome@empresa.com" autoComplete="email" required
                  />
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                    <label style={{ fontSize:12.5, fontWeight:500, color:'rgba(148,163,184,0.7)', letterSpacing:'0.3px', fontFamily:"'DM Sans', sans-serif", textTransform:'uppercase' }}>Senha</label>
                    <button type="button" onClick={() => { setForgotMode(true); setError(null) }}
                      style={{ background:'none', border:'none', color:'rgba(96,165,250,0.7)', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans', sans-serif", padding:0, transition:'color 0.2s' }}
                      onMouseEnter={e => e.target.style.color='rgba(96,165,250,1)'}
                      onMouseLeave={e => e.target.style.color='rgba(96,165,250,0.7)'}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <input
                    className="inp-field" type="password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••" autoComplete="current-password" required
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop:12 }}>
                  {loading
                    ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontFamily:"'DM Sans', sans-serif" }}>
                        <span style={{ width:15, height:15, border:'2px solid rgba(255,255,255,0.25)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.75s linear infinite', display:'inline-block' }} />
                        Autenticando...
                      </span>
                    : <span style={{ fontFamily:"'DM Sans', sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        Entrar na plataforma
                        <span style={{ fontSize:16, opacity:0.8 }}>→</span>
                      </span>
                  }
                </button>
              </form>
            )}

            {/* Footer */}
            <div style={{
              marginTop:36,
              paddingTop:20,
              borderTop:'1px solid rgba(255,255,255,0.05)',
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <p style={{
                color:'rgba(100,116,139,0.6)',
                fontSize:11.5, margin:0,
                fontFamily:"'DM Sans', sans-serif",
              }}>
                © {new Date().getFullYear()} Facesign
              </p>
              <span style={{
                fontSize:10.5,
                color:'rgba(100,116,139,0.45)',
                fontFamily:"'DM Sans', sans-serif",
                display:'flex', alignItems:'center', gap:5,
              }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'rgba(16,185,129,0.6)', display:'inline-block', boxShadow:'0 0 4px rgba(16,185,129,0.5)' }} />
                Uso restrito e confidencial
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
