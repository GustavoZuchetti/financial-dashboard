import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { normalizarValor } from '@/lib/saldo-abertura'

// ─── Âncoras de saldo de abertura ───────────────────────────────────────────
// GET  ?empresa_ids=a,b,c  → lista as âncoras das empresas pedidas
// POST { empresa_id, data_corte, valor, origem, observacao, conciliado }
// DELETE ?id=<uuid>
//
// Roda com service role e faz o escopo por organização EM JAVASCRIPT, pelo
// mesmo motivo de /api/my-empresas: consultas parametrizadas com .eq() sofriam
// cache de plano no ambiente serverless da Vercel e voltavam incompletas.
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

  // Empresas da organização — a fronteira de autorização de tudo abaixo
  const { data: todas } = await db.from('empresas').select('id, nome, organization_id')
  const minhas = (todas || []).filter(e => e.organization_id === profile.organization_id)
  return { db, user, profile, minhas, idsPermitidos: new Set(minhas.map(e => e.id)) }
}

export async function GET(request) {
  const ctx = await contexto(request)
  if (ctx.erro) return NextResponse.json({ error: ctx.erro }, { status: ctx.status })

  const pedidas = (new URL(request.url).searchParams.get('empresa_ids') || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const alvo = pedidas.length
    ? pedidas.filter(id => ctx.idsPermitidos.has(id))
    : [...ctx.idsPermitidos]

  const { data: todas, error } = await ctx.db.from('saldos_abertura')
    .select('id, empresa_id, data_corte, valor, origem, observacao, conciliado_em, conciliado_por, updated_at')
    .order('data_corte', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const permitido = new Set(alvo)
  const ancoras = (todas || [])
    .filter(a => permitido.has(a.empresa_id))
    .map(a => ({ ...a, valor: Number(a.valor) }))

  return NextResponse.json({
    ancoras,
    empresas: ctx.minhas.filter(e => permitido.has(e.id)).map(e => ({ id: e.id, nome: e.nome })),
  })
}

export async function POST(request) {
  const ctx = await contexto(request)
  if (ctx.erro) return NextResponse.json({ error: ctx.erro }, { status: ctx.status })
  if (!['org_admin', 'super_admin'].includes(ctx.profile.role))
    return NextResponse.json({ error: 'Apenas administradores podem definir saldo de abertura' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { empresa_id, data_corte, origem = 'extrato_bancario', observacao = null, conciliado = false } = body

  if (!ctx.idsPermitidos.has(empresa_id))
    return NextResponse.json({ error: 'Entidade fora da sua organização' }, { status: 403 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data_corte || '')))
    return NextResponse.json({ error: 'data_corte deve estar no formato AAAA-MM-DD' }, { status: 400 })
  if (!['extrato_bancario', 'fechamento_mensal', 'saldo_migrado'].includes(origem))
    return NextResponse.json({ error: 'origem inválida' }, { status: 400 })

  // Aceita "499.772,38", "499772.38" e 499772.38 — o campo é digitado por
  // humano, e um saldo lido errado por causa de vírgula é erro grave e silencioso.
  const valor = normalizarValor(body.valor)
  if (valor === null)
    return NextResponse.json({ error: 'valor inválido' }, { status: 400 })

  const empresa = ctx.minhas.find(e => e.id === empresa_id)
  const linha = {
    organization_id: empresa.organization_id,
    empresa_id, data_corte, valor, origem, observacao,
    conciliado_por: conciliado ? ctx.user.id : null,
    conciliado_em:  conciliado ? new Date().toISOString() : null,
  }

  const { data, error } = await ctx.db.from('saldos_abertura')
    .upsert(linha, { onConflict: 'empresa_id,data_corte' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ancora: { ...data, valor: Number(data.valor) } })
}

export async function DELETE(request) {
  const ctx = await contexto(request)
  if (ctx.erro) return NextResponse.json({ error: ctx.erro }, { status: ctx.status })
  if (!['org_admin', 'super_admin'].includes(ctx.profile.role))
    return NextResponse.json({ error: 'Apenas administradores podem remover saldo de abertura' }, { status: 403 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  // Confere a posse ANTES de apagar — nunca delete direto por id
  const { data: alvo } = await ctx.db.from('saldos_abertura')
    .select('id, empresa_id').eq('id', id).single()
  if (!alvo || !ctx.idsPermitidos.has(alvo.empresa_id))
    return NextResponse.json({ error: 'Âncora não encontrada' }, { status: 404 })

  const { error } = await ctx.db.from('saldos_abertura').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ removido: id })
}
