'use client'
import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

// Contexto para gerenciar a empresa selecionada globalmente sem recarregar a página
const DashboardContext = createContext()

export const useDashboard = () => useContext(DashboardContext)

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const [empresa, setEmpresa] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/')
        return
      }

      setUser(session.user)

      try {
        // Busca apenas empresas que pertencem ao usuário autenticado (Segurança Multi-tenant)
        const { data, error } = await supabase
          .from('empresas')
          .select('id, nome')
          .eq('user_id', session.user.id)
          .order('nome')

        if (error) throw error

        if (data && data.length > 0) {
          setEmpresas(data)
          const saved = localStorage.getItem('empresa_id')
          
          // Validar se o valor salvo é válido (pode ser um ID de empresa ou "todas")
          let initialEmpresa = data[0].id
          if (saved === 'todas' || (saved && data.find(e => e.id === saved))) {
            initialEmpresa = saved
          }
          
          setEmpresa(initialEmpresa)
          
          if (saved !== initialEmpresa) {
            localStorage.setItem('empresa_id', initialEmpresa)
          }
        } else {
          // Se o usuário não tem empresas, redireciona para criar a primeira
          setEmpresas([])
        }
      } catch (e) {
        console.error('Erro ao carregar empresas:', e)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Listener para mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/')
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handleEmpresaChange = (id) => {
    setEmpresa(id)
    localStorage.setItem('empresa_id', id)
    // Removido window.location.reload() para melhor performance
    // As páginas que consomem o contexto ou o localStorage via useEffect irão reagir
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #1a1a2e', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '500' }}>Carregando ambiente seguro...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <DashboardContext.Provider value={{ empresa, empresas, user, setEmpresa: handleEmpresaChange }}>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0f' }}>
        <Sidebar
          empresa={empresa}
          empresas={empresas}
          onEmpresaChange={handleEmpresaChange}
        />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px', position: 'relative' }}>
          {empresas.length === 0 && !loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', color: '#fff', textAlign: 'center' }}>
              <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Bem-vindo ao Financial Dashboard</h2>
              <p style={{ color: '#9ca3af', marginBottom: '24px' }}>Você ainda não tem nenhuma empresa cadastrada.</p>
              <button 
                onClick={() => router.push('/dashboard/configuracoes')}
                style={{ background: '#3b82f6', color: '#000', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cadastrar Minha Primeira Empresa
              </button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </DashboardContext.Provider>
  )
}
