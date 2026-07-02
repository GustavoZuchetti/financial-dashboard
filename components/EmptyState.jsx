'use client'
// ─── EmptyState — estado vazio padrão do sistema ──────────────────────────────
// Voz de produto: diz o que aconteceu, por que a tela está vazia e qual o
// próximo passo — nunca apenas "sem dados".
import Link from 'next/link'
import SvgIcon from './SvgIcon'

export default function EmptyState({ icon = 'inbox', title, children, actionHref, actionLabel, compact }) {
  return (
    <div style={{ textAlign:'center', padding: compact ? '36px 24px' : '64px 24px' }}>
      <div style={{ width:44, height:44, borderRadius:12, background:'var(--fs-hover-2)', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
        <SvgIcon name={icon} size={20} color="var(--fs-text-4)" />
      </div>
      <div style={{ fontSize:14, fontWeight:700, color:'var(--fs-text-2)', marginBottom:6 }}>{title}</div>
      {children && <div style={{ fontSize:12.5, color:'var(--fs-text-4)', maxWidth:420, margin:'0 auto', lineHeight:1.55 }}>{children}</div>}
      {actionHref && (
        <Link href={actionHref} style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:16, background:'var(--fs-brand)', color:'#fff', borderRadius:8, padding:'8px 16px', fontSize:12.5, fontWeight:700, textDecoration:'none' }}>
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
