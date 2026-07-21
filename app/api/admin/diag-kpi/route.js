import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const KEY = '8d47e2a9740109e260bf4c1056c24344'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== KEY)
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
  const hoje = new Date().toISOString().split('T')[0]
  const n30 = new Date(); n30.setDate(n30.getDate()+30)
  const next30 = n30.toISOString().split('T')[0]

  // Títulos na janela hoje..+30d por tipo (base do "A Pagar / A Receber 30 dias")
  const { data: fc30 } = await admin.from('fluxo_caixa')
    .select('tipo,status,valor,data').eq('empresa_id', FACE).gt('data', hoje).lte('data', next30)
  const porTipo = {}
  ;(fc30||[]).forEach(f => { porTipo[f.tipo] = (porTipo[f.tipo]||{n:0,soma:0}); porTipo[f.tipo].n++; porTipo[f.tipo].soma += Math.abs(Number(f.valor)||0) })

  // amostra dos tipos existentes na tabela toda
  const { data: amostraTipos } = await admin.from('fluxo_caixa').select('tipo').eq('empresa_id', FACE).limit(2000)
  const tiposUnicos = {}
  ;(amostraTipos||[]).forEach(f => tiposUnicos[f.tipo]=(tiposUnicos[f.tipo]||0)+1)

  return Response.json({ janela: `${hoje} .. ${next30}`, fc30_total: fc30?.length, fc30_por_tipo: porTipo, tipos_na_tabela: tiposUnicos })
}
