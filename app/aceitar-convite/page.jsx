'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AceitarConviteForm() {
  const params  = useSearchParams()
  const router  = useRouter()
  const token   = params.get('token')

  const [step,    setStep]    = useState('validando')
  const [invite,  setInvite]  = useState(null)
  const [form,    setForm]    = useState({ nome: '', senha: '', confirma: '' })
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')

  // Validar token via API server-side (bypassa RLS)
  useEffect(() => {
    if (!token) { setStep('erro'); setMsg('Link inválido — token não encontrado.'); return }
    fetch(`/api/invite?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setStep('erro'); setMsg(d.error); return }
        setInvite(d); setStep('form')
      })
      .catch(() => { setStep('erro'); setMsg('Erro ao validar convite. Tente novamente.') })
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.senha !== form.confirma) { setMsg('As senhas não coincidem.'); return }
    if (form.senha.length < 6)        { setMsg('A senha deve ter ao menos 6 caracteres.'); return }
    setLoading(true); setMsg('')

    const res = await fetch('/api/invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, nome: form.nome, senha: form.senha }),
    })
    const data = await res.json()

    if (!res.ok) { setMsg(data.error || 'Erro ao criar conta.'); setLoading(false); return }

    // Login automático após criar conta
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email: invite.email, password: form.senha })
    setLoading(false)
    if (loginErr) { setStep('sucesso'); return } // conta criada mas login falhou — redireciona para login
    router.replace('/dashboard/dre')
  }

  const inp = {
    width: '100%', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
    padding: '11px 14px', color: 'var(--fs-text-1)', fontSize: 14,
    outline: 'none', boxSizing: 'border-box', marginBottom: 14,
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f1117', padding:16 }}>
      <div style={{ width:'100%', maxWidth:440, background:'#1a1f2e', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:40 }}>

        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:52,height:52,background:'linear-gradient(135deg,var(--fs-brand-dark),var(--fs-brand))',borderRadius:13,margin:'0 auto 14px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:800,color:'#fff' }}>FS</div>
          <h1 style={{ fontSize:20,fontWeight:800,color:'var(--fs-text-1)',margin:0 }}>Financial Dashboard</h1>
        </div>

        {step === 'validando' && (
          <div style={{ textAlign:'center', color:'var(--fs-text-2)' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
            <p>Validando seu convite...</p>
          </div>
        )}

        {step === 'erro' && (
          <div style={{ textAlign:'center' }}>
            
            <h2 style={{ color:'var(--fs-text-1)', fontSize:18, marginBottom:8 }}>Convite inválido</h2>
            <p style={{ color:'var(--fs-text-2)', fontSize:14, marginBottom:20 }}>{msg}</p>
            <p style={{ color:'var(--fs-text-4)', fontSize:12 }}>Solicite um novo link de convite ao administrador.</p>
          </div>
        )}

        {step === 'form' && invite && (
          <>
            <h2 style={{ color:'var(--fs-text-1)', fontSize:18, fontWeight:700, marginBottom:4 }}>Criar sua conta</h2>
            <p style={{ color:'var(--fs-text-4)', fontSize:13, marginBottom:24 }}>
              Você foi convidado como <strong style={{ color:'var(--fs-brand-text)' }}>{invite.role === 'org_admin' ? 'Administrador' : 'Usuário'}</strong>
            </p>
            <form onSubmit={handleSubmit}>
              <label style={{ display:'block', fontSize:11, color:'var(--fs-text-2)', fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>E-mail</label>
              <input style={{ ...inp, opacity:0.6, cursor:'not-allowed' }} value={invite.email} disabled />

              <label style={{ display:'block', fontSize:11, color:'var(--fs-text-2)', fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>Seu nome</label>
              <input style={inp} value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} placeholder="Como quer ser chamado" required />

              <label style={{ display:'block', fontSize:11, color:'var(--fs-text-2)', fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>Senha</label>
              <input style={inp} type="password" value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})} placeholder="Mínimo 6 caracteres" required />

              <label style={{ display:'block', fontSize:11, color:'var(--fs-text-2)', fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>Confirmar senha</label>
              <input style={inp} type="password" value={form.confirma} onChange={e=>setForm({...form,confirma:e.target.value})} placeholder="Repita a senha" required />

              {msg && <div style={{ background:'rgba(var(--fs-danger-rgb),0.1)', border:'1px solid rgba(var(--fs-danger-rgb),0.2)', borderRadius:8, padding:'9px 12px', color:'#fca5a5', fontSize:13, marginBottom:14 }}>⚠️ {msg}</div>}

              <button type="submit" disabled={loading} style={{ width:'100%', background:loading?'var(--fs-surface)':'var(--fs-brand)', color:loading?'var(--fs-text-4)':'#fff', border:'none', borderRadius:8, padding:'12px', fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer', marginTop:4 }}>
                {loading ? 'Criando conta...' : '✓ Criar conta e acessar'}
              </button>
            </form>
          </>
        )}

        {step === 'sucesso' && (
          <div style={{ textAlign:'center' }}>
            
            <h2 style={{ color:'var(--fs-text-1)', fontSize:20, marginBottom:8 }}>Conta criada!</h2>
            <p style={{ color:'var(--fs-text-2)', fontSize:14, marginBottom:24 }}>Sua conta foi criada com sucesso.</p>
            <button onClick={() => router.push('/')} style={{ background:'var(--fs-brand)', color:'#fff', border:'none', borderRadius:8, padding:'11px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
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
    <Suspense fallback={<div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f1117', color:'var(--fs-text-2)' }}>Carregando...</div>}>
      <AceitarConviteForm />
    </Suspense>
  )
}
