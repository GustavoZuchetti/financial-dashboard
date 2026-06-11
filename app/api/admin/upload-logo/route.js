import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BUCKET = 'org-assets'

// Garante que o bucket existe (cria se necessário) e que a tabela org_settings existe
async function ensureInfra() {
  // 1. Bucket
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  const exists = (buckets || []).some(b => b.name === BUCKET)
  if (!exists) {
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024, // 2MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
    })
  }
  // 2. Tabela org_settings (idempotente via RPC SQL não disponível —
  //    a tabela deve existir; se não, o upsert falhará e tratamos no catch)
}

export async function POST(req) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // Verificar permissão (org_admin ou super_admin) e obter org
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

    await ensureInfra()

    const ext  = (file.name?.split('.').pop() || 'png').toLowerCase()
    const path = `logos/${profile.organization_id}/logo.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET).upload(path, buffer, { upsert: true, contentType: file.type })
    if (upErr) return NextResponse.json({ error: 'Falha no upload: ' + upErr.message }, { status: 500 })

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    const versionedUrl = `${publicUrl}?v=${Date.now()}`

    const { error: dbErr } = await supabaseAdmin.from('org_settings').upsert(
      { organization_id: profile.organization_id, logo_url: versionedUrl, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id' }
    )
    if (dbErr) {
      return NextResponse.json({
        error: 'Logo enviada, mas falha ao salvar referência. A tabela org_settings precisa existir no banco. Detalhe: ' + dbErr.message
      }, { status: 500 })
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

    await supabaseAdmin.from('org_settings').upsert(
      { organization_id: profile.organization_id, logo_url: null, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id' }
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
