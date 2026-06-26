import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { data: profile } = await admin
    .from('profiles').select('organization_id, role').eq('id', user.id).single()

  let empresas = []

  if (profile?.organization_id) {
    // Buscar todas e filtrar em JS — evita qualquer cache de plano de query
    // por organization_id que estava retornando resultado parcial no ambiente
    // serverless (entidades recém-criadas não apareciam).
    const { data } = await admin.from('empresas').select('id, nome, organization_id')
    empresas = (data || [])
      .filter(e => e.organization_id === profile.organization_id)
      .map(e => ({ id: e.id, nome: e.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }

  // Fallback para usuários sem organização
  if (empresas.length === 0) {
    const { data } = await admin.from('empresas').select('id, nome, user_id')
    empresas = (data || [])
      .filter(e => e.user_id === user.id)
      .map(e => ({ id: e.id, nome: e.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }

  return NextResponse.json(
    { empresas, organization_id: profile?.organization_id || null },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
