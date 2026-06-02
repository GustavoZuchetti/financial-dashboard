'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/lib/org-context'

const CAMPOS_SISTEMA = [
  { key:'valor',        label:'Valor',                        required:true,  group:'Obrigatórios', hint:'Valor principal do lançamento (ex: 9.714,00)' },
  { key:'data',         label:'Data',                         required:true,  group:'Obrigatórios', hint:'Data de referência principal (DD/MM/AAAA)' },
  { key:'tipo_raw',     label:'Tipo (Entrada/Saída)',         required:true,  group:'Obrigatórios', hint:'Coluna que indica se é receita ou despesa' },
  { key:'descricao',    label:'Descrição',                    required:false, group:'Recomendados', hint:'Texto descritivo do lançamento' },
  { key:'categoria',    label:'Categoria / Grupo',            required:false, group:'Recomendados', hint:'Grupo financeiro (ex: Pessoas, Fornecedor)' },
  { key:'nome',         label:'Nome / Fornecedor / Cliente',  required:false, group:'Recomendados', hint:'Nome da contraparte' },
  { key:'empresa',      label:'Empresa (multi-entidade)',     required:false, group:'Recomendados', hint:'Coluna com nome/código da empresa (JAM, JB...)' },
  { key:'valor_pago',   label:'Valor Pago/Recebido',         required:false, group:'Opcionais',    hint:'Valor efetivo — usado no módulo Fluxo de Caixa' },
  { key:'situacao',     label:'Situação',                     required:false, group:'Opcionais',    hint:'Status do lançamento (Pago, Atrasado, Previsto)' },
  { key:'competencia',  label:'Competência',                  required:false, group:'Opcionais',    hint:'Data de competência contábil — usada no DRE' },
  { key:'vencimento',   label:'Vencimento',                   required:false, group:'Opcionais',    hint:'Data de vencimento — usada em aging / fluxo futuro' },
  { key:'liquidacao',   label:'Liquidação',                   required:false, group:'Opcionais',    hint:'Data de liquidação efetiva' },
  { key:'grupo',        label:'Grupo Caixa',                  required:false, group:'Opcionais',    hint:'Grupo para agrupamento no fluxo (ex: PESSOAS)' },
  { key:'observacoes',  label:'Observações',                  required:false, group:'Opcionais',    hint:'Campo livre de observações' },
]

const TIPO_DESTINOS = [
  { value:'receita',            label:'Receita Operacional' },
  { value:'custo',              label:'Custo Variável' },
  { value:'despesa',            label:'Despesa Fixa' },
  { value:'receita_financeira', label:'Receita Financeira' },
  { value:'despesa_financeira', label:'Despesa Financeira' },
  { value:'deducao',            label:'Dedução' },
  { value:'investimento',       label:'Investimento' },
  { value:'ignorar',            label:'Ignorar este valor' },
]

const FORMATOS_DATA = [
  { value:'DD/MM/YYYY', label:'DD/MM/AAAA  (ex: 24/09/2024)' },
  { value:'MM/DD/YYYY', label:'MM/DD/AAAA  (ex: 09/24/2024)' },
  { value:'YYYY-MM-DD', label:'AAAA-MM-DD  (ex: 2024-09-24)' },
  { value:'DD-MM-YYYY', label:'DD-MM-AAAA  (ex: 24-09-2024)' },
  { value:'DD/MM/YY',   label:'DD/MM/AA    (ex: 24/09/24)' },
]

const SEPARADORES = [
  { value:';',  label:'Ponto e vírgula  ( ; )' },
  { value:',',  label:'Vírgula          ( , )' },
  { value:'\t', label:'Tabulação  (TAB)' },
  { value:'|',  label:'Pipe  ( | )' },
]

