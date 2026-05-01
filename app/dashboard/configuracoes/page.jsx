'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, background: '#12121a', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab: (a) => ({ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: a ? 600 : 400, color: a ? '#fff' : '#6b7280', background: a ? '#1e1e2e' : 'transparent', cursor: 'pointer', border: 'none' }),
  card: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: '24px', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 },
  cardSub: { color: '#6b7280', fontSize: 13, marginBottom: 20 },
  label: { display: 'block', color: '#9ca3af', fontSize: 13, fontWeight: 500, marginBottom: 6 },
  input: { width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  btn: { background: '#3b82f6', color: '#000', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnGhost: { background: 'transparent', color: '#9ca3af', border: '1px solid #1e1e2e', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' },
  success: { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '10px 14px', color: '#3b82f6', fontSize: 13, marginBottom: 16 },
  danger: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 16 },
  empresaRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#0a0a0f', borderRadius: 8, marginBottom: 8 },
  badge: { display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
}

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState('perfil')
  const [perfil, setPerfil] = useState({ nome: '', email: '' })
  const [novaEmpresa, setNovaEmpresa] = useState({ nome: '', cnpj: '' })
  const [empresas, setEmpresas] = useState([])
  const [msg, setMsg] = useState('')
  const [msgTipo, setMsgTipo] = useState('success')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setPerfil({ nome: user.user_metadata?.nome || user.email?.split('@')[0] || '', email: user.email || '' })
      
      const { data: list } = await supabase.from('empresas').select('*').order('nome')
      if (list) setEmpresas(list)
    }
    loadData()
  }, [])

  const showMsg = (texto, tipo = 'success') => {
    setMsg(texto); setMsgTipo(tipo)
    setTimeout(() => setMsg(''), 3000)
  }

  const salvarPerfil = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ data: { nome: perfil.nome } })
    setLoading(false)
    showMsg(error ? 'Erro ao salvar.' : 'Perfil atualizado com sucesso!', error ? 'error' : 'success')
  }

  const addEmpresa = async (e) => {
    e.preventDefault()
    if (!novaEmpresa.nome) return
    setLoading(true)
    
    const { data, error } = await supabase
      .from('empresas')
      .insert([{ nome: novaEmpresa.nome, cnpj: novaEmpresa.cnpj }])
      .select()
      .single()

    setLoading(false)
    
    if (error) {
      console.error('Erro ao adicionar empresa:', error)
      showMsg('Erro ao adicionar empresa: ' + error.message, 'error')
    } else {
      setEmpresas(prev => [...prev, data])
      setNovaEmpresa({ nome: '', cnpj: '' })
      showMsg('Empresa adicionada com sucesso!')
    }
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Configurações</h1>
        <p style={S.subtitle}>Gerencie seu perfil e empresas do sistema</p>
      </div>

      <div style={S.tabs}>
        {[['perfil', '👤 Perfil'], ['empresas', '🏢 Empresas'], ['sistema', '⚙️ Sistema']].map(([v, l]) => (
          <button key={v} style={S.tab(tab === v)} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      {msg && <div style={msgTipo === 'success' ? S.success : S.danger}>{msg}</div>}

      {tab === 'perfil' && (
        <div style={S.card}>
          <div style={S.cardTitle}>Dados do Perfil</div>
          <div style={S.cardSub}>Atualize suas informações de acesso</div>
          <form onSubmit={salvarPerfil}>
            <div style={S.grid2}>
              <div>
                <label style={S.label}>Nome</label>
                <input style={S.input} value={perfil.nome} onChange={e => setPerfil({ ...perfil, nome: e.target.value })} placeholder="Seu nome" />
              </div>
              <div>
                <label style={S.label}>E-mail</label>
                <input style={{ ...S.input, opacity: 0.6 }} value={perfil.email} disabled />
              </div>
            </div>
            <label style={S.label}>Nova Senha</label>
            <input style={S.input} type="password" placeholder="Deixe em branco para não alterar" />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={S.btn} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'empresas' && (
        <>
          <div style={S.card}>
            <div style={S.cardTitle}>Empresas Cadastradas</div>
            <div style={S.cardSub}>Empresas vinculadas ao seu usuário</div>
            {empresas.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 13 }}>Nenhuma empresa cadastrada.</p>
            ) : (
              empresas.map(emp => (
                <div key={emp.id} style={S.empresaRow}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>{emp.nome}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>CNPJ: {emp.cnpj || 'Não informado'}</div>
                  </div>
                  <span style={S.badge}>ativo</span>
                </div>
              ))
            )}
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Adicionar Nova Empresa</div>
            <div style={S.cardSub}>Cadastre uma nova empresa para gerenciar</div>
            <form onSubmit={addEmpresa}>
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Nome da Empresa</label>
                  <input style={S.input} value={novaEmpresa.nome} onChange={e => setNovaEmpresa({ ...novaEmpresa, nome: e.target.value })} placeholder="Razão Social" required />
                </div>
                <div>
                  <label style={S.label}>CNPJ</label>
                  <input style={S.input} value={novaEmpresa.cnpj} onChange={e => setNovaEmpresa({ ...novaEmpresa, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
                </div>
              </div>
              <button type="submit" style={S.btn} disabled={loading}>
                {loading ? 'Adicionando...' : '+ Adicionar Empresa'}
              </button>
            </form>
          </div>
        </>
      )}

      {tab === 'sistema' && (
        <div style={S.card}>
          <div style={S.cardTitle}>Preferências do Sistema</div>
          <div style={S.cardSub}>Configurações gerais da plataforma</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {[
              { label: 'Tema', valor: 'Escuro (Dark)', icon: '🌙' },
              { label: 'Idioma', valor: 'Português (BR)', icon: '🇧🇷' },
              { label: 'Moeda Padrão', valor: 'BRL - Real Brasileiro', icon: '💰' },
              { label: 'Formato de Data', valor: 'DD/MM/YYYY', icon: '📅' },
              { label: 'Versão do Sistema', valor: 'v1.0.0', icon: '🔖' },
              { label: 'Banco de Dados', valor: 'Supabase (Online)', icon: '🖥️' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', background: '#0a0a0f', borderRadius: 8 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <div>
                  <div style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{item.valor}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
