'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const [empresa, setEmpresa] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }
      const { data } = await supabase.from('empresas').select('id, nome').order('nome')
      if (data && data.length > 0) {
        setEmpresas(data)
        const saved = localStorage.getItem('empresa_id')
        setEmpresa(saved && data.find(e => e.id === saved) ? saved : data[0].id)
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar
        empresa={empresa}
        empresas={empresas}
        onEmpresaChange={handleEmpresaChange}
      />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
