import { NextResponse } from 'next/server'
import { getAdmin, verifyState, exchangeCode } from '@/lib/bling-server'

// GET /api/integracoes/bling/callback?code=...&state=...
// Registrar esta URL como Redirect URI no app Bling:
// https://financial-dashboard-omega-six.vercel.app/api/integracoes/bling/callback
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const volta = (q) => NextResponse.redirect(`${origin}/dashboard/configuracoes?bling=${q}`)

  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const integId = state ? verifyState(state) : null
  if (!code || !integId) return volta('erro_state')

  const admin = getAdmin()
  const { data: integ } = await admin.from('integracoes').select('*').eq('id', integId).single()
  if (!integ) return volta('erro_integracao')

  try {
    const tk = await exchangeCode(integ, code)
    await admin.from('integracoes').update({
      access_token:    tk.access_token,
      refresh_token:   tk.refresh_token || null,
      token_expira_em: new Date(Date.now() + (tk.expires_in || 21600) * 1000).toISOString(),
      updated_at:      new Date().toISOString(),
    }).eq('id', integId)
    return volta('ok')
  } catch (e) {
    console.error('Bling callback:', e)
    return volta('erro_token')
  }
}
