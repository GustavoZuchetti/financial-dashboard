// Script para pré-configurar os mapeamentos de categorias (De-Para)
// Execute: node scripts/seed_categoria_mappings.js

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const mappingsConfig = [
  // RECEITAS
  { categoria_origem: 'Receita de Serviços', tipo_destino: 'receita', conta_codigo: '1.1.1' },
  { categoria_origem: 'Receita de Produtos', tipo_destino: 'receita', conta_codigo: '1.1.2' },
  { categoria_origem: 'Juros recebidos', tipo_destino: 'receita', conta_codigo: '4.1.1' },

  // IMPOSTOS SOBRE RECEITA
  { categoria_origem: 'COFINS', tipo_destino: 'deducao', conta_codigo: '1.2.1' },
  { categoria_origem: 'ISS', tipo_destino: 'deducao', conta_codigo: '1.2.2' },
  { categoria_origem: 'PIS', tipo_destino: 'deducao', conta_codigo: '1.2.3' },

  // CAC
  { categoria_origem: 'PABX', tipo_destino: 'custo', conta_codigo: '2.1.1.1' },

  // CSP
  { categoria_origem: 'Facetec', tipo_destino: 'custo', conta_codigo: '2.1.2.1' },
  { categoria_origem: 'AWS', tipo_destino: 'custo', conta_codigo: '2.1.2.2' },
  { categoria_origem: 'Serpro', tipo_destino: 'custo', conta_codigo: '2.1.2.3' },
  { categoria_origem: 'Hostinger', tipo_destino: 'custo', conta_codigo: '2.1.2.4' },
  { categoria_origem: 'OpenAI', tipo_destino: 'custo', conta_codigo: '2.1.2.5' },

  // DESPESAS DE DESENVOLVIMENTO
  { categoria_origem: '_Projetos', tipo_destino: 'despesa', conta_codigo: '3.1.1.1' },

  // DESPESAS GERAIS E ADM
  { categoria_origem: 'Aluguel', tipo_destino: 'despesa', conta_codigo: '3.1.2.1' },
  { categoria_origem: 'Energia elétrica', tipo_destino: 'despesa', conta_codigo: '3.1.2.2' },
  { categoria_origem: 'Internet', tipo_destino: 'despesa', conta_codigo: '3.1.2.3' },
  { categoria_origem: 'Material de escritório', tipo_destino: 'despesa', conta_codigo: '3.1.2.4' },
  { categoria_origem: 'Material de uso e consumo', tipo_destino: 'despesa', conta_codigo: '3.1.2.5' },
  { categoria_origem: 'Honorários advocatícios', tipo_destino: 'despesa', conta_codigo: '3.1.2.6' },
  { categoria_origem: 'Serviços contábeis', tipo_destino: 'despesa', conta_codigo: '3.1.2.7' },
  { categoria_origem: 'Software Administrativo', tipo_destino: 'despesa', conta_codigo: '3.1.2.8' },
  { categoria_origem: 'Telefone', tipo_destino: 'despesa', conta_codigo: '3.1.2.9' },
  { categoria_origem: 'Viagens Administrativo', tipo_destino: 'despesa', conta_codigo: '3.1.2.10' },
  { categoria_origem: 'Conta de água', tipo_destino: 'despesa', conta_codigo: '3.1.2.11' },
  { categoria_origem: 'Limpeza', tipo_destino: 'despesa', conta_codigo: '3.1.2.12' },
  { categoria_origem: 'Impostos retidos - Nf Serviços Tomados', tipo_destino: 'despesa', conta_codigo: '3.1.2.13' },
  { categoria_origem: 'Manutenção', tipo_destino: 'despesa', conta_codigo: '3.1.2.14' },
  { categoria_origem: 'Monitoramento e Segurança', tipo_destino: 'despesa', conta_codigo: '3.1.2.15' },
  { categoria_origem: 'Eventos', tipo_destino: 'despesa', conta_codigo: '3.1.2.16' },
  { categoria_origem: 'Serviços ADM', tipo_destino: 'despesa', conta_codigo: '3.1.2.17' },
  { categoria_origem: 'Alimentação', tipo_destino: 'despesa', conta_codigo: '3.1.2.18' },
  { categoria_origem: 'Seguros', tipo_destino: 'despesa', conta_codigo: '3.1.2.19' },

  // SALÁRIOS E ENCARGOS ADM
  { categoria_origem: 'Pró-labore', tipo_destino: 'despesa', conta_codigo: '3.1.3.1' },
  { categoria_origem: 'Benefícios_Gestão', tipo_destino: 'despesa', conta_codigo: '3.1.3.2' },
  { categoria_origem: 'Salários_Gestão', tipo_destino: 'despesa', conta_codigo: '3.1.3.3' },
  { categoria_origem: 'Plano de saúde diretoria', tipo_destino: 'despesa', conta_codigo: '3.1.3.4' },
  { categoria_origem: 'Encargos da folha_Gestão', tipo_destino: 'despesa', conta_codigo: '3.1.3.5' },
  { categoria_origem: 'Seguro de Vida', tipo_destino: 'despesa', conta_codigo: '3.1.3.6' },

  // DESPESAS OPERACIONAIS
  { categoria_origem: 'Locações de máquinas e equipamentos', tipo_destino: 'despesa', conta_codigo: '3.1.4.1' },
  { categoria_origem: 'Software operação', tipo_destino: 'despesa', conta_codigo: '3.1.4.2' },

  // DESPESAS DE MKT E COMERCIAIS
  { categoria_origem: '_Mktg', tipo_destino: 'despesa', conta_codigo: '3.1.5.1' },
  { categoria_origem: 'Alimentação - Comercial', tipo_destino: 'despesa', conta_codigo: '3.1.5.2' },
  { categoria_origem: 'Combustíveis e lubrificantes - Comercial', tipo_destino: 'despesa', conta_codigo: '3.1.5.3' },
  { categoria_origem: 'Fretes e Viagens - Comercial', tipo_destino: 'despesa', conta_codigo: '3.1.5.4' },
  { categoria_origem: 'Propaganda e publicidade - Comercial', tipo_destino: 'despesa', conta_codigo: '3.1.5.5' },
  { categoria_origem: 'Salários - Comercial', tipo_destino: 'despesa', conta_codigo: '3.1.5.6' },
  { categoria_origem: 'Software - Comercial', tipo_destino: 'despesa', conta_codigo: '3.1.5.7' },

  // SALÁRIOS E ENCARGOS MOB
  { categoria_origem: 'Plano de saúde Operadores', tipo_destino: 'despesa', conta_codigo: '3.1.6.1' },
  { categoria_origem: 'Salários Operadores', tipo_destino: 'despesa', conta_codigo: '3.1.6.2' },
  { categoria_origem: 'Encargos da folha Operadores', tipo_destino: 'despesa', conta_codigo: '3.1.6.3' },
  { categoria_origem: 'Despesas Processos Trabalhistas', tipo_destino: 'despesa', conta_codigo: '3.1.6.4' },

  // DESPESAS FINANCEIRAS
  { categoria_origem: 'Juros pagos', tipo_destino: 'despesa', conta_codigo: '4.2.1' },
  { categoria_origem: 'Juros_Antecipação', tipo_destino: 'despesa', conta_codigo: '4.2.2' },
  { categoria_origem: 'Tarifa bancária', tipo_destino: 'despesa', conta_codigo: '4.2.3' },
  { categoria_origem: 'Taxas pagas', tipo_destino: 'despesa', conta_codigo: '4.2.4' },

  // INVESTIMENTOS
  { categoria_origem: 'CAPEX', tipo_destino: 'custo', conta_codigo: '6.1.1' },
  { categoria_origem: 'Intangível', tipo_destino: 'custo', conta_codigo: '6.1.2' },
  { categoria_origem: 'Computadores e Periféricos', tipo_destino: 'custo', conta_codigo: '6.1.3' },
]

