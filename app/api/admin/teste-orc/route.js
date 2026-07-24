import { getAdmin } from '@/lib/bling-server'
export const dynamic = 'force-dynamic'
const ORG = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const FACE = '2cb67427-fa9f-4f64-a77f-543dca1a1ab7'
export async function GET(request) {
  if (new URL(request.url).searchParams.get('key') !== '4bcf5ef597fb518eb4c80f9f')
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdmin()
  const t = {}
  // 1. consolidado válido
  const c1 = await admin.from('orcamentos').insert({ organization_id: ORG, empresa_id: null, escopo:'consolidado', ano:2099, mes:1, categoria:'TESTE', tipo:'receita', modulo:'dre', valor_orcado:1000 })
  t.consolidado_valido = c1.error ? 'FALHOU: '+c1.error.message : 'OK'
  // 2. duplicata consolidada (deve ser rejeitada pelo índice parcial)
  const c2 = await admin.from('orcamentos').insert({ organization_id: ORG, empresa_id: null, escopo:'consolidado', ano:2099, mes:1, categoria:'TESTE', tipo:'receita', modulo:'dre', valor_orcado:2000 })
  t.duplicata_bloqueada = c2.error ? 'OK (rejeitada)' : 'FALHOU: aceitou duplicata'
  // 3. entidade válida com MESMA chave (deve coexistir — escopos independentes)
  const c3 = await admin.from('orcamentos').insert({ empresa_id: FACE, organization_id: null, escopo:'entidade', ano:2099, mes:1, categoria:'TESTE', tipo:'receita', modulo:'dre', valor_orcado:500 })
  t.entidade_coexiste = c3.error ? 'FALHOU: '+c3.error.message : 'OK'
  // 4. inválido: consolidado sem organization_id (CHECK deve barrar)
  const c4 = await admin.from('orcamentos').insert({ empresa_id: null, organization_id: null, escopo:'consolidado', ano:2099, mes:2, categoria:'X', tipo:'receita', modulo:'dre', valor_orcado:1 })
  t.invalido_bloqueado = c4.error ? 'OK (rejeitado)' : 'FALHOU: aceitou inválido'
  // limpeza
  await admin.from('orcamentos').delete().eq('ano', 2099)
  const { count } = await admin.from('orcamentos').select('id',{count:'exact',head:true}).eq('ano',2099)
  t.limpeza = count === 0 ? 'OK' : `sobraram ${count}`
  return Response.json(t)
}
