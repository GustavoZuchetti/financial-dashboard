'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Configuração ──────────────────────────────────────────────────────────
// TESTE: valores reduzidos. Reverter para 45min/2min após validação.
const IDLE_LIMIT_MS  = 2 * 60 * 1000   // 2 min de inatividade → logout
const WARN_BEFORE_MS = 30 * 1000       // avisa 30s antes
const CHECK_EVERY_MS = 5  * 1000       // verifica a cada 5s
const STORAGE_KEY    = 'fs-last-activity'
// ──────────────────────────────────────────────────────────────────────────

export default function IdleTimeout() {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARN_BEFORE_MS / 1000))
  const checker = useRef(null)
  const loggedOut = useRef(false)

  const markActivity = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch {}
  }, [])

  const getIdleMs = useCallback(() => {
    try {
      const last = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
      if (!last) return 0
      return Date.now() - last
    } catch { return 0 }
  }, [])

  const doLogout = useCallback(async () => {
    if (loggedOut.current) return
    loggedOut.current = true
    clearInterval(checker.current)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    await supabase.auth.signOut()
    router.push('/?expired=1')
  }, [router])

  // Verificação por timestamp — funciona mesmo com aba minimizada/congelada,
  // pois compara o horário real decorrido, não depende do timer rodar continuamente.
  const check = useCallback(() => {
    const idle = getIdleMs()
    if (idle >= IDLE_LIMIT_MS) {
      doLogout()
    } else if (idle >= IDLE_LIMIT_MS - WARN_BEFORE_MS) {
      setShowWarning(true)
      setSecondsLeft(Math.max(0, Math.ceil((IDLE_LIMIT_MS - idle) / 1000)))
    } else {
      setShowWarning(false)
    }
  }, [getIdleMs, doLogout])

  const stayConnected = () => {
    markActivity()
    setShowWarning(false)
  }

  useEffect(() => {
    // Inicializa o timestamp ao montar
    markActivity()

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    const onActivity = () => {
      // Atividade só conta enquanto o aviso NÃO está visível.
      // Com o aviso, exige clique explícito em "Continuar conectado".
      if (!showWarning) markActivity()
    }
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))

    // Ao voltar o foco para a aba (desminimizar), verifica imediatamente
    const onVisibility = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', check)

    // Verificação periódica
    checker.current = setInterval(check, CHECK_EVERY_MS)
    check() // verificação inicial

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', check)
      clearInterval(checker.current)
    }
  }, [showWarning, markActivity, check])

  if (!showWarning) return null

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:14, padding:28, width:400, maxWidth:'90vw', textAlign:'center' }}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
          </svg>
        </div>
        <div style={{ fontSize:17, fontWeight:700, color:'var(--fs-text-1)', marginBottom:8 }}>Sessão prestes a expirar</div>
        <p style={{ fontSize:13, color:'var(--fs-text-3)', lineHeight:1.6, marginBottom:6 }}>
          Por segurança, você será desconectado por inatividade em
        </p>
        <div style={{ fontSize:30, fontWeight:800, color:'var(--fs-text-1)', fontFamily:'monospace', marginBottom:22, letterSpacing:1 }}>
          {mm}:{ss}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={doLogout} style={{ background:'transparent', border:'1px solid var(--fs-border)', borderRadius:8, padding:'9px 18px', fontSize:13, fontWeight:600, color:'var(--fs-text-2)', cursor:'pointer' }}>
            Sair agora
          </button>
          <button onClick={stayConnected} style={{ background:'#1d4ed8', color:'#fff', border:'none', borderRadius:8, padding:'9px 22px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            Continuar conectado
          </button>
        </div>
      </div>
    </div>
  )
}
