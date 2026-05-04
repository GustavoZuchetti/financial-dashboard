// Script para popular o Plano de Contas com a estrutura padrão do DRE Gerencial
// Execute: node scripts/seed_plano_contas.js

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const planoContasEstrutura = [
  // RECEITA BRUTA
  { codigo: '1.1', nome: 'RECEITA BRUTA', tipo: 'receita', nivel: 0 },
  { codigo: '1.1.1', nome: 'Receita de Serviços', tipo: 'receita', nivel: 1, pai: '1.1' },
  { codigo: '1.1.2', nome: 'Receita de Produtos', tipo: 'receita', nivel: 1, pai: '1.1' },
  { codigo: '1.1.3', nome: 'Outras Receitas', tipo: 'receita', nivel: 1, pai: '1.1' },

  // IMPOSTOS SOBRE RECEITA
  { codigo: '1.2', nome: 'IMPOSTOS SOBRE RECEITA', tipo: 'receita', nivel: 0 },
  { codigo: '1.2.1', nome: 'ICMS', tipo: 'receita', nivel: 1, pai: '1.2' },
  { codigo: '1.2.2', nome: 'ISS', tipo: 'receita', nivel: 1, pai: '1.2' },
  { codigo: '1.2.3', nome: 'PIS/COFINS', tipo: 'receita', nivel: 1, pai: '1.2' },

  // RECEITA LÍQUIDA (calculada)
  { codigo: '1.3', nome: 'RECEITA LÍQUIDA', tipo: 'receita', nivel: 0 },

  // CUSTOS VARIÁVEIS
  { codigo: '2.1', nome: 'CUSTOS VARIÁVEIS', tipo: 'custo', nivel: 0 },
  { codigo: '2.1.1', nome: 'CAC - Custo de Aquisição de Clientes', tipo: 'custo', nivel: 1, pai: '2.1' },
  { codigo: '2.1.1.1', nome: 'Publicidade e Propaganda', tipo: 'custo', nivel: 2, pai: '2.1.1' },
  { codigo: '2.1.1.2', nome: 'Comissões de Vendas', tipo: 'custo', nivel: 2, pai: '2.1.1' },
  { codigo: '2.1.2', nome: 'CSP - Custo dos Serviços Prestados', tipo: 'custo', nivel: 1, pai: '2.1' },
  { codigo: '2.1.2.1', nome: 'Matéria Prima', tipo: 'custo', nivel: 2, pai: '2.1.2' },
  { codigo: '2.1.2.2', nome: 'Mão de Obra Direta', tipo: 'custo', nivel: 2, pai: '2.1.2' },
  { codigo: '2.1.2.3', nome: 'Terceirizações', tipo: 'custo', nivel: 2, pai: '2.1.2' },

  // LUCRO BRUTO (calculado)
  { codigo: '2.2', nome: 'LUCRO BRUTO', tipo: 'custo', nivel: 0 },

  // DESPESAS FIXAS
  { codigo: '3.1', nome: 'DESPESAS FIXAS', tipo: 'despesa', nivel: 0 },
  { codigo: '3.1.1', nome: 'DESPESAS DE DESENVOLVIMENTO', tipo: 'despesa', nivel: 1, pai: '3.1' },
  { codigo: '3.1.1.1', nome: 'Salários Desenvolvimento', tipo: 'despesa', nivel: 2, pai: '3.1.1' },
  { codigo: '3.1.1.2', nome: 'Ferramentas e Softwares Dev', tipo: 'despesa', nivel: 2, pai: '3.1.1' },

  { codigo: '3.1.2', nome: 'DESPESAS GERAIS E ADM', tipo: 'despesa', nivel: 1, pai: '3.1' },
  { codigo: '3.1.2.1', nome: 'Aluguel', tipo: 'despesa', nivel: 2, pai: '3.1.2' },
  { codigo: '3.1.2.2', nome: 'Condomínio', tipo: 'despesa', nivel: 2, pai: '3.1.2' },
  { codigo: '3.1.2.3', nome: 'Limpeza e Manutenção', tipo: 'despesa', nivel: 2, pai: '3.1.2' },
  { codigo: '3.1.2.4', nome: 'Suprimentos', tipo: 'despesa', nivel: 2, pai: '3.1.2' },

  { codigo: '3.1.3', nome: 'SALÁRIOS E ENCARGOS ADM', tipo: 'despesa', nivel: 1, pai: '3.1' },
  { codigo: '3.1.3.1', nome: 'Salários ADM', tipo: 'despesa', nivel: 2, pai: '3.1.3' },
  { codigo: '3.1.3.2', nome: 'FGTS e Encargos', tipo: 'despesa', nivel: 2, pai: '3.1.3' },
  { codigo: '3.1.3.3', nome: 'Vale Refeição', tipo: 'despesa', nivel: 2, pai: '3.1.3' },

  { codigo: '3.1.4', nome: 'DESPESAS OPERACIONAIS (PDTI/S...)', tipo: 'despesa', nivel: 1, pai: '3.1' },
  { codigo: '3.1.4.1', nome: 'Telefone e Internet', tipo: 'despesa', nivel: 2, pai: '3.1.4' },
  { codigo: '3.1.4.2', nome: 'Energia Elétrica', tipo: 'despesa', nivel: 2, pai: '3.1.4' },
  { codigo: '3.1.4.3', nome: 'Água e Esgoto', tipo: 'despesa', nivel: 2, pai: '3.1.4' },

  { codigo: '3.1.5', nome: 'DESPESAS DE MKT E COMERCIAIS', tipo: 'despesa', nivel: 1, pai: '3.1' },
  { codigo: '3.1.5.1', nome: 'Marketing Digital', tipo: 'despesa', nivel: 2, pai: '3.1.5' },
  { codigo: '3.1.5.2', nome: 'Eventos e Sponsorships', tipo: 'despesa', nivel: 2, pai: '3.1.5' },

  { codigo: '3.1.6', nome: 'SALÁRIOS E ENCARGOS MOB', tipo: 'despesa', nivel: 1, pai: '3.1' },
  { codigo: '3.1.6.1', nome: 'Salários MOB', tipo: 'despesa', nivel: 2, pai: '3.1.6' },
  { codigo: '3.1.6.2', nome: 'Vale Transporte', tipo: 'despesa', nivel: 2, pai: '3.1.6' },

  // EBITDA (calculado)
  { codigo: '3.2', nome: 'EBITDA', tipo: 'despesa', nivel: 0 },
]

