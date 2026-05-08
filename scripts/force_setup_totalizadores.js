import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://wbrjdehmauaincgtcjrk.supabase.co"
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndicmpkZWhtYXVhaW5jZ3RjanJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgxMDQ0NiwiZXhwIjoyMDkxMzg2NDQ2fQ.lya0lX7C_u0oevESCE9Baak186aP9kZIxLWxyLC8-T8"

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const categoriasTotalizadoras = [
  { codigo: '1.1', nome: 'RECEITA BRUTA', tipo: 'receita' },
  { codigo: '1.2', nome: 'IMPOSTOS SOBRE RECEITA', tipo: 'receita' },
  { codigo: '2.1', nome: 'CAC', tipo: 'custo' },
  { codigo: '2.2', nome: 'CSP', tipo: 'custo' },
  { codigo: '3.1', nome: 'DESPESAS DE DESENVOLVIMENTO', tipo: 'despesa' },
  { codigo: '3.2', nome: 'DESPESAS GERAIS E ADM', tipo: 'despesa' },
  { codigo: '3.3', nome: 'SALÁRIOS E ENCARGOS ADM', tipo: 'despesa' },
  { codigo: '3.4', nome: 'DESPESAS OPERACIONAIS (PDTI/S...)', tipo: 'despesa' },
  { codigo: '3.5', nome: 'DESPESAS DE MKT E COMERCIAIS', tipo: 'despesa' },
  { codigo: '3.6', nome: 'SALÁRIOS E ENCARGOS MOB', tipo: 'despesa' },
  { codigo: '4.1', nome: 'RECEITAS FINANCEIRAS', tipo: 'receita' },
  { codigo: '4.2', nome: 'DESPESAS FINANCEIRAS', tipo: 'despesa' },
]

async function setup() {
  try {
    const { data: empresas } = await supabase.from('empresas').select('id')
    if (!empresas || empresas.length === 0) {
      console.log('Nenhuma empresa encontrada.')
      return
    }
    
    const empresaId = empresas[0].id
    console.log(`Limpando e configurando para empresa: ${empresaId}`)

    // 1. Deletar mapeamentos antigos primeiro (devido a chaves estrangeiras)
    console.log('Deletando mapeamentos antigos...')
    await supabase.from('categoria_mappings').delete().eq('empresa_id', empresaId)

    // 2. Deletar plano de contas antigo
    console.log('Deletando plano de contas antigo...')
    await supabase.from('plano_contas').delete().eq('empresa_id', empresaId)

    // 3. Inserir novas categorias totalizadoras
    console.log('Inserindo novas categorias totalizadoras...')
    const { error } = await supabase
      .from('plano_contas')
      .insert(categoriasTotalizadoras.map(c => ({ ...c, empresa_id: empresaId })))
    
    if (error) throw error

    // 4. Verificar se os dados estão lá
    const { data: check } = await supabase.from('plano_contas').select('*').eq('empresa_id', empresaId)
    console.log(`Verificação: ${check.length} contas inseridas com sucesso.`)

    console.log('✅ Configuração concluída com sucesso!')
  } catch (err) {
    console.error('ERRO FATAL:', err.message)
  }
}

setup()
