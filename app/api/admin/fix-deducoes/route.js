import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
  )
}

// Categorias que são DEDUÇÕES da receita bruta (não receitas)
const DEDUCAO_CATEGORIAS = ['PIS', 'COFINS', 'ISS']
const DEDUCAO_CONTA_CODIGOS = ['1.2', '1.2.1', '1.2.2', '1.2.3']

export async function POST(request) {
  const admin = getAdmin()
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('apply') !== 'true'

  const report = { dryRun }

  // 1. Contas do plano que deveriam ser dedução (atualmente 'receita')
  const { data: contas } = await admin
    .from('plano_contas')
    .select('id, codigo, nome, tipo')
    .in('codigo', DEDUCAO_CONTA_CODIGOS)
  report.contas_encontradas = contas || []

  // 2. Mappings PIS/COFINS/ISS
  const { data: mappings } = await admin
    .from('categoria_mappings')
    .select('id, categoria_origem, tipo_destino, conta_id')
    .in('categoria_origem', DEDUCAO_CATEGORIAS)
  report.mappings_encontrados = mappings || []

  // 3. Lançamentos afetados — os que apontam para as contas de dedução
  const contaIds = (contas || []).map(c => c.id)
  let lancamentos = []
  if (contaIds.length) {
    const { data: lanc } = await admin
      .from('lancamentos')
      .select('id, descricao, tipo, valor, data')
      .in('conta_id', contaIds)
    lancamentos = lanc || []
  }
  report.lancamentos_afetados = lancamentos.length
  report.lancamentos_valor_total = lancamentos.reduce((a, l) => a + Number(l.valor), 0)
  report.lancamentos_amostra = lancamentos.slice(0, 5)

  if (dryRun) {
    report.message = 'DRY RUN — nada foi alterado. Use ?apply=true para aplicar.'
    return NextResponse.json(report)
  }

  // ─── APLICAR CORREÇÕES ───
  const applied = {}

  // 1. plano_contas → tipo 'deducao'
  const { error: e1 } = await admin
    .from('plano_contas').update({ tipo: 'deducao' }).in('codigo', DEDUCAO_CONTA_CODIGOS)
  applied.plano_contas = e1 ? `erro: ${e1.message}` : 'atualizado para deducao'

  // 2. categoria_mappings → tipo_destino 'deducao'
  const { error: e2 } = await admin
    .from('categoria_mappings').update({ tipo_destino: 'deducao' }).in('categoria_origem', DEDUCAO_CATEGORIAS)
  applied.categoria_mappings = e2 ? `erro: ${e2.message}` : 'atualizado para deducao'

  // 3. lancamentos já importados → tipo 'deducao'
  if (contaIds.length) {
    const { error: e3 } = await admin
      .from('lancamentos').update({ tipo: 'deducao' }).in('conta_id', contaIds)
    applied.lancamentos = e3 ? `erro: ${e3.message}` : `${lancamentos.length} lançamentos atualizados para deducao`
  }

  report.applied = applied
  report.message = 'CORREÇÃO APLICADA com sucesso.'
  return NextResponse.json(report)
}
