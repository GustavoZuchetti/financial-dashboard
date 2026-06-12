import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
  )
}

const BUCKET = 'org-assets'

async function ensureLogoColumn() {
  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([^.]+)\./)?.[1]
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN
  if (!projectRef || !mgmtToken) return
  try {
    await fetch('https://api.supabase.com/v1/projects/' + projectRef + '/database/query', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + mgmtToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;' }),
    })
  } catch (_e) {}
}

async function ensureBucket(admin) {
  const { data: list } = await admin.storage.listBuckets()
  if (!(list || []).some(function(b) { return b.name === BUCKET })) {
    await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 2097152 })
  }
}

export async function POST(request) {
  try {
    const admin = getAdmin()
    const token = (request.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { data: profile } = await admin
      .from('profiles').select('role, organization_id').eq('id', user.id).single()
    if (!profile || !['super_admin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Sem organização' }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!file) return NextResponse.json({ error: 'Arquivo ausente' }, { status: 400 })

    await ensureBucket(admin)
    await ensureLogoColumn()

    const nameParts = (file.name || 'logo.png').split('.')
    const ext = nameParts.length > 1 ? nameParts.pop().toLowerCase() : 'png'
    const storagePath = 'logos/' + profile.organization_id + '/logo.' + ext
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error: upErr } = await admin.storage
      .from(BUCKET).upload(storagePath, buffer, { upsert: true, contentType: file.type })
    if (upErr) return NextResponse.json({ error: 'Upload falhou: ' + upErr.message }, { status: 500 })

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
    const logoUrl = urlData.publicUrl + '?v=' + Date.now()

    const { error: dbErr } = await admin
      .from('organizations').update({ logo_url: logoUrl }).eq('id', profile.organization_id)
    if (dbErr) return NextResponse.json({ error: 'Erro ao salvar URL: ' + dbErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, logo_url: logoUrl })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const admin = getAdmin()
    const token = (request.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { data: profile } = await admin
      .from('profiles').select('role, organization_id').eq('id', user.id).single()
    if (!profile || !['super_admin', 'org_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await admin.from('organizations').update({ logo_url: null }).eq('id', profile.organization_id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
