import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function setup() {
  try {
    console.log('Verificando empresas...')
    const { data: empresas } = await supabase.from('empresas').select('id')

    if (!empresas || empresas.length === 0) {
      console.log('Criando empresa padrão...')
      const { data: newEmpresa, error } = await supabase
        .from('empresas')
        .insert({ nome: 'Facesign Dashboard', cnpj: '00.000.000/0001-00' })
        .select()

      if (error) throw error
      console.log('Empresa criada com sucesso:', newEmpresa[0].id)
    } else {
      console.log('Empresas já existem no banco.')
    }
  } catch (err) {
    console.error('Erro no setup:', err)
  }
}

setup()
