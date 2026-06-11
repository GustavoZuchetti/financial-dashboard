'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Next.js App Router error boundary — captura erros de renderização
// em qualquer página filha de /dashboard
export default function DashboardError({ error, reset }) {
  const router = useRouter()

  useEffect(() => {
    console.error('Dashboard error boundary:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        maxWidth: 460, textAlign: 'center',
        background: 'var(--fs-surface)', border: '1px solid var(--fs-border)',
        borderRadius: 16, padding: '40px 36px',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--fs-text-1)', marginBottom: 10 }}>
          Algo deu errado
        </h2>
        <p style={{ fontSize: 14, color: 'var(--fs-text-3)', lineHeight: 1.6, marginBottom: 28 }}>
          Ocorreu um erro inesperado ao carregar esta página. Você pode tentar
          novamente ou voltar ao início do sistema.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/dashboard/dre')}
            style={{ background: 'transparent', border: '1px solid var(--fs-border)', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, color: 'var(--fs-text-2)', cursor: 'pointer' }}
          >
            Voltar ao início
          </button>
          <button
            onClick={() => reset()}
            style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <pre style={{
            marginTop: 24, padding: 12, background: 'var(--fs-bg)', borderRadius: 8,
            fontSize: 11, color: 'var(--fs-text-4)', textAlign: 'left', overflowX: 'auto',
            border: '1px solid var(--fs-border)',
          }}>
            {error?.message || 'Erro desconhecido'}
          </pre>
        )}
      </div>
    </div>
  )
}
