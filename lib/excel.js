import * as XLSX from 'xlsx'
import { supabase } from './supabase'

/**
 * Importa lancamentos de uma planilha Excel para o Supabase
 * Formato esperado das colunas:
 * data, descricao, tipo (receita|custo|despesa), valor, categoria
 */
export async function importarExcelLancamentos(file, empresaId) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

        if (rows.length < 2) {
          return reject(new Error('Planilha vazia ou sem dados'))
        }

        const headers = rows[0].map(h => String(h).toLowerCase().trim())
        const dataIdx = headers.findIndex(h => h.includes('data'))
        const descIdx = headers.findIndex(h => h.includes('descri'))
        const tipoIdx = headers.findIndex(h => h.includes('tipo'))
        const valorIdx = headers.findIndex(h => h.includes('valor'))
        const catIdx = headers.findIndex(h => h.includes('categor'))

        if (valorIdx === -1 || tipoIdx === -1) {
          return reject(new Error('Colunas obrigatorias nao encontradas: tipo, valor'))
        }

        const lancamentos = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length === 0) continue

          let valor = parseFloat(String(row[valorIdx] || '0').replace(',', '.'))
          if (isNaN(valor)) continue

          let dataStr = null
          if (dataIdx !== -1 && row[dataIdx]) {
            const rawDate = row[dataIdx]
            if (typeof rawDate === 'number') {
              // Data serial do Excel
              const date = XLSX.SSF.parse_date_code(rawDate)
              dataStr = `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`
            } else {
              // Formato string
              const parts = String(rawDate).split('/')
              if (parts.length === 3) {
                dataStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
              } else {
                dataStr = String(rawDate)
              }
            }
          }

          const tipo = String(row[tipoIdx] || '').toLowerCase().trim()
          if (!['receita', 'custo', 'despesa'].includes(tipo)) continue

          lancamentos.push({
            empresa_id: empresaId,
            data: dataStr || new Date().toISOString().split('T')[0],
            descricao: descIdx !== -1 ? String(row[descIdx] || '') : '',
            tipo,
            valor: Math.abs(valor),
            categoria: catIdx !== -1 ? String(row[catIdx] || '') : null,
          })
        }

        if (lancamentos.length === 0) {
          return reject(new Error('Nenhum lancamento valido encontrado na planilha'))
        }

        // Inserir em lotes de 100
        const batchSize = 100
        let totalInserido = 0
        for (let i = 0; i < lancamentos.length; i += batchSize) {
          const batch = lancamentos.slice(i, i + batchSize)
          const { error } = await supabase.from('lancamentos').insert(batch)
          if (error) throw error
          totalInserido += batch.length
        }

        resolve({ total: totalInserido, lancamentos })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Importa fluxo de caixa de uma planilha Excel
 * Colunas: data, descricao, tipo (entrada|saida), valor, categoria
 */
export async function importarExcelFluxoCaixa(file, empresaId) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

        const headers = rows[0].map(h => String(h).toLowerCase().trim())
        const dataIdx = headers.findIndex(h => h.includes('data'))
        const descIdx = headers.findIndex(h => h.includes('descri'))
        const tipoIdx = headers.findIndex(h => h.includes('tipo'))
        const valorIdx = headers.findIndex(h => h.includes('valor'))
        const catIdx = headers.findIndex(h => h.includes('categor'))

        const items = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length === 0) continue

          let valor = parseFloat(String(row[valorIdx] || '0').replace(',', '.'))
          if (isNaN(valor)) continue

          const tipo = String(row[tipoIdx] || '').toLowerCase().trim()
          if (!['entrada', 'saida'].includes(tipo)) continue

          let dataStr = new Date().toISOString().split('T')[0]
          if (dataIdx !== -1 && row[dataIdx]) {
            const rawDate = row[dataIdx]
            if (typeof rawDate === 'number') {
              const date = XLSX.SSF.parse_date_code(rawDate)
              dataStr = `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`
            } else {
              const parts = String(rawDate).split('/')
              if (parts.length === 3) dataStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
            }
          }

          items.push({
            empresa_id: empresaId,
            data: dataStr,
            descricao: descIdx !== -1 ? String(row[descIdx] || '') : '',
            tipo,
            valor: Math.abs(valor),
            categoria: catIdx !== -1 ? String(row[catIdx] || '') : null,
          })
        }

        const { error } = await supabase.from('fluxo_caixa').insert(items)
        if (error) throw error
        resolve({ total: items.length })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsArrayBuffer(file)
  })
}

export function gerarTemplateExcelLancamentos() {
  const data = [
    ['data', 'descricao', 'tipo', 'valor', 'categoria'],
    ['01/01/2025', 'Venda de produto A', 'receita', 10000, 'Vendas'],
    ['05/01/2025', 'Custo mercadoria vendida', 'custo', 4000, 'CMV'],
    ['10/01/2025', 'Aluguel escritorio', 'despesa', 2000, 'Administrativo'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lancamentos')
  XLSX.writeFile(wb, 'template_lancamentos.xlsx')
}

export function gerarTemplateExcelFluxo() {
  const data = [
    ['data', 'descricao', 'tipo', 'valor', 'categoria'],
    ['01/01/2025', 'Recebimento cliente', 'entrada', 15000, 'Clientes'],
    ['05/01/2025', 'Pagamento fornecedor', 'saida', 8000, 'Fornecedores'],
    ['10/01/2025', 'Pagamento salarios', 'saida', 5000, 'Folha'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'FluxoCaixa')
  XLSX.writeFile(wb, 'template_fluxo_caixa.xlsx')
}
