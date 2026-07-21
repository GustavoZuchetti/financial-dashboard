import { getAdmin, ensureToken, fetchDetalhe } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const KEY = 'f9ce6add2ad362a664f7ffce30244c02'
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const out = {}

  // 1. Estado da integração/token
  const { data: integ0 } = await admin.from('integracoes').select('*').eq('empresa_id', FACE).single()
  out.integracao = {
    tem_client_id: !!integ0?.client_id,
    tem_refresh: !!integ0?.refresh_token,
    fluxo_ativo: integ0?.modulo_fluxo_ativo,
    ultima_sync: integ0?.ultima_sync,
    ultima_sync_cron: integ0?.ultima_sync_cron,
    cron_cursor: integ0?.cron_cursor,
    cron_resultado: integ0?.cron_resultado,
  }

  // 2. Token renova?
  let integ = null
  try { integ = await ensureToken(admin, integ0); out.token_ok = !!integ?.access_token }
  catch (e) { out.token_ok = false; out.token_erro = String(e) }

  // 3. Saúde dos dados
  const hoje = new Date().toISOString().split('T')[0]
  const q = (f) => admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id', FACE).then(r=>r.count)
  out.dados = {
    total: await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id',FACE).then(r=>r.count),
    categorias_cruas: await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id',FACE).like('categoria','Categoria %').then(r=>r.count),
    pagos_sem_data_liq: await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id',FACE).in('status',['pago','parcial']).is('data_liquidacao',null).like('doc_ref','bling:%').then(r=>r.count),
    sem_descricao: await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id',FACE).or('descricao.is.null,descricao.eq.Sem descrição').then(r=>r.count),
    abertos_vencidos: await admin.from('fluxo_caixa').select('id',{count:'exact',head:true}).eq('empresa_id',FACE).in('status',['aberto','parcial']).lt('data',hoje).then(r=>r.count),
    ultimo_gravado: await admin.from('fluxo_caixa').select('created_at,descricao,data,status').eq('empresa_id',FACE).order('created_at',{ascending:false}).limit(1).maybeSingle().then(r=>r.data),
  }

  // 4. Cross-check com Bling (3 pagos)
  if (integ?.access_token) {
    const { data: amostra } = await admin.from('fluxo_caixa').select('doc_ref,descricao,status,data_liquidacao').eq('empresa_id',FACE).eq('status','pago').like('doc_ref','bling:%').limit(3)
    out.cross_check = []
    for (const r of amostra||[]) {
      const [,tRef,id] = r.doc_ref.split(':')
      const det = await fetchDetalhe(integ, tRef==='entrada'?'contas/receber':'contas/pagar', id)
      out.cross_check.push({ desc: r.descricao?.slice(0,30), banco: r.status, banco_liq: r.data_liquidacao, bling_situacao: det?.situacao, bling_saldo: det?.saldo })
    }
  }
  return Response.json(out)
}
