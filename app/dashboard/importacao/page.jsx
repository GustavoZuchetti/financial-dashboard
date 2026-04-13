'use client';
import React, { useState } from 'react';
import {
  Download,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  X
} from 'lucide-react';
import UploadExcel from '@/components/UploadExcel';

const ImportacaoPage = () => {
  const [activeTab, setActiveTab] = useState('grupo');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [mappings, setMappings] = useState([
    {
      group: 'RECEITA BRUTA',
      type: 'Receita Bruta',
      items: [
        { id: 1, erp: 'Receita de Serviços', oxy: 'Receita de Serviços', dre: true, fluxo: true, data: '30/01/2025' },
        { id: 2, erp: 'Receita de Produtos', oxy: 'Receita de Produtos', dre: true, fluxo: true, data: '23/07/2025' },
      ]
    },
    {
      group: 'OUTROS RECEBIMENTOS',
      type: 'Receita Bruta',
      items: [
        { id: 3, erp: 'Devoluções de Pagamentos', oxy: 'Devoluções de Pagamentos', dre: true, fluxo: true, data: '20/03/2025' },
      ]
    },
    {
      group: 'IMPOSTOS SOBRE RECEITA',
      type: 'Deduções',
      items: [
        { id: 4, erp: 'COFINS', oxy: 'COFINS', dre: true, fluxo: false, data: '15/02/2025' },
        { id: 5, erp: 'PIS', oxy: 'PIS', dre: true, fluxo: false, data: '15/02/2025' },
        { id: 6, erp: 'ISS', oxy: 'ISS', dre: true, fluxo: true, data: '15/02/2025' },
      ]
    }
  ]);

  return (
    <div className="p-6 bg-zinc-950 min-h-screen text-white">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Download className="w-6 h-6" />
          Importação / De-Para
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Configure o mapeamento entre categorias do ERP e categorias do sistema
        </p>
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

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-zinc-800">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('grupo')}
              className={`pb-3 px-2 text-sm font-medium transition-all relative ${
                activeTab === 'grupo'
                  ? 'text-green-500'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Grupo de Categorias
              {activeTab === 'grupo' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('mapeamento')}
              className={`pb-3 px-2 text-sm font-medium transition-all relative ${
                activeTab === 'mapeamento'
                  ? 'text-green-500'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Mapeamento de Categorias
              {activeTab === 'mapeamento' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tab: Grupo de Categorias - Importar XLSX */}
      {activeTab === 'grupo' && (
        <div>
          <UploadExcel onFileSelect={(file) => console.log('Arquivo selecionado:', file)} />
        </div>
      )}

      {/* Tab: Mapeamento de Categorias */}
      {activeTab === 'mapeamento' && (
        <div>
          {/* Create Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm flex items-center gap-2 transition-colors active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Criar Mapeamento de Categoria
            </button>
          </div>

          {/* Mappings */}
          <div className="space-y-6">
            {mappings.map((group, gIdx) => (
              <div key={gIdx} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                {/* Group Header */}
                <div className="p-4 bg-zinc-800/30 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-zinc-200">{group.group}</h3>
                    <p className="text-xs text-zinc-500">Tipo: {group.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Mapeamentos: {group.items.length}</span>
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-zinc-800/20 text-zinc-400 uppercase text-xs">
                        <th className="p-3 font-medium w-12">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0 focus:ring-offset-zinc-900"
                          />
                        </th>
                        <th className="p-3 font-medium">Categoria do ERP</th>
                        <th className="p-3 font-medium">Categoria da OXY</th>
                        <th className="p-3 font-medium text-center">DRE</th>
                        <th className="p-3 font-medium text-center">Fluxo de Caixa</th>
                        <th className="p-3 font-medium">Data da Criação</th>
                        <th className="p-3 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {group.items.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0 focus:ring-offset-zinc-900"
                            />
                          </td>
                          <td className="p-3 text-zinc-200 font-medium">{item.erp}</td>
                          <td className="p-3 text-zinc-300">{item.oxy}</td>
                          <td className="p-3 text-center">
                            {item.dre && <span className="text-green-500 text-base">✓</span>}
                          </td>
                          <td className="p-3 text-center">
                            {item.fluxo && <span className="text-green-500 text-base">✓</span>}
                          </td>
                          <td className="p-3 text-zinc-400">{item.data}</td>
                          <td className="p-3">
                            <div className="flex justify-end gap-1">
                              <button className="p-2 hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-white">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button className="p-2 hover:bg-red-900/30 rounded transition-colors text-zinc-400 hover:text-red-400">
                                <Trash2 className="w-4 h-4" />
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
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Novo Mapeamento</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Categoria do ERP</label>
                <input
                  type="text"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none text-white"
                  placeholder="Ex: Venda de Mercadorias"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Categoria OXY</label>
                <select className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none text-white">
                  <option>Receita de Serviços</option>
                  <option>Receita de Produtos</option>
                  <option>Deduções</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-md transition-colors border border-zinc-700"
                >
                  Cancelar
                </button>
                <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition-colors">
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportacaoPage;
