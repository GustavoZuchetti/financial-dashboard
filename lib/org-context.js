'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const [org,      setOrg]      = useState(null)  // { id, nome, plano, status }
  const [profile,  setProfile]  = useState(null)  // { id, role, organization_id }
  const [viewAsOrg,setViewAsOrg]= useState(null)  // super_admin "view as"
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) { setLoading(false); return }

        // Buscar perfil do usuário
        const { data: p } = await supabase
          .from('profiles')
          .select('*, organizations(*)')
          .eq('id', session.user.id)
          .single()

        if (p) {
          setProfile(p)
          setOrg(p.organizations)
        }

        // Super admin: verificar ?org=UUID na URL
        if (p?.role === 'super_admin' && typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const viewOrgId = params.get('org')
          if (viewOrgId) {
            const { data: viewOrg } = await supabase
              .from('organizations').select('*').eq('id', viewOrgId).single()
            if (viewOrg) setViewAsOrg(viewOrg)
          }
        }
      } catch (e) {
        console.error('OrgContext init error:', e)
      } finally {
        setLoading(false)
      }
    }

    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => init())
    return () => subscription.unsubscribe()
  }, [])

  // Org efetiva: se super_admin está em view-as, usa a org do cliente
  const effectiveOrg  = viewAsOrg || org
  const isSuperAdmin  = profile?.role === 'super_admin'
  const isViewingAs   = isSuperAdmin && viewAsOrg !== null

  const exitViewAs = () => {
    setViewAsOrg(null)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('org')
      window.history.replaceState({}, '', url.toString())
    }
  }

  return (
    <OrgContext.Provider value={{ org: effectiveOrg, profile, isSuperAdmin, isViewingAs, viewAsOrg, exitViewAs, loading }}>
      {children}
    </OrgContext.Provider>
  )
}

export const useOrg = () => {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside OrgProvider')
  return ctx
}
