// ─── bling-server.js — Integração Bling API v3 (APENAS server-side) ─────────
// URLs com override por env para calibração sem redeploy de código.
// O mapeamento de campos é DEFENSIVO: a primeira sincronização deve rodar em
// modo diagnóstico (?diag=1) para validar o payload real antes de gravar.
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const pausa = (ms) => new Promise(r => setTimeout(r, ms))

export const BLING = {
  AUTH_URL:  process.env.BLING_AUTH_URL  || 'https://www.bling.com.br/Api/v3/oauth/authorize',
  TOKEN_URL: process.env.BLING_TOKEN_URL || 'https://www.bling.com.br/Api/v3/oauth/token',
  API_BASE:  process.env.BLING_API_BASE  || 'https://api.bling.com.br/Api/v3',
}

export function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
    {
      // CRÍTICO: o Next.js 14 cacheia fetch GET por padrão em route handlers —
      // SELECTs do PostgREST voltavam CONGELADOS (cursor 'não retomava' apesar
      // de gravado). no-store garante leitura sempre fresca do banco.
      global: { fetch: (url, opts = {}) => fetch(url, { ...opts, cache: 'no-store' }) },
    }
  )
}

// ── Autenticação das rotas: valida o Bearer token e devolve user+profile ────
export async function getAuthProfile(request) {
  const admin = getAdmin()
  const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return { error: 'Não autenticado', status: 401 }
  const { data: { user }, error } = await admin.auth.getUser(jwt)
  if (error || !user) return { error: 'Sessão inválida', status: 401 }
  const { data: profile } = await admin.from('profiles')
    .select('organization_id, role').eq('id', user.id).single()
  if (!profile?.organization_id) return { error: 'Perfil sem organização', status: 403 }
  return { admin, user, profile }
}

// ── State assinado (HMAC) para o fluxo OAuth ────────────────────────────────
const hmac = (msg) => crypto
  .createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'k')
  .update(msg).digest('hex').slice(0, 32)

export function signState(integracaoId) {
  const ts = Date.now()
  const msg = `${integracaoId}|${ts}`
  return Buffer.from(`${msg}|${hmac(msg)}`).toString('base64url')
}
export function verifyState(state) {
  try {
    const [id, ts, sig] = Buffer.from(state, 'base64url').toString().split('|')
    if (hmac(`${id}|${ts}`) !== sig) return null
    if (Date.now() - Number(ts) > 15 * 60 * 1000) return null // 15 min
    return id
  } catch { return null }
}

// ── Troca/renovação de tokens (Basic auth client_id:client_secret) ──────────
async function tokenRequest(integ, params) {
  const basic = Buffer.from(`${integ.client_id}:${integ.client_secret}`).toString('base64')
  const r = await fetch(BLING.TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '1.0',
    },
    body: new URLSearchParams(params).toString(),
  })
  const body = await r.json().catch(() => null)
  if (!r.ok || !body?.access_token) {
    throw new Error(`Token Bling falhou (HTTP ${r.status}): ${JSON.stringify(body).slice(0, 300)}`)
  }
  return body
}

export const exchangeCode = (integ, code) =>
  tokenRequest(integ, { grant_type: 'authorization_code', code })

export const refreshTokens = (integ) =>
  tokenRequest(integ, { grant_type: 'refresh_token', refresh_token: integ.refresh_token })

// Garante access_token válido; renova e persiste se expirando (<120s)
export async function ensureToken(admin, integ) {
  const expira = integ.token_expira_em ? new Date(integ.token_expira_em).getTime() : 0
  if (integ.access_token && expira - Date.now() > 120_000) return integ
  if (!integ.refresh_token) throw new Error('Integração sem refresh_token — reconecte ao Bling')
  const tk = await refreshTokens(integ)
  const novo = {
    access_token: tk.access_token,
    refresh_token: tk.refresh_token || integ.refresh_token,
    token_expira_em: new Date(Date.now() + (tk.expires_in || 21600) * 1000).toISOString(),
  }
  await admin.from('integracoes').update({ ...novo, updated_at: new Date().toISOString() }).eq('id', integ.id)
  return { ...integ, ...novo }
}

// ── Busca de contas (a receber / a pagar) com paginação ─────────────────────
export async function fetchContas(integ, recurso, pagina = 1, limite = 100) {
  const url = `${BLING.API_BASE}/${recurso}?pagina=${pagina}&limite=${limite}`
  const r = await fetch(url, { headers: { 'Authorization': `Bearer ${integ.access_token}`, 'Accept': 'application/json' } })
  const body = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`Bling ${recurso} p${pagina} (HTTP ${r.status}): ${JSON.stringify(body).slice(0, 300)}`)
  return Array.isArray(body?.data) ? body.data : []
}

