'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const S = {
  sidebar: { width: 240, minHeight: '100vh', background: '#12121a', borderRight: '1px solid #1e1e2e', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  logo: { padding: '20px 16px', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { width: 32, height: 32, background: '#00e676', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#000', fontSize: 14 },
  logoText: { fontWeight: 700, color: '#fff', fontSize: 15 },
  select: { margin: '12px', padding: '8px 10px', background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, color: '#ccc', fontSize: 13, width: 'calc(100% - 24px)' },
  nav: { flex: 1, padding: '8px 0', overflowY: 'auto' },
  navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', color: active ? '#00e676' : '#9ca3af', background: active ? 'rgba(0,230,118,0.08)' : 'transparent', borderLeft: active ? '2px solid #00e676' : '2px solid transparent', fontSize: 14, fontWeight: active ? 600 : 400, textDecoration: 'none', transition: 'all 0.15s' }),
  subItem: (active) => ({ display: 'flex', alignItems: 'center', padding: '7px 16px 7px 42px', cursor: 'pointer', color: active ? '#00e676' : '#6b7280', fontSize: 13, textDecoration: 'none', background: active ? 'rgba(0,230,118,0.05)' : 'transparent' }),
  chevron: (open) => ({ marginLeft: 'auto', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: 12 }),
  footer: { padding: '12px 16px', borderTop: '1px solid #1e1e2e' },
  logoutBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: '1px solid #2a2a3e', borderRadius: 8, color: '#9ca3af', fontSize: 13, cursor: 'pointer', width: '100%' },
}

const navItems = [
  { label: 'DRE', href: '/dashboard/dre', icon: '📊', children: [
    { label: 'DRE Geral', href: '/dashboard/dre' },
    { label: 'DRE Detalhado', href: '/dashboard/dre/detalhado' },
    { label: 'Analise', href: '/dashboard/dre/analise' },
    { label: 'Comparativo', href: '/dashboard/dre/comparativo' },
  ]},
  { label: 'Orcamento', href: '/dashboard/orcamento', icon: '📈' },
  { label: 'Fluxo de Caixa', href: '/dashboard/fluxo-caixa', icon: '💰', children: [
    { label: 'Fluxo Geral', href: '/dashboard/fluxo-caixa' },
    { label: 'Analise', href: '/dashboard/fluxo-caixa/analise' },
    { label: 'Projecao', href: '/dashboard/fluxo-caixa/projecao' },
    { label: 'Comparativo', href: '/dashboard/fluxo-caixa/comparativo' },
  ]},
  { label: 'Ciclo Financeiro', href: '/dashboard/ciclo-financeiro', icon: '🔄' },
  { label: 'Plano de Contas', href: '/dashboard/plano-contas', icon: '📋', children: [
    { label: 'Plano', href: '/dashboard/plano-contas' },
    { label: 'Auditoria', href: '/dashboard/plano-contas/auditoria' },
  ]},
  { label: 'Configuracoes', href: '/dashboard/configuracoes', icon: '⚙️', children: [
    { label: 'Perfil', href: '/dashboard/configuracoes/perfil' },
    { label: 'Empresas', href: '/dashboard/configuracoes/empresas' },
  ]},
]

export default function Sidebar({ empresa, empresas, onEmpresaChange }) {
  const pathname = usePathname()
  const router = useRouter()
  const [openMenus, setOpenMenus] = useState({ '/dashboard/dre': true })

  const toggleMenu = (href) => setOpenMenus(prev => ({ ...prev, [href]: !prev[href] }))

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={S.sidebar}>
      <div style={S.logo}>
        <div style={S.logoIcon}>F</div>
        <span style={S.logoText}>Financial Dashboard</span>
      </div>

      {empresas && empresas.length > 1 && (
        <select style={S.select} value={empresa} onChange={e => onEmpresaChange(e.target.value)}>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      )}

      <nav style={S.nav}>
        {navItems.map(item => {
          const isActive = pathname.startsWith(item.href)
          const isOpen = openMenus[item.href]
          return (
            <div key={item.href}>
              {item.children ? (
                <div style={S.navItem(isActive)} onClick={() => toggleMenu(item.href)}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                  <span style={S.chevron(isOpen)}>▾</span>
                </div>
              ) : (
                <Link href={item.href} style={S.navItem(isActive)}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )}
              {item.children && isOpen && (
                <div>
                  {item.children.map(child => (
                    <Link key={child.href} href={child.href} style={S.subItem(pathname === child.href)}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div style={S.footer}>
        <button style={S.logoutBtn} onClick={handleLogout}>
          <span>🚪</span> Sair
        </button>
      </div>
    </div>
  )
}
