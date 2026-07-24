import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '756c78e391119ae328b8c975')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: orgs } = await admin.from('organizations').select('id,nome,plano')
  const { data: profs } = await admin.from('profiles').select('id,email,role,organization_id,created_at').order('created_at',{ascending:false})
  const nome = Object.fromEntries((orgs||[]).map(o=>[o.id,o.nome]))
  // usuários do Auth (podem existir sem profile)
  let authUsers = []
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
    authUsers = (data?.users||[]).map(u => ({ email: u.email, id: u.id, criado: u.created_at }))
  } catch (e) { authUsers = ['erro: '+String(e)] }
  const idsProf = new Set((profs||[]).map(p=>p.id))
  const semProfile = authUsers.filter(u => u.id && !idsProf.has(u.id))
  return Response.json({
    organizacoes: (orgs||[]).map(o=>({ id:o.id, nome:o.nome })),
    profiles: (profs||[]).map(p=>({ email:p.email, role:p.role, org: nome[p.organization_id] || p.organization_id || 'SEM ORG', criado:p.created_at })),
    total_auth_users: authUsers.length,
    AUTH_SEM_PROFILE: semProfile,
  })
}
