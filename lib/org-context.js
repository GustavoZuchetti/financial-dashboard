'use client'
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
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
  const loadingRef = useRef(false)

  // Carrega profile + organização do usuário logado.
  // Reutilizável: chamada no mount E no SIGNED_IN (fix do bug de login SPA,
  // onde o provider montava sem sessão e nunca recarregava após o login).
  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoading(false); return }

      // Cache válido para este usuário — usar sem bater no banco
      if (_cache && _cache.profile?.id === session.user.id) {
        setProfile(_cache.profile)
        setOrg(_cache.org)
        setLoading(false)
        await maybeLoadViewAs(_cache.profile, _cache.org)
        return
      }

      const { data: p } = await supabase
        .from('profiles')
        .select('id, role, email, organization_id, organizations(*)')
        .eq('id', session.user.id)
        .single()

      if (p) {
        const orgData = p.organizations || null
        setProfile(p)
        setOrg(orgData)
        _cache = { org: orgData, profile: p }
        await maybeLoadViewAs(p, orgData)
      }
    } catch (e) {
      console.error('OrgContext load:', e)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  // Super admin com ?org= na URL → carregar org de visualização
  const maybeLoadViewAs = async (p, orgData) => {
    if (p?.role !== 'super_admin' || typeof window === 'undefined') return
    const viewOrgId = new URLSearchParams(window.location.search).get('org')
    if (viewOrgId && viewOrgId !== orgData?.id) {
      const { data: vo } = await supabase
        .from('organizations').select('*').eq('id', viewOrgId).single()
      if (vo) setViewAsOrg(vo)
    }
  }

  useEffect(() => {
    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        _cache = null
        setOrg(null); setProfile(null); setViewAsOrg(null)
        setLoading(false)
        return
      }
      if (event === 'SIGNED_IN' && session?.user) {
        const cachedUserId = _cache?.profile?.id
        // Recarregar quando: (a) não há cache (login após mount sem sessão —
        // o caso que deixava o org nulo para sempre) ou (b) trocou de usuário
        if (!_cache || cachedUserId !== session.user.id) {
          if (cachedUserId !== session.user.id) {
            _cache = null
            setProfile(null); setOrg(null)
          }
          setLoading(true)
          load()
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [load])

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
