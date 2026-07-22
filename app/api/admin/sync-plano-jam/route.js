import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'PH'
const MASTER = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
const JAM = '620c213b-213e-49ec-9bc4-48cf3c23514a'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== 'e0a0db6654972a74c1c98353')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  // 1. amostra crua de uma conta master p/ ver TODAS as colunas
  const { data: amostra, error: e1 } = await admin.from('plano_contas').select('*').eq('empresa_id', MASTER).limit(1)
  const colunas = amostra?.[0] ? Object.keys(amostra[0]) : []
  // 2. tenta inserir UMA conta na JAM copiando a amostra (menos id)
  let insertErro = null, inserido = false
  if (amostra?.[0]) {
    const base = { ...amostra[0] }
    delete base.id; delete base.created_at; delete base.updated_at
    base.empresa_id = JAM
    const { error } = await admin.from('plano_contas').insert([base])
    if (error) insertErro = error.message; else inserido = true
  }
  const { count } = await admin.from('plano_contas').select('id',{count:'exact',head:true}).eq('empresa_id', JAM)
  return Response.json({ colunas, insert_erro: insertErro, inserido, jam_total_agora: count })
}
