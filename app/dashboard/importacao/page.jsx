'use client';
import React, { useState, useEffect } from 'react';
import { Download, Plus, Pencil, Trash2, ChevronDown, X, CheckCircle2, AlertCircle, ArrowRight, Loader2, Settings2 } from 'lucide-react';
import UploadExcel from '@/components/UploadExcel';
import { supabase } from '@/lib/supabase';

const ImportacaoPage = () => {
  const [activeTab, setActiveTab] = useState('grupo');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({ erp: '', category: '' });
  const [importStep, setImportStep] = useState('upload'); // 'upload' | 'conclusao'
  const [importData, setImportData] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [isEmpresaModalOpen, setIsEmpresaModalOpen] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [clienteMappings, setClienteMappings] = useState([]);
  const [planoContas, setPlanoContas] = useState([]);
  const [mappings, setMappings] = useState([
    { group: 'RECEITA BRUTA', type: 'receita', items: [] },
    { group: 'OUTROS RECEBIMENTOS', type: 'receita', items: [] },
    { group: 'IMPOSTOS SOBRE RECEITA', type: 'despesa', items: [] },
    { group: 'CUSTOS OPERACIONAIS', type: 'despesa', items: [] },
    { group: 'DESPESAS ADMINISTRATIVAS', type: 'despesa', items: [] },
    { group: 'DESPESAS COM PESSOAL', type: 'despesa', items: [] }
  ]);

  useEffect(() => {
    const loadSavedState = async () => {
      // Carregar empresas
      const { data: allEmpresas } = await supabase.from('empresas').select('*').order('nome');
      if (allEmpresas) {
        setEmpresas(allEmpresas);
        const savedEmpresaId = localStorage.getItem('empresa_id');
        if (savedEmpresaId && allEmpresas.some(e => e.id === savedEmpresaId)) {
          setEmpresaId(savedEmpresaId);
        } else if (allEmpresas.length > 0) {
          setEmpresaId(allEmpresas[0].id);
        }
      }

      // Carregar mapeamentos salvos de categoria_mappings
      const { data: categoriaMappings } = await supabase.from('categoria_mappings').select('*');
      if (categoriaMappings) {
        setClienteMappings(categoriaMappings);
      }

      // Carregar Plano de Contas do Supabase
      const { data: plano } = await supabase.from('plano_contas').select('*').order('codigo');
      if (plano) {
        setPlanoContas(plano);
      }

      const savedImportData = localStorage.getItem('financial_import_data');
      if (savedImportData) { try { setImportData(JSON.parse(savedImportData)); } catch (e) {} }

      const savedStep = localStorage.getItem('financial_import_step');
      if (savedStep) setImportStep(savedStep);

      const savedTab = localStorage.getItem('financial_import_active_tab');
      if (savedTab) setActiveTab(savedTab);

      setIsLoaded(true);
    };
    loadSavedState();
  }, []);

  // Aplicar mappings salvos ao importData quando ambos estiverem carregados
  useEffect(() => {
    if (!importData || !clienteMappings || clienteMappings.length === 0) return;

    const updatedData = importData.map(row => {
      const accountField = Object.keys(row).find(k => 
        k.toLowerCase().includes('nome') || 
        k.toLowerCase().includes('conta') || 
        k.toLowerCase().includes('categoria') || 
        k.toLowerCase().includes('histórico')
      );
      
      const accountValue = accountField ? String(row[accountField] || '').trim() : '';
      
      const mapping = clienteMappings.find(m => 
        m.nome_erp && m.nome_erp.toLowerCase() === accountValue.toLowerCase()
      );
      
      if (mapping) {
        return {
          ...row,
          __configured: true,
          __mappedCategory: mapping.categoria_sistema
        };
      }
      
      return row;
    });
    
    setImportData(updatedData);
  }, [clienteMappings, importData?.length]);

  useEffect(() => { if (isLoaded && empresaId) localStorage.setItem('empresa_id', empresaId); }, [empresaId, isLoaded]);
  useEffect(() => {
    if (isLoaded) {
      if (importData) localStorage.setItem('financial_import_data', JSON.stringify(importData));
      else localStorage.removeItem('financial_import_data');
    }
  }, [importData, isLoaded]);
  useEffect(() => { if (isLoaded) localStorage.setItem('financial_import_step', importStep); }, [importStep, isLoaded]);
  useEffect(() => { if (isLoaded) localStorage.setItem('financial_import_active_tab', activeTab); }, [activeTab, isLoaded]);

  const handleFileSelect = (payload) => { setImportData(payload); };

  const handleAddMapping = async (erpName, categoryName) => {
    if (!empresaId) {
      alert('Selecione uma empresa primeiro.');
      return;
    }

    try {
      // 1. Salvar mapeamento no Supabase
      const { data: newMap, error: mappingError } = await supabase
        .from('categoria_mappings')
        .insert([{
          empresa_id: empresaId,
          nome_erp: erpName,
          categoria_sistema: categoryName
        }])
        .select()
        .single();

      if (mappingError) {
        console.error('Erro ao salvar mapeamento:', mappingError);
      } else if (newMap) {
        setClienteMappings(prev => [...prev, newMap]);
      }

      // 2. Verificar se existe no plano de contas, se não adicionar
      const contaExistente = planoContas.find(c => 
        c.nome.toLowerCase() === erpName.toLowerCase()
      );

      if (!contaExistente) {
        const tipo = categoryName.includes('RECEITA') ? 'receita' : 'despesa';
        const prefixo = tipo === 'receita' ? '3' : '4';
        const proximoCodigo = `${prefixo}.${planoContas.filter(c => c.codigo.startsWith(prefixo)).length + 1}`;

        const { data: novaConta, error: contaError } = await supabase
          .from('plano_contas')
          .insert([{
            empresa_id: empresaId,
            codigo: proximoCodigo,
            nome: erpName,
            tipo: tipo
          }])
          .select()
          .single();

        if (!contaError && novaConta) {
          setPlanoContas(prev => [...prev, novaConta]);
        }
      }

      // 3. Atualizar status visual do item importado
      setImportData(prev => prev.map(row => {
        const accountField = Object.keys(row).find(k => 
          k.toLowerCase().includes('nome') || 
          k.toLowerCase().includes('conta') || 
          k.toLowerCase().includes('categoria') || 
          k.toLowerCase().includes('histórico')
        );
        
        const accountValue = accountField ? String(row[accountField] || '').trim() : '';
        
        if (accountValue.toLowerCase() === erpName.toLowerCase()) {
          return {
            ...row,
            __configured: true,
            __mappedCategory: categoryName
          };
        }
        return row;
      }));

    } catch (error) {
      console.error('Erro em handleAddMapping:', error);
    }
  };

  const handleSaveNewMapping = () => {
    if (!newMapping.erp || !newMapping.category) return;
    handleAddMapping(newMapping.erp, newMapping.category);
    setIsModalOpen(false);
    setNewMapping({ erp: '', category: '' });
  };

  const handleFinalImport = async () => {
    if (!importData || importData.length === 0) return;
    if (!empresaId) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      // Lógica de importação final aqui (inserir em lancamentos ou fluxo_caixa)
      // Por enquanto, apenas simulando sucesso
      setTimeout(() => {
        setIsImporting(false);
        setImportStatus({ type: 'success', message: 'Importação concluída com sucesso!' });
        setImportStep('conclusao');
      }, 2000);
    } catch (error) {
      setIsImporting(false);
      setImportStatus({ type: 'error', message: 'Erro na importação: ' + error.message });
    }
  };

  const renderConclusao = () => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center space-y-6">
      <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Importação Concluída!</h2>
        <p className="text-zinc-400">Os dados foram processados e salvos com sucesso no sistema.</p>
      </div>
      <button onClick={() => { setImportData(null); setImportStep('upload'); }} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors">
        Fazer Nova Importação
      </button>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Importação de Dados</h1>
          <p className="text-zinc-500 mt-1">Carregue seus arquivos do ERP para análise financeira</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setIsEmpresaModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-300 hover:text-white hover:border-zinc-500 transition-all">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium">{empresas.find(e => e.id === empresaId)?.nome || 'Selecionar Empresa'}</span>
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {importStep === 'upload' && (
        <div className="space-y-6">
          <UploadExcel 
            onFileSelect={handleFileSelect} 
            mappings={mappings} 
            planoContas={planoContas}
            onAddMapping={handleAddMapping}
            initialData={importData}
          />
          
          {importData && importData.length > 0 && (
            <div className="flex justify-end">
              <button 
                onClick={handleFinalImport}
                disabled={isImporting}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white rounded-lg font-bold transition-all shadow-lg shadow-green-600/20"
              >
                {isImporting ? <Loader2 className="animate-spin" /> : <ArrowRight size={20} />}
                {isImporting ? 'Processando...' : 'Finalizar Importação'}
              </button>
            </div>
          )}
        </div>
      )}

      {importStep === 'conclusao' && renderConclusao()}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Novo Mapeamento</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-zinc-400 text-xs font-semibold block mb-1">Categoria do ERP</label>
                <input type="text" value={newMapping.erp} onChange={e => setNewMapping(prev => ({ ...prev, erp: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 outline-none text-white focus:border-green-500"
                  placeholder="Ex: Venda de Mercadorias" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs font-semibold block mb-1">Categoria do Sistema</label>
                <select value={newMapping.category} onChange={e => setNewMapping(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 outline-none text-white focus:border-green-500">
                  <option value="">Selecione...</option>
                  {mappings.map(g => <option key={g.group} value={g.group}>{g.group}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-zinc-800 rounded-md border border-zinc-700 hover:bg-zinc-700 transition-colors text-zinc-300">Cancelar</button>
              <button onClick={handleSaveNewMapping} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-bold transition-colors">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {isEmpresaModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Selecionar Empresa</h2>
              <button onClick={() => setIsEmpresaModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {empresas.map(emp => (
                <button key={emp.id} onClick={() => { setEmpresaId(emp.id); setIsEmpresaModalOpen(false); }}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${empresaId === emp.id ? 'bg-green-600/10 border-green-600 text-green-500' : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>
                  <p className="font-semibold">{emp.nome}</p>
                  <p className="text-sm opacity-70">{emp.cnpj}</p>
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
