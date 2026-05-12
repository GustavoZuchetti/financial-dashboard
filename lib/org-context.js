'use client'
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const OrgContext = createContext(null)

// Cache em memória — sobrevive à navegação entre páginas (SPA)
// Reset apenas no refresh completo ou logout
let _cache = null

export function OrgProvider({ children }) {
  const [org,       setOrg]       = useState(null)
  const [profile,   setProfile]   = useState(null)
  const [viewAsOrg, setViewAsOrg] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const initRef = useRef(false)

  useEffect(() => {
    // Já inicializado nesta sessão — usar cache
    if (_cache) {
      setOrg(_cache.org)
      setProfile(_cache.profile)
      setLoading(false)
      // Verificar ?org= apenas se super_admin
      if (_cache.profile?.role === 'super_admin' && typeof window !== 'undefined') {
        const viewOrgId = new URLSearchParams(window.location.search).get('org')
        if (viewOrgId && viewOrgId !== _cache.org?.id) {
          supabase.from('organizations').select('*').eq('id', viewOrgId).single()
            .then(({ data }) => { if (data) setViewAsOrg(data) })
        }
      }
      return
    }

    if (initRef.current) return
    initRef.current = true

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) { setLoading(false); return }

        // Uma única query com join — ao invés de 2 separadas
        const { data: p } = await supabase
          .from('profiles')
          .select('id, role, email, organization_id, organizations(id, nome, plano, status)')
          .eq('id', session.user.id)
          .single()

        if (p) {
          const orgData = p.organizations || null
          setProfile(p)
          setOrg(orgData)
          // Salvar cache em memória
          _cache = { org: orgData, profile: p }

          // View As: só busca se super_admin e tem ?org=
          if (p.role === 'super_admin' && typeof window !== 'undefined') {
            const viewOrgId = new URLSearchParams(window.location.search).get('org')
            if (viewOrgId && viewOrgId !== orgData?.id) {
              const { data: vo } = await supabase
                .from('organizations').select('*').eq('id', viewOrgId).single()
              if (vo) setViewAsOrg(vo)
            }
          }
        }
      } catch (e) {
        console.error('OrgContext:', e)
      } finally {
        setLoading(false)
      }
    }

    init()

    // Auth listener — só para resetar cache no logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        _cache = null
        setOrg(null); setProfile(null); setViewAsOrg(null)
        initRef.current = false
      }
    })
    return () => subscription.unsubscribe()
  }, [])

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

// Helper para limpar cache (usar no logout)
export const clearOrgCache = () => { _cache = null }
