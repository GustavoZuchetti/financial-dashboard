'use client';
import React, { useState } from 'react';
import {
  Download,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import UploadExcel from '@/components/UploadExcel';

const ImportacaoPage = () => {
  const [activeTab, setActiveTab] = useState('grupo');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importStep, setImportStep] = useState('upload'); // 'upload' | 'validation'
  const [importData, setImportData] = useState(null);
  
  const [mappings, setMappings] = useState([
    {
      group: 'RECEITA BRUTA',
      type: 'Receita Bruta',
      items: [
        { id: 1, erp: 'Receita de Serviços', categoria: 'Receita de Serviços', dre: true, fluxo: true, data: '30/01/2025' },
        { id: 2, erp: 'Receita de Produtos', categoria: 'Receita de Produtos', dre: true, fluxo: true, data: '23/07/2025' },
      ]
    },
    {
      group: 'OUTROS RECEBIMENTOS',
      type: 'Receita Bruta',
      items: [
        { id: 3, erp: 'Devoluções de Pagamentos', categoria: 'Devoluções de Pagamentos', dre: true, fluxo: true, data: '20/03/2025' },
      ]
    },
    {
      group: 'IMPOSTOS SOBRE RECEITA',
      type: 'Deduções',
      items: [
        { id: 4, erp: 'COFINS', categoria: 'COFINS', dre: true, fluxo: false, data: '15/02/2025' },
        { id: 5, erp: 'PIS', categoria: 'PIS', dre: true, fluxo: false, data: '15/02/2025' },
        { id: 6, erp: 'ISS', categoria: 'ISS', dre: true, fluxo: true, data: '15/02/2025' },
      ]
    }
  ]);

  const handleFileSelect = (payload) => {
    setImportData(payload);
  };

  const handleContinue = () => {
    setImportStep('validation');
  };

  // Lógica de validação integrada
  const getValidationResults = () => {
    if (!importData) return [];
    
    const allMappedAccounts = mappings.flatMap(g => g.items.map(i => i.erp.toLowerCase()));
    
    return importData.map((row) => {
      const accountField = Object.keys(row).find(k => 
        k.toLowerCase().includes('nome') || 
        k.toLowerCase().includes('conta') || 
        k.toLowerCase().includes('categoria')
      ) || Object.keys(row)[0];
      
      const accountValue = String(row[accountField] || '');
      const isMatched = allMappedAccounts.includes(accountValue.toLowerCase());
      
      return {
        ...row,
        status: isMatched ? 'valid' : 'invalid',
        account: accountValue
      };
    });
  };

  const validationResults = getValidationResults();
  const validCount = validationResults.filter(r => r.status === 'valid').length;

  return (
    <div className="p-6 bg-zinc-950 min-h-screen text-white">
      {/* Header */}
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Download className="w-6 h-6" />
            Importação / De-Para
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {importStep === 'upload' 
              ? 'Configure o mapeamento entre categorias do ERP e categorias do sistema'
              : 'Validação de contas importadas vs mapeamento do sistema'}
          </p>
        </div>
        {importStep === 'validation' && (
          <button 
            onClick={() => setImportStep('upload')}
            className="text-zinc-400 hover:text-white text-sm flex items-center gap-1"
          >
            ← Voltar para Upload
          </button>
        )}
      </div>

      {/* Company Selection Card */}
      <div className="bg-zinc-900 rounded-lg p-4 mb-6 border border-zinc-800">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-base">FACESIGN - JB DESENVOLVIMENTO EMPRESARIAL LTDA</h2>
            <p className="text-zinc-500 text-sm">CNPJ: 37.196.114/0001-69</p>
          </div>
          <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-md text-sm transition-colors border border-zinc-700">
            Selecionar Empresa
          </button>
        </div>
      </div>

      {importStep === 'upload' ? (
        <>
          {/* Tabs */}
          <div className="mb-6">
            <div className="border-b border-zinc-800">
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab('grupo')}
                  className={`pb-3 px-2 text-sm font-medium transition-all relative ${
                    activeTab === 'grupo' ? 'text-green-500' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Grupo de Categorias
                  {activeTab === 'grupo' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />}
                </button>
                <button
                  onClick={() => setActiveTab('mapeamento')}
                  className={`pb-3 px-2 text-sm font-medium transition-all relative ${
                    activeTab === 'mapeamento' ? 'text-green-500' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Mapeamento de Categorias
                  {activeTab === 'mapeamento' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />}
                </button>
              </div>
            </div>
          </div>

          {activeTab === 'grupo' && (
            <div>
              <UploadExcel onFileSelect={handleFileSelect} mappings={mappings} />
              {importData && (
                <div className="mt-6 flex justify-end">
                  <button 
                    onClick={handleContinue}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                  >
                    Continuar para Validação <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'mapeamento' && (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={() => setIsModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm flex items-center gap-2 transition-colors">
                  <Plus className="w-4 h-4" /> Criar Mapeamento de Categoria
                </button>
              </div>
              <div className="space-y-6">
                {mappings.map((group, gIdx) => (
                  <div key={gIdx} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                    <div className="p-4 bg-zinc-800/30 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-zinc-200">{group.group}</h3>
                        <p className="text-xs text-zinc-500">Tipo: {group.type}</p>
                      </div>
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-zinc-800/20 text-zinc-400 uppercase text-xs">
                          <tr>
                            <th className="p-3 w-12"><input type="checkbox" className="w-4 h-4 rounded border-zinc-600 bg-zinc-800" /></th>
                            <th className="p-3">Categoria do ERP</th>
                            <th className="p-3">Categoria do Sistema</th>
                            <th className="p-3 text-center">DRE</th>
                            <th className="p-3 text-center">Fluxo</th>
                            <th className="p-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {group.items.map((item) => (
                            <tr key={item.id} className="hover:bg-zinc-800/20">
                              <td className="p-3"><input type="checkbox" className="w-4 h-4 rounded border-zinc-600 bg-zinc-800" /></td>
                              <td className="p-3 text-zinc-200">{item.erp}</td>
                              <td className="p-3 text-zinc-400">{item.categoria}</td>
                              <td className="p-3 text-center">{item.dre && '✓'}</td>
                              <td className="p-3 text-center">{item.fluxo && '✓'}</td>
                              <td className="p-3 text-right"><Pencil className="w-4 h-4 inline mr-2 cursor-pointer"/><Trash2 className="w-4 h-4 inline cursor-pointer text-zinc-500"/></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Step: Validation (Legacy/Extended) */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
              <div className="text-zinc-500 text-xs uppercase font-bold mb-1">Total de Itens</div>
              <div className="text-2xl font-bold">{validationResults.length}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg border-l-4 border-l-green-600">
              <div className="text-zinc-500 text-xs uppercase font-bold mb-1">Contas Validadas</div>
              <div className="text-2xl font-bold text-green-500">{validCount}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg border-l-4 border-l-red-600">
              <div className="text-zinc-500 text-xs uppercase font-bold mb-1">Atenção (Não Mapeadas)</div>
              <div className="text-2xl font-bold text-red-500">{validationResults.length - validCount}</div>
            </div>
          </div>
          {/* ... Rest of validation detail table ... */}
        </div>
      )}
      
feat: integra validação de mapeamento no componente de upload e atualiza importacao/page.jsx      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Novo Mapeamento</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Categoria do ERP</label>
                <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 outline-none text-white" placeholder="Ex: Venda de Mercadorias" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Categoria do Sistema</label>
                <select className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 outline-none text-white">
                  <option>Receita de Serviços</option>
                  <option>Receita de Produtos</option>
                  <option>Deduções</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-zinc-800 py-2 rounded-md border border-zinc-700">Cancelar</button>
                <button className="flex-1 bg-green-600 py-2 rounded-md">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportacaoPage;
