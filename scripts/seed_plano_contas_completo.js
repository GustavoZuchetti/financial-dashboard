// Script para popular o Plano de Contas com a estrutura completa e detalhada do DRE Gerencial
// Execute: node scripts/seed_plano_contas_completo.js

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const planoContasEstrutura = [
  // ===== RECEITA BRUTA =====
  { codigo: '1.1', nome: 'RECEITA BRUTA', tipo: 'receita', nivel: 0, categoria: 'RECEITA BRUTA' },
  { codigo: '1.1.1', nome: 'Receita de Serviços', tipo: 'receita', nivel: 1, pai: '1.1', categoria: 'Receita de Serviços' },
  { codigo: '1.1.2', nome: 'Receita de Produtos', tipo: 'receita', nivel: 1, pai: '1.1', categoria: 'Receita de Produtos' },

  // ===== IMPOSTOS SOBRE RECEITA =====
  { codigo: '1.2', nome: 'IMPOSTOS SOBRE RECEITA', tipo: 'receita', nivel: 0, categoria: 'IMPOSTOS SOBRE RECEITA' },
  { codigo: '1.2.1', nome: 'COFINS', tipo: 'receita', nivel: 1, pai: '1.2', categoria: 'COFINS' },
  { codigo: '1.2.2', nome: 'ISS', tipo: 'receita', nivel: 1, pai: '1.2', categoria: 'ISS' },
  { codigo: '1.2.3', nome: 'PIS', tipo: 'receita', nivel: 1, pai: '1.2', categoria: 'PIS' },

  // ===== RECEITA LÍQUIDA (calculada) =====
  { codigo: '1.3', nome: 'RECEITA LÍQUIDA', tipo: 'receita', nivel: 0, categoria: 'RECEITA LÍQUIDA', isCalculated: true },

  // ===== CUSTOS VARIÁVEIS =====
  { codigo: '2.1', nome: 'CUSTOS VARIÁVEIS', tipo: 'custo', nivel: 0, categoria: 'CUSTOS VARIÁVEIS' },
  
  // CAC - Custo de Aquisição de Clientes
  { codigo: '2.1.1', nome: 'CAC - Custo de Aquisição de Clientes', tipo: 'custo', nivel: 1, pai: '2.1', categoria: 'CAC' },
  { codigo: '2.1.1.1', nome: 'PABX', tipo: 'custo', nivel: 2, pai: '2.1.1', categoria: 'PABX' },

  // CSP - Custo dos Serviços Prestados
  { codigo: '2.1.2', nome: 'CSP - Custo dos Serviços Prestados', tipo: 'custo', nivel: 1, pai: '2.1', categoria: 'CSP' },
  { codigo: '2.1.2.1', nome: 'Facetec', tipo: 'custo', nivel: 2, pai: '2.1.2', categoria: 'Facetec' },
  { codigo: '2.1.2.2', nome: 'AWS', tipo: 'custo', nivel: 2, pai: '2.1.2', categoria: 'AWS' },
  { codigo: '2.1.2.3', nome: 'Serpro', tipo: 'custo', nivel: 2, pai: '2.1.2', categoria: 'Serpro' },
  { codigo: '2.1.2.4', nome: 'Hostinger', tipo: 'custo', nivel: 2, pai: '2.1.2', categoria: 'Hostinger' },
  { codigo: '2.1.2.5', nome: 'OpenAI', tipo: 'custo', nivel: 2, pai: '2.1.2', categoria: 'OpenAI' },

  // ===== LUCRO BRUTO (calculado) =====
  { codigo: '2.2', nome: 'LUCRO BRUTO', tipo: 'custo', nivel: 0, categoria: 'LUCRO BRUTO', isCalculated: true },

  // ===== DESPESAS FIXAS =====
  { codigo: '3.1', nome: 'DESPESAS FIXAS', tipo: 'despesa', nivel: 0, categoria: 'DESPESAS FIXAS' },

  // DESPESAS DE DESENVOLVIMENTO
  { codigo: '3.1.1', nome: 'DESPESAS DE DESENVOLVIMENTO', tipo: 'despesa', nivel: 1, pai: '3.1', categoria: 'DESPESAS DE DESENVOLVIMENTO' },
  { codigo: '3.1.1.1', nome: '_Projetos', tipo: 'despesa', nivel: 2, pai: '3.1.1', categoria: '_Projetos' },

  // DESPESAS GERAIS E ADM
  { codigo: '3.1.2', nome: 'DESPESAS GERAIS E ADM', tipo: 'despesa', nivel: 1, pai: '3.1', categoria: 'DESPESAS GERAIS E ADM' },
  { codigo: '3.1.2.1', nome: 'Aluguel', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Aluguel' },
  { codigo: '3.1.2.2', nome: 'Energia elétrica', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Energia elétrica' },
  { codigo: '3.1.2.3', nome: 'Internet', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Internet' },
  { codigo: '3.1.2.4', nome: 'Material de escritório', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Material de escritório' },
  { codigo: '3.1.2.5', nome: 'Material de uso e consumo', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Material de uso e consumo' },
  { codigo: '3.1.2.6', nome: 'Honorários advocatícios', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Honorários advocatícios' },
  { codigo: '3.1.2.7', nome: 'Serviços contábeis', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Serviços contábeis' },
  { codigo: '3.1.2.8', nome: 'Software Administrativo', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Software Administrativo' },
  { codigo: '3.1.2.9', nome: 'Telefone', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Telefone' },
  { codigo: '3.1.2.10', nome: 'Viagens Administrativo', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Viagens Administrativo' },
  { codigo: '3.1.2.11', nome: 'Conta de água', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Conta de água' },
  { codigo: '3.1.2.12', nome: 'Limpeza', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Limpeza' },
  { codigo: '3.1.2.13', nome: 'Impostos retidos - Nf Serviços Tomados', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Impostos retidos - Nf Serviços Tomados' },
  { codigo: '3.1.2.14', nome: 'Manutenção', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Manutenção' },
  { codigo: '3.1.2.15', nome: 'Monitoramento e Segurança', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Monitoramento e Segurança' },
  { codigo: '3.1.2.16', nome: 'Eventos', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Eventos' },
  { codigo: '3.1.2.17', nome: 'Serviços ADM', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Serviços ADM' },
  { codigo: '3.1.2.18', nome: 'Alimentação', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Alimentação' },
  { codigo: '3.1.2.19', nome: 'Seguros', tipo: 'despesa', nivel: 2, pai: '3.1.2', categoria: 'Seguros' },

  // SALÁRIOS E ENCARGOS ADM
  { codigo: '3.1.3', nome: 'SALÁRIOS E ENCARGOS ADM', tipo: 'despesa', nivel: 1, pai: '3.1', categoria: 'SALÁRIOS E ENCARGOS ADM' },
  { codigo: '3.1.3.1', nome: 'Pró-labore', tipo: 'despesa', nivel: 2, pai: '3.1.3', categoria: 'Pró-labore' },
  { codigo: '3.1.3.2', nome: 'Benefícios_Gestão', tipo: 'despesa', nivel: 2, pai: '3.1.3', categoria: 'Benefícios_Gestão' },
  { codigo: '3.1.3.3', nome: 'Salários_Gestão', tipo: 'despesa', nivel: 2, pai: '3.1.3', categoria: 'Salários_Gestão' },
  { codigo: '3.1.3.4', nome: 'Plano de saúde diretoria', tipo: 'despesa', nivel: 2, pai: '3.1.3', categoria: 'Plano de saúde diretoria' },
  { codigo: '3.1.3.5', nome: 'Encargos da folha_Gestão', tipo: 'despesa', nivel: 2, pai: '3.1.3', categoria: 'Encargos da folha_Gestão' },
  { codigo: '3.1.3.6', nome: 'Seguro de Vida', tipo: 'despesa', nivel: 2, pai: '3.1.3', categoria: 'Seguro de Vida' },

  // DESPESAS OPERACIONAIS
  { codigo: '3.1.4', nome: 'DESPESAS OPERACIONAIS (PDTI/S...)', tipo: 'despesa', nivel: 1, pai: '3.1', categoria: 'DESPESAS OPERACIONAIS' },
  { codigo: '3.1.4.1', nome: 'Locações de máquinas e equipamentos', tipo: 'despesa', nivel: 2, pai: '3.1.4', categoria: 'Locações de máquinas e equipamentos' },
  { codigo: '3.1.4.2', nome: 'Software operação', tipo: 'despesa', nivel: 2, pai: '3.1.4', categoria: 'Software operação' },

  // DESPESAS DE MKT E COMERCIAIS
  { codigo: '3.1.5', nome: 'DESPESAS DE MKT E COMERCIAIS', tipo: 'despesa', nivel: 1, pai: '3.1', categoria: 'DESPESAS DE MKT E COMERCIAIS' },
  { codigo: '3.1.5.1', nome: '_Mktg', tipo: 'despesa', nivel: 2, pai: '3.1.5', categoria: '_Mktg' },
  { codigo: '3.1.5.2', nome: 'Alimentação - Comercial', tipo: 'despesa', nivel: 2, pai: '3.1.5', categoria: 'Alimentação - Comercial' },
  { codigo: '3.1.5.3', nome: 'Combustíveis e lubrificantes - Comercial', tipo: 'despesa', nivel: 2, pai: '3.1.5', categoria: 'Combustíveis e lubrificantes - Comercial' },
  { codigo: '3.1.5.4', nome: 'Fretes e Viagens - Comercial', tipo: 'despesa', nivel: 2, pai: '3.1.5', categoria: 'Fretes e Viagens - Comercial' },
  { codigo: '3.1.5.5', nome: 'Propaganda e publicidade - Comercial', tipo: 'despesa', nivel: 2, pai: '3.1.5', categoria: 'Propaganda e publicidade - Comercial' },
  { codigo: '3.1.5.6', nome: 'Salários - Comercial', tipo: 'despesa', nivel: 2, pai: '3.1.5', categoria: 'Salários - Comercial' },
  { codigo: '3.1.5.7', nome: 'Software - Comercial', tipo: 'despesa', nivel: 2, pai: '3.1.5', categoria: 'Software - Comercial' },

  // SALÁRIOS E ENCARGOS MOB
  { codigo: '3.1.6', nome: 'SALÁRIOS E ENCARGOS MOB', tipo: 'despesa', nivel: 1, pai: '3.1', categoria: 'SALÁRIOS E ENCARGOS MOB' },
  { codigo: '3.1.6.1', nome: 'Plano de saúde Operadores', tipo: 'despesa', nivel: 2, pai: '3.1.6', categoria: 'Plano de saúde Operadores' },
  { codigo: '3.1.6.2', nome: 'Salários Operadores', tipo: 'despesa', nivel: 2, pai: '3.1.6', categoria: 'Salários Operadores' },
  { codigo: '3.1.6.3', nome: 'Encargos da folha Operadores', tipo: 'despesa', nivel: 2, pai: '3.1.6', categoria: 'Encargos da folha Operadores' },
  { codigo: '3.1.6.4', nome: 'Despesas Processos Trabalhistas', tipo: 'despesa', nivel: 2, pai: '3.1.6', categoria: 'Despesas Processos Trabalhistas' },

  // ===== EBITDA (calculado) =====
  { codigo: '3.2', nome: 'EBITDA', tipo: 'despesa', nivel: 0, categoria: 'EBITDA', isCalculated: true },

  // ===== RECEITAS FINANCEIRAS =====
  { codigo: '4.1', nome: 'RECEITAS FINANCEIRAS', tipo: 'receita', nivel: 0, categoria: 'RECEITAS FINANCEIRAS' },
  { codigo: '4.1.1', nome: 'Juros recebidos', tipo: 'receita', nivel: 1, pai: '4.1', categoria: 'Juros recebidos' },

  // ===== DESPESAS FINANCEIRAS =====
  { codigo: '4.2', nome: 'DESPESAS FINANCEIRAS', tipo: 'despesa', nivel: 0, categoria: 'DESPESAS FINANCEIRAS' },
  { codigo: '4.2.1', nome: 'Juros pagos', tipo: 'despesa', nivel: 1, pai: '4.2', categoria: 'Juros pagos' },
  { codigo: '4.2.2', nome: 'Juros_Antecipação', tipo: 'despesa', nivel: 1, pai: '4.2', categoria: 'Juros_Antecipação' },
  { codigo: '4.2.3', nome: 'Tarifa bancária', tipo: 'despesa', nivel: 1, pai: '4.2', categoria: 'Tarifa bancária' },
  { codigo: '4.2.4', nome: 'Taxas pagas', tipo: 'despesa', nivel: 1, pai: '4.2', categoria: 'Taxas pagas' },

  // ===== RESULTADO LÍQUIDO (calculado) =====
  { codigo: '5.1', nome: 'RESULTADO LÍQUIDO', tipo: 'receita', nivel: 0, categoria: 'RESULTADO LÍQUIDO', isCalculated: true },

  // ===== INVESTIMENTOS =====
  { codigo: '6.1', nome: 'INVESTIMENTOS', tipo: 'custo', nivel: 0, categoria: 'INVESTIMENTOS' },
  { codigo: '6.1.1', nome: 'CAPEX', tipo: 'custo', nivel: 1, pai: '6.1', categoria: 'CAPEX' },
  { codigo: '6.1.2', nome: 'Intangível', tipo: 'custo', nivel: 1, pai: '6.1', categoria: 'Intangível' },
  { codigo: '6.1.3', nome: 'Computadores e Periféricos', tipo: 'custo', nivel: 1, pai: '6.1', categoria: 'Computadores e Periféricos' },

  // ===== RESULTADO FINAL (calculado) =====
  { codigo: '6.2', nome: 'RESULTADO FINAL', tipo: 'custo', nivel: 0, categoria: 'RESULTADO FINAL', isCalculated: true },
]

async function seedPlanoContas() {
  try {
    console.log('Iniciando seed do Plano de Contas Completo...')

    // Obter todas as empresas
    const { data: empresas, error: empresasError } = await supabase
      .from('empresas')
      .select('id')

    if (empresasError) throw empresasError

    if (!empresas || empresas.length === 0) {
      console.log('Nenhuma empresa encontrada. Crie uma empresa primeiro.')
      return
    }

    // Para cada empresa, inserir o plano de contas
    for (const empresa of empresas) {
      console.log(`\nInserindo Plano de Contas para empresa: ${empresa.id}`)

      // Primeiro, inserir contas principais (nivel 0)
      const contasExistentes = {}
      for (const conta of planoContasEstrutura.filter(c => c.nivel === 0)) {
        const { data, error } = await supabase
          .from('plano_contas')
          .insert({
            empresa_id: empresa.id,
            codigo: conta.codigo,
            nome: conta.nome,
            tipo: conta.tipo,
            categoria: conta.categoria,
            pai_id: null
          })
          .select()

        if (error) {
          console.log(`  Conta ${conta.codigo} já existe ou erro: ${error.message}`)
        } else {
          contasExistentes[conta.codigo] = data[0].id
          console.log(`  ✓ Conta ${conta.codigo} inserida`)
        }
      }

      // Depois, inserir contas filhas (nivel 1 e 2)
      for (const conta of planoContasEstrutura.filter(c => c.nivel > 0)) {
        const paiId = contasExistentes[conta.pai]
        if (paiId) {
          const { data, error } = await supabase
            .from('plano_contas')
            .insert({
              empresa_id: empresa.id,
              codigo: conta.codigo,
              nome: conta.nome,
              tipo: conta.tipo,
              categoria: conta.categoria,
              pai_id: paiId
            })
            .select()

          if (error) {
            console.log(`  Conta ${conta.codigo} já existe ou erro: ${error.message}`)
          } else {
            contasExistentes[conta.codigo] = data[0].id
            console.log(`  ✓ Conta ${conta.codigo} inserida`)
          }
        }
      }
    }

    console.log('\n✅ Seed do Plano de Contas Completo concluído!')
  } catch (error) {
    console.error('❌ Erro ao fazer seed:', error)
  }
}

seedPlanoContas()
