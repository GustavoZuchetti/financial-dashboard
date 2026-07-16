'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Configuração ──────────────────────────────────────────────────────────
const IDLE_LIMIT_MS  = 45 * 60 * 1000  // 45 min de inatividade → logout
const WARN_BEFORE_MS = 2  * 60 * 1000  // avisa 2 min antes
const CHECK_EVERY_MS = 5  * 1000       // verifica a cada 5s
const STORAGE_KEY    = 'fs-last-activity'
// ──────────────────────────────────────────────────────────────────────────

export default function IdleTimeout() {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARN_BEFORE_MS / 1000))

  const showWarningRef = useRef(false)
  const loggedOut      = useRef(false)
  const router_        = useRef(router)
  router_.current = router

  useEffect(() => { showWarningRef.current = showWarning }, [showWarning])

  // Efeito de inicialização — roda UMA ÚNICA VEZ (deps vazias)
  useEffect(() => {
    const markActivity = () => {
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch (_e) {}
    }
    const getIdleMs = () => {
      try {
        const last = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
        return last ? Date.now() - last : 0
      } catch (_e) { return 0 }
    }
    const doLogout = async () => {
      if (loggedOut.current) return
      loggedOut.current = true
      clearInterval(intervalId)
      try { localStorage.removeItem(STORAGE_KEY) } catch (_e) {}
      await supabase.auth.signOut()
      router_.current.push('/?expired=1')
    }
    // Verificação por timestamp — funciona mesmo com aba minimizada/congelada
    const check = () => {
      const idle = getIdleMs()
      if (idle >= IDLE_LIMIT_MS) {
        doLogout()
      } else if (idle >= IDLE_LIMIT_MS - WARN_BEFORE_MS) {
        setShowWarning(true)
        setSecondsLeft(Math.max(0, Math.ceil((IDLE_LIMIT_MS - idle) / 1000)))
      } else {
        if (showWarningRef.current) setShowWarning(false)
      }
    }

    if (!localStorage.getItem(STORAGE_KEY)) markActivity()

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    const onActivity = () => { if (!showWarningRef.current) markActivity() }
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))

    const onVisibility = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', check)

    const intervalId = setInterval(check, CHECK_EVERY_MS)
    check()

    window.__fsStayConnected = () => { markActivity(); setShowWarning(false) }
    window.__fsLogoutNow = doLogout

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', check)
      clearInterval(intervalId)
      delete window.__fsStayConnected
      delete window.__fsLogoutNow
    }
  }, [])

  if (!showWarning) return null

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:14, padding:28, width:400, maxWidth:'90vw', textAlign:'center' }}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(var(--fs-warning-rgb),0.1)', border:'1px solid rgba(var(--fs-warning-rgb),0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--fs-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <button onClick={() => window.__fsLogoutNow?.()} style={{ background:'transparent', border:'1px solid var(--fs-border)', borderRadius:8, padding:'9px 18px', fontSize:13, fontWeight:600, color:'var(--fs-text-2)', cursor:'pointer' }}>
            Sair agora
          </button>
          <button onClick={() => window.__fsStayConnected?.()} style={{ background:'var(--fs-brand-dark)', color:'#fff', border:'none', borderRadius:8, padding:'9px 22px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            Continuar conectado
          </button>
        </div>
      </div>
    </div>
  )
}
