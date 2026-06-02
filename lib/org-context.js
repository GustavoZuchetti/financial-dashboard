'use client'
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const OrgContext = createContext(null)

// Cache em memória — sobrevive à navegação SPA, resetado no logout
let _cache = null

export function OrgProvider({ children }) {
  // Inicializar estado com cache imediatamente — elimina o flash de loading
  const [org,       setOrg]       = useState(_cache?.org     ?? null)
  const [profile,   setProfile]   = useState(_cache?.profile ?? null)
  const [viewAsOrg, setViewAsOrg] = useState(null)
  const [loading,   setLoading]   = useState(_cache === null)
  const initRef = useRef(false)

  useEffect(() => {
    // Cache já disponível — usar sem bater no banco
    if (_cache) {
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

        const { data: p } = await supabase
          .from('profiles')
          .select('id, role, email, organization_id, organizations(id, nome, plano, status)')
          .eq('id', session.user.id)
          .single()

        if (p) {
          const orgData = p.organizations || null
          setProfile(p)
          setOrg(orgData)
          _cache = { org: orgData, profile: p }

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
        console.error('OrgContext init:', e)
      } finally {
        setLoading(false)
      }
    }

    init()

    // Auth listener — reseta ao logout ou troca de usuário
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        _cache = null
        setOrg(null); setProfile(null); setViewAsOrg(null)
        setLoading(false)
        initRef.current = false
      }
      // Troca de usuário (ex: demo → gustavo) — limpar cache e recarregar
      if (event === 'SIGNED_IN' && session?.user) {
        const cachedUserId = _cache?.profile?.id
        if (cachedUserId && cachedUserId !== session.user.id) {
          _cache = null
          initRef.current = false
          setLoading(true)
          setProfile(null); setOrg(null)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const effectiveOrg = viewAsOrg || org
  const isSuperAdmin = profile?.role === 'super_admin'
  const isViewingAs  = isSuperAdmin && viewAsOrg !== null

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

export const clearOrgCache = () => { _cache = null }