// GET no Bling com até 3 tentativas em 429/5xx (backoff progressivo) —
// o Bling aplica rate limit por app; sem retry, lotes paralelos viram erro
export async function blingGet(integ, path) {
  for (let tent = 1; tent <= 3; tent++) {
    const r = await fetch(`${BLING.API_BASE}/${path}`, {
      headers: { 'Authorization': `Bearer ${integ.access_token}`, 'Accept': 'application/json' } })
    if (r.status === 429 || r.status >= 500) {
      if (tent < 3) { await pausa(600 * tent); continue }
      return { ok: false, status: r.status, body: null }
    }
    const body = await r.json().catch(() => null)
    return { ok: r.ok, status: r.status, body }
  }
}

// Detalhe de um título (a listagem não traz categoria nem histórico)
export async function fetchDetalhe(integ, recurso, id) {
  const r = await blingGet(integ, `${recurso}/${id}`)
  return r.ok ? (r.body?.data || null) : null
}

// Mapa id→descrição das categorias de receitas/despesas (1 chamada por sync)
export async function fetchCategoriasMap(integ) {
  const map = {}
  try {
    for (let pg = 1; pg <= 3; pg++) {
      const r = await fetch(`${BLING.API_BASE}/categorias/receitas-despesas?pagina=${pg}&limite=100`, {
        headers: { 'Authorization': `Bearer ${integ.access_token}`, 'Accept': 'application/json' } })
      const body = await r.json().catch(() => null)
      const itens = Array.isArray(body?.data) ? body.data : []
      itens.forEach(c => { if (c?.id != null) map[c.id] = c.descricao || c.nome || `Categoria ${c.id}` })
      if (itens.length < 100) break
    }
  } catch { /* enriquecimento é opcional */ }
  return map
}

// Nome de um contato — retorna { nome, negado } para distinguir 403 de 429
export async function fetchContatoNome(integ, id) {
  try {
    const r = await blingGet(integ, `contatos/${id}`)
    if (r.status === 403) return { nome: null, negado: true }
    return { nome: r.ok ? (r.body?.data?.nome || null) : null, negado: false }
  } catch { return { nome: null, negado: false } }
}

export const chunk = (arr, n) => arr.reduce((a, _, i) => (i % n ? a : [...a, arr.slice(i, i + n)]), [])

// Data de pagamento/recebimento: mora no BORDERÔ (detalhe traz só o id)
export async function fetchBorderoData(integ, borderoId) {
  try {
    const r = await blingGet(integ, `borderos/${borderoId}`)
    if (!r.ok) return null
    const d = r.body?.data
    return d?.data || d?.dataPagamento || d?.dataLiquidacao || null
  } catch { return null }
}


// ── Mapeamento defensivo de um título Bling → registro interno ──────────────
// Situação (numérica ou textual) → status interno. Fallback: 'aberto'.
const SITUACAO_MAP = {
  '1': 'aberto', '2': 'pago', '3': 'parcial', '5': 'cancelado',
  'em aberto': 'aberto', 'atrasada': 'aberto', 'atrasado': 'aberto',
  'pago': 'pago', 'paga': 'pago', 'recebido': 'pago', 'recebida': 'pago', 'liquidado': 'pago',
  'parcial': 'parcial', 'parcialmente': 'parcial',
  'cancelado': 'cancelado', 'cancelada': 'cancelado',
}
export function mapSituacao(s) {
  const k = String(s ?? '').trim().toLowerCase()
  return SITUACAO_MAP[k] || 'aberto'
}

const pick = (obj, keys) => { for (const k of keys) { const v = k.split('.').reduce((o, p) => o?.[p], obj); if (v !== undefined && v !== null && v !== '') return v } return null }
// Só aceita string limpa — blindagem contra objeto/JSON virar descrição
const str = (v) => (typeof v === 'string' && v.trim()) ? v.trim() : null