async function seedPlanoContas() {
  try {
    console.log('Iniciando seed do Plano de Contas...')

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

      // Primeiro, buscar contas pai que já existem
      const contasExistentes = {}
      for (const conta of planoContasEstrutura) {
        if (conta.codigo === '1.1' || conta.codigo === '1.2' || conta.codigo === '1.3' ||
            conta.codigo === '2.1' || conta.codigo === '2.2' ||
            conta.codigo === '3.1' || conta.codigo === '3.2') {
          // Inserir contas principais primeiro
          const { data, error } = await supabase
            .from('plano_contas')
            .insert({
              empresa_id: empresa.id,
              codigo: conta.codigo,
              nome: conta.nome,
              tipo: conta.tipo,
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
      }

      // Depois, inserir contas filhas
      for (const conta of planoContasEstrutura) {
        if (conta.pai) {
          const paiId = contasExistentes[conta.pai]
          if (paiId) {
            const { error } = await supabase
              .from('plano_contas')
              .insert({
                empresa_id: empresa.id,
                codigo: conta.codigo,
                nome: conta.nome,
                tipo: conta.tipo,
                pai_id: paiId
              })

            if (error) {
              console.log(`  Conta ${conta.codigo} já existe ou erro: ${error.message}`)
            } else {
              console.log(`  ✓ Conta ${conta.codigo} inserida`)
            }
          }
        }
      }
    }

    console.log('\n✅ Seed do Plano de Contas concluído!')
  } catch (error) {
    console.error('❌ Erro ao fazer seed:', error)
  }
}

seedPlanoContas()
