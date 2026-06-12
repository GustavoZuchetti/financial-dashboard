'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Configuração ──────────────────────────────────────────────────────────
const IDLE_LIMIT_MS  = 45 * 60 * 1000  // 45 min de inatividade → logout
const WARN_BEFORE_MS = 2  * 60 * 1000  // avisa 2 min antes
// ──────────────────────────────────────────────────────────────────────────

export default function IdleTimeout() {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARN_BEFORE_MS / 1000))

  const idleTimer  = useRef(null)
  const warnTimer  = useRef(null)
  const countdown  = useRef(null)

  const doLogout = useCallback(async () => {
    clearAll()
    await supabase.auth.signOut()
    router.push('/?expired=1')
  }, [router])

  const clearAll = () => {
    clearTimeout(idleTimer.current)
    clearTimeout(warnTimer.current)
    clearInterval(countdown.current)
  }

  const startCountdown = useCallback(() => {
    setShowWarning(true)
    setSecondsLeft(Math.floor(WARN_BEFORE_MS / 1000))
    countdown.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(countdown.current); return 0 }
        return s - 1
      })
    }, 1000)
  }, [])

  const resetTimers = useCallback(() => {
    clearAll()
    setShowWarning(false)
    // Agenda o aviso e o logout
    warnTimer.current = setTimeout(startCountdown, IDLE_LIMIT_MS - WARN_BEFORE_MS)
    idleTimer.current = setTimeout(doLogout, IDLE_LIMIT_MS)
  }, [startCountdown, doLogout])

  // Continuar a sessão (usuário clicou em "Continuar conectado")
  const stayConnected = () => { resetTimers() }

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    // Só reseta por atividade enquanto o aviso NÃO está visível —
    // quando o aviso aparece, o usuário precisa clicar explicitamente.
    const onActivity = () => { if (!showWarning) resetTimers() }

    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))
    resetTimers()

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity))
      clearAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWarning])

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
