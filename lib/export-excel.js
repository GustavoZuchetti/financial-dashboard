// ─── export-excel.js — Utilitário de exportação para Excel (SheetJS) ─────────
// Uso: downloadWorkbook([{ name, aoa, colWidths }], 'arquivo.xlsx')
// - aoa: array de arrays (linhas × colunas). Números permanecem numéricos no Excel.
// - colWidths: larguras em caracteres, ex.: [40, 14, 12]
import * as XLSX from 'xlsx'

export function downloadWorkbook(sheets, filename) {
  const wb = XLSX.utils.book_new()
  sheets.forEach(({ name, aoa, colWidths, currencyCols }) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    if (colWidths) ws['!cols'] = colWidths.map(w => ({ wch: w }))
    // Formato monetário BRL nas colunas indicadas (índices 0-based), pulando o cabeçalho
    if (currencyCols && currencyCols.length) {
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let R = 1; R <= range.e.r; R++) {
        currencyCols.forEach(C => {
          const addr = XLSX.utils.encode_cell({ r: R, c: C })
          const cell = ws[addr]
          if (cell && typeof cell.v === 'number') cell.z = '#,##0.00'
        })
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31))
  })
  XLSX.writeFile(wb, filename)
}

// Nome de arquivo padronizado: Prefixo_2026-01-01_a_2026-07-02.xlsx
export function exportFilename(prefixo, startDate, endDate) {
  return `${prefixo}_${startDate}_a_${endDate}.xlsx`
}
