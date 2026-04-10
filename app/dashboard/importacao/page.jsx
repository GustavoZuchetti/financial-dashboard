'use client'
import { useState } from 'react'
import UploadExcel from '@/components/UploadExcel'

const MAPEAMENTOS_MOCK = [
  {
    id: 1,
    grupo: 'RECEITA BRUTA',
    tipo: 'Receita Bruta',
    mapeamentos: [
      { id: 1, categoriaERP: 'Receita de Serviços', categoriaOxy: 'Receita de Serviços', dre: true, fluxoCaixa: true, dataCriacao: '30/01/2025' },
      { id: 2, categoriaERP: 'Receita de Produtos', categoriaOxy: 'Receita de Produtos', dre: true, fluxoCaixa: true, dataCriacao: '23/07/2025' },
    ]
  },
  {
    id: 2,
    grupo: 'OUTROS RECEBIMENTOS',
    tipo: 'Receita Bruta',
    mapeamentos: [
      { id: 3, categoriaERP: 'Devoluções de Pagamentos', categoriaOxy: 'Devoluções de Pagamentos', dre: true, fluxoCaixa: true, dataCriacao: '20/03/2025' },
    ]
  },
  {
    id: 3,
    grupo: 'IMPOSTOS SOBRE RECEITA',
    tipo: 'Deduções',
    mapeamentos: [
      { id: 4, categoriaERP: 'COFINS', categoriaOxy: 'COFINS', dre: true, fluxoCaixa: false, dataCriacao: '15/02/2025' },
      { id: 5, categoriaERP: 'PIS', categoriaOxy: 'PIS', dre: true, fluxoCaixa: false, dataCriacao: '15/02/2025' },
      { id: 6, categoriaERP: 'ISS', categoriaOxy: 'ISS', dre: true, fluxoCaixa: true, dataCriacao: '15/02/2025' },
    ]
  },
]

