'use client'
import { useState, useEffect } from 'react'

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)
const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

export default function ThemeToggle({ collapsed = false }) {
  const [theme, setTheme] = useState('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const current = document.documentElement.getAttribute('data-theme')
      || localStorage.getItem('fs-theme') || 'dark'
    setTheme(current)
    document.documentElement.setAttribute('data-theme', current)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('fs-theme', next) } catch(_e) {}
  }

  if (!mounted) {
    // Placeholder com mesmo tamanho para não causar layout shift
    return <div style={{ height: 36 }} />
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      style={{
        display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8,
        width: '100%', padding: '8px 10px', borderRadius: 8,
        border: '1px solid var(--fs-border)', background: 'var(--fs-surface-2)',
        cursor: 'pointer', transition: 'all 0.2s', color: 'var(--fs-text-3)',
        fontSize: 12, fontWeight: 600,
        justifyContent: collapsed ? 'center' : 'flex-start', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'relative', width: 32, height: 18, borderRadius: 99,
        background: isDark ? '#1e3a5f' : '#fbbf24',
        border: `1px solid ${isDark ? '#2563eb' : '#f59e0b'}`,
        transition: 'all 0.3s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 1, left: isDark ? 14 : 1,
          width: 14, height: 14, borderRadius: '50%',
          background: '#fff',
          transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} />
      </div>
      {!collapsed && (
        <>
          <span style={{ color: 'var(--fs-text-3)', display: 'flex', alignItems: 'center' }}>
            {isDark ? <MoonIcon /> : <SunIcon />}
          </span>
          <span style={{ color: 'var(--fs-text-3)' }}>
            {isDark ? 'Tema Escuro' : 'Tema Claro'}
          </span>
        </>
      )}
    </button>
  )
}
