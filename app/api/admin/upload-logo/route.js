import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BUCKET = 'org-assets'

// Executa DDL via Management API (cria coluna logo_url se não existir)
async function ensureLogoColumn() {
  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([^.]+)\./)?.[1]
  const mgmtToken  = process.env.SUPABASE_ACCESS_TOKEN
  if (!projectRef || !mgmtToken) return
  try {
    await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;' }),
    })
  } catch(_e) {}
}

// Garante bucket (cria se não existir)
async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  if (!(buckets || []).some(b => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
    })
  }
}

// Salva o logo_url na tabela organizations
async function saveLogoUrl(orgId, url) {
  const { error } = await supabaseAdmin
    .from('organizations').update({ logo_url: url }).eq('id', orgId)
  return { ok: !error, error: error?.message }
}

export async function POST(req) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('role, organization_id').eq('id', user.id).single()
    if (!profile || !['super_admin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão para alterar a logo' }, { status: 403 })
    }
    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Usuário sem organização' }, { status: 400 })
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!file) return NextResponse.json({ error: 'Arquivo ausente' }, { status: 400 })

    await ensureBucket()
    await ensureLogoColumn()

    const ext  = (file.name?.split('.').pop() || 'png').toLowerCase()
    const path = `logos/${profile.organization_id}/logo.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET).upload(path, buffer, { upsert: true, contentType: file.type })
    if (upErr) return NextResponse.json({ error: 'Falha no upload: ' + upErr.message }, { status: 500 })

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    const versionedUrl = `${publicUrl}?v=${Date.now()}`

    const saved = await saveLogoUrl(profile.organization_id, versionedUrl)
    if (!saved.ok) {
      return NextResponse.json({ error: 'Erro ao salvar referência da logo' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, logo_url: versionedUrl })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('role, organization_id').eq('id', user.id).single()
    if (!profile || !['super_admin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await saveLogoUrl(profile.organization_id, null)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