const S = {
  page: { color: '#e5e7eb' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 },
  subtitle: { color: '#6b7280', fontSize: 14, margin: '4px 0 0' },
  empresaBanner: { background: '#12121a', border: '2px solid #00e676', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  empresaNome: { fontSize: 16, fontWeight: 700, color: '#fff' },
  empresaCNPJ: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  btnEmpresa: { background: '#00e676', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  tabs: { display: 'flex', gap: 20, marginBottom: 24, borderBottom: '1px solid #1e1e2e' },
  tab: (active) => ({ padding: '12px 0', fontSize: 14, fontWeight: 600, color: active ? '#00e676' : '#6b7280', borderBottom: active ? '2px solid #00e676' : 'none', cursor: 'pointer', background: 'transparent', border: 'none' }),
  toolbar: { display: 'flex', justifyContent: 'flex-end', marginBottom: 20 },
  btn: { background: '#00e676', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  grupoCard: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  grupoHeader: { padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' },
  grupoInfo: { display: 'flex', gap: 12, alignItems: 'center' },
  grupoNome: { fontSize: 16, fontWeight: 700, color: '#00e676' },
  grupoTipo: { color: '#9ca3af', fontSize: 13 },
  grupoQtd: { color: '#6b7280', fontSize: 12 },
  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#0a0a0f' },
  th: { padding: '10px 16px', textAlign: 'left', color: '#9ca3af', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #1e1e2e' },
  td: { padding: '12px 16px', color: '#e5e7eb', fontSize: 13, borderBottom: '1px solid #0d0d18' },
  checkbox: { width: 16, height: 16, cursor: 'pointer' },
  check: { color: '#00e676', fontSize: 18 },
  btnIcon: { background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, padding: 4 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 24, width: 600, maxWidth: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20 },
  formGroup: { marginBottom: 16 },
    uploadArea: { border: '2px dashed #00e676', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer', background: '#12121a', transition: 'all 0.3s' },
  uploadAreaHover: { background: '#1a1a24', borderColor: '#00ff88' },
  uploadIcon: { fontSize: 48, color: '#00e676', marginBottom: 16 },
  uploadText: { color: '#e5e7eb', fontSize: 16, fontWeight: 600, marginBottom: 8 },
  uploadSubtext: { color: '#6b7280', fontSize: 13 },
  fileInfo: { background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, padding: 16, marginTop: 20 },
  fileName: { color: '#e5e7eb', fontSize: 14, fontWeight: 600, marginBottom: 4 },
  fileSize: { color: '#6b7280', fontSize: 12 },
  btnUpload: { background: '#00e676', color: '#000', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6 },
  input: { width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 6, color: '#e5e7eb', padding: '8px 12px', fontSize: 13 },
  select: { width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 6, color: '#e5e7eb', padding: '8px 12px', fontSize: 13 },
  checkGroup: { display: 'flex', gap: 20, marginTop: 8 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e5e7eb' },
  modalActions: { display: 'flex', gap: 10, marginTop: 24 },
  btnCancel: { flex: 1, background: 'transparent', border: '1px solid #374151', borderRadius: 8, color: '#9ca3af', padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnSave: { flex: 1, background: '#00e676', border: 'none', borderRadius: 8, color: '#000', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
}

function ModalMapeamento({ mapeamento, onClose, onSave }) {
  const [form, setForm] = useState({
    categoriaERP: mapeamento?.categoriaERP || '',
    categoriaOxy: mapeamento?.categoriaOxy || '',
    dre: mapeamento?.dre || false,
    fluxoCaixa: mapeamento?.fluxoCaixa || false,
  })

  const handleSave = () => {
    onSave(form)
    onClose()
  }

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={S.modalTitle}>{mapeamento ? 'Editar Mapeamento' : 'Novo Mapeamento'}</h2>
        
        <div style={S.formGroup}>
          <label style={S.label}>Categoria do ERP</label>
          <input
            style={S.input}
            value={form.categoriaERP}
            onChange={(e) => setForm({...form, categoriaERP: e.target.value})}
            placeholder="Ex: Receita de Serviços"
          />
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Categoria da Oxy</label>
          <select
            style={S.select}
            value={form.categoriaOxy}
            onChange={(e) => setForm({...form, categoriaOxy: e.target.value})}
          >
            <option value="">Selecione...</option>
            <option value="Receita de Serviços">Receita de Serviços</option>
            <option value="Receita de Produtos">Receita de Produtos</option>
            <option value="COFINS">COFINS</option>
            <option value="PIS">PIS</option>
            <option value="ISS">ISS</option>
          </select>
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Aparecer em:</label>
          <div style={S.checkGroup}>
            <label style={S.checkLabel}>
              <input
                type="checkbox"
                checked={form.dre}
                onChange={(e) => setForm({...form, dre: e.target.checked})}
                style={S.checkbox}
              />
              DRE
            </label>
            <label style={S.checkLabel}>
              <input
                type="checkbox"
                checked={form.fluxoCaixa}
                onChange={(e) => setForm({...form, fluxoCaixa: e.target.checked})}
                style={S.checkbox}
              />
              Fluxo de Caixa
            </label>
          </div>
        </div>

        <div style={S.modalActions}>
          <button style={S.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={S.btnSave} onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

function GrupoCard({ grupo, expanded, onToggle, onEdit, onDelete }) {
  return (
    <div style={S.grupoCard}>
      <div style={S.grupoHeader} onClick={() => onToggle(grupo.id)}>
        <div style={S.grupoInfo}>
          <div>
            <div style={S.grupoNome}>{grupo.grupo}</div>
            <div style={S.grupoTipo}>Tipo: {grupo.tipo}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={S.grupoQtd}>Mapeamentos: {grupo.mapeamentos.length}</span>
          <span style={{ color: '#9ca3af', fontSize: 18 }}>{expanded ? '▾' : '▸'}</span>
        </div>
      </div>
      
      {expanded && (
        <div style={S.tableContainer}>
          <table style={S.table}>
            <thead style={S.thead}>
              <tr>
                <th style={S.th}>
                  <input type="checkbox" style={S.checkbox} />
                </th>
                <th style={S.th}>Categoria do ERP</th>
                <th style={S.th}>Categoria da Oxy</th>
                <th style={S.th}>DRE</th>
                <th style={S.th}>Fluxo de Caixa</th>
                <th style={S.th}>Data da Criação</th>
                <th style={S.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {grupo.mapeamentos.map(m => (
                <tr key={m.id}>
                  <td style={S.td}>
                    <input type="checkbox" style={S.checkbox} />
                  </td>
                  <td style={S.td}>{m.categoriaERP}</td>
                  <td style={S.td}>{m.categoriaOxy}</td>
                  <td style={S.td}>
                    {m.dre && <span style={S.check}>✔</span>}
                  </td>
                  <td style={S.td}>
                    {m.fluxoCaixa && <span style={S.check}>✔</span>}
                  </td>
                  <td style={S.td}>{m.dataCriacao}</td>
                  <td style={S.td}>
                    <button style={S.btnIcon} onClick={() => onEdit(m)} title="Editar">✎</button>
                    <button style={S.btnIcon} onClick={() => onDelete(m.id)} title="Deletar">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ImportacaoPage() {
  const [abaAtiva, setAbaAtiva] = useState('mapeamento')
  const [expanded, setExpanded] = useState({ 1: true, 2: true, 3: true })
  const [modalAberto, setModalAberto] = useState(false)
  const [mapeamentoEditando, setMapeamentoEditando] = useState(null)

  const handleToggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const handleNovoMapeamento = () => {
    setMapeamentoEditando(null)
    setModalAberto(true)
  }

  const handleEditarMapeamento = (mapeamento) => {
    setMapeamentoEditando(mapeamento)
    setModalAberto(true)
  }

  const handleSalvarMapeamento = (formData) => {
    console.log('Salvando mapeamento:', formData)
    // Aqui seria a integração com API/Supabase
  }

  const handleDeletarMapeamento = (id) => {
    console.log('Deletando mapeamento:', id)
    // Aqui seria a integração com API/Supabase
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Importação / De-Para</h1>
        <p style={S.subtitle}>Configure o mapeamento entre categorias do ERP e categorias do sistema</p>
      </div>

      <div style={S.empresaBanner}>
        <div>
          <div style={S.empresaNome}>FACESIGN - JB DESENVOLVIMENTO EMPRESARIAL LTDA</div>
          <div style={S.empresaCNPJ}>CNPJ: 37.196.114/0001-69</div>
        </div>
        <button style={S.btnEmpresa}>Selecionar Empresa</button>
      </div>

      <div style={S.tabs}>
        <button
          style={S.tab(abaAtiva === 'grupos')}
          onClick={() => setAbaAtiva('grupos')}
        >
                      Grupo de Categorias
          
        </button>
        <button
          style={S.tab(abaAtiva === 'mapeamento')}
          onClick={() => setAbaAtiva('mapeamento')}
        >
                      Mapeamento de Categorias
        </button>
      </div>

      {abaAtiva === 'mapeamento' && (
        <>
          <div style={S.toolbar}>
            <button style={S.btn} onClick={handleNovoMapeamento}>
              Criar Mapeamento de Categoria
            </button>
          </div>

          {MAPEAMENTOS_MOCK.map(grupo => (
            <GrupoCard
              key={grupo.id}
              grupo={grupo}
              expanded={expanded[grupo.id]}
              onToggle={handleToggle}
              onEdit={handleEditarMapeamento}
              onDelete={handleDeletarMapeamento}
            />
          ))}
        </>
      )}

      {abaAtiva === 'grupos' && (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
          <p>Funcionalidade de Grupos de Categorias em desenvolvimento</p>
        </div>
      )}

      {modalAberto && (
        <ModalMapeamento
          mapeamento={mapeamentoEditando}
          onClose={() => setModalAberto(false)}
          onSave={handleSalvarMapeamento}
        />
      )}
    </div>
  )
}
