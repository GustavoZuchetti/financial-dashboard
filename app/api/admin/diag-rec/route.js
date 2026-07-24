import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '0fc718c5f83f5128474c865f')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const { data: emps } = await admin.from('empresas').select('id').eq('organization_id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  const ids = (emps||[]).map(e=>e.id)
  const hoje = new Date().toISOString().split('T')[0]
  const fimMes = new Date(2026, 7, 0).toISOString().split('T')[0] // 31/07/2026
  let all = [], pg = 0
  while (pg < 20) {
    const { data } = await admin.from('lancamentos').select('tipo,valor,data')
      .in('empresa_id', ids).gte('data','2026-01-01').lte('data', fimMes).range(pg*1000,(pg+1)*1000-1)
    if (!data || !data.length) break
    all = all.concat(data); if (data.length < 1000) break; pg++
  }
  const soma = (ate) => all.filter(l => l.tipo==='receita' && l.data <= ate).reduce((a,c)=>a+Number(c.valor),0)
  const futuros = all.filter(l => l.tipo==='receita' && l.data > hoje)
  const { count: totalPeriodo } = await admin.from('lancamentos').select('id',{count:'exact',head:true}).in('empresa_id', ids).gte('data','2026-01-01').lte('data', fimMes)
  return Response.json({
    LINHAS_NO_PERIODO: totalPeriodo, passa_de_1000: totalPeriodo > 1000,
    hoje, fim_mes_julho: fimMes,
    receita_ate_hoje_DRE: +soma(hoje).toFixed(2),
    receita_ate_fim_mes_ORCAMENTO: +soma(fimMes).toFixed(2),
    diferenca: +(soma(fimMes)-soma(hoje)).toFixed(2),
    lancamentos_futuros: futuros.length,
    amostra_futuros: futuros.slice(0,5).map(f=>({data:f.data, valor:f.valor})),
  })
}
