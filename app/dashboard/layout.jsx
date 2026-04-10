'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const [empresa, setEmpresa] = useState('demo')
  const [empresas, setEmpresas] = useState([{ id: 'demo', nome: 'Empresa Demo' }])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }
      try {
        const { data } = await supabase.from('empresas').select('id, nome').order('nome')
        if (data && data.length > 0) {
          setEmpresas(data)
          const saved = localStorage.getItem('empresa_id')
          setEmpresa(saved && data.find(e => e.id === saved) ? saved : data[0].id)
        }
      } catch (e) {
        // usa empresa demo se nao houver dados
      }
      setLoading(false)
    }
    checkAuth()
  }, [])

  const handleEmpresaChange = (id) => {
    setEmpresa(id)
    localStorage.setItem('empresa_id', id)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #1a1a2e', borderTop: '3px solid #00e676', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0f' }}>
      <Sidebar
        empresa={empresa}
        empresas={empresas}
        onEmpresaChange={handleEmpresaChange}
      />
      <main style={{ flex: 1, overflowAuto: 'auto', padding: '24px' }}>
        {children}
      </main>
    </div>
  )
}