const IS = { background:'var(--fs-bg)', border:'1px solid var(--fs-border)', borderRadius:8, color:'var(--fs-text-1)', padding:'8px 10px', fontSize:13, outline:'none', width:'100%' }
const LS = { fontSize:11, fontWeight:700, color:'var(--fs-text-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:5, display:'block' }
const Card = ({ children, style }) => <div style={{ background:'var(--fs-surface)', border:'1px solid var(--fs-border)', borderRadius:12, padding:'20px 24px', ...style }}>{children}</div>
const Step = ({ n }) => <span style={{ background:'rgba(59,130,246,0.15)', color:'#60a5fa', width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, marginRight:8, flexShrink:0 }}>{n}</span>

const EMPTY_FORM = { nome:'', descricao:'', separador:';', formato_data:'DD/MM/YYYY', linha_header:1, colunas:{}, tipo_regras:[], is_default:false }

export default function LayoutImportacao() {
  const { isSuperAdmin, profile } = useOrg()
  const isAdmin = isSuperAdmin || profile?.role === 'org_admin'

  const [layouts,    setLayouts]    = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [mode,       setMode]       = useState('list')
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [empresaId,  setEmpresaId]  = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvPreview, setCsvPreview] = useState([])
  const fileRef = useRef(null)

  useEffect(() => {
    const id = localStorage.getItem('empresa_id')
    if (id) setEmpresaId(id)
  }, [])

  const loadLayouts = useCallback(async () => {
    if (!empresaId || empresaId === 'todas') { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('import_layouts').select('*').eq('empresa_id', empresaId).order('created_at', { ascending:false })
    setLayouts(data || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { if (empresaId) loadLayouts() }, [loadLayouts, empresaId])

  const handlePreviewFile = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = new TextDecoder('utf-8').decode(e.target.result)
      const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g,'\n').replace(/\r/g,'\n')
      const sep = form.separador
      const lines = clean.split('\n').filter(l=>l.trim())
      const hLine = lines[form.linha_header - 1] || lines[0]
      const headers = hLine.split(sep).map(h=>h.replace(/^"|"$/g,'').trim())
      setCsvHeaders(headers)
      const preview = lines.slice(form.linha_header, form.linha_header + 3).map(l => {
        const cells = l.split(sep).map(c=>c.replace(/^"|"$/g,'').trim())
        return Object.fromEntries(headers.map((h,i)=>[h,cells[i]||'']))
      })
      setCsvPreview(preview)
    }
    reader.readAsArrayBuffer(file)
  }

  const openNew  = () => { setForm(EMPTY_FORM); setCsvHeaders([]); setCsvPreview([]); setMode('new') }
  const openEdit = (lay) => {
    setSelectedId(lay.id)
    setForm({ nome:lay.nome, descricao:lay.descricao||'', separador:lay.separador||';', formato_data:lay.formato_data||'DD/MM/YYYY', linha_header:lay.linha_header||1, colunas:lay.colunas||{}, tipo_regras:lay.tipo_regras||[] })
    setCsvHeaders(lay.csv_headers_amostra||[]); setCsvPreview([])
    setMode('edit')
  }

  const save = async () => {
    if (!form.nome.trim()) { setMsg({type:'err',text:'Informe um nome para o layout.'}); return }
    const missing = CAMPOS_SISTEMA.filter(c=>c.required && !form.colunas[c.key])
    if (missing.length) { setMsg({type:'err',text:`Mapeie os campos obrigatórios: ${missing.map(m=>m.label).join(', ')}`}); return }
    setSaving(true)
    const payload = { empresa_id:empresaId, nome:form.nome.trim(), descricao:form.descricao.trim(), separador:form.separador, formato_data:form.formato_data, linha_header:form.linha_header, colunas:form.colunas, tipo_regras:form.tipo_regras, csv_headers_amostra:csvHeaders, is_default:form.is_default, updated_at:new Date().toISOString() }
    // Se definido como padrão, remove o padrão dos demais
    if (form.is_default) { await supabase.from('import_layouts').update({is_default:false}).eq('empresa_id',empresaId).neq('id', selectedId||'00000000-0000-0000-0000-000000000000') }
    const { error } = mode === 'new'
      ? await supabase.from('import_layouts').insert({...payload, created_at:new Date().toISOString()})
      : await supabase.from('import_layouts').update(payload).eq('id', selectedId)
    setSaving(false)
    if (error) { setMsg({type:'err',text:`Erro: ${error.message}`}); return }
    setMsg({type:'ok',text:'Layout salvo com sucesso!'})
    await loadLayouts()
    setTimeout(()=>{ setMode('list'); setMsg(null) }, 1200)
  }

  const deleteLayout = async (id) => {
    if (!confirm('Excluir este layout?')) return
    await supabase.from('import_layouts').delete().eq('id', id)
    await loadLayouts()
  }

  const setDefault = async (id) => {
    await supabase.from('import_layouts').update({is_default:false}).eq('empresa_id', empresaId)
    await supabase.from('import_layouts').update({is_default:true }).eq('id', id)
    await loadLayouts()
  }

  const setCol = (k, v) => setForm(f=>({...f, colunas:{...f.colunas,[k]:v}}))
  const addRegra = () => setForm(f=>({...f, tipo_regras:[...f.tipo_regras,{valor_csv:'',tipo_destino:'despesa',modulo:'ambos'}]}))
  const updRegra = (i,k,v) => setForm(f=>{ const r=[...f.tipo_regras]; r[i]={...r[i],[k]:v}; return {...f,tipo_regras:r} })
  const delRegra = (i) => setForm(f=>({...f,tipo_regras:f.tipo_regras.filter((_,j)=>j!==i)}))

  if (!isAdmin) return (
    <div style={{textAlign:'center',padding:80,color:'var(--fs-text-4)'}}>
      <div style={{marginBottom:12,fontSize:13,color:'var(--fs-text-4)'}}>Acesso restrito</div>
      <div style={{fontSize:15,fontWeight:700}}>Acesso restrito a administradores</div>
    </div>
  )

  return (
    <div style={{color:'var(--fs-text-1)',width:'100%'}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:'var(--fs-text-4)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:4}}>Importação · Configuração</div>
          <h1 style={{fontSize:28,fontWeight:900,margin:0}}>{mode==='list'?'Layouts de Importação':mode==='new'?'Novo Layout':'Editar Layout'}</h1>
          <div style={{fontSize:12,color:'var(--fs-text-4)',marginTop:4}}>
            {mode==='list'?'Configure como cada coluna do seu arquivo CSV/Excel é interpretada pelo sistema':'Mapeie as colunas do seu arquivo para os campos do sistema'}
          </div>
        </div>
        {mode==='list' ? (
          <button onClick={openNew} style={{background:'#3b82f6',border:'none',color:'#fff',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}>
            <span style={{fontSize:16,lineHeight:1}}>+</span> Novo Layout
          </button>
        ) : (
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{setMode('list');setMsg(null)}} style={{background:'var(--fs-surface)',border:'1px solid var(--fs-border)',color:'var(--fs-text-2)',borderRadius:10,padding:'9px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>← Voltar</button>
            <button onClick={save} disabled={saving} style={{background:saving?'rgba(59,130,246,0.5)':'#3b82f6',border:'none',color:'#fff',borderRadius:10,padding:'9px 18px',fontSize:13,fontWeight:700,cursor:saving?'default':'pointer'}}>{saving?'Salvando...':'Salvar Layout'}</button>
          </div>
        )}
      </div>

      {msg && <div style={{background:msg.type==='ok'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',border:`1px solid ${msg.type==='ok'?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}`,color:msg.type==='ok'?'#22c55e':'#ef4444',borderRadius:8,padding:'10px 16px',fontSize:13,fontWeight:600,marginBottom:16}}>{msg.text}</div>}

      {/* LISTA */}
      {mode==='list' && (loading
        ? <div style={{textAlign:'center',padding:60,color:'var(--fs-text-4)'}}>Carregando...</div>
        : layouts.length===0
          ? <Card style={{textAlign:'center',padding:60}}>
              <div style={{marginBottom:12,fontSize:13,color:'var(--fs-text-4)'}}>Layouts configurados</div>
              <div style={{fontSize:15,fontWeight:700,color:'var(--fs-text-1)',marginBottom:6}}>Nenhum layout configurado</div>
              <div style={{fontSize:13,color:'var(--fs-text-4)',marginBottom:20}}>Crie um layout para que o sistema reconheça automaticamente as colunas do seu arquivo ao importar</div>
              <button onClick={openNew} style={{background:'#3b82f6',border:'none',color:'#fff',borderRadius:8,padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer'}}>Criar primeiro layout</button>
            </Card>
          : <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {layouts.map(lay=>(
                <div key={lay.id} style={{background:'var(--fs-surface)',border:lay.is_default?'1px solid rgba(59,130,246,0.5)':'1px solid var(--fs-border)',borderRadius:12,padding:'18px 22px',display:'grid',gridTemplateColumns:'1fr auto',gap:16,alignItems:'center'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontSize:15,fontWeight:800,color:'var(--fs-text-1)'}}>{lay.nome}</span>
                      {lay.is_default&&<span style={{fontSize:10,fontWeight:700,background:'rgba(59,130,246,0.15)',color:'#60a5fa',border:'1px solid rgba(59,130,246,0.3)',padding:'2px 8px',borderRadius:20}}>PADRÃO</span>}
                    </div>
                    {lay.descricao&&<div style={{fontSize:12,color:'var(--fs-text-4)',marginBottom:6}}>{lay.descricao}</div>}
                    <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                      {[
                        ['Separador', lay.separador==='\t'?'TAB':lay.separador],
                        ['Data', lay.formato_data],
                        ['Campos', Object.keys(lay.colunas||{}).length+' mapeados'],
                        ['Regras', (lay.tipo_regras||[]).length+' de tipo'],
                      ].map(([l,v])=>(
                        <span key={l} style={{fontSize:11,color:'var(--fs-text-4)'}}>{l}: <strong style={{color:'var(--fs-text-3)'}}>{v}</strong></span>
                      ))}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
                    <button onClick={()=>lay.is_default ? null : setDefault(lay.id)} style={{
                      background: lay.is_default ? 'rgba(59,130,246,0.15)' : 'transparent',
                      border: lay.is_default ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--fs-border)',
                      color: lay.is_default ? '#60a5fa' : 'var(--fs-text-3)',
                      borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:700,
                      cursor: lay.is_default ? 'default' : 'pointer',
                      display:'flex', alignItems:'center', gap:5,
                    }}>
                      <span style={{ width:8,height:8,borderRadius:'50%', background: lay.is_default ? '#3b82f6' : 'var(--fs-border)', display:'inline-block', flexShrink:0 }} />
                      {lay.is_default ? 'Padrão ativo' : 'Definir Padrão'}
                    </button>
                    <button onClick={()=>openEdit(lay)} style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',color:'#60a5fa',borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>Editar</button>
                    <button onClick={()=>deleteLayout(lay.id)} style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#ef4444',borderRadius:7,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
      )}

      {/* FORMULÁRIO */}
      {(mode==='new'||mode==='edit') && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>

          {/* 1 Identificação */}
          <Card>
            <div style={{fontSize:13,fontWeight:800,color:'var(--fs-text-1)',marginBottom:16,display:'flex',alignItems:'center'}}><Step n="1"/>Identificação do Layout</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:16}}>
              <div>
                <label style={LS}>Nome *</label>
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Ex: Bling FC Padrão" style={IS}/>
              </div>
              <div>
                <label style={LS}>Descrição</label>
                <input value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Quando usar este layout..." style={IS}/>
              </div>
            </div>
            {/* Toggle: definir como padrão */}
            <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--fs-bg)', borderRadius:8, border:'1px solid var(--fs-border)', cursor:'pointer' }}
              onClick={() => setForm(f=>({...f, is_default:!f.is_default}))}>
              <div style={{ width:36, height:20, borderRadius:10, background: form.is_default ? '#3b82f6' : 'var(--fs-border)', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left: form.is_default ? 18 : 2, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color: form.is_default ? '#60a5fa' : 'var(--fs-text-2)' }}>
                  {form.is_default ? '✓ Definido como layout padrão' : 'Definir como layout padrão'}
                </div>
                <div style={{ fontSize:11, color:'var(--fs-text-4)', marginTop:1 }}>
                  O layout padrão é aplicado automaticamente ao importar arquivos desta empresa
                </div>
              </div>
            </div>
          </Card>

          {/* 2 Config arquivo */}
          <Card>
            <div style={{fontSize:13,fontWeight:800,color:'var(--fs-text-1)',marginBottom:16,display:'flex',alignItems:'center'}}><Step n="2"/>Configurações do Arquivo</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:18}}>
              <div>
                <label style={LS}>Separador *</label>
                <select value={form.separador} onChange={e=>setForm(f=>({...f,separador:e.target.value}))} style={IS}>
                  {SEPARADORES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>Formato de data *</label>
                <select value={form.formato_data} onChange={e=>setForm(f=>({...f,formato_data:e.target.value}))} style={IS}>
                  {FORMATOS_DATA.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>Linha do cabeçalho</label>
                <input type="number" min={1} max={10} value={form.linha_header} onChange={e=>setForm(f=>({...f,linha_header:Number(e.target.value)}))} style={IS}/>
                <div style={{fontSize:10,color:'var(--fs-text-4)',marginTop:3}}>Linha com os nomes das colunas (normalmente 1)</div>
              </div>
            </div>

            <div>
              <label style={LS}>Carregar arquivo de exemplo para detectar colunas automaticamente</label>
              <div onClick={()=>fileRef.current?.click()} style={{border:'2px dashed var(--fs-border)',borderRadius:8,padding:'14px 18px',cursor:'pointer',display:'flex',alignItems:'center',gap:10}} onMouseEnter={e=>e.currentTarget.style.borderColor='#3b82f6'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--fs-border)'}>
                
                <div>
                  <div style={{fontSize:13,color:'var(--fs-text-2)',fontWeight:600}}>Clique para carregar um CSV de exemplo</div>
                  <div style={{fontSize:11,color:'var(--fs-text-4)'}}>Nenhum dado será importado — apenas as colunas serão detectadas</div>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e=>{if(e.target.files[0])handlePreviewFile(e.target.files[0])}}/>
              {csvHeaders.length>0&&(
                <div style={{marginTop:10,display:'flex',flexWrap:'wrap',gap:6}}>
                  {csvHeaders.map(h=><span key={h} style={{background:'rgba(59,130,246,0.1)',color:'#60a5fa',border:'1px solid rgba(59,130,246,0.2)',padding:'3px 9px',borderRadius:5,fontSize:11,fontWeight:600}}>{h}</span>)}
                </div>
              )}
            </div>
          </Card>

          {/* 3 Mapeamento */}
          <Card>
            <div style={{fontSize:13,fontWeight:800,color:'var(--fs-text-1)',marginBottom:4,display:'flex',alignItems:'center'}}><Step n="3"/>Mapeamento de Colunas</div>
            <div style={{fontSize:12,color:'var(--fs-text-4)',marginBottom:18,marginLeft:30}}>Para cada campo do sistema, informe o nome exato da coluna no seu arquivo</div>

            {['Obrigatórios','Recomendados','Opcionais'].map(grupo=>(
              <div key={grupo} style={{marginBottom:22}}>
                <div style={{fontSize:11,fontWeight:700,color:grupo==='Obrigatórios'?'#ef4444':grupo==='Recomendados'?'#f59e0b':'var(--fs-text-4)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:10,paddingBottom:6,borderBottom:'1px solid var(--fs-border)'}}>
                  {grupo}{grupo==='Obrigatórios'?' — necessários para importar':''}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {CAMPOS_SISTEMA.filter(c=>c.group===grupo).map(campo=>(
                    <div key={campo.key} style={{display:'grid',gridTemplateColumns:'220px 1fr 1fr',gap:12,alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:'var(--fs-text-1)'}}>{campo.label}{campo.required&&<span style={{color:'#ef4444',marginLeft:3}}>*</span>}</div>
                        <div style={{fontSize:10,color:'var(--fs-text-4)',marginTop:1}}>{campo.hint}</div>
                      </div>
                      {csvHeaders.length>0
                        ? <select value={form.colunas[campo.key]||''} onChange={e=>setCol(campo.key,e.target.value)} style={IS}>
                            <option value="">— não mapear —</option>
                            {csvHeaders.map(h=><option key={h} value={h}>{h}</option>)}
                          </select>
                        : <input value={form.colunas[campo.key]||''} onChange={e=>setCol(campo.key,e.target.value)} placeholder="Nome exato da coluna..." style={IS}/>
                      }
                      <div style={{fontSize:11,color:'var(--fs-text-4)',fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {form.colunas[campo.key]&&csvPreview[0]?`Ex: "${csvPreview[0][form.colunas[campo.key]]||'—'}"` :''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Card>

          {/* 4 Regras de tipo */}
          <Card>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <div style={{fontSize:13,fontWeight:800,color:'var(--fs-text-1)',display:'flex',alignItems:'center'}}><Step n="4"/>Regras de Classificação de Tipo</div>
              <button onClick={addRegra} style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.25)',color:'#22c55e',borderRadius:7,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>+ Adicionar Regra</button>
            </div>
            <div style={{fontSize:12,color:'var(--fs-text-4)',marginBottom:16,marginLeft:30}}>
              Define como cada valor da coluna "Tipo" do seu arquivo é classificado no sistema.<br/>
              <span style={{color:'var(--fs-text-3)'}}>Ex: "Conta a pagar" → Despesa Fixa · "Conta a receber" → Receita Operacional</span>
            </div>

            {form.tipo_regras.length===0
              ? <div style={{textAlign:'center',padding:'20px',color:'var(--fs-text-4)',fontSize:12,background:'var(--fs-bg)',borderRadius:8,border:'1px dashed var(--fs-border)'}}>Nenhuma regra criada. Clique em "+ Adicionar Regra".</div>
              : <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 140px 36px',gap:10,marginBottom:6}}>
                    {['Valor no CSV','Classificar como','Módulo',''].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:'var(--fs-text-4)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{h}</div>)}
                  </div>
                  {form.tipo_regras.map((r,i)=>(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 140px 36px',gap:10,alignItems:'center',marginBottom:8}}>
                      <input value={r.valor_csv} onChange={e=>updRegra(i,'valor_csv',e.target.value)} placeholder="Ex: Conta a pagar" style={IS}/>
                      <select value={r.tipo_destino} onChange={e=>updRegra(i,'tipo_destino',e.target.value)} style={IS}>
                        {TIPO_DESTINOS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <select value={r.modulo} onChange={e=>updRegra(i,'modulo',e.target.value)} style={IS}>
                        <option value="ambos">DRE + FC</option>
                        <option value="dre">Só DRE</option>
                        <option value="fluxo">Só Fluxo</option>
                      </select>
                      <button onClick={()=>delRegra(i)} style={{background:'rgba(239,68,68,0.1)',border:'none',color:'#ef4444',borderRadius:6,width:32,height:32,cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                    </div>
                  ))}
                </>
            }

            {/* Sugestão automática */}
            {csvPreview.length>0 && form.colunas.tipo_raw && (() => {
              const vals = [...new Set(csvPreview.map(r=>r[form.colunas.tipo_raw]).filter(Boolean))]
              const existing = form.tipo_regras.map(r=>r.valor_csv)
              const novas = vals.filter(v=>!existing.includes(v))
              if (!novas.length) return null
              return (
                <div style={{marginTop:12,background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:8,padding:'10px 14px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#f59e0b',marginBottom:6}}>Dica: Valores detectados no arquivo sem regra:</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {novas.map(v=>(
                      <button key={v} onClick={()=>setForm(f=>({...f,tipo_regras:[...f.tipo_regras,{valor_csv:v,tipo_destino:v.toLowerCase().includes('pagar')?'despesa':'receita',modulo:'ambos'}]}))} style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)',color:'#f59e0b',borderRadius:5,padding:'3px 10px',fontSize:11,fontWeight:600,cursor:'pointer'}}>+ {v}</button>
                    ))}
                  </div>
                </div>
              )
            })()}
          </Card>

          {/* Botão inferior */}
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,paddingBottom:24}}>
            <button onClick={()=>{setMode('list');setMsg(null)}} style={{background:'var(--fs-surface)',border:'1px solid var(--fs-border)',color:'var(--fs-text-2)',borderRadius:10,padding:'10px 20px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{background:saving?'rgba(59,130,246,0.5)':'#3b82f6',border:'none',color:'#fff',borderRadius:10,padding:'10px 22px',fontSize:13,fontWeight:700,cursor:saving?'default':'pointer'}}>{saving?'Salvando...':'Salvar Layout'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
