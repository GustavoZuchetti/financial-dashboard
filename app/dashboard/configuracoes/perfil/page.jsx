'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfiguracoesPerfil() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/configuracoes?tab=perfil')
  }, [])
  return null
}
