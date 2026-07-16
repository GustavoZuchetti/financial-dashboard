'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { COLORS, TRANSITION } from '@/lib/design-tokens'
import { useOrg } from '@/lib/org-context'
import OrgLogo from '@/components/OrgLogo'
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
  admin:     'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
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
    { label: 'Em Atraso',     href: '/dashboard/fluxo-caixa/atrasados' },
    { label: 'Visão Geral',   href: '/dashboard/fluxo-caixa' },
    { label: 'Análise',       href: '/dashboard/fluxo-caixa/analise' },
    { label: 'Comparativo',   href: '/dashboard/fluxo-caixa/comparativo' },
    { label: 'Projeção',      href: '/dashboard/fluxo-caixa/projecao' },
  ]},
  { label: 'Ciclo Financeiro', href: '/dashboard/ciclo-financeiro', icon: 'ciclo' },
  { label: 'Plano de Contas',  href: '/dashboard/plano-contas',     icon: 'plano' },
  { label: 'Importação', href: '/dashboard/importacao', icon: 'importacao', children: [
    { label: 'Importar Arquivo', href: '/dashboard/importacao' },
    { label: 'Layouts',          href: '/dashboard/importacao/layout', adminOnly: true },
  ]},
  { label: 'Configurações',    href: '/dashboard/configuracoes',    icon: 'config' },
]

