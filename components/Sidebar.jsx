'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  BarChart2, TrendingUp, DollarSign, RefreshCw,
  BookOpen, Settings, ChevronDown, ChevronRight,
  LogOut, Building2
} from 'lucide-react'

const navItems = [
  {
    label: 'DRE',
    icon: BarChart2,
    href: '/dashboard/dre',
    children: [
      { label: 'DRE Geral', href: '/dashboard/dre' },
      { label: 'DRE Detalhado', href: '/dashboard/dre/detalhado' },
      { label: 'Analise', href: '/dashboard/dre/analise' },
      { label: 'Comparativo', href: '/dashboard/dre/comparativo' },
    ]
  },
  {
    label: 'Orcamento',
    icon: TrendingUp,
    href: '/dashboard/orcamento',
  },
  {
    label: 'Fluxo de Caixa',
    icon: DollarSign,
    href: '/dashboard/fluxo-caixa',
    children: [
      { label: 'Fluxo Geral', href: '/dashboard/fluxo-caixa' },
      { label: 'Analise', href: '/dashboard/fluxo-caixa/analise' },
      { label: 'Projecao', href: '/dashboard/fluxo-caixa/projecao' },
      { label: 'Comparativo', href: '/dashboard/fluxo-caixa/comparativo' },
    ]
  },
  {
    label: 'Ciclo Financeiro',
    icon: RefreshCw,
    href: '/dashboard/ciclo-financeiro',
  },
  {
    label: 'Plano de Contas',
    icon: BookOpen,
    href: '/dashboard/plano-contas',
    children: [
      { label: 'Plano', href: '/dashboard/plano-contas' },
      { label: 'Auditoria', href: '/dashboard/plano-contas/auditoria' },
    ]
  },
  {
    label: 'Configuracoes',
    icon: Settings,
    href: '/dashboard/configuracoes',
    children: [
      { label: 'Perfil', href: '/dashboard/configuracoes/perfil' },
      { label: 'Empresas', href: '/dashboard/configuracoes/empresas' },
    ]
  },
]

export default function Sidebar({ empresa, empresas = [], onEmpresaChange }) {
  const pathname = usePathname()
  const router = useRouter()
  const [expanded, setExpanded] = useState({ DRE: true })

  const toggle = (label) => setExpanded(prev => ({ ...prev, [label]: !prev[label] }))

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <aside className="w-60 min-h-screen bg-[#0d0d14] border-r border-gray-800 flex flex-col">
      <div className="px-4 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-500 rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-xs">F</span>
          </div>
          <span className="text-white font-semibold text-sm">Financial Dashboard</span>
        </div>
      </div>

      {empresas.length > 0 && (
        <div className="px-3 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-1.5">
            <Building2 size={12} className="text-gray-400" />
            <span className="text-gray-400 text-xs">Empresa</span>
          </div>
          <select
            value={empresa}
            onChange={(e) => onEmpresaChange(e.target.value)}
            className="w-full bg-[#1a1a24] border border-gray-700 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500"
          >
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
          const isOpen = expanded[item.label]

          return (
            <div key={item.label}>
              {item.children ? (
                <button
                  onClick={() => toggle(item.label)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={15} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </Link>
              )}
              {item.children && isOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {item.children.map(child => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        pathname === child.href ? 'text-emerald-400 bg-emerald-600/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <span className="w-1 h-1 rounded-full bg-current" />
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={15} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}
