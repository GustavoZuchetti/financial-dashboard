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

async function run() {
  try {
    console.log('--- INICIANDO LIMPEZA PROFUNDA ---')
    
    // 1. Deletar TUDO de categoria_mappings
    console.log('Deletando todos os mapeamentos...')
    const { error: err1 } = await supabase.from('categoria_mappings').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (err1) console.log('Erro ao deletar mapeamentos:', err1.message)

    // 2. Deletar TUDO de plano_contas
    console.log('Deletando todo o plano de contas...')
    const { error: err2 } = await supabase.from('plano_contas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (err2) console.log('Erro ao deletar plano de contas:', err2.message)

    // 3. Buscar todas as empresas
    const { data: empresas } = await supabase.from('empresas').select('*')
    console.log(`Empresas encontradas: ${empresas.length}`)

    // 4. Inserir novas categorias para cada empresa
    for (const empresa of empresas) {
      console.log(`Configurando empresa: ${empresa.nome} (${empresa.id})`)
      const { error: err3 } = await supabase
        .from('plano_contas')
        .insert(categoriasTotalizadoras.map(c => ({ ...c, empresa_id: empresa.id })))
      
      if (err3) console.log(`Erro ao inserir para ${empresa.nome}:`, err3.message)
      else console.log(`✓ 12 categorias inseridas para ${empresa.nome}`)
    }

    // 5. Verificação Final
    const { data: finalCheck } = await supabase.from('plano_contas').select('nome, empresa_id')
    console.log('\n--- VERIFICAÇÃO FINAL DO BANCO ---')
    console.log(`Total de contas no banco: ${finalCheck.length}`)
    finalCheck.forEach(c => console.log(`- ${c.nome}`))

    console.log('\n✅ BANCO DE DADOS LIMPO E RECONFIGURADO!')
  } catch (err) {
    console.error('ERRO:', err)
  }
}

run()
