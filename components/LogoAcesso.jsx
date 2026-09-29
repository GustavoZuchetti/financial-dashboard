'use client'
// ─── LogoAcesso — logo nas telas anteriores à autenticação ──────────────────
//
// Usado em: aceitar convite, redefinir senha. O login mantém sua composição
// própria, mas segue a mesma regra.
//
// Até 30/09/2026 essas telas exibiam um "FS" fixo no código, ignorando a logo
// cadastrada. O fallback continua existindo — para organização sem logo —, mas
// deixa de ser o padrão.
//
// PRIORIDADE DA ORIGEM
//   1. `logo` passada pela tela — no convite, a da organização que convidou
//   2. /api/public/logo           — quando a tela não sabe a organização
//   3. fallback "FS"              — organização sem logo cadastrada
//
// As telas de acesso têm fundo escuro fixo, então a versão escura (logo_url)
// tem precedência sobre a clara — mesma regra do login.
import { useState, useEffect } from 'react'

// MESMA chave do login (app/page.jsx) — reaproveita o cache e evita o flash
// de "FS" antes da logo carregar. Conferida no código em 30/09.
const CACHE = 'fs-org-logo-dark'

export default function LogoAcesso({ logo = null, tamanho = 52, nomeFallback = 'Facesign' }) {
  const [src, setSrc] = useState(() => {
    if (logo) return logo
    if (typeof window === 'undefined') return null
    try { return localStorage.getItem(CACHE) || null } catch { return null }
  })
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    if (logo) { setSrc(logo); setFalhou(false); return }
    let vivo = true
    fetch('/api/public/logo')
      .then(r => r.json())
      .then(({ logo_url, logo_url_light }) => {
        const url = logo_url || logo_url_light
        if (vivo && url) {
          setSrc(url); setFalhou(false)
          try { localStorage.setItem(CACHE, url) } catch { /* modo privado */ }
        }
      })
      .catch(() => { /* sem rede: mantém o cache ou o fallback */ })
    return () => { vivo = false }
  }, [logo])

  // Imagem que não carrega (URL expirada, bucket removido) cai no fallback em
  // vez de exibir ícone de imagem quebrada.
  if (src && !falhou) {
    return (
      <img src={src} alt="Logo" onError={() => setFalhou(true)}
        style={{ height: tamanho, maxWidth: tamanho * 4, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: tamanho, height: tamanho,
        background: 'linear-gradient(135deg,var(--fs-brand-dark),var(--fs-brand))',
        borderRadius: Math.round(tamanho / 4), display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: Math.round(tamanho * 0.42), fontWeight: 800, color: '#fff',
      }}>FS</div>
      {nomeFallback && (
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-text-2)' }}>{nomeFallback}</span>
      )}
    </div>
  )
}
