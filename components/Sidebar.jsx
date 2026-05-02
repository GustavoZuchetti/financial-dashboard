'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const S = {
  sidebar: { width: 240, minHeight: '100vh', background: '#12121a', borderRight: '1px solid #1e1e2e', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  logo: { padding: '20px 16px', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { width: 32, height: 32, background: '#3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#000', fontSize: 14 },
  logoText: { fontWeight: 700, color: '#fff', fontSize: 15 },
  selectContainer: { padding: '12px', borderBottom: '1px solid #1e1e2e' },
  selectLabel: { fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px', display: 'block', paddingLeft: '4px' },
  select: { padding: '8px 10px', background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, color: '#fff', fontSize: 13, width: '100%', outline: 'none', cursor: 'pointer' },
  nav: { flex: 1, padding: '8px 0', overflowY: 'auto' },
  navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', color: active ? '#3b82f6' : '#9ca3af', background: active ? 'rgba(59,130,246,0.08)' : 'transparent', borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent', fontSize: 14, fontWeight: active ? 600 : 400, textDecoration: 'none', transition: 'all 0.15s' }),
  subItem: (active) => ({ display: 'flex', alignItems: 'center', padding: '7px 16px 7px 42px', cursor: 'pointer', color: active ? '#3b82f6' : '#6b7280', fontSize: 13, textDecoration: 'none', background: active ? 'rgba(59,130,246,0.05)' : 'transparent' }),
  chevron: (open) => ({ marginLeft: 'auto', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: 12 }),
  footer: { padding: '16px', borderTop: '1px solid #1e1e2e', background: '#0a0a0f' },
  userSection: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  userAvatar: { width: '32px', height: '32px', borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#fff', fontWeight: 'bold' },
  userInfo: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  userName: { fontSize: '12px', color: '#fff', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  logoutBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, color: '#f87171', fontSize: 12, cursor: 'pointer', width: '100%', fontWeight: '600', transition: 'all 0.2s' },
}

const navItems = [
  { label: 'Demonstrativos', href: '/dashboard/dre', icon: '📊', children: [
    { label: 'Geral', href: '/dashboard/dre' },
    { label: 'Detalhado', href: '/dashboard/dre/detalhado' },
    { label: 'Análise', href: '/dashboard/dre/analise' },
    { label: 'Comparativo', href: '/dashboard/dre/comparativo' },
  ]},
  { label: 'Orçamento', href: '/dashboard/orcamento', icon: '📈' },
  { label: 'Fluxo de Caixa', href: '/dashboard/fluxo-caixa', icon: '💰', children: [
    { label: 'Fluxo Geral', href: '/dashboard/fluxo-caixa' },
    { label: 'Análise', href: '/dashboard/fluxo-caixa/analise' },
  ]},
  { label: 'Ciclo Financeiro', href: '/dashboard/ciclo-financeiro', icon: '🔄' },
  { label: 'Plano de Contas', href: '/dashboard/plano-contas', icon: '📋' },
  { label: 'Importação / De-Para', href: '/dashboard/importacao', icon: '📥' },
  { label: 'Configurações', href: '/dashboard/configuracoes', icon: '⚙️', children: [
    { label: 'Empresas', href: '/dashboard/configuracoes' },
  ]},
]

export default function Sidebar({ empresa, empresas, onEmpresaChange }) {
  const pathname = usePathname()
  const router = useRouter()
  const [openMenus, setOpenMenus] = useState({ '/dashboard/dre': true })
  const [userEmail, setUserEmail] = useState('')

  useState(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) setUserEmail(session.user.email)
    }
    getUser()
  }, [])

  const toggleMenu = (href) => setOpenMenus(prev => ({ ...prev, [href]: !prev[href] }))

  const handleLogout = async () => {
    if (confirm('Deseja realmente sair do sistema?')) {
      await supabase.auth.signOut()
      router.push('/')
    }
  }

  const getEmpresaLabel = () => {
    if (empresa === 'todas') return 'Todas as Empresas (Consolidado)'
    return empresas.find(e => e.id === empresa)?.nome || 'Selecione'
  }

  return (
    <div style={S.sidebar}>
      <div style={S.logo}>
        <div style={S.logoIcon}>F</div>
        <span style={S.logoText}>Financial Dashboard</span>
      </div>

      <div style={S.selectContainer}>
        <label style={S.selectLabel}>Empresa / Grupo</label>
        <select style={S.select} value={empresa || ''} onChange={e => onEmpresaChange(e.target.value)}>
          {empresas.length === 0 && <option value="">Nenhuma empresa</option>}
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          {empresas.length > 1 && <option value="todas">📊 Todas as Empresas (Consolidado)</option>}
        </select>
        {empresa === 'todas' && (
          <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '6px', padding: '4px 6px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', textAlign: 'center' }}>
            Visão Consolidada
          </div>
        )}
      </div>

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
        <div style={S.userSection}>
          <div style={S.userAvatar}>{userEmail.substring(0, 1).toUpperCase()}</div>
          <div style={S.userInfo}>
            <span style={S.userName}>{userEmail.split('@')[0]}</span>
          </div>
        </div>
        <button style={S.logoutBtn} onClick={handleLogout}>
          <span>🚪</span> Sair do Sistema
        </button>
      </div>
    </div>
  )
}
