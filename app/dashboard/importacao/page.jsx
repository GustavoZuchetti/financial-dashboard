'use client';
import React, { useState, useEffect } from 'react';
import { Download, Plus, Pencil, Trash2, ChevronDown, X, CheckCircle2, AlertCircle, ArrowRight, Loader2, Settings2, Database, Wallet } from 'lucide-react';
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
  const [importTarget, setImportTarget] = useState('dre'); // 'dre' | 'fluxo'
  
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

      const { data: categoriaMappings } = await supabase.from('categoria_mappings').select('*');
      if (categoriaMappings) {
        setClienteMappings(categoriaMappings);
      }

      const { data: plano } = await supabase.from('plano_contas').select('*').order('codigo');
      if (plano) {
        setPlanoContas(plano);
      }

      const savedImportData = localStorage.getItem('financial_import_data');
      if (savedImportData) { try { setImportData(JSON.parse(savedImportData)); } catch (e) {} }

      const savedStep = localStorage.getItem('financial_import_step');
      if (savedStep) setImportStep(savedStep);

      const savedTarget = localStorage.getItem('financial_import_target');
      if (savedTarget) setImportTarget(savedTarget);

      setIsLoaded(true);
    };
    loadSavedState();
  }, []);

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
  useEffect(() => { if (isLoaded) localStorage.setItem('financial_import_target', importTarget); }, [importTarget, isLoaded]);

  const handleFileSelect = (payload) => { setImportData(payload); };

  const handleAddMapping = async (erpName, categoryName) => {
    if (!empresaId) {
      alert('Selecione uma empresa primeiro.');
      return;
    }

    try {
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
      const table = importTarget === 'dre' ? 'lancamentos' : 'fluxo_caixa';
      
      const records = importData.map(row => {
        const accountField = Object.keys(row).find(k => 
          k.toLowerCase().includes('nome') || 
          k.toLowerCase().includes('conta') || 
          k.toLowerCase().includes('categoria') || 
          k.toLowerCase().includes('histórico')
        );
        const descField = Object.keys(row).find(k => k.toLowerCase().includes('descrição') || k.toLowerCase().includes('histórico')) || accountField;
        const dateField = Object.keys(row).find(k => k.toLowerCase().includes('data') || k.toLowerCase().includes('competência'));
        const valueField = Object.keys(row).find(k => k.toLowerCase().includes('valor') || k.toLowerCase().includes('total'));

        const valorRaw = String(row[valueField] || '0').replace(/\./g, '').replace(',', '.');
        const valor = Math.abs(parseFloat(valorRaw));
        
        // Determinar tipo baseado na categoria mapeada ou valor
        let tipo = 'despesa';
        if (row.__mappedCategory?.includes('RECEITA')) {
          tipo = importTarget === 'dre' ? 'receita' : 'entrada';
        } else {
          tipo = importTarget === 'dre' ? 'despesa' : 'saida';
        }

        // Formatar data para YYYY-MM-DD
        let dataStr = row[dateField] || new Date().toISOString().split('T')[0];
        if (dataStr.includes('/')) {
          const [d, m, y] = dataStr.split('/');
          dataStr = `${y}-${m}-${d}`;
        }

        return {
          empresa_id: empresaId,
          data: dataStr,
          descricao: row[descField] || 'Importação Excel',
          valor: valor,
          tipo: tipo,
          categoria: row.__mappedCategory || 'Não Classificado'
        };
      });

      // Inserir em lotes de 100
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error } = await supabase.from(table).insert(batch);
        if (error) throw error;
      }

      setIsImporting(false);
      setImportStatus({ type: 'success', message: `Importação para ${importTarget.toUpperCase()} concluída com sucesso!` });
      setImportStep('conclusao');
      localStorage.removeItem('financial_import_data');
    } catch (error) {
      console.error('Erro na importação:', error);
      setIsImporting(false);
      setImportStatus({ type: 'error', message: 'Erro na importação: ' + error.message });
    }
  };

  const renderConclusao = () => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center space-y-6">
      <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10 text-blue-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Importação Concluída!</h2>
        <p className="text-zinc-400">Os dados foram processados e salvos na tabela de <strong>{importTarget === 'dre' ? 'DRE (Lançamentos)' : 'Fluxo de Caixa'}</strong>.</p>
      </div>
      <button onClick={() => { setImportData(null); setImportStep('upload'); }} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors">
        Fazer Nova Importação
      </button>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Importação / De-Para</h1>
          <p className="text-zinc-500 mt-1">Configure e importe seus dados financeiros</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setIsEmpresaModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-300 hover:text-white hover:border-zinc-500 transition-all">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-sm font-medium">{empresas.find(e => e.id === empresaId)?.nome || 'Selecionar Empresa'}</span>
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {importStep === 'upload' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              onClick={() => setImportTarget('dre')}
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${importTarget === 'dre' ? 'bg-blue-600/10 border-blue-600' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${importTarget === 'dre' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                <Database size={24} />
              </div>
              <div>
                <h3 className={`font-bold ${importTarget === 'dre' ? 'text-white' : 'text-zinc-400'}`}>Importar para DRE</h3>
                <p className="text-xs text-zinc-500">Os dados alimentarão a tabela de Lançamentos</p>
              </div>
            </div>

            <div 
              onClick={() => setImportTarget('fluxo')}
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${importTarget === 'fluxo' ? 'bg-blue-600/10 border-blue-600' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${importTarget === 'fluxo' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                <Wallet size={24} />
              </div>
              <div>
                <h3 className={`font-bold ${importTarget === 'fluxo' ? 'text-white' : 'text-zinc-400'}`}>Importar para Fluxo de Caixa</h3>
                <p className="text-xs text-zinc-500">Os dados alimentarão a tabela de Fluxo de Caixa</p>
              </div>
            </div>
          </div>

          <UploadExcel 
            onFileSelect={handleFileSelect} 
            mappings={mappings} 
            planoContas={planoContas}
            onAddMapping={handleAddMapping}
            initialData={importData}
          />
          
          {importStatus && importStatus.type === 'error' && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {importStatus.message}
            </div>
          )}

          {importData && importData.length > 0 && (
            <div className="flex justify-end">
              <button 
                onClick={handleFinalImport}
                disabled={isImporting}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg font-bold transition-all shadow-lg shadow-blue-600/20"
              >
                {isImporting ? <Loader2 className="animate-spin" /> : <ArrowRight size={20} />}
                {isImporting ? 'Processando...' : `Finalizar Importação para ${importTarget === 'dre' ? 'DRE' : 'Fluxo'}`}
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 outline-none text-white focus:border-blue-500"
                  placeholder="Ex: Venda de Mercadorias" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs font-semibold block mb-1">Categoria do Sistema</label>
                <select value={newMapping.category} onChange={e => setNewMapping(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 outline-none text-white focus:border-blue-500">
                  <option value="">Selecione...</option>
                  {mappings.map(g => <option key={g.group} value={g.group}>{g.group}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-zinc-800 rounded-md border border-zinc-700 hover:bg-zinc-700 transition-colors text-zinc-300">Cancelar</button>
              <button onClick={handleSaveNewMapping} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold transition-colors">Salvar</button>
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
                  className={`w-full text-left p-4 rounded-lg border transition-all ${empresaId === emp.id ? 'bg-blue-600/10 border-blue-600 text-blue-500' : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>
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
