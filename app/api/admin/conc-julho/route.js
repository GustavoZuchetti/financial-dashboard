import { getAdmin } from '@/lib/bling-server'
import { efeitosCaixa } from '@/lib/fluxo-status'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== 'c8b1fd1be3168f226e4bb58b')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  let all = [], pg = 0
  while (pg < 20) {
    const { data } = await admin.from('fluxo_caixa')
      .select('descricao,categoria,tipo,valor,valor_liquidado,status,data,data_liquidacao')
      .eq('empresa_id', FACE).range(pg*1000, (pg+1)*1000-1)
    if (!data?.length) break
    all = all.concat(data); if (data.length < 1000) break; pg++
  }
  const INI = '2026-07-01', FIM = '2026-07-31'
  const itens = []
  for (const r of all) {
    for (const e of efeitosCaixa(r, '2026-07-30')) {
      if (e.data >= INI && e.data <= FIM) {
        itens.push({ data: e.data, valor: +e.valor.toFixed(2),
                     tipo: r.tipo === 'entrada' ? 'entrada' : 'saida',
                     desc: (r.descricao||'').slice(0,40), cat: (r.categoria||'').slice(0,30),
                     status: r.status, aprox: !!e.aproximado })
      }
    }
  }
  const ent = itens.filter(i=>i.tipo==='entrada').reduce((a,c)=>a+c.valor,0)
  const sai = itens.filter(i=>i.tipo==='saida').reduce((a,c)=>a+c.valor,0)
  const porDia = {}
  itens.forEach(i => { const d = porDia[i.data] || (porDia[i.data]={entrada:0,saida:0,n:0}); d[i.tipo]+=i.valor; d.n++ })
  Object.values(porDia).forEach(d => { d.entrada=+d.entrada.toFixed(2); d.saida=+d.saida.toFixed(2) })
  return Response.json({ total_itens: itens.length, entradas:+ent.toFixed(2), saidas:+sai.toFixed(2),
    diferenca:+(ent-sai).toFixed(2), por_dia: porDia, itens })
}
