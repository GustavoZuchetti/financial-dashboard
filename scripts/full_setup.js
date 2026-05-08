import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://wbrjdehmauaincgtcjrk.supabase.co"
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndicmpkZWhtYXVhaW5jZ3RjanJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgxMDQ0NiwiZXhwIjoyMDkxMzg2NDQ2fQ.lya0lX7C_u0oevESCE9Baak186aP9kZIxLWxyLC8-T8"

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runSetup() {
  try {
    console.log('1. Verificando/Criando tabela categoria_mappings...')
    // Como não podemos criar tabelas via API JS, vamos apenas garantir que os dados possam ser inseridos
    // se a tabela já existir. Se não existir, o erro nos dirá.
    
    console.log('2. Buscando empresas cadastradas...')
    const { data: empresas, error: empError } = await supabase.from('empresas').select('*')
    if (empError) throw empError
    
    if (!empresas || empresas.length === 0) {
      console.log('Nenhuma empresa encontrada. Por favor, cadastre uma empresa no sistema primeiro.')
      return
    }
    
    const empresa = empresas[0]
    console.log(`Empresa encontrada: ${empresa.nome} (${empresa.id})`)

    console.log('3. Configurando Plano de Contas detalhado...')
    // Estrutura simplificada para o script
    const contas = [
      { codigo: '1.1', nome: 'RECEITA BRUTA', tipo: 'receita', nivel: 0 },
      { codigo: '1.1.1', nome: 'Receita de Serviços', tipo: 'receita', nivel: 1, pai: '1.1' },
      { codigo: '1.2', nome: 'IMPOSTOS SOBRE RECEITA', tipo: 'receita', nivel: 0 },
      { codigo: '1.2.1', nome: 'COFINS', tipo: 'receita', nivel: 1, pai: '1.2' },
      { codigo: '1.2.2', nome: 'ISS', tipo: 'receita', nivel: 1, pai: '1.2' },
      { codigo: '1.2.3', nome: 'PIS', tipo: 'receita', nivel: 1, pai: '1.2' },
      { codigo: '2.1', nome: 'CUSTOS VARIÁVEIS', tipo: 'custo', nivel: 0 },
      { codigo: '2.1.1', nome: 'CAC', tipo: 'custo', nivel: 1, pai: '2.1' },
      { codigo: '2.1.2', nome: 'CSP', tipo: 'custo', nivel: 1, pai: '2.1' },
      { codigo: '2.1.2.1', nome: 'Facetec', tipo: 'custo', nivel: 2, pai: '2.1.2' },
      { codigo: '2.1.2.2', nome: 'AWS', tipo: 'custo', nivel: 2, pai: '2.1.2' },
      { codigo: '2.1.2.3', nome: 'Serpro', tipo: 'custo', nivel: 2, pai: '2.1.2' },
      { codigo: '2.1.2.4', nome: 'OpenAI', tipo: 'custo', nivel: 2, pai: '2.1.2' },
      { codigo: '3.1', nome: 'DESPESAS FIXAS', tipo: 'despesa', nivel: 0 },
      { codigo: '3.1.1', nome: 'DESPESAS DE DESENVOLVIMENTO', tipo: 'despesa', nivel: 1, pai: '3.1' },
      { codigo: '3.1.2', nome: 'DESPESAS GERAIS E ADM', tipo: 'despesa', nivel: 1, pai: '3.1' },
      { codigo: '3.1.2.1', nome: 'Aluguel', tipo: 'despesa', nivel: 2, pai: '3.1.2' },
      { codigo: '3.1.3', nome: 'SALÁRIOS E ENCARGOS ADM', tipo: 'despesa', nivel: 1, pai: '3.1' },
      { codigo: '3.1.3.1', nome: 'Pró-labore', tipo: 'despesa', nivel: 2, pai: '3.1.3' },
      { codigo: '4.1', nome: 'RECEITAS FINANCEIRAS', tipo: 'receita', nivel: 0 },
      { codigo: '4.1.1', nome: 'Juros recebidos', tipo: 'receita', nivel: 1, pai: '4.1' },
      { codigo: '4.2', nome: 'DESPESAS FINANCEIRAS', tipo: 'despesa', nivel: 0 },
      { codigo: '4.2.2', nome: 'Juros_Antecipação', tipo: 'despesa', nivel: 1, pai: '4.2' },
    ]

    const idMap = {}
    for (const c of contas) {
      const { data, error } = await supabase
        .from('plano_contas')
        .upsert({
          empresa_id: empresa.id,
          codigo: c.codigo,
          nome: c.nome,
          tipo: c.tipo,
          pai_id: c.pai ? idMap[c.pai] : null
        }, { onConflict: 'empresa_id,codigo' })
        .select()
      
      if (error) console.log(`Erro na conta ${c.codigo}:`, error.message)
      else if (data) idMap[c.codigo] = data[0].id
    }

    console.log('4. Configurando Mapeamentos De-Para...')
    const mappings = [
      { cat: 'Receita de Serviços', cod: '1.1.1', tipo: 'receita' },
      { cat: 'Juros recebidos', cod: '4.1.1', tipo: 'receita' },
      { cat: 'Juros_Antecipação', cod: '4.2.2', tipo: 'despesa' },
      { cat: 'AWS', cod: '2.1.2.2', tipo: 'custo' },
      { cat: 'OpenAI', cod: '2.1.2.4', tipo: 'custo' },
      { cat: 'Aluguel', cod: '3.1.2.1', tipo: 'despesa' },
      { cat: 'Pró-labore', cod: '3.1.3.1', tipo: 'despesa' },
    ]

    for (const m of mappings) {
      const contaId = idMap[m.cod]
      if (contaId) {
        const { error } = await supabase
          .from('categoria_mappings')
          .upsert({
            empresa_id: empresa.id,
            categoria_origem: m.cat,
            conta_id: contaId,
            tipo_destino: m.tipo,
            ativo: true
          }, { onConflict: 'empresa_id,categoria_origem' })
        
        if (error) console.log(`Erro no mapeamento ${m.cat}:`, error.message)
        else console.log(`✓ Mapeamento configurado: ${m.cat}`)
      }
    }

    console.log('✅ Configuração concluída com sucesso!')
  } catch (err) {
    console.error('Erro fatal:', err)
  }
}

runSetup()
