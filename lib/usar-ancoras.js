'use client'
// ─── usar-ancoras.js — carregamento das âncoras de saldo nas telas ───────────
// Ponto único de acesso às âncoras pelo lado do cliente. Existe para que as
// três telas de caixa (Visão Geral, Fluxo de Caixa, Gestão) não repitam o
// fetch nem a montagem das entidades — regra canônica nº 7.
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useAncoras(empIds) {
  const [ancoras, setAncoras] = useState(null)   // null = ainda carregando
  const [erro, setErro] = useState(null)
  const chave = (empIds || []).slice().sort().join(',')

  useEffect(() => {
    let cancelado = false
    if (!chave) { setAncoras([]); return }
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const r = await fetch(`/api/saldos-abertura?empresa_ids=${encodeURIComponent(chave)}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` },
        })
        const j = await r.json()
        if (cancelado) return
        if (j.error) { setErro(j.error); setAncoras([]); return }
        setAncoras(j.ancoras || [])
      } catch (e) {
        if (!cancelado) { setErro(e.message); setAncoras([]) }
      }
    })()
    return () => { cancelado = true }
  }, [chave])

  return { ancoras, erro, carregando: ancoras === null }
}

// Mensagem padrão quando o saldo não pode ser composto — usada nas três telas
// para que o texto seja idêntico em todas.
export function motivoIndisponivel(faltando = []) {
  if (!faltando.length) return 'Saldo de abertura não configurado.'
  const nomes = faltando.map(f => f.nome).join(', ')
  return `Sem saldo de abertura para: ${nomes}. Configure em Configurações › Saldo de Abertura.`
}
