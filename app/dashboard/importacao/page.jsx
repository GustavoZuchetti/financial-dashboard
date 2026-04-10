'use client'
import { useState } from 'react'

const MAPEAMENTOS_MOCK = [
  {
    id: 1,
    grupo: 'RECEITA BRUTA',
    tipo: 'Receita Bruta',
    mapeamentos: [
      { id: 1, categoriaERP: 'Receita de Serviços', categoriaOxy: 'Receita de Serviços', dre: true, fluxoCaixa: true, dataCriacao: '30/01/2025' },
      { id: 2, categoriaERP: 'Receita de Produtos', categoriaOxy: 'Receita de Produtos', dre: true, fluxoCaixa: true, dataCriacao: '23/07/2025' },
    ]
  },
  {
    id: 2,
    grupo: 'OUTROS RECEBIMENTOS',
    tipo: 'Receita Bruta',
    mapeamentos: [
      { id: 3, categoriaERP: 'Devoluções de Pagamentos', categoriaOxy: 'Devoluções de Pagamentos', dre: true, fluxoCaixa: true, dataCriacao: '20/03/2025' }
    ]
  },
  {
    id: 3,
    grupo: 'IMPOSTOS SOBRE RECEITA',
    tipo: 'Deduções',
    mapeamentos: [
      { id: 4, categoriaERP: 'COFINS', categoriaOxy: 'COFINS', dre: true, fluxoCaixa: false, dataCriacao: '15/02/2025' },
      { id: 5, categoriaERP: 'PIS', categoriaOxy: 'PIS', dre: true, fluxoCaixa: false, dataCriacao: '15/02/2025' },
      { id: 6, categoriaERP: 'ISS', categoriaOxy: 'ISS', dre: true, fluxoCaixa: true, dataCriacao: '15/02/2025' },
    ]
  }
]

export default function ImportacaoDePara() {
  const [isUploading, setIsUploading] = useState(false)

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setIsUploading(true)
      // Simulação de processamento
      setTimeout(() => {
        setIsUploading(false)
        alert('Planilha "' + file.name + '" enviada com sucesso!')
      }, 2000)
    }
  }

  return (
    <div style={{ color: '#e5e7eb', padding: '24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Importação / De-Para</h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>
          Configure o mapeamento entre categorias do ERP e categorias do sistema
        </p>
      </div>

      {/* Botão de Upload Principal */}
      <div style={{ 
        backgroundColor: '#1f2937', 
        borderRadius: '12px', 
        padding: '32px', 
        border: '2px dashed #374151',
        textAlign: 'center',
        marginBottom: '32px',
        transition: 'all 0.2s'
      }}>
        <div style={{ marginBottom: '16px', fontSize: '48px' }}>📊</div>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Carregar Dados Financeiros</h3>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px' }}>
          Selecione uma planilha Excel (.xlsx, .csv) contendo os dados do seu ERP
        </p>
        
        <label style={{
          backgroundColor: isUploading ? '#4b5563' : '#10b981',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontWeight: 'bold',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          {isUploading ? '⌛ Processando...' : '📁 Escolher Planilha Excel'}
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            style={{ display: 'none' }} 
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </label>
      </div>

      <div style={{ 
        backgroundColor: '#111827', 
        border: '1px solid #059669', 
        borderRadius: '8px', 
        padding: '16px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>FACESIGN - JB DESENVOLVIMENTO EMPRESARIAL LTDA</div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>CNPJ: 37.196.114/0001-69</div>
        </div>
        <button style={{ backgroundColor: '#10b981', color: 'white', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
          Selecionar Empresa
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
        <span style={{ color: '#9ca3af', fontSize: '14px', cursor: 'pointer' }}>Grupo de Categorias</span>
        <span style={{ color: '#10b981', fontSize: '14px', borderBottom: '2px solid #10b981', paddingBottom: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          Mapeamento de Categorias
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
        <button style={{ backgroundColor: '#10b981', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' }}>
          Criar Mapeamento de Categoria
        </button>
      </div>

      {MAPEAMENTOS_MOCK.map((grupo) => (
        <div key={grupo.id} style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>{grupo.grupo}</h2>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>Tipo: {grupo.tipo}</span>
            </div>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Mapeamentos: {grupo.mapeamentos.length} ▾</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ color: '#9ca3af', textAlign: 'left', borderBottom: '1px solid #374151' }}>
                <th style={{ padding: '12px' }}><input type="checkbox" /></th>
                <th style={{ padding: '12px' }}>CATEGORIA DO ERP</th>
                <th style={{ padding: '12px' }}>CATEGORIA DA OXY</th>
                <th style={{ padding: '12px' }}>DRE</th>
                <th style={{ padding: '12px' }}>FLUXO DE CAIXA</th>
                <th style={{ padding: '12px' }}>DATA DA CRIAÇÃO</th>
                <th style={{ padding: '12px' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {grupo.mapeamentos.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #1f2937' }}>
                  <td style={{ padding: '12px' }}><input type="checkbox" /></td>
                  <td style={{ padding: '12px' }}>{m.categoriaERP}</td>
                  <td style={{ padding: '12px' }}>{m.categoriaOxy}</td>
                  <td style={{ padding: '12px' }}>{m.dre ? '✔️' : '-'}</td>
                  <td style={{ padding: '12px' }}>{m.fluxoCaixa ? '✔️' : '-'}</td>
                  <td style={{ padding: '12px' }}>{m.dataCriacao}</td>
                  <td style={{ padding: '12px' }}>✏️ 🗑️</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
