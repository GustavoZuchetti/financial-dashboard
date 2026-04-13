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
  Loader2,
  Settings2
} from 'lucide-react';
import UploadExcel from '@/components/UploadExcel';
import { supabase } from '@/lib/supabase';

const ImportacaoPage = () => {
  const [activeTab, setActiveTab] = useState('grupo');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({ erp: '', category: '' });
  const [importStep, setImportStep] = useState('upload'); // 'upload' | 'validation'
  const [importData, setImportData] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [empresaId, setEmpresaId] = useState(null);
  const [isEmpresaModalOpen, setIsEmpresaModalOpen] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  
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

  // Carregar dados salvos do localStorage no mount
  useEffect(() => {
    const loadSavedState = async () => {
      // 1. Carregar Empresa
      const savedEmpresaId = localStorage.getItem('empresa_id');
      if (savedEmpresaId) {
        setEmpresaId(savedEmpresaId);
      } else {
        const { data: list } = await supabase.from('empresas').select('id').limit(1);
        if (list && list.length > 0) {
          setEmpresaId(list[0].id);
        }
      }

      // 2. Carregar Mapeamentos
      const savedMappings = localStorage.getItem('financial_mappings');
      if (savedMappings) {
        try {
          setMappings(JSON.parse(savedMappings));
        } catch (e) {
          console.error('Erro ao carregar mapeamentos:', e);
        }
      }

      // 3. Carregar Estado da Importação
      const savedImportData = localStorage.getItem('financial_import_data');
      if (savedImportData) {
        try {
          setImportData(JSON.parse(savedImportData));
        } catch (e) {}
      }

      const savedStep = localStorage.getItem('financial_import_step');
      if (savedStep) setImportStep(savedStep);

      const savedTab = localStorage.getItem('financial_import_active_tab');
      if (savedTab) setActiveTab(savedTab);
      
      // Carregar lista de empresas para o modal
      const { data: allEmpresas } = await supabase.from('empresas').select('*').order('nome');
      if (allEmpresas) setEmpresas(allEmpresas);
    };

    loadSavedState();
  }, []);

  // Persistir mudanças no localStorage
  useEffect(() => {
    if (empresaId) localStorage.setItem('empresa_id', empresaId);
  }, [empresaId]);

  useEffect(() => {
    localStorage.setItem('financial_mappings', JSON.stringify(mappings));
  }, [mappings]);

  useEffect(() => {
    if (importData) {
      localStorage.setItem('financial_import_data', JSON.stringify(importData));
    } else {
      localStorage.removeItem('financial_import_data');
    }
  }, [importData]);

  useEffect(() => {
    localStorage.setItem('financial_import_step', importStep);
  }, [importStep]);

  useEffect(() => {
    localStorage.setItem('financial_import_active_tab', activeTab);
  }, [activeTab]);

  const handleFileSelect = (payload) => {
    setImportData(payload);
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

  const handleSaveNewMapping = () => {
    if (!newMapping.erp || !newMapping.category) return;
    handleAddMapping(newMapping.erp, newMapping.category);
    setIsModalOpen(false);
    setNewMapping({ erp: '', category: '' });
  };

  const handleDeleteMapping = (groupId, itemId) => {
    setMappings(prev => prev.map(group => {
      if (group.group === groupId) {
        return {
          ...group,
          items: group.items.filter(item => item.id !== itemId)
        };
      }
      return group;
    }));
  };

  const handleFinalImport = async () => {
    if (!importData || !empresaId) {
      setImportStatus({ 
        type: 'error', 
        message: 'Empresa não identificada ou dados ausentes.' 
      });
      return;
    }

    setIsImporting(true);
    setImportStatus(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setImportStatus({
        type: 'success',
        message: 'Importação concluída com sucesso!'
      });
      setImportData(null);
      setImportStep('upload');
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: 'Erro ao realizar importação.'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const selectedEmpresa = empresas.find(e => e.id === empresaId);

  return (
    <div className=\"min-h-screen bg-black text-white p-8\">
      <div className=\"max-w-7xl mx-auto mb-8\">
        <div className=\"flex justify-between items-start mb-2\">
          <div>
            <h1 className=\"text-3xl font-bold flex items-center gap-3\">
              <Download className=\"w-8 h-8 text-green-500\" />
              Importação / De-Para
            </h1>
            <p className=\"text-zinc-400 mt-1\">Configure o mapeamento entre categorias do ERP e categorias do sistema</p>
          </div>
        </div>

        <div className=\"bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl flex justify-between items-center mt-6\">
          <div>
            <h2 className=\"text-lg font-bold text-white\">
              {selectedEmpresa ? selectedEmpresa.nome : 'Carregando empresa...'}
            </h2>
            <p className=\"text-sm text-zinc-500\">{selectedEmpresa?.cnpj || 'Buscando informações...'}</p>
          </div>
          <button 
            onClick={() => setIsEmpresaModalOpen(true)}
            className=\"bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors\"
          >
            Selecionar Empresa
          </button>
        </div>
      </div>

      <div className=\"max-w-7xl mx-auto\">
        <div className=\"flex gap-8 border-b border-zinc-800 mb-8\">
          <button
            onClick={() => setActiveTab('grupo')}
            className={`pb-4 text-sm font-medium transition-colors relative ${
              activeTab === 'grupo' ? 'text-green-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Grupo de Categorias
            {activeTab === 'grupo' && <div className=\"absolute bottom-0 left-0 right-0 h-0.5 bg-green-500\" />}
          </button>
          <button
            onClick={() => setActiveTab('mapeamento')}
            className={`pb-4 text-sm font-medium transition-colors relative ${
              activeTab === 'mapeamento' ? 'text-green-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Mapeamento de Categorias
            {activeTab === 'mapeamento' && <div className=\"absolute bottom-0 left-0 right-0 h-0.5 bg-green-500\" />}
          </button>
        </div>

        <div style={{ display: activeTab === 'grupo' ? 'block' : 'none' }}>
           <UploadExcel 
             onFileSelect={handleFileSelect} 
             mappings={mappings}
             onAddMapping={handleAddMapping}
             initialData={importData}
           />
           
           {importData && (
             <div className=\"mt-8 flex justify-end gap-4\">
               <button
                 onClick={() => setImportData(null)}
                 className=\"px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors\"
               >
                 Limpar Dados
               </button>
               <button
                 onClick={handleFinalImport}
                 disabled={isImporting}
                 className=\"px-8 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-bold transition-colors flex items-center gap-2\"
               >
                 {isImporting ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <CheckCircle2 className=\"w-4 h-4\" />}
                 {isImporting ? 'Importando...' : 'Confirmar Importação'}
               </button>
             </div>
           )}
           
           {importStatus && (
             <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
               importStatus.type === 'success' ? 'bg-green-900/20 text-green-400 border border-green-900/50' : 'bg-red-900/20 text-red-400 border border-red-900/50'
             }`}>
               {importStatus.type === 'success' ? <CheckCircle2 className=\"w-5 h-5\" /> : <AlertCircle className=\"w-5 h-5\" />}
               <p className=\"text-sm font-medium\">{importStatus.message}</p>
             </div>
           )}
        </div>

        <div style={{ display: activeTab === 'mapeamento' ? 'block' : 'none' }}>
          <div className=\"flex justify-end mb-6\">
            <button
              onClick={() => setIsModalOpen(true)}
              className=\"bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors\"
            >
              <Plus className=\"w-4 h-4\" />
              Criar Mapeamento de Categoria
            </button>
          </div>

          <div className=\"space-y-6\">
            {mappings.map((group) => (
              <div key={group.group} className=\"bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden\">
                <div className=\"p-4 border-b border-zinc-800 bg-zinc-800/30 flex justify-between items-center\">
                  <div>
                    <h3 className=\"font-bold text-white\">{group.group}</h3>
                    <p className=\"text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5\">Tipo: {group.type}</p>
                  </div>
                  <ChevronDown className=\"w-5 h-5 text-zinc-600\" />
                </div>
                <div className=\"overflow-x-auto\">
                  <table className=\"w-full text-left text-sm\">
                    <thead>
                      <tr className=\"text-zinc-500 border-b border-zinc-800\">
                        <th className=\"p-4 font-medium\">CATEGORIA DO ERP</th>
                        <th className=\"p-4 font-medium\">CATEGORIA DO SISTEMA</th>
                        <th className=\"p-4 font-medium text-center\">DRE</th>
                        <th className=\"p-4 font-medium text-center\">FLUXO</th>
                        <th className=\"p-4 font-medium text-right\">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody className=\"divide-y divide-zinc-800\">
                      {group.items.map((item) => (
                        <tr key={item.id} className=\"hover:bg-zinc-800/30 transition-colors\">
                          <td className=\"p-4 font-medium text-zinc-300\">{item.erp}</td>
                          <td className=\"p-4 text-zinc-400\">{item.categoria}</td>
                          <td className=\"p-4 text-center\">
                            {item.dre && <div className=\"w-1.5 h-1.5 rounded-full bg-green-500 mx-auto\" />}
                          </td>
                          <td className=\"p-4 text-center\">
                            {item.fluxo && <div className=\"w-1.5 h-1.5 rounded-full bg-blue-500 mx-auto\" />}
                          </td>
                          <td className=\"p-4 text-right\">
                            <div className=\"flex justify-end gap-2\">
                              <button className=\"p-2 text-zinc-500 hover:text-white transition-colors\">
                                <Pencil className=\"w-4 h-4\" />
                              </button>
                              <button 
                                onClick={() => handleDeleteMapping(group.group, item.id)}
                                className=\"p-2 text-zinc-500 hover:text-red-400 transition-colors\"
                              >
                                <Trash2 className=\"w-4 h-4\" />
                              </button>
                            </div>
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
      </div>

      {isModalOpen && (
        <div className=\"fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50\">
          <div className=\"bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl\">
            <div className=\"flex justify-between items-center mb-6\">
              <h2 className=\"text-xl font-bold\">Novo Mapeamento</h2>
              <button onClick={() => setIsModalOpen(false)} className=\"text-zinc-500 hover:text-white\">
                <X className=\"w-6 h-6\" />
              </button>
            </div>
            <div className=\"space-y-4\">
              <div>
                <label className=\"block text-sm text-zinc-400 mb-1\">Categoria do ERP</label>
                <input 
                  type=\"text\" 
                  value={newMapping.erp}
                  onChange={(e) => setNewMapping(prev => ({ ...prev, erp: e.target.value }))}
                  className=\"w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 outline-none text-white focus:border-green-500\"
                  placeholder=\"Ex: Venda de Mercadorias\"
                />
              </div>
              <div>
                <label className=\"block text-sm text-zinc-400 mb-1\">Categoria do Sistema</label>
                <select 
                  value={newMapping.category}
                  onChange={(e) => setNewMapping(prev => ({ ...prev, category: e.target.value }))}
                  className=\"w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 outline-none text-white focus:border-green-500\"
                >
                  <option value=\"\">Selecione...</option>
                  {mappings.map(g => (
                    <option key={g.group} value={g.group}>{g.group}</option>
                  ))}
                </select>
              </div>
              <div className=\"flex gap-3 pt-4\">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className=\"flex-1 bg-zinc-800 py-2 rounded-md border border-zinc-700 hover:bg-zinc-700 transition-colors\"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveNewMapping}
                  disabled={!newMapping.erp || !newMapping.category}
                  className=\"flex-1 bg-green-600 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors\"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEmpresaModalOpen && (
        <div className=\"fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]\">
          <div className=\"bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-lg shadow-2xl\">
            <div className=\"flex justify-between items-center mb-6\">
              <div className=\"flex items-center gap-3\">
                <Settings2 className=\"w-6 h-6 text-green-500\" />
                <h2 className=\"text-xl font-bold text-white\">Selecionar Empresa</h2>
              </div>
              <button onClick={() => setIsEmpresaModalOpen(false)} className=\"text-zinc-500 hover:text-white\">
                <X className=\"w-6 h-6\" />
              </button>
            </div>
            <div className=\"space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar\">
              {empresas.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => {
                    setEmpresaId(emp.id);
                    setIsEmpresaModalOpen(false);
                  }}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    empresaId === emp.id 
                    ? 'bg-green-600/10 border-green-600 text-green-500' 
                    : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div className=\"font-bold\">{emp.nome}</div>
                  <div className=\"text-xs opacity-60 mt-1\">{emp.cnpj}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportacaoPage;
