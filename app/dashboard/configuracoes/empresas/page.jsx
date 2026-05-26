'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfiguracoesEmpresas() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/configuracoes?tab=empresas')
  }, [])
  return null
}
