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
    if (!empresas || empresas.length === 0) return
    
    const empresaId = empresas[0].id
    console.log(`Configurando para empresa: ${empresaId}`)

    // Limpar plano de contas atual para evitar duplicidade (opcional, mas garante limpeza)
    // await supabase.from('plano_contas').delete().eq('empresa_id', empresaId)

    for (const cat of categoriasTotalizadoras) {
      const { error } = await supabase
        .from('plano_contas')
        .upsert({
          empresa_id: empresaId,
          codigo: cat.codigo,
          nome: cat.nome,
          tipo: cat.tipo
        }, { onConflict: 'empresa_id,codigo' })
      
      if (error) console.log(`Erro na categoria ${cat.nome}:`, error.message)
      else console.log(`✓ Categoria configurada: ${cat.nome}`)
    }

    console.log('✅ Categorias totalizadoras configuradas!')
  } catch (err) {
    console.error(err)
  }
}

setup()