// Retorna { registro, camposFaltantes } — nunca lança por campo ausente
export function mapConta(item, { tipoFluxo, empresaId }) {
  const faltantes = []
  const id     = pick(item, ['id'])
  const valor  = pick(item, ['valor', 'valorTitulo', 'vlrTitulo'])
  const venc   = pick(item, ['vencimento', 'dataVencimento'])
  if (id == null)    faltantes.push('id')
  if (valor == null) faltantes.push('valor')
  if (!venc)         faltantes.push('vencimento')
  const situ   = pick(item, ['situacao', 'situacao.valor', 'situacao.id'])
  const status = mapSituacao(situ)
  const registro = {
    empresa_id:      empresaId,
    doc_ref:         id != null ? `bling:${tipoFluxo}:${id}` : null,
    tipo:            tipoFluxo, // 'entrada' | 'saida'
    valor:           Math.abs(Number(valor) || 0),
    data:            venc || null,
    data_emissao:    pick(item, ['dataEmissao', 'emissao']) || null,
    descricao:       str(pick(item, ['contato.nome', 'historico', 'descricao', 'observacoes']))
                       || (pick(item, ['contato.id']) != null ? `Contato ${pick(item, ['contato.id'])}` : 'Título Bling'),
    categoria:       str(pick(item, ['categoria.descricao', 'categoria.nome', 'portador.descricao'])) || 'Sem categoria',
    status,
    data_liquidacao: status === 'pago' ? (pick(item, ['dataLiquidacao', 'dataPagamento', 'dataRecebimento']) || null) : null,
    valor_liquidado: pick(item, ['valorPago', 'valorRecebido', 'saldoPago']) ?? (status === 'pago' ? Math.abs(Number(valor) || 0) : null),
  }
  return { registro, faltantes }
}


// ─── Processa UMA página de fluxo (compartilhado entre sync manual e cron) ──
// Traz cada título COMPLETO: pula os já completos, busca detalhe do resto,
// resolve categoria/contato/competência/parcial/liquidação. Retorna
// { gravados, itens, cacheAtualizado }.
export async function processarPaginaFluxo(admin, integ, recurso, tipoFluxo, pagina, limite, categoriasMap, nomesContato) {
  const itens = await fetchContas(integ, recurso, pagina, limite)
  const docRefs = itens.map(i => `bling:${tipoFluxo}:${i.id}`)
  const { data: existentes } = await admin.from('fluxo_caixa')
    .select('doc_ref,descricao,categoria,competencia,status,data_liquidacao').in('doc_ref', docRefs)
  const hojeSync = new Date().toISOString().split('T')[0]
  const completo = {}
  ;(existentes || []).forEach(e => {
    const id = e.doc_ref.split(':').pop()
    const descOk = e.descricao && !/^Contato \d+$/.test(e.descricao) && e.descricao !== 'Sem descrição' && e.descricao !== 'Título Bling'
    const dadosOk = descOk && e.categoria && e.categoria !== 'Sem categoria' && !!e.competencia
    const pagoOk  = e.status !== 'pago' || !!e.data_liquidacao
    // Título em aberto/parcial cujo vencimento já passou PODE ter sido pago
    // no Bling desde a última sync → NÃO é "completo", força reconferência
    const statusPodeMudar = ['aberto','parcial'].includes(e.status) && e.data <= hojeSync
    completo[id] = dadosOk && pagoOk && !statusPodeMudar
  })
  const aDetalhar = itens.filter(i => !completo[i.id])
  const detalhes = {}
  for (const grupo of chunk(aDetalhar.map(i => i.id).filter(Boolean), 8)) {
    const ds = await Promise.all(grupo.map(id => fetchDetalhe(integ, recurso, id)))
    grupo.forEach((id, ix) => { if (ds[ix]) detalhes[id] = ds[ix] })
  }
  const registros = []
  for (const item of itens) {
    if (completo[item?.id] && !detalhes[item?.id]) continue
    const det = detalhes[item?.id] || {}
    const base = { ...item, ...det }
    const cid = base?.contato?.id
    if (cid != null && !base?.contato?.nome) {
      if (nomesContato[cid] === undefined) { const rc = await fetchContatoNome(integ, cid); nomesContato[cid] = rc.nome }
      if (nomesContato[cid]) base.contato = { ...base.contato, nome: nomesContato[cid] }
    }
    const { registro, faltantes } = mapConta(base, { tipoFluxo, empresaId: integ.empresa_id })
    if (faltantes.length || !registro.doc_ref || !registro.data) continue
    const catId = base?.categoria?.id
    if (catId != null && categoriasMap[catId]) registro.categoria = categoriasMap[catId]
    if (base?.competencia && base.competencia !== '0000-00-00') registro.competencia = base.competencia
    const sld = Number(base?.saldo)
    if (Number.isFinite(sld) && sld > 0 && sld < registro.valor) { registro.status = 'parcial'; registro.valor_liquidado = Number((registro.valor - sld).toFixed(2)) }
    if (registro.status === 'pago' && Array.isArray(base?.borderos) && base.borderos.length) {
      const dt = await fetchBorderoData(integ, base.borderos[base.borderos.length - 1]); if (dt && dt !== '0000-00-00') registro.data_liquidacao = dt
    }
    registros.push(registro)
  }
  let gravados = 0
  if (registros.length) {
    const { error, count } = await admin.from('fluxo_caixa').upsert(registros, { onConflict: 'doc_ref', count: 'exact' })
    if (!error) gravados = count ?? registros.length
  }
  return { gravados, recebidos: itens.length, paginaCheia: itens.length >= limite }
}
