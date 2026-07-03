import { NextResponse } from 'next/server'
import { getAuthProfile, signState, BLING } from '@/lib/bling-server'

// GET /api/integracoes — estado das integrações da organização (segredos mascarados)
export async function GET(request) {
  const auth = await getAuthProfile(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin, profile } = auth

  const [{ data: org }, { data: integs }] = await Promise.all([
    admin.from('organizations').select('api_dre_liberado, api_fluxo_liberado').eq('id', profile.organization_id).single(),
    admin.from('integracoes').select('*').eq('organization_id', profile.organization_id),
  ])

  return NextResponse.json({
    liberacao: { dre: !!org?.api_dre_liberado, fluxo: !!org?.api_fluxo_liberado },
    integracoes: (integs || []).map(i => ({
      id: i.id, empresa_id: i.empresa_id, provedor: i.provedor,
      credenciais_ok: !!(i.client_id && i.client_secret),
      conectado: !!i.refresh_token,
      token_expira_em: i.token_expira_em,
      modulo_dre_ativo: i.modulo_dre_ativo,
      modulo_fluxo_ativo: i.modulo_fluxo_ativo,
      ultima_sync: i.ultima_sync,
      ultimo_resultado: i.ultimo_resultado,
      // URL de autorização pronta (state assinado) — só quando há credenciais
      authorize_url: (i.client_id && i.client_secret)
        ? `${BLING.AUTH_URL}?response_type=code&client_id=${encodeURIComponent(i.client_id)}&state=${signState(i.id)}`
        : null,
    })),
  })
}

// POST /api/integracoes — cria/atualiza credenciais e módulos (somente admin da org)
export async function POST(request) {
  const auth = await getAuthProfile(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin, profile } = auth
  if (!['admin', 'super_admin'].includes(profile.role))
    return NextResponse.json({ error: 'Apenas administradores podem configurar integrações' }, { status: 403 })

  const { empresa_id, client_id, client_secret, modulo_dre_ativo, modulo_fluxo_ativo } = await request.json()
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

  // A entidade precisa pertencer à organização do usuário
  const { data: emp } = await admin.from('empresas')
    .select('id').eq('id', empresa_id).eq('organization_id', profile.organization_id).single()
  if (!emp) return NextResponse.json({ error: 'Entidade não pertence à organização' }, { status: 403 })

  // Módulos só podem ser ativados se liberados pela administração
  const { data: org } = await admin.from('organizations')
    .select('api_dre_liberado, api_fluxo_liberado').eq('id', profile.organization_id).single()
  const payload = {
    organization_id: profile.organization_id,
    empresa_id,
    provedor: 'bling',
    updated_at: new Date().toISOString(),
  }
  if (client_id !== undefined && client_id !== '')         payload.client_id = client_id
  if (client_secret !== undefined && client_secret !== '') payload.client_secret = client_secret
  if (modulo_dre_ativo   !== undefined) payload.modulo_dre_ativo   = !!modulo_dre_ativo   && !!org?.api_dre_liberado
  if (modulo_fluxo_ativo !== undefined) payload.modulo_fluxo_ativo = !!modulo_fluxo_ativo && !!org?.api_fluxo_liberado

  const { error } = await admin.from('integracoes')
    .upsert(payload, { onConflict: 'organization_id,empresa_id,provedor' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
