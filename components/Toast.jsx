'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastContext = createContext(null)

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const add = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type, exiting: false }])
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
    return id
  }, [])

  const remove = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320)
  }, [])

  const toast = {
    success: (msg, dur) => add(msg, 'success', dur),
    error:   (msg, dur) => add(msg, 'error',   dur),
    info:    (msg, dur) => add(msg, 'info',     dur),
    warning: (msg, dur) => add(msg, 'warning',  dur),
    remove,
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  )
}

const TOAST_STYLES = {
  success: { bg: 'rgba(var(--fs-success-rgb),0.12)', border: 'rgba(var(--fs-success-rgb),0.35)', icon: '✓', color: 'var(--fs-success)' },
  error:   { bg: 'rgba(var(--fs-danger-rgb),0.12)',  border: 'rgba(var(--fs-danger-rgb),0.35)',  icon: '✕', color: 'var(--fs-danger)' },
  info:    { bg: 'rgba(var(--fs-brand-rgb),0.12)', border: 'rgba(var(--fs-brand-rgb),0.35)', icon: 'ℹ', color: 'var(--fs-brand)' },
  warning: { bg: 'rgba(var(--fs-warning-rgb),0.12)', border: 'rgba(var(--fs-warning-rgb),0.35)', icon: '⚠', color: 'var(--fs-warning)' },
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null
  return (
    <>
      <style>{`
        @keyframes toastIn  { from { opacity:0; transform:translateX(110%); } to { opacity:1; transform:translateX(0); } }
        @keyframes toastOut { from { opacity:1; transform:translateX(0);    } to { opacity:0; transform:translateX(110%); } }
        .toast-enter { animation: toastIn  0.28s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .toast-exit  { animation: toastOut 0.28s ease-in forwards; }
      `}</style>
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
        {toasts.map(t => {
          const s = TOAST_STYLES[t.type] || TOAST_STYLES.info
          return (
            <div
              key={t.id}
              className={t.exiting ? 'toast-exit' : 'toast-enter'}
              style={{
                pointerEvents: 'all',
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderRadius: 10,
                padding: '12px 14px',
                minWidth: 260, maxWidth: 380,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                cursor: 'pointer',
              }}
              onClick={() => onRemove(t.id)}
            >
              <span style={{ fontSize: 14, color: s.color, fontWeight: 700, lineHeight: 1.4, flexShrink: 0 }}>{s.icon}</span>
              <span style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5, flex: 1 }}>{t.message}</span>
              <span style={{ fontSize: 16, color: '#475569', lineHeight: 1, flexShrink: 0, marginTop: 1 }}>×</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
