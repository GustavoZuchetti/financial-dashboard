'use client'
import { useState, useEffect } from 'react'

// Observa o atributo data-theme no <html> e reage à troca em tempo real
export function useActiveTheme() {
  const getTheme = () => {
    if (typeof document === 'undefined') return 'dark'
    return document.documentElement.getAttribute('data-theme') ||
      localStorage.getItem('fs-theme') || 'dark'
  }
  const [theme, setTheme] = useState('dark')
  useEffect(() => {
    setTheme(getTheme())
    const obs = new MutationObserver(() => setTheme(getTheme()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

// Escolhe a logo certa para o tema com fallback inteligente
function pickLogo(theme, logoUrl, logoUrlLight) {
  if (theme === 'light') return logoUrlLight || logoUrl || null
  return logoUrl || logoUrlLight || null
}

// Filtro CSS para o tema escuro quando não há versão específica para ele:
// se só existe logo_url_light (versão clara), clareia no tema escuro;
// se existe logo_url (versão escura), nenhum filtro.
function pickFilter(theme, logoUrl, logoUrlLight) {
  if (theme !== 'dark') return 'none'
  // Está usando a versão light no tema escuro (não tem versão dark)
  if (!logoUrl && logoUrlLight) return 'brightness(0) invert(1)'
  return 'none'
}

export default function OrgLogo({ logoUrl, logoUrlLight, height = 44, maxWidth = 180 }) {
  const theme = useActiveTheme()
  const src    = pickLogo(theme, logoUrl, logoUrlLight)
  const filter = pickFilter(theme, logoUrl, logoUrlLight)

  if (src) {
    return (
      <img
        key={src + theme}           /* força remount ao trocar tema */
        src={src}
        alt="Logo da organização"
        style={{
          height,
          maxWidth,
          objectFit: 'contain',
          flexShrink: 0,
          filter,
          transition: 'filter 0.3s ease',
        }}
      />
    )
  }

  // Fallback: marca FS
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