export default function Sidebar({ empresa, empresas, onEmpresaChange }) {
  const pathname = usePathname()
  const router = useRouter()
  const { org } = useOrg()
  const [openMenus, setOpenMenus] = useState({ '/dashboard/dre': true })
  const [userEmail, setUserEmail] = useState('')
  const [userRole,  setUserRole]  = useState('')
  const [hoveredItem, setHoveredItem] = useState(null)
  // Multi-seleção de entidades
  const [entDropdownOpen, setEntDropdownOpen] = useState(false)
  const [selecionadas, setSelecionadas] = useState([]) // ids marcados
  const entRef = useRef(null)

  // Inicializa a seleção a partir do localStorage
  useEffect(() => {
    const initSel = () => {
      let ids = []
      try {
        const raw = localStorage.getItem('empresa_ids')
        if (raw) ids = JSON.parse(raw)
      } catch (_) {}
      if (!Array.isArray(ids) || ids.length === 0) {
        const single = localStorage.getItem('empresa_id')
        if (single && single !== 'todas') ids = [single]
        else if (single === 'todas') ids = (empresas || []).map(e => e.id)
      }
      // Filtra ids que ainda existem
      const validos = (empresas || []).map(e => e.id)
      ids = ids.filter(id => validos.includes(id))
      if (ids.length === 0 && empresas?.length) ids = [empresas[0].id]
      setSelecionadas(ids)
    }
    if (empresas?.length) initSel()
  }, [empresas])

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const onClick = (e) => { if (entRef.current && !entRef.current.contains(e.target)) setEntDropdownOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Persiste a seleção e notifica as páginas
  const aplicarSelecao = (ids) => {
    const total = (empresas || []).length
    // empresa_id mantém compatibilidade: 'todas' se >1 selecionada, senão o id único
    const empresaIdVal = ids.length === 1 ? ids[0] : 'todas'
    localStorage.setItem('empresa_ids', JSON.stringify(ids))
    localStorage.setItem('empresa_id', empresaIdVal)
    // Dispara o evento que as páginas escutam (mesma aba não recebe 'storage' nativo)
    window.dispatchEvent(new Event('storage'))
    onEmpresaChange?.(empresaIdVal)
    setSelecionadas(ids)
  }

  const toggleEntidade = (id) => {
    let novas = selecionadas.includes(id) ? selecionadas.filter(x => x !== id) : [...selecionadas, id]
    if (novas.length === 0) novas = [id] // nunca deixa zero — mantém a clicada
    aplicarSelecao(novas)
  }

  const selecionarTodas = () => aplicarSelecao((empresas || []).map(e => e.id))

  const rotuloSelecao = () => {
    const total = (empresas || []).length
    if (selecionadas.length === 0) return 'Nenhuma entidade'
    if (selecionadas.length === 1) return (empresas.find(e => e.id === selecionadas[0])?.nome) || '1 entidade'
    if (selecionadas.length === total) return `Todas (${total} entidades)`
    return `${selecionadas.length} de ${total} entidades`
  }

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

  const isActive = (href) => pathname === href
  const isGroupActive = (item) => {
    if (item.children) {
      // Grupo ativo se a rota atual é exatamente um dos filhos
      return item.children.some(c => pathname === c.href)
    }
    return pathname === item.href
  }

  const initials = userEmail ? userEmail.substring(0, 2).toUpperCase() : 'U'
  const username = userEmail ? userEmail.split('@')[0] : 'Usuário'

  return (
    <div style={{
      width: 240,
      height: '100vh',
      position: 'sticky',
      top: 0,
      background: 'var(--fs-bg)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <style>{`
        .nav-item-btn { transition: ${TRANSITION}; }
        .nav-item-btn:hover { background: rgba(var(--fs-brand-rgb),0.06) !important; }
        .sub-item-link { transition: ${TRANSITION}; }
        .sub-item-link:hover { color: var(--fs-text-1) !important; background: rgba(var(--fs-brand-rgb),0.04) !important; }
        .select-empresa { transition: ${TRANSITION}; }
        .select-empresa:focus { border-color: var(--fs-brand) !important; }
        .logout-btn { transition: ${TRANSITION}; }
        .logout-btn:hover { background: rgba(var(--fs-danger-rgb),0.15) !important; border-color: rgba(var(--fs-danger-rgb),0.35) !important; }
      `}</style>

      {/* ── Logo Facesign ───────────────────────────────────────── */}
      <div style={{ padding: '18px 16px 16px', borderBottom: '1px solid var(--fs-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <OrgLogo logoUrl={org?.logo_url} logoUrlLight={org?.logo_url_light} />
        </div>
      </div>

      {/* ── Seletor de Empresa ──────────────────────────────────── */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--fs-border)', flexShrink: 0 }}>
        <label style={{ fontSize: 9, color: 'var(--fs-text-4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px', marginBottom: 4, display: 'block', paddingLeft: 2 }}>
          Entidade
        </label>
        <div ref={entRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setEntDropdownOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', background: 'var(--fs-surface-2)', border: '1px solid var(--fs-border)', borderRadius: 8, color: 'var(--fs-text-1)', fontSize: 12, width: '100%', outline: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rotuloSelecao()}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, transform: entDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M6 9l6 6 6-6"/></svg>
          </button>

          {entDropdownOpen && empresas?.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: 'var(--fs-surface)', border: '1px solid var(--fs-border)', borderRadius: 8, boxShadow: 'var(--fs-shadow-lg)', overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
              {empresas.length > 1 && (
                <button
                  onClick={selecionarTodas}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--fs-border)', color: 'var(--fs-brand)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ✓ Selecionar todas (consolidado)
                </button>
              )}
              {empresas.map(e => {
                const marcada = selecionadas.includes(e.id)
                return (
                  <button
                    key={e.id}
                    onClick={() => toggleEntidade(e.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', background: marcada ? 'rgba(var(--fs-brand-rgb),0.08)' : 'transparent', border: 'none', color: 'var(--fs-text-1)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                  >
                    <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: marcada ? 'var(--fs-brand)' : 'transparent', border: `1.5px solid ${marcada ? 'var(--fs-brand)' : 'var(--fs-text-4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {marcada && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: marcada ? 'var(--fs-text-1)' : 'var(--fs-text-2)', fontWeight: marcada ? 600 : 400 }}>{e.nome}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Área rolável: navegação + bloco de usuário juntos ────── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ padding: '8px 0' }}>
        {(navItems || []).filter(item => !item.superAdminOnly || userRole === 'super_admin').map(item => {
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
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: pathname === child.href ? 'var(--fs-brand)' : 'var(--fs-text-4)', flexShrink: 0 }} />
                      {child.label}
                      {child.adminOnly && (
                        <span style={{ fontSize:9, background:'rgba(var(--fs-danger-rgb),0.12)', color:'var(--fs-danger)', border:'1px solid rgba(var(--fs-danger-rgb),0.2)', padding:'1px 5px', borderRadius:4, marginLeft:'auto', fontWeight:700, letterSpacing:'0.3px' }}>ADM</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Bloco de usuário (logo após o menu) ──────────────────── */}
      <div style={{ padding: 10, background: 'var(--fs-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--fs-surface-2)', borderRadius: 8, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--fs-brand-dark), var(--fs-brand))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#fff', fontWeight: 800, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--fs-text-1)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{username}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</div>
          </div>
          <button
            className="logout-btn"
            onClick={handleLogout}
            title="Sair do sistema"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, flexShrink: 0,
              background: 'rgba(var(--fs-danger-rgb),0.07)',
              border: '1px solid rgba(var(--fs-danger-rgb),0.15)',
              borderRadius: 8, color: 'var(--fs-danger)', cursor: 'pointer',
            }}
          >
            <Icon path={ICONS.logout} size={14} color="currentColor" />
          </button>
        </div>
        <ThemeToggle />
      </div>
      </div>
    </div>
  )
}
