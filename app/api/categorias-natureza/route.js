import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { NATUREZAS } from '@/lib/natureza-categoria'

// ─── Natureza das categorias ────────────────────────────────────────────────
// GET    → lista a classificação da organização
// POST   { categoria, natureza, observacao } → grava ou atualiza
// DELETE ?categoria=... → volta ao padrão (operacional)
//
// Escopo por organização resolvido em JavaScript, mesmo motivo de
// /api/my-empresas: consultas parametrizadas sofriam cache de plano no
// ambiente serverless da Vercel e voltavam incompletas.
export const dynamic = 'force-dynamic'
export const revalidate = 0

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

async function contexto(request) {
  const db = admin()
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return { erro: 'Não autenticado', status: 401 }
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return { erro: 'Token inválido', status: 401 }
  const { data: profile } = await db.from('profiles')
    .select('organization_id, role').eq('id', user.id).single()
  if (!profile?.organization_id) return { erro: 'Perfil sem organização', status: 403 }
  return { db, user, profile, orgId: profile.organization_id }
}

// Tabela recém-criada: se a migração ainda não rodou, degrada em vez de quebrar.
function tabelaAusente(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
    || /does not exist|schema cache/i.test(error?.message || '')
}

export async function GET(request) {
  const ctx = await contexto(request)
  if (ctx.erro) return NextResponse.json({ error: ctx.erro }, { status: ctx.status })

  const { data, error } = await ctx.db.from('categorias_natureza')
    .select('id, organization_id, categoria, natureza, observacao, updated_at')
    .order('categoria', { ascending: true })

  if (error) {
    if (tabelaAusente(error)) return NextResponse.json({ naturezas: [], migracao_pendente: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({
    naturezas: (data || []).filter(n => n.organization_id === ctx.orgId),
  })
}

export async function POST(request) {
  const ctx = await contexto(request)
  if (ctx.erro) return NextResponse.json({ error: ctx.erro }, { status: ctx.status })
  if (!['org_admin', 'super_admin'].includes(ctx.profile.role))
    return NextResponse.json({ error: 'Apenas administradores podem classificar categorias' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  // Aceita uma ou várias de uma vez — o assistente classifica em lote.
  const itens = Array.isArray(body?.itens) ? body.itens : [body]
  const linhas = []
  for (const it of itens) {
    const categoria = String(it?.categoria ?? '').trim()
    const natureza = String(it?.natureza ?? '').trim()
    if (!categoria) return NextResponse.json({ error: 'categoria obrigatória' }, { status: 400 })
    if (!Object.keys(NATUREZAS).includes(natureza))
      return NextResponse.json({ error: `natureza inválida: ${natureza}` }, { status: 400 })
    linhas.push({
      organization_id: ctx.orgId, categoria, natureza,
      observacao: it?.observacao ?? null, definido_por: ctx.user.id,
    })
  }

  const { data, error } = await ctx.db.from('categorias_natureza')
    .upsert(linhas, { onConflict: 'organization_id,categoria' }).select()
  if (error) {
    if (tabelaAusente(error))
      return NextResponse.json({ error: 'Migração 20260915_categorias_natureza.sql ainda não aplicada no banco.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ naturezas: data, gravados: linhas.length })
}

export async function DELETE(request) {
  const ctx = await contexto(request)
  if (ctx.erro) return NextResponse.json({ error: ctx.erro }, { status: ctx.status })
  if (!['org_admin', 'super_admin'].includes(ctx.profile.role))
    return NextResponse.json({ error: 'Apenas administradores podem alterar a classificação' }, { status: 403 })

  const categoria = new URL(request.url).searchParams.get('categoria')
  if (!categoria) return NextResponse.json({ error: 'categoria obrigatória' }, { status: 400 })

  // Confere a posse ANTES de apagar — nunca delete por chave sem escopo
  const { data: alvos } = await ctx.db.from('categorias_natureza')
    .select('id, organization_id, categoria')
  const alvo = (alvos || []).find(a =>
    a.organization_id === ctx.orgId &&
    String(a.categoria).trim().toLowerCase() === categoria.trim().toLowerCase())
  if (!alvo) return NextResponse.json({ error: 'Categoria não classificada' }, { status: 404 })

  const { error } = await ctx.db.from('categorias_natureza').delete().eq('id', alvo.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ removido: alvo.categoria })
}
