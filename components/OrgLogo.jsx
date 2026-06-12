'use client'
import { useState, useEffect } from 'react'

// Hook: observa o tema ativo (data-theme no <html>) e reage à troca em tempo real
export function useActiveTheme() {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute('data-theme') || 'dark')
    read()
    // MutationObserver: dispara imediatamente quando o ThemeToggle muda o atributo
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return theme
}

// Escolhe a logo certa para o tema atual, com fallback inteligente:
// tema claro → logo_url_light, senão logo_url
// tema escuro → logo_url, senão logo_url_light
export function pickLogo(theme, logoUrl, logoUrlLight) {
  if (theme === 'light') return logoUrlLight || logoUrl || null
  return logoUrl || logoUrlLight || null
}

// Logo da organização que acompanha o tema. Fallback: marca FS/Facesign.
export default function OrgLogo({ logoUrl, logoUrlLight, height = 34, maxWidth = 150 }) {
  const theme = useActiveTheme()
  const src = pickLogo(theme, logoUrl, logoUrlLight)

  if (src) {
    return (
      <img
        src={src}
        alt="Logo da organização"
        style={{ height, maxWidth, objectFit: 'contain', flexShrink: 0 }}
      />
    )
  }

  return (
    <>
      <div style={{
        width: 34, height: 34,
        background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
        borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, color: '#fff', fontSize: 14,
        boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
        flexShrink: 0,
      }}>FS</div>
      <div>
        <div style={{ fontWeight: 800, color: 'var(--fs-text-1)', fontSize: 15, letterSpacing: '-0.3px', lineHeight: 1.2 }}>Facesign</div>
        <div style={{ fontSize: 10, color: 'var(--fs-text-4)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Financeiro</div>
      </div>
    </>
  )
}