async function seedMappings() {
  try {
    console.log('Iniciando seed dos Mapeamentos de Categorias...')

    // Obter todas as empresas
    const { data: empresas, error: empresasError } = await supabase
      .from('empresas')
      .select('id')

    if (empresasError) throw empresasError

    if (!empresas || empresas.length === 0) {
      console.log('Nenhuma empresa encontrada. Crie uma empresa primeiro.')
      return
    }

    // Para cada empresa
    for (const empresa of empresas) {
      console.log(`\nInserindo Mapeamentos para empresa: ${empresa.id}`)

      // Para cada mapeamento
      for (const mapping of mappingsConfig) {
        // Buscar a conta pelo código
        const { data: contas, error: contaError } = await supabase
          .from('plano_contas')
          .select('id')
          .eq('empresa_id', empresa.id)
          .eq('codigo', mapping.conta_codigo)
          .limit(1)

        if (contaError || !contas || contas.length === 0) {
          console.log(`  ⚠️  Conta ${mapping.conta_codigo} não encontrada para ${mapping.categoria_origem}`)
          continue
        }

        const contaId = contas[0].id

        // Inserir o mapeamento
        const { error: mapError } = await supabase
          .from('categoria_mappings')
          .insert({
            empresa_id: empresa.id,
            categoria_origem: mapping.categoria_origem,
            conta_id: contaId,
            tipo_destino: mapping.tipo_destino,
            ativo: true
          })

        if (mapError) {
          console.log(`  Mapeamento ${mapping.categoria_origem} já existe ou erro: ${mapError.message}`)
        } else {
          console.log(`  ✓ Mapeamento ${mapping.categoria_origem} → ${mapping.conta_codigo}`)
        }
      }
    }

    console.log('\n✅ Seed dos Mapeamentos concluído!')
  } catch (error) {
    console.error('❌ Erro ao fazer seed:', error)
  }
}

seedMappings()
