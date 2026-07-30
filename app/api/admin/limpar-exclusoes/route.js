// TEMP: roda a verificação de exclusões em todas as entidades
import { getAdmin, ensureToken, verificarExclusoes } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request) {
  const sp = new URL(request.url).searchParams
  if (sp.get('key') !== '378c83a461996f72caaa5e1e') return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const desde = sp.get('desde') || '2026-06-01'
  const { data: integs } = await admin.from('integracoes').select('*').not('refresh_token','is',null)
  const { data: emps } = await admin.from('empresas').select('id,nome')
  const nome = Object.fromEntries((emps||[]).map(e=>[e.id,e.nome]))
  const inicio = Date.now()
  const rel = []
  for (const i0 of integs || []) {
    if (Date.now() - inicio > 44000) break
    const integ = await ensureToken(admin, i0)
    const r = await verificarExclusoes(admin, integ, { desde, limite: 200, prazoMs: 44000 - (Date.now() - inicio) })
    rel.push({ empresa: nome[i0.empresa_id], ...r })
  }
  return Response.json({ desde, resultado: rel })
}
