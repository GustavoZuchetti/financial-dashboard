import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
  )
}

const BUCKET  = 'org-assets'
const ORG_ID  = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

export async function POST(request) {
  const admin = getAdmin()

  // Verificar autenticação
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  // Ler o arquivo da pasta public
  const filePath = path.join(process.cwd(), 'public', 'logo-dark.jpg')
  let fileBuffer
  try {
    fileBuffer = fs.readFileSync(filePath)
  } catch (e) {
    return NextResponse.json({ error: 'Arquivo não encontrado: ' + e.message }, { status: 500 })
  }

  // Garantir que o bucket existe
  const { data: buckets } = await admin.storage.listBuckets()
  if (!(buckets || []).find(b => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 2097152 })
  }

  // Upload
  const storagePath = `logos/${ORG_ID}/logo-dark.jpg`
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { upsert: true, contentType: 'image/jpeg' })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // URL pública
  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
  const logoUrl = urlData.publicUrl + '?v=' + Date.now()

  // Salvar no banco
  const { error: dbErr } = await admin
    .from('organizations')
    .update({ logo_url: logoUrl })
    .eq('id', ORG_ID)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, logo_url: logoUrl })
}
