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
  const [clienteMappings, setClienteMappings] = useState({});
  const [planoContas, setPlanoContas] = useState([]);
  const [mappings, setMappings] = useState([
    { group: 'RECEITA BRUTA', type: 'receita', items: [
      { id: 1, erp: 'Receita de Serviços', categoria: 'Receita de Serviços', dre: true, fluxo: true },
      { id: 2, erp: 'Receita de Produtos', categoria: 'Receita de Produtos', dre: true, fluxo: true },
    ]},
    { group: 'OUTROS RECEBIMENTOS', type: 'receita', items: [
      { id: 3, erp: 'Devoluções de Pagamentos', categoria: 'Devoluções de Pagamentos', dre: true, fluxo: true },
    ]},
    { group: 'IMPOSTOS SOBRE RECEITA', type: 'despesa', items: [
      { id: 4, erp: 'COFINS', categoria: 'COFINS', dre: true, fluxo: false },
      { id: 5, erp: 'PIS', categoria: 'PIS', dre: true, fluxo: false },
      { id: 6, erp: 'ISS', categoria: 'ISS', dre: true, fluxo: true },
    ]}
  ]);

  useEffect(() => {
    const loadSavedState = async () => {
      const savedEmpresaId = localStorage.getItem('empresa_id');
      if (savedEmpresaId) setEmpresaId(savedEmpresaId);
      else {
        const { data: list } = await supabase.from('empresas').select('id').limit(1);
        if (list?.length > 0) setEmpresaId(list[0].id);
      }

      const savedMappings = localStorage.getItem('financial_mappings');
      if (savedMappings) { try { setMappings(JSON.parse(savedMappings)); } catch (e) {} }

      const savedImportData = localStorage.getItem('financial_import_data');
      if (savedImportData) { try { setImportData(JSON.parse(savedImportData)); } catch (e) {} }

      const savedStep = localStorage.getItem('financial_import_step');
      if (savedStep) setImportStep(savedStep);

      const savedTab = localStorage.getItem('financial_import_active_tab');
      if (savedTab) setActiveTab(savedTab);

      const savedClientes = localStorage.getItem('financial_cliente_mappings');
      if (savedClientes) { try { setClienteMappings(JSON.parse(savedClientes)); } catch (e) {} }

      const { data: allEmpresas } = await supabase.from('empresas').select('*').order('nome');
      if (allEmpresas) setEmpresas(allEmpresas);

      // Carregar Plano de Contas do Supabase
      const { data: plano } = await supabase.from('plano_contas').select('*').order('codigo');
      if (plano) setPlanoContas(plano);

          // Carregar mapeamentos salvos de categoria_mappings
    const { data: savedMappings } = await supabase
      .from('categoria_mappings')
      .select('*')
      .eq('empresa_id', empresaId);
    if (savedMappings && savedMappings.length > 0) {
      setClienteMappings(savedMappings);
    }

      setIsLoaded(true);
    };
    loadSavedState();
  }, []);

  useEffect(() => { if (isLoaded && empresaId) localStorage.setItem('empresa_id', empresaId); }, [empresaId, isLoaded]);
  useEffect(() => { if (isLoaded) localStorage.setItem('financial_mappings', JSON.stringify(mappings)); }, [mappings, isLoaded]);
  useEffect(() => {
    if (isLoaded) {
      if (importData) localStorage.setItem('financial_import_data', JSON.stringify(importData));
      else localStorage.removeItem('financial_import_data');
    }
  }, [importData, isLoaded]);
  useEffect(() => { if (isLoaded) localStorage.setItem('financial_import_step', importStep); }, [importStep, isLoaded]);
  useEffect(() => { if (isLoaded) localStorage.setItem('financial_import_active_tab', activeTab); }, [activeTab, isLoaded]);
  useEffect(() => { if (isLoaded) localStorage.setItem('financial_cliente_mappings', JSON.stringify(clienteMappings)); }, [clienteMappings, isLoaded]);

  const clientesDoArquivo = React.useMemo(() => {
    if (!importData || !Array.isArray(importData)) return [];
    const nomes = new Set();
    importData.forEach(row => {
      const key = Object.keys(row).find(k =>
        k.toLowerCase().includes('nome') || k.toLowerCase().includes('cliente') ||
        k.toLowerCase().includes('conta') || k.toLowerCase().includes('categoria') ||
        k.toLowerCase().includes('histórico')
      );
      const val = key ? String(row[key] || '').trim() : '';
      if (val) nomes.add(val);
    });
    return Array.from(nomes);
  }, [importData]);

  const handleFileSelect = (payload) => { setImportData(payload); };

    const handleAddMapping = async (erpName, categoryName) => {
    try {
      // 1. Salvar mapeamento no Supabase
      const { data: newMapping, error: mappingError } = await supabase
        .from('categoria_mappings')
        .insert([{
          empresa_id: empresaId,
          nome_erp: erpName,
          categoria_sistema: categoryName,
          criado_em: new Date().toISOString()
        }])
        .select()
        .single();

      if (mappingError) {
        console.error('Erro ao salvar mapeamento:', mappingError);
        // Continua mesmo com erro - atualiza apenas localmente
      }

      // 2. Verificar se existe no plano de contas, se não adicionar
      const contaExistente = planoContas.find(c => 
        c.nome.toLowerCase() === erpName.toLowerCase()
      );

      if (!contaExistente) {
        // Gerar código automático baseado na categoria
        const tipo = categoryName.includes('RECEITA') ? 'receita' : 'despesa';
        const prefixo = tipo === 'receita' ? '3' : '4';
        const proximoCodigo = `${prefixo}.${planoContas.filter(c => c.codigo.startsWith(prefixo)).length + 1}`;

        const { data: novaConta, error: contaError } = await supabase
          .from('plano_contas')
          .insert([{
            codigo: proximoCodigo,
            nome: erpName,
            tipo: tipo,
            ativo: true,
            criado_em: new Date().toISOString()
          }])
          .select()
          .single();

        if (!contaError && novaConta) {
          setPlanoContas(prev => [...prev, novaConta]);
        }
      }

      // 3. Atualizar estado local de mappings
      setMappings(prev => prev.map(group => {
        if (group.group === categoryName) {
          return { 
            ...group, 
            items: [...group.items, { 
              id: Date.now(), 
              erp: erpName, 
              categoria: erpName, 
              dre: true, 
              fluxo: true, 
              data: new Date().toLocaleDateString('pt-BR') 
            }]
          };
        }
        return group;
      }));

      // 4. Forçar revalidação dos dados importados
      if (importData && Array.isArray(importData)) {
        const revalidated = importData.map(row => {
          const accountField = Object.keys(row).find(k => 
            k.toLowerCase().includes('nome') || 
            k.toLowerCase().includes('conta') || 
            k.toLowerCase().includes('categoria') || 
            k.toLowerCase().includes('histórico')
          );
          const accountValue = accountField ? String(row[accountField] || '').trim() : '';
          
          // Revalidar usando a função validateRow do UploadExcel
          return {
            ...row,
            __validation: {
              isValid: accountValue !== '',
              errors: accountValue === '' ? ['Nome/Conta ausente'] : [],
              accountValue
            }
          };
        });
        setImportData(revalidated);
      }

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

  const handleDeleteMapping = (groupId, itemId) => {
    setMappings(prev => prev.map(group =>
      group.group === groupId ? { ...group, items: group.items.filter(item => item.id !== itemId) } : group
    ));
  };

  const handleSaveClienteMapping = (nomeCliente, contaContabil, tipo) => {
    setClienteMappings(prev => ({ ...prev, [nomeCliente]: { contaContabil, tipo } }));
  };

  const handleFinalImport = async () => {
    if (!importData || !Array.isArray(importData) || importData.length === 0) {
      setImportStatus({ type: 'error', message: 'Nenhum dado para importar. Volte e carregue um arquivo.' });
      return;
    }
    if (!empresaId) {
      setImportStatus({ type: 'error', message: 'Empresa não identificada. Selecione a empresa antes de importar.' });
      return;
    }
    setIsImporting(true);
    setImportStatus(null);
    try {
      const registros = importData
        .filter(row => row.__validation?.isValid)
        .map(row => {
          const clienteKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('nome') || k.toLowerCase().includes('cliente') ||
            k.toLowerCase().includes('conta') || k.toLowerCase().includes('categoria') ||
            k.toLowerCase().includes('histórico')
          );
          const nomeCliente = clienteKey ? String(row[clienteKey] || '').trim() : '';
          const mapping = clienteMappings[nomeCliente] || {};
          const dataKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('data') || k.toLowerCase().includes('competência') || k.toLowerCase().includes('liquidação')
          );
          const valorRaw = row['Valor'] || row['valor'] || row['Valor Pago/Recebido'] || row['Total'] || 0;
          const valor = parseFloat(String(valorRaw).replace(/\./g, '').replace(',', '.')) || 0;
          return {
            empresa_id: empresaId,
            nome_conta_erp: nomeCliente,
            conta_contabil: mapping.contaContabil || null,
            tipo: mapping.tipo || null,
            valor,
            data_lancamento: dataKey ? row[dataKey] : null,
            dados_brutos: JSON.stringify(row),
            importado_em: new Date().toISOString(),
          };
        });

      if (registros.length === 0) {
        setImportStatus({ type: 'error', message: 'Nenhum registro válido para importar. Corrija os erros de mapeamento primeiro.' });
        setIsImporting(false);
        return;
      }

      const { error } = await supabase.from('lancamentos').insert(registros);
      if (error) throw error;

      setImportStatus({ type: 'success', message: `Importação concluída! ${registros.length} lançamentos gravados com sucesso.` });
      setImportData(null);
      setClienteMappings({});
      setImportStep('upload');
    } catch (error) {
      console.error('Erro na importação:', error);
      setImportStatus({ type: 'error', message: `Erro ao importar: ${error.message || 'Verifique o console para detalhes.'}` });
    } finally {
      setIsImporting(false);
    }
  };

  const selectedEmpresa = empresas.find(e => e.id === empresaId);

  const renderConclusao = () => {
    const totalRegistros = importData?.length || 0;
    const validos = importData?.filter(r => r.__validation?.isValid).length || 0;
    const invalidos = totalRegistros - validos;
    const totalValor = importData
      ?.filter(r => r.__validation?.isValid)
      .reduce((acc, row) => {
        const valorRaw = row['Valor'] || row['valor'] || row['Valor Pago/Recebido'] || row['Total'] || 0;
        return acc + (parseFloat(String(valorRaw).replace(/\./g, '').replace(',', '.')) || 0);
      }, 0) || 0;

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white">Conclusão da Importação</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-white">{totalRegistros}</p>
            <p className="text-zinc-400 text-sm mt-1">Total de Registros</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-400">{validos}</p>
            <p className="text-zinc-400 text-sm mt-1">Válidos</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-red-400">{invalidos}</p>
            <p className="text-zinc-400 text-sm mt-1">Com Erro</p>
          </div>
        </div>

        <div className="bg-zinc-800 rounded-xl p-4 flex justify-between items-center">
          <span className="text-zinc-400 text-sm font-medium">Valor Total a Importar</span>
          <span className="text-green-400 text-2xl font-bold">
            {totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        {clientesDoArquivo.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Settings2 size={16} className="text-green-400" />
              Configuração de Clientes → Plano de Contas
            </h3>
            <p className="text-zinc-500 text-xs">Associe cada cliente/conta do arquivo a uma conta contábil para que o lançamento apareça no Plano de Contas.</p>
            <div className="space-y-2">
              {clientesDoArquivo.map(nome => (
                <div key={nome} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3">
                  <span className="flex-1 text-zinc-300 text-sm truncate">{nome}</span>
                  <input
                    type="text"
                    placeholder="Código (ex: 3.1.1)"
                    className="w-32 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-green-500"
                    value={clienteMappings[nome]?.contaContabil || ''}
                    onChange={e => handleSaveClienteMapping(nome, e.target.value, clienteMappings[nome]?.tipo || 'receita')}
                  />
                  <select
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-green-500"
                    value={clienteMappings[nome]?.tipo || 'receita'}
                    onChange={e => handleSaveClienteMapping(nome, clienteMappings[nome]?.contaContabil || '', e.target.value)}
                  >
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                  </select>
                  {clienteMappings[nome]?.contaContabil ? (
                    <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-yellow-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {importStatus && (
          <div className={`flex items-center gap-3 p-4 rounded-xl ${importStatus.type === 'success' ? 'bg-green-600/10 border border-green-600/20 text-green-400' : 'bg-red-600/10 border border-red-600/20 text-red-400'}`}>
            {importStatus.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-medium">{importStatus.message}</span>
          </div>
        )}

        {invalidos > 0 && (
          <div className="flex items-center gap-2 bg-yellow-600/10 border border-yellow-600/20 text-yellow-400 p-4 rounded-xl text-sm">
            <AlertCircle size={16} />
            <span>{invalidos} registro(s) com erro não serão importados. Volte e corrija os mapeamentos se necessário.</span>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={() => setImportStep('upload')}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={handleFinalImport}
            disabled={isImporting || validos === 0}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
          >
            {isImporting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            {isImporting ? 'Importando...' : `Concluir Importação (${validos} registros)`}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Importação / De-Para</h1>
        <p className="text-zinc-400 text-sm mt-1">Configure o mapeamento entre categorias do ERP e categorias do sistema</p>
      </div>

      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div>
          <p className="text-white font-semibold">{selectedEmpresa ? selectedEmpresa.nome : 'Carregando empresa...'}</p>
          <p className="text-zinc-500 text-sm">{selectedEmpresa?.cnpj || 'Buscando informações...'}</p>
        </div>
        <button onClick={() => setIsEmpresaModalOpen(true)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Selecionar Empresa
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {['upload', 'conclusao'].map((step, idx) => (
          <React.Fragment key={step}>
            {idx > 0 && <ArrowRight size={14} className="text-zinc-600" />}
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${importStep === step ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
              {step === 'upload' ? '1. Upload e Validação' : '2. Conclusão'}
            </span>
          </React.Fragment>
        ))}
      </div>

      {importStep === 'upload' && (
        <div className="space-y-4">
          <div className="flex gap-6 border-b border-zinc-800">
            <button onClick={() => setActiveTab('grupo')} className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'grupo' ? 'text-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
              Grupo de Categorias {activeTab === 'grupo' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded" />}
            </button>
            <button onClick={() => setActiveTab('mapeamento')} className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'mapeamento' ? 'text-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
              Mapeamento de Categorias {activeTab === 'mapeamento' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded" />}
            </button>
          </div>

          <UploadExcel
            onFileSelect={handleFileSelect}
            mappings={mappings}
            planoContas={planoContas}
            onAddMapping={handleAddMapping}
            initialData={importData}
          />

          {importData && Array.isArray(importData) && importData.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setImportStep('conclusao')}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
              >
                Próximo: Conclusão <ArrowRight size={16} />
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
