'use client'
import { useOrg } from '@/lib/org-context'

export default function ViewAsBanner() {
  const { isViewingAs, viewAsOrg, exitViewAs } = useOrg()
  if (!isViewingAs) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'linear-gradient(90deg,#7c3aed,#4f46e5)',
      color: '#fff', padding: '8px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 13, fontWeight: 600, boxShadow: '0 2px 12px rgba(0,0,0,0.4)'
    }}>
      <span>👁 Visualizando como: <strong>{viewAsOrg?.nome}</strong> · Plano {viewAsOrg?.plano}</span>
      <button onClick={exitViewAs} style={{
        background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
        color: '#fff', padding: '4px 14px', borderRadius: 6,
        fontSize: 12, fontWeight: 700, cursor: 'pointer'
      }}>
        ✕ Sair do modo visualização
      </button>
    </div>
  )
}
