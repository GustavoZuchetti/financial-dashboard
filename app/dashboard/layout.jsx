'use client'
import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ViewAsBanner from '@/components/ViewAsBanner'
import IdleTimeout from '@/components/IdleTimeout'

const DashboardContext = createContext()
export const useDashboard = () => useContext(DashboardContext)

export default function DashboardLayout({ children }) {
  const router   = useRouter()
  const [empresa,  setEmpresa]  = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [user,     setUser]     = useState(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/'); return }
        setUser(session.user)

        const res = await fetch('/api/my-empresas', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        const { empresas: data } = await res.json()

        if (data && data.length > 0) {
          setEmpresas(data)
          const saved = localStorage.getItem('empresa_id')
          let initial = data[0].id
          if (saved === 'todas' || (saved && data.find(e => e.id === saved))) {
            initial = saved
          }
          setEmpresa(initial)
          if (saved !== initial) localStorage.setItem('empresa_id', initial)
        } else {
          setEmpresas([])
        }
      } catch (e) {
        console.error('checkAuth error:', e)
        // Se falhar por qualquer motivo (ex: Supabase pausado), redirecionar ao login
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/')
    })
    return () => subscription.unsubscribe()
  }, [router])

  const handleEmpresaChange = (id) => {
    setEmpresa(id)
    localStorage.setItem('empresa_id', id)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--fs-bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <div style={{ width:40, height:40, border:'3px solid #1a1a2e', borderTop:'3px solid #3b82f6', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
        <span style={{ color:'var(--fs-text-2)', fontSize:14, fontWeight:500 }}>Carregando ambiente...</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <DashboardContext.Provider value={{ empresa, empresas, user, setEmpresa: handleEmpresaChange }}>
      <IdleTimeout />
      <ViewAsBanner />
      <div style={{ display:'flex', minHeight:'100vh', background:'var(--fs-bg)' }}>
        <Sidebar empresa={empresa} empresas={empresas} onEmpresaChange={handleEmpresaChange} />
        {/* Divisor vertical — 1px que acompanha a altura total da página */}
        <div style={{ width: 1, flexShrink: 0, background: 'var(--fs-border)' }} />
        <main style={{ flex:1, overflowY:'auto', padding:'28px 32px', position:'relative', minWidth:0 }}>
          {empresas.length === 0 && !loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'80vh', color:'var(--fs-text-1)', textAlign:'center' }}>
              <h2 style={{ fontSize:24, marginBottom:12 }}>Bem-vindo ao Financial Dashboard</h2>
              <p style={{ color:'var(--fs-text-2)', marginBottom:24 }}>
                Nenhuma empresa encontrada para a sua organização.
              </p>
              <button
                onClick={() => router.push('/dashboard/configuracoes')}
                style={{ background:'#3b82f6', color:'#fff', border:'none', padding:'12px 24px', borderRadius:8, fontWeight:700, cursor:'pointer' }}>
                Ir para Configurações
              </button>
            </div>
          ) : children}
        </main>
      </div>
    </DashboardContext.Provider>
  )
}
