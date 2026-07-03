// ─── bling-server.js — Integração Bling API v3 (APENAS server-side) ─────────
// URLs com override por env para calibração sem redeploy de código.
// O mapeamento de campos é DEFENSIVO: a primeira sincronização deve rodar em
// modo diagnóstico (?diag=1) para validar o payload real antes de gravar.
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const BLING = {
  AUTH_URL:  process.env.BLING_AUTH_URL  || 'https://www.bling.com.br/Api/v3/oauth/authorize',
  TOKEN_URL: process.env.BLING_TOKEN_URL || 'https://www.bling.com.br/Api/v3/oauth/token',
  API_BASE:  process.env.BLING_API_BASE  || 'https://api.bling.com.br/Api/v3',
}

export function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
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
    descricao:       pick(item, ['contato.nome', 'historico', 'descricao', 'observacoes']) || 'Título Bling',
    categoria:       pick(item, ['categoria.descricao', 'categoria.nome', 'portador.descricao']) || 'Sem categoria',
    status,
    data_liquidacao: status === 'pago' ? (pick(item, ['dataLiquidacao', 'dataPagamento', 'dataRecebimento']) || null) : null,
    valor_liquidado: pick(item, ['valorPago', 'valorRecebido', 'saldoPago']) ?? (status === 'pago' ? Math.abs(Number(valor) || 0) : null),
  }
  return { registro, faltantes }
}
