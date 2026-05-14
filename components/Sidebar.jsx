'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { COLORS, TRANSITION } from '@/lib/design-tokens'
import ThemeToggle from '@/components/ThemeToggle'

// ─── Ícones SVG inline ──────────────────────────────────────────────────────────
const Icon = ({ path, size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {path.split(' M').map((p, i) => (
      <path key={i} d={i === 0 ? p : 'M' + p} />
    ))}
  </svg>
)

const ICONS = {
  dre:       'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  orcamento: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  fluxo:     'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
  ciclo:     'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  plano:     'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 002 2h2a2 2 0 002-2 M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  importacao:'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  config:    'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  overview:  'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  chevron:   'M19 9l-7 7-7-7',
  logout:    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
}

const navItems = [
  { label: 'Overview', href: '/dashboard/overview', icon: 'overview' },
  { label: 'Demonstrativos', href: '/dashboard/dre', icon: 'dre', children: [
    { label: 'Visão Geral',   href: '/dashboard/dre' },
    { label: 'Detalhado',     href: '/dashboard/dre/detalhado' },
    { label: 'Análise',       href: '/dashboard/dre/analise' },
    { label: 'Comparativo',   href: '/dashboard/dre/comparativo' },
  ]},
  { label: 'Orçamento',       href: '/dashboard/orcamento',       icon: 'orcamento' },
  { label: 'Fluxo de Caixa',  href: '/dashboard/fluxo-caixa',     icon: 'fluxo', children: [
    { label: 'Gestão',        href: '/dashboard/fluxo-caixa/gestao', adminOnly: true },
    { label: 'Visão Geral',   href: '/dashboard/fluxo-caixa' },
    { label: 'Análise',       href: '/dashboard/fluxo-caixa/analise' },
    { label: 'Comparativo',   href: '/dashboard/fluxo-caixa/comparativo' },
    { label: 'Projeção',      href: '/dashboard/fluxo-caixa/projecao' },
  ]},
  { label: 'Ciclo Financeiro', href: '/dashboard/ciclo-financeiro', icon: 'ciclo' },
  { label: 'Plano de Contas',  href: '/dashboard/plano-contas',     icon: 'plano' },
  { label: 'Importação',       href: '/dashboard/importacao',       icon: 'importacao' },
  { label: 'Configurações',    href: '/dashboard/configuracoes',    icon: 'config', children: [
    { label: 'Empresas',      href: '/dashboard/configuracoes' },
    { label: 'Perfil',        href: '/dashboard/configuracoes/perfil' },
  ]},
]

export default function Sidebar({ empresa, empresas, onEmpresaChange }) {
  const pathname = usePathname()
  const router = useRouter()
  const [openMenus, setOpenMenus] = useState({ '/dashboard/dre': true })
  const [userEmail, setUserEmail] = useState('')
  const [userRole,  setUserRole]  = useState('')
  const [hoveredItem, setHoveredItem] = useState(null)

  useEffect(() => {
    // Usar cache do Supabase em vez de nova requisição
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
      if (user?.id) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (p?.role) setUserRole(p.role)
      }
    })
  }, [])

  const toggleMenu = (href) => setOpenMenus(prev => ({ ...prev, [href]: !prev[href] }))

  const handleLogout = async () => {
    if (confirm('Deseja realmente sair do sistema?')) {
      await supabase.auth.signOut()
      router.push('/')
    }
  }

  const isActive = (href) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  const isGroupActive = (item) => item.children ? item.children.some(c => pathname === c.href) || pathname === item.href : pathname === item.href

  const initials = userEmail ? userEmail.substring(0, 2).toUpperCase() : 'U'
  const username = userEmail ? userEmail.split('@')[0] : 'Usuário'

  return (
    <div style={{
      width: 240,
      minHeight: '100vh',
      background: 'var(--fs-bg)',
      borderRight: '1px solid var(--fs-border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'relative',
    }}>
      <style>{`
        .nav-item-btn { transition: ${TRANSITION}; }
        .nav-item-btn:hover { background: rgba(var(--fs-brand-rgb),0.06) !important; }
        .sub-item-link { transition: ${TRANSITION}; }
        .sub-item-link:hover { color: var(--fs-text-1) !important; background: rgba(var(--fs-brand-rgb),0.04) !important; }
        .select-empresa { transition: ${TRANSITION}; }
        .select-empresa:focus { border-color: #3b82f6 !important; }
        .logout-btn { transition: ${TRANSITION}; }
        .logout-btn:hover { background: rgba(239,68,68,0.15) !important; border-color: rgba(239,68,68,0.35) !important; }
      `}</style>

      {/* ── Logo Facesign ───────────────────────────────────────── */}
      <div style={{ padding: '18px 16px 16px', borderBottom: '1px solid var(--fs-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, color: 'var(--fs-text-1)', fontSize: 14,
            boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
            flexShrink: 0,
          }}>FS</div>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--fs-text-1)', fontSize: 15, letterSpacing: '-0.3px', lineHeight: 1.2 }}>Facesign</div>
            <div style={{ fontSize: 10, color: 'var(--fs-text-4)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Financeiro</div>
          </div>
        </div>
      </div>

      {/* ── Seletor de Empresa ──────────────────────────────────── */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--fs-border)' }}>
        <label style={{ fontSize: 9, color: 'var(--fs-text-4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 4, display: 'block', paddingLeft: 2 }}>
          Entidade
        </label>
        <select
          className="select-empresa"
          style={{ padding: '7px 10px', background: 'var(--fs-surface-2)', border: '1px solid var(--fs-border)', borderRadius: 8, color: 'var(--fs-text-1)', fontSize: 12, width: '100%', outline: 'none', cursor: 'pointer' }}
          value={empresa || ''}
          onChange={e => onEmpresaChange(e.target.value)}
        >
          {empresas.length === 0 && <option value="">Nenhuma entidade</option>}
          {(empresas || []).map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          {empresas.length > 1 && <option value="todas">📊 Todas (Consolidado)</option>}
        </select>
        {empresa === 'todas' && (
          <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 5, padding: '3px 8px', background: 'rgba(59,130,246,0.1)', borderRadius: 4, textAlign: 'center', border: '1px solid rgba(59,130,246,0.2)' }}>
            Visão Consolidada · FACE + JAM + JB
          </div>
        )}
      </div>

      {/* ── Navegação ───────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {(navItems || []).map(item => {
          const active = isGroupActive(item)
          const open = openMenus[item.href]
          return (
            <div key={item.href}>
              {item.children ? (
                <div
                  className="nav-item-btn"
                  onClick={() => toggleMenu(item.href)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px',
                    cursor: 'pointer',
                    color: active ? 'var(--fs-text-1)' : 'var(--fs-text-4)',
                    background: active ? 'rgba(var(--fs-brand-rgb),0.08)' : 'transparent',
                    borderLeft: active ? '2px solid var(--fs-brand)' : '2px solid transparent',
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    userSelect: 'none',
                  }}
                >
                  <span style={{ color: active ? 'var(--fs-brand)' : 'var(--fs-text-4)', flexShrink: 0 }}>
                    <Icon path={ICONS[item.icon]} size={15} color="currentColor" />
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span style={{
                    color: 'var(--fs-text-4)', fontSize: 11,
                    transform: open ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}>
                    <Icon path={ICONS.chevron} size={12} color="currentColor" />
                  </span>
                </div>
              ) : (
                <Link
                  href={item.href}
                  className="nav-item-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px',
                    color: active ? 'var(--fs-text-1)' : 'var(--fs-text-4)',
                    background: active ? 'rgba(var(--fs-brand-rgb),0.08)' : 'transparent',
                    borderLeft: active ? '2px solid var(--fs-brand)' : '2px solid transparent',
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ color: active ? 'var(--fs-brand)' : 'var(--fs-text-4)', flexShrink: 0 }}>
                    <Icon path={ICONS[item.icon]} size={15} color="currentColor" />
                  </span>
                  {item.label}
                </Link>
              )}

              {/* Sub-itens */}
              {item.children && open && (
                <div style={{ paddingBottom: 4 }}>
                  {(item.children || []).filter(child => !child.adminOnly || userRole === 'super_admin' || userRole === 'org_admin').map(child => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="sub-item-link"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 14px 7px 40px',
                        fontSize: 12,
                        color: pathname === child.href ? 'var(--fs-brand)' : 'var(--fs-text-4)',
                        textDecoration: 'none',
                        borderLeft: pathname === child.href ? '2px solid rgba(var(--fs-brand-rgb),0.4)' : '2px solid transparent',
                      }}
                    >
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: pathname === child.href ? '#3b82f6' : '#475569', flexShrink: 0 }} />
                      {child.label}
                      {child.adminOnly && (
                        <span style={{ fontSize:9, background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)', padding:'1px 5px', borderRadius:4, marginLeft:'auto', fontWeight:700, letterSpacing:'0.3px' }}>ADM</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Footer com usuário ──────────────────────────────────── */}
      <div style={{ padding: 12, borderTop: '1px solid var(--fs-border)', background: 'var(--fs-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 8px', background: 'var(--fs-surface-2)', borderRadius: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#fff', fontWeight: 800, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--fs-text-1)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{username}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</div>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <ThemeToggle />
        </div>
        <button
          className="logout-btn"
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '8px 12px', width: '100%',
            background: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 8, color: '#f87171',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Icon path={ICONS.logout} size={13} color="currentColor" />
          Sair do sistema
        </button>
      </div>
    </div>
  )
}
