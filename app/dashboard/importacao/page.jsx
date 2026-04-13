'use client';
import React, { useState, useEffect } from 'react';
import {
  Download,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import UploadExcel from '@/components/UploadExcel';
import { supabase } from '@/lib/supabase';

const ImportacaoPage = () => {
  const [activeTab, setActiveTab] = useState('grupo');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importStep, setImportStep] = useState('upload'); // 'upload' | 'validation'
  const [importData, setImportData] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [empresaId, setEmpresaId] = useState(null);

  const [mappings, setMappings] = useState([
    {
      group: 'RECEITA BRUTA',
      type: 'receita',
      items: [
        { id: 1, erp: 'Receita de Serviços', categoria: 'Receita de Serviços', dre: true, fluxo: true },
        { id: 2, erp: 'Receita de Produtos', categoria: 'Receita de Produtos', dre: true, fluxo: true },
      ]
    },
    {
      group: 'OUTROS RECEBIMENTOS',
      type: 'receita',
      items: [
        { id: 3, erp: 'Devoluções de Pagamentos', categoria: 'Devoluções de Pagamentos', dre: true, fluxo: true },
      ]
    },
    {
      group: 'IMPOSTOS SOBRE RECEITA',
      type: 'despesa',
      items: [
        { id: 4, erp: 'COFINS', categoria: 'COFINS', dre: true, fluxo: false },
        { id: 5, erp: 'PIS', categoria: 'PIS', dre: true, fluxo: false },
        { id: 6, erp: 'ISS', categoria: 'ISS', dre: true, fluxo: true },
      ]
    }
  ]);

  // Carregar empresa e mapeamentos salvos
  useEffect(() => {
    const init = async () => {
      // Carregar empresa
      const { data: empresas } = await supabase.from('empresas').select('id').limit(1);
      if (empresas && empresas.length > 0) {
        setEmpresaId(empresas[0].id);
      }

      // Carregar mapeamentos do localStorage (fallback para persistência rápida)
      const savedMappings = localStorage.getItem('financial_mappings');
      if (savedMappings) {
        try {
          setMappings(JSON.parse(savedMappings));
        } catch (e) {
          console.error('Erro ao carregar mapeamentos:', e);
        }
      }
    };
    init();
  }, []);

  // Salvar mapeamentos sempre que mudarem
  useEffect(() => {
    localStorage.setItem('financial_mappings', JSON.stringify(mappings));
  }, [mappings]);

  const handleFileSelect = (payload) => {
    setImportData(payload);
  };

  const handleContinue = () => {
    setImportStep('validation');
  };

  const handleAddMapping = (erpName, categoryName) => {
    setMappings(prev => prev.map(group => {
      if (group.group === categoryName) {
        return {
          ...group,
          items: [
            ...group.items,
            {
              id: Date.now(),
              erp: erpName,
              categoria: erpName,
              dre: true,
              fluxo: true,
              data: new Date().toLocaleDateString('pt-BR')
            }
          ]
        };
      }
      return group;
    }));
  };

  const handleFinalImport = async () => {
    if (!importData || !empresaId) {
      setImportStatus({ type: 'error', message: 'Empresa não identificada ou dados ausentes.' });
      return;
    }

    setIsImporting(true);
    setImportStatus(null);

    try {
      const recordsToInsert = importData.map(row => {
        // Encontrar o tipo (receita/custo/despesa) baseado no mapeamento
        let tipo = 'despesa';
        mappings.forEach(g => {
          if (g.items.some(i => i.erp.toLowerCase() === row.__validation.accountValue.toLowerCase())) {
            tipo = g.type;
          }
        });

        // Limpar valor
        const valorRaw = row['Valor'] || row['valor'] || 0;
        const valor = Math.abs(parseFloat(String(valorRaw).replace(/\./g, '').replace(',', '.')));

        // Tratar data (formato esperado YYYY-MM-DD)
        let dataStr = row['Data'] || row['data'];
        if (dataStr && dataStr.includes('/')) {
          const [d, m, y] = dataStr.split('/');
          dataStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        return {
          empresa_id: empresaId,
          data: dataStr || new Date().toISOString().split('T')[0],
          descricao: row['Nome'] || row['nome'] || row['Descrição'] || '',
          tipo: tipo,
          valor: valor,
          categoria: row.__validation.accountValue
        };
      });

      const { error } = await supabase.from('lancamentos').insert(recordsToInsert);
      
      if (error) throw error;

      setImportStatus({ type: 'success', message: `${recordsToInsert.length} lançamentos importados com sucesso para o DRE!` });
      setImportData(null);
      setImportStep('upload');
    } catch (err) {
      console.error(err);
      setImportStatus({ type: 'error', message: `Erro na importação: ${err.message}` });
    } finally {
      setIsImporting(false);
    }
  };

  const getValidationResults = () => {
    if (!importData) return [];
    return importData;
  };

  const validationResults = getValidationResults();
  const validCount = validationResults.filter(r => r.__validation?.isValid).length;

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
              : 'Validação final de itens para importação'}
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

      {/* Status Messages */}
      {importStatus && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          importStatus.type === 'success' ? 'bg-green-950/30 border border-green-900/50 text-green-400' : 'bg-red-950/30 border border-red-900/50 text-red-400'
        }`}>
          {importStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{importStatus.message}</span>
          <button onClick={() => setImportStatus(null)} className="ml-auto text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

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
            <div className="space-y-6">
              <UploadExcel onFileSelect={handleFileSelect} mappings={mappings} onAddMapping={handleAddMapping} />
              {importData && (
                <div className="flex justify-end pt-4">
                  <button 
                    onClick={handleContinue}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-green-900/20 transition-all hover:scale-105 active:scale-95"
                  >
                    Continuar para Validação Final <ArrowRight className="w-5 h-5" />
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
                              <td className="p-3 text-right">
                                <Pencil className="w-4 h-4 inline mr-2 cursor-pointer text-zinc-500 hover:text-white transition-colors"/>
                                <Trash2 className="w-4 h-4 inline cursor-pointer text-zinc-500 hover:text-red-500 transition-colors"/>
                              </td>
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
        /* Step: Final Validation Detail */
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
              <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1 tracking-wider">Total de Itens</div>
              <div className="text-2xl font-bold">{validationResults.length}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg border-l-4 border-l-green-600">
              <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1 tracking-wider">Itens Validados</div>
              <div className="text-2xl font-bold text-green-500">{validCount}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg border-l-4 border-l-red-600">
              <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1 tracking-wider">Atenção (Não Mapeados)</div>
              <div className="text-2xl font-bold text-red-500">{validationResults.length - validCount}</div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-zinc-800/50 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold text-sm text-zinc-200 uppercase tracking-widest">Resumo da Validação Item a Item</h3>
              <div className="flex gap-2">
                <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-md text-xs border border-zinc-700">Exportar Log</button>
                <button 
                  disabled={validCount < validationResults.length || isImporting}
                  onClick={handleFinalImport}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-md text-xs font-bold shadow-lg shadow-green-900/20 flex items-center gap-2"
                >
                  {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {isImporting ? 'Importando...' : 'Concluir Importação'}
                </button>
              </div>
            </div>

            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-zinc-900 z-10 border-b border-zinc-800">
                  <tr className="text-zinc-500">
                    <th className="p-4 w-12 text-center">Status</th>
                    <th className="p-4">Conta Origem (ERP)</th>
                    <th className="p-4">Valor</th>
                    <th className="p-4">Erro / Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {validationResults.map((item, idx) => (
                    <tr key={idx} className={`hover:bg-zinc-800/10 ${!item.__validation?.isValid ? 'bg-red-950/10' : ''}`}>
                      <td className="p-4 text-center">
                        {item.__validation?.isValid ? 
                          <CheckCircle2 className="w-5 h-5 text-green-600 inline" /> : 
                          <AlertCircle className="w-5 h-5 text-red-500 inline" />
                        }
                      </td>
                      <td className="p-4 font-mono text-zinc-300">{item.__validation?.accountValue || 'N/A'}</td>
                      <td className="p-4 font-bold text-zinc-200">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          parseFloat(String(item['Valor'] || item['valor'] || 0).replace(/\./g, '').replace(',', '.'))
                        )}
                      </td>
                      <td className="p-4 text-zinc-400">
                        {item.__validation?.isValid ? 
                          <span className="text-green-800 text-[10px] font-bold uppercase">Pronto para importar</span> : 
                          <span className="text-red-400 font-medium italic">{item.__validation?.errors.join(', ')}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Mapeamento */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Novo Mapeamento</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Categoria do ERP</label>
                <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 outline-none text-white focus:border-green-500" placeholder="Ex: Venda de Mercadorias" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Categoria do Sistema</label>
                <select className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 outline-none text-white focus:border-green-500">
                  <option>Receita de Serviços</option>
                  <option>Receita de Produtos</option>
                  <option>Deduções</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-zinc-800 py-2 rounded-md border border-zinc-700 hover:bg-zinc-700 transition-colors">Cancelar</button>
                <button className="flex-1 bg-green-600 py-2 rounded-md hover:bg-green-700 transition-colors">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportacaoPage;
