// TEMP: corrige o EVOLLO específico + permite reparo pontual por id. Remover após.
import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = 'PH'
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  const sp = new URL(request.url).searchParams
  if (sp.get('key') !== 'ccb038b22d38bf5c950ea161') return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  // corrige o EVOLLO 26280111859: 15/07 → 10/07 (borderô)
  const { data: antes } = await admin.from('fluxo_caixa')
    .select('descricao,data_liquidacao,status').eq('empresa_id', FACE)
    .like('doc_ref','%26280111859').maybeSingle()
  const { error } = await admin.from('fluxo_caixa')
    .update({ data_liquidacao: '2026-07-10' }).eq('empresa_id', FACE).like('doc_ref','%26280111859')
  const { data: depois } = await admin.from('fluxo_caixa')
    .select('descricao,data_liquidacao,status').eq('empresa_id', FACE)
    .like('doc_ref','%26280111859').maybeSingle()
  return Response.json({ antes, erro: error?.message || null, depois })
}
