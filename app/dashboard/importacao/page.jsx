'use client';

import React, { useState } from 'react';
import { 
  ArrowDownTrayIcon, 
  PlusIcon, 
  PencilSquareIcon, 
  TrashIcon,
  ChevronDownIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const ImportacaoPage = () => {
  const [activeTab, setActiveTab] = useState('mapeamento');
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowDownTrayIcon className="w-6 h-6" />
            Importação / De-Para
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Configure o mapeamento entre categorias do ERP e categorias do sistema
          </p>
        </div>
      </div>

      <div className="bg-zinc-900/50 rounded-lg p-6 mb-6 border border-zinc-800">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-lg">FACESIGN - JB DESENVOLVIMENTO EMPRESARIAL LTDA</h2>
            <p className="text-zinc-500 text-sm">CNPJ: 37.196.114/0001-69</p>
          </div>
          <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-md text-sm transition-colors">
            Selecionar Empresa
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-zinc-800">
        <button 
          onClick={() => setActiveTab('grupo')}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'grupo' ? 'text-green-500 border-b-2 border-green-500' : 'text-zinc-400 hover:text-white'}`}
        >
          Grupo de Categorias
        </button>
        <button 
          onClick={() => setActiveTab('mapeamento')}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'mapeamento' ? 'text-green-500 border-b-2 border-green-500' : 'text-zinc-400 hover:text-white'}`}
        >
          Mapeamento de Categorias
        </button>
      </div>

      <div className="flex justify-end mb-4">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm flex items-center gap-2 transition-colors active:scale-95"
        >
          <PlusIcon className="w-4 h-4" />
          Criar Mapeamento de Categoria
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Mapeamentos: {group.items.length}</span>
                <ChevronDownIcon className="w-4 h-4 text-zinc-500" />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-zinc-800/10 text-zinc-500 uppercase text-xs border-b border-zinc-800">
                    <th className="p-4 w-10">
                      <input type="checkbox" className="rounded border-zinc-700 bg-zinc-800 text-green-600 focus:ring-green-500" />
                    </th>
                    <th className="p-4 font-semibold">Categoria do ERP</th>
                    <th className="p-4 font-semibold">Categoria da OXY</th>
                    <th className="p-4 font-semibold text-center">DRE</th>
                    <th className="p-4 font-semibold text-center">Fluxo de Caixa</th>
                    <th className="p-4 font-semibold">Data da Criação</th>
                    <th className="p-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {group.items.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="p-4">
                        <input type="checkbox" className="rounded border-zinc-700 bg-zinc-800 text-green-600 focus:ring-green-500" />
                      </td>
                      <td className="p-4 text-zinc-300 font-medium">{item.erp}</td>
                      <td className="p-4 text-zinc-300">{item.oxy}</td>
                      <td className="p-4 text-center">
                        {item.dre && <span className="text-green-500">✔</span>}
                      </td>
                      <td className="p-4 text-center">
                        {item.fluxo && <span className="text-green-500">✔</span>}
                      </td>
                      <td className="p-4 text-zinc-500">{item.data}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button className="p-1.5 hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-white">
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 hover:bg-red-900/30 rounded transition-colors text-zinc-400 hover:text-red-500">
                            <TrashIcon className="w-4 h-4" />
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

      {/* Modal Simples para Criar Mapeamento */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Novo Mapeamento</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Categoria do ERP</label>
                <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 focus:ring-1 focus:ring-green-500 outline-none" placeholder="Ex: Venda de Mercadorias" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Categoria OXY</label>
                <select className="w-full bg-zinc-800 border border-zinc-700 rounded-md p-2 focus:ring-1 focus:ring-green-500 outline-none">
                  <option>Receita de Serviços</option>
                  <option>Receita de Produtos</option>
                  <option>Deduções</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-md transition-colors">
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
