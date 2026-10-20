// ─── bling-server.js — Integração Bling API v3 (APENAS server-side) ─────────
// URLs com override por env para calibração sem redeploy de código.
// O mapeamento de campos é DEFENSIVO: a primeira sincronização deve rodar em
// modo diagnóstico (?diag=1) para validar o payload real antes de gravar.
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import {
  partesDocRef, decidirDestino, podeRemover,
  FASES_LIQUIDADOS, filtrosPorPagamento, LIMITE_PAGINA_LIQUIDADOS, avancarListagem,
  candidatosLiquidados, filaPlausivel, idsDaPagina,
} from './bling-reconferencia'

export const pausa = (ms) => new Promise(r => setTimeout(r, ms))

// ── Limitador de taxa das chamadas ao Bling ─────────────────────────────────
// O Bling v3 aceita ~3 requisições/segundo por aplicativo. As rotinas
// disparavam RAJADAS paralelas (o enriquecimento processava 6 títulos ao mesmo
// tempo, cada um com até 3 chamadas — detalhe + contato + borderô — ou seja,
// até 18 requisições quase simultâneas). O Bling rejeitava o excedente com
// HTTP 429, que virava "erro" e deixava o título pendente.
// Este limitador SERIALIZA todas as chamadas com espaçamento mínimo,
// eliminando o 429 na origem — vale para enriquecimento, sync e cron.
// Calibrável por env para permitir testes rápidos e ajuste operacional sem alterar a lógica.
const RATE_MIN_MS = Number(process.env.BLING_RATE_MIN_MS) || 380   // ~2,6 req/s (margem sobre o limite de 3)
let _ultimaReq = 0
let _fila = Promise.resolve()
function aguardarVez() {
  const p = _fila.then(async () => {
    const espera = _ultimaReq + RATE_MIN_MS - Date.now()
    if (espera > 0) await pausa(espera)
    _ultimaReq = Date.now()
  })
  _fila = p.catch(() => {})
  return p
}


// ── Header obrigatório da migração JWT ──────────────────────────────────────
// A autenticação por tokens opacos está DESCONTINUADA no Bling. Sem este
// header, o endpoint de token continua devolvendo token opaco — que deixará de
// ser aceito na data de bloqueio.
//
// A documentação é explícita em três pontos:
//   · obter token   → enable-jwt: 1 no POST /oauth/token
//   · RENOVAR token → enable-jwt: 1 também, senão a renovação volta a emitir
//                     token opaco e a migração se desfaz sozinha
//   · usar a API    → enable-jwt: 1 em TODA requisição autenticada
//
// Calibrável por env para permitir rollback sem redeploy, caso o Bling mude o
// contrato antes da data de corte.
const JWT_HEADER = process.env.BLING_DISABLE_JWT === '1' ? {} : { 'enable-jwt': '1' }

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
      ...JWT_HEADER,   // sem isto, o Bling devolve token OPACO (descontinuado)
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
// `forcar` renova mesmo com o token ainda dentro da validade. Usado na
// transição para JWT: o token gravado é OPACO e, uma vez que passamos a enviar
// enable-jwt, ele pode ser rejeitado antes de expirar. Renovar força a emissão
// de um JWT sem depender do relógio.
// Referência ao client admin, guardada para que blingGet possa renovar em 401
// sem exigir que sete assinaturas propaguem o parâmetro — cada uma seria um
// ponto a esquecer. As três rotas que consomem a API (sync, cron, enrich)
// SEMPRE chamam ensureToken antes de qualquer busca, então a referência está
// sempre disponível quando necessária.
let _admin = null

export async function ensureToken(admin, integ, { forcar = false } = {}) {
  if (admin) _admin = admin
  const expira = integ.token_expira_em ? new Date(integ.token_expira_em).getTime() : 0
  if (!forcar && integ.access_token && expira - Date.now() > 120_000) return integ
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
// Erros lançados aqui carregam a página do cursor original para que a rota
// possa repetir exatamente o ponto que falhou, sem vazar subpáginas.
export async function fetchContas(integ, recurso, pagina = 1, limite = 100, filtros = {}, profundidade = 0) {
  const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite) })
  for (const [chave, valor] of Object.entries(filtros || {})) {
    if (valor === undefined || valor === null || valor === '') continue
    if (Array.isArray(valor)) valor.forEach(v => params.append(`${chave}[]`, String(v)))
    else params.set(chave, String(valor))
  }
  const r = await blingGet(integ, `${recurso}?${params.toString()}`)
  if (r.ok) return Array.isArray(r.body?.data) ? r.body.data : []

  // Degradação de lote: a página N com limite L equivale exatamente às
  // páginas 2N-1 e 2N com limite L/2. Só é aplicada para gateway, limite par
  // e no máximo duas divisões; filtros permanecem idênticos nas subconsultas.
  const metade = limite / 2
  if (r.gateway && profundidade < 2 && limite % 2 === 0 && metade >= 10) {
    try {
      const a = await fetchContas(integ, recurso, pagina * 2 - 1, metade, filtros, profundidade + 1)
      const b = a.length < metade
        ? []
        : await fetchContas(integ, recurso, pagina * 2, metade, filtros, profundidade + 1)
      return [...a, ...b]
    } catch (sub) {
      sub.pagina = pagina
      sub.limite = limite
      sub.recurso = recurso
      throw sub
    }
  }

  const err = new Error(`Bling ${recurso} p${pagina} (HTTP ${r.status}): ${r.gateway
    ? 'a origem do Bling não respondeu dentro do tempo permitido após as tentativas de repetição'
    : JSON.stringify(r.body).slice(0, 300)}`)
  err.gateway = !!r.gateway
  err.status = r.status
  err.recurso = recurso
  err.pagina = pagina
  err.limite = limite
  throw err
}

// ── Erros de gateway × rate limit ───────────────────────────────────────────
// Gateway representa indisponibilidade da origem (Cloudflare/Bling), enquanto
// 429 indica apenas que devemos desacelerar as chamadas.
const GATEWAY_STATUS = new Set([502, 503, 504, 520, 521, 522, 523, 524])
export const ehGateway = (status) => GATEWAY_STATUS.has(Number(status))
const REQ_TIMEOUT_MS = Number(process.env.BLING_REQ_TIMEOUT_MS) || 20_000
const BACKOFF_GATEWAY_MS = Number(process.env.BLING_BACKOFF_GATEWAY_MS) || 2_000
const BACKOFF_RATE_MS = Number(process.env.BLING_BACKOFF_RATE_MS) || 500

// GET no Bling com retry em 429/5xx/timeout. O timeout evita que uma origem
// pendurada consuma todo o orçamento da função serverless.
export async function blingGet(integ, path, { tentativas = 4, timeoutMs = REQ_TIMEOUT_MS, admin = null } = {}) {
  let ultimoStatus = 0
  let jaRenovou = false   // uma renovação por chamada: evita laço em 401 crônico
  for (let tent = 1; tent <= tentativas; tent++) {
    await aguardarVez()
    let r = null
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      r = await fetch(`${BLING.API_BASE}/${path}`, {
        headers: {
          'Authorization': `Bearer ${integ.access_token}`,
          'Accept': 'application/json',
          ...JWT_HEADER,   // exigido em toda requisição autenticada
        },
        signal: ctl.signal,
        cache: 'no-store',
      })
    } catch {
      r = null
    } finally {
      clearTimeout(timer)
    }

    const status = r ? r.status : 504
    ultimoStatus = status
    const gateway = ehGateway(status)
    // 401 = token expirado ou inválido. Antes não era tratado: caía direto no
    // retorno de erro e a sincronização parava sem se recuperar.
    // Crítico na migração JWT — se o Bling recusar a combinação
    // "token opaco + enable-jwt", TODA integração quebraria de uma vez, e só
    // voltaria com reconexão manual das três entidades. Com a renovação aqui,
    // o primeiro 401 troca o opaco por JWT e a chamada segue.
    const adm = admin || _admin
    if (status === 401 && adm && tent < tentativas && !jaRenovou) {
      jaRenovou = true
      try {
        integ = await ensureToken(adm, integ, { forcar: true })
        continue
      } catch { /* sem refresh_token válido: cai no fluxo normal de erro */ }
    }

    if (!r || status === 429 || status >= 500) {
      if (tent < tentativas) {
        const ra = Number(r?.headers?.get('retry-after'))
        const base = gateway ? BACKOFF_GATEWAY_MS : BACKOFF_RATE_MS
        const espera = Number.isFinite(ra) && ra > 0
          ? Math.min(ra * 1000, 15_000)
          : Math.min(20_000, base * 2 ** (tent - 1)) + Math.floor(Math.random() * 400)
        await pausa(espera)
        continue
      }
      return { ok: false, status, body: null, gateway }
    }

    const body = await r.json().catch(() => null)
    return { ok: r.ok, status, body, gateway: false }
  }
  return { ok: false, status: ultimoStatus, body: null, gateway: ehGateway(ultimoStatus) }
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
      const r = await blingGet(integ, `categorias/receitas-despesas?pagina=${pg}&limite=100`)
      const body = r.body
      const itens = Array.isArray(body?.data) ? body.data : []
      itens.forEach(c => { if (c?.id != null) map[c.id] = c.descricao || c.nome || `Categoria ${c.id}` })
      if (itens.length < 100) break
    }
  } catch { /* enriquecimento é opcional */ }
  return map
}

// Resolve UMA categoria pelo detalhe (cobre inativas/fora da listagem)
export async function fetchCategoriaNome(integ, id) {
  try {
    const r = await blingGet(integ, `categorias/receitas-despesas/${id}`)
    return r.body?.data?.descricao || r.body?.data?.nome || null
  } catch { return null }
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
export async function fetchBordero(integ, borderoId) {
  try {
    const r = await blingGet(integ, `borderos/${borderoId}`)
    if (!r.ok) return { data: null, valorPago: null }
    const d = r.body?.data
    // O borderô é a fonte da verdade do que SAIU/ENTROU de fato: traz o valor
    // pago com juros, multa, desconto e tarifa já aplicados. Pode divergir do
    // valor do título (ex.: título alterado depois de emitido).
    const pgs = Array.isArray(d?.pagamentos) ? d.pagamentos : []
    const valorPago = pgs.reduce((a, p) => a + (Number(p?.valorPago) || 0), 0)
    return {
      data: d?.data || d?.dataPagamento || d?.dataLiquidacao || null,
      valorPago: valorPago > 0 ? Number(valorPago.toFixed(2)) : null,
    }
  } catch { return { data: null, valorPago: null } }
}

// Compatibilidade: só a data
export async function fetchBorderoData(integ, borderoId) {
  const b = await fetchBordero(integ, borderoId)
  return b.data
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
// Critério ÚNICO de completude — fonte da verdade para sync manual e cron
// Coerência de valor_liquidado. Existe porque status, valor e vencimento
// podem estar TODOS corretos enquanto o liquidado está deformado — foi
// exatamente o caso ALEXANDRE 1414/11 (pago, 22.000, venc 15/07, tudo batendo
// com o Bling, mas liquidado gravado como 5.000). Sem esta verificação o
// titulo era considerado "completo" e nunca mais reprocessado, por mais
// sincronizações que se rodasse.
export function liquidadoCoerente(e) {
  const v = Math.abs(Number(e?.valor) || 0)
  const l = e?.valor_liquidado == null ? null : Math.abs(Number(e.valor_liquidado) || 0)
  if (e?.status === 'pago')    return l != null && Math.abs(l - v) < 0.01
  if (e?.status === 'parcial') return l != null && l > 0 && l < v - 0.005
  return true   // aberto/cancelado não têm liquidado a conferir
}

export function tituloCompleto(e, hoje = new Date().toISOString().split('T')[0]) {
  const descOk = e.descricao && !/^Contato \d+$/.test(e.descricao) && e.descricao !== 'Sem descrição' && e.descricao !== 'Título Bling'
  const dadosOk = descOk && e.categoria && e.categoria !== 'Sem categoria' && !!e.competencia
  const pagoOk  = e.status !== 'pago' || !!e.data_liquidacao
  // Aberto/parcial pode ter sido pago no Bling a QUALQUER momento — inclusive
  // ANTES do vencimento (pagamento antecipado é rotina). Antes a condição
  // exigia 'e.data <= hoje', então um título pago em 29/07 que vencia em 31/07
  // era considerado imutável e nunca reconferido: continuava aparecendo no
  // fluxo na data de vencimento, e não na data real do pagamento.
  const statusPodeMudar = ['aberto','parcial'].includes(e.status)
  return dadosOk && pagoOk && !statusPodeMudar && liquidadoCoerente(e)
}

// Monta os registros de fluxo COMPLETOS de uma página (sem gravar) — núcleo
// compartilhado. Retorna { registros, itens, detalhes, paginaCheia }.
// ── ORÇAMENTO DE TEMPO ───────────────────────────────────────────────────────
// Cada detalhe e cada borderô passam pelo limitador de taxa (~380ms). Numa
// página de 50 títulos, detalhar tudo custa ~19s, e buscar o borderô de cada
// um custa outros ~19s. Somado à verificação de exclusões, isso ultrapassa o
// maxDuration de 60s da Vercel: a função é morta e o navegador reporta
// "Failed to fetch" — sem resposta, sem cursor salvo, sem diagnóstico.
//
// Antes da verificação de coerência do liquidado (28/08), quase todos os
// títulos eram pulados por já estarem completos, e o custo por página era
// baixo. A verificação quebrou essa premissa sem que o orçamento fosse
// ajustado. Agora o trabalho é limitado por tempo e o que não couber fica
// para a varredura seguinte — o cursor garante que nada se perde.
export async function montarRegistrosFluxo(admin, integ, recurso, tipoFluxo, pagina, limite, categoriasMap, nomesContato, itensPre = null, filtros = {}, orcamento = {}) {
  const t0 = orcamento.inicio || Date.now()
  const prazoMs = orcamento.prazoMs || 32000
  const sobra = () => prazoMs - (Date.now() - t0)
  const itens = itensPre || await fetchContas(integ, recurso, pagina, limite, filtros)
  const docRefs = itens.map(i => `bling:${tipoFluxo}:${i.id}`)
  const { data: existentes } = await admin.from('fluxo_caixa')
    .select('doc_ref,descricao,categoria,competencia,status,data,data_liquidacao,valor,valor_liquidado').in('doc_ref', docRefs)
  const existMap = {}
  ;(existentes || []).forEach(e => { existMap[e.doc_ref.split(':').pop()] = e })
  const completo = {}
  for (const i of itens) {
    const e = existMap[i.id]
    if (!e) { completo[i.id] = false; continue }
    if (!tituloCompleto(e)) { completo[i.id] = false; continue }
    // A listagem do Bling já informa a situação — comparar com a nossa custa
    // ZERO chamadas extras e detecta mudanças (pagamento antecipado, estorno)
    // que antes passavam batido.
    // A listagem já traz situação, valor e vencimento: qualquer divergência
    // (pagamento antecipado, título EDITADO no Bling, estorno) força o detalhe.
    const statusBling = mapSituacao(pick(i, ['situacao', 'situacao.valor', 'situacao.id']))
    const valorBling  = Math.abs(Number(pick(i, ['valor'])) || 0)
    const vencBling   = pick(i, ['vencimento', 'dataVencimento']) || null
    const mesmoValor  = Math.abs(valorBling - Math.abs(Number(e.valor) || 0)) < 0.01
    const mesmoVenc   = !vencBling || vencBling === e.data
    // Coerência do liquidado entra no critério: sem ela, um título com status,
    // valor e vencimento corretos mas liquidado deformado jamais era
    // reprocessado — o defeito ficava permanente na base.
    completo[i.id] = (statusBling === e.status) && mesmoValor && mesmoVenc && liquidadoCoerente(e)
  }
  // PRIORIDADE: títulos NOVOS antes dos que só precisam de revisão. Com prazo
  // apertado, dado inédito sempre entra; correção de valor pode esperar a
  // próxima varredura. O inverso deixaria lançamentos recentes de fora.
  const novos   = itens.filter(i => !completo[i.id] && !existMap[i.id])
  const revisar = itens.filter(i => !completo[i.id] &&  existMap[i.id])
  const aDetalhar = [...novos, ...revisar]
  const detalhes = {}
  let adiados = 0
  for (const grupo of chunk(aDetalhar.map(i => i.id).filter(Boolean), 8)) {
    // Reserva ~40% do prazo para os borderôs e o upsert, que vêm depois.
    if (sobra() < prazoMs * 0.4) { adiados += grupo.length; continue }
    const ds = await Promise.all(grupo.map(id => fetchDetalhe(integ, recurso, id)))
    grupo.forEach((id, ix) => { if (ds[ix]) detalhes[id] = ds[ix] })
  }
  const registros = []
  for (const item of itens) {
    if (completo[item?.id] && !detalhes[item?.id]) continue
    // Precisava de detalhe e não coube no prazo: NÃO gravar. Sem o detalhe o
    // registro sairia degradado (sem categoria, competência e liquidação) e
    // sobrescreveria dados bons. Fica para a próxima varredura.
    if (!completo[item?.id] && !detalhes[item?.id]) { adiados++; continue }
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
    if (catId != null && !categoriasMap[catId]) {
      const nome = await fetchCategoriaNome(integ, catId)
      if (nome) categoriasMap[catId] = nome  // cacheia p/ os próximos da página
    }
    if (catId != null && categoriasMap[catId]) registro.categoria = categoriasMap[catId]
    if (base?.competencia && base.competencia !== '0000-00-00') registro.competencia = base.competencia
    const sld = Number(base?.saldo)
    if (Number.isFinite(sld) && sld > 0 && sld < registro.valor) { registro.status = 'parcial'; registro.valor_liquidado = Number((registro.valor - sld).toFixed(2)) }
    // ── Borderô: DATA sempre; VALOR só quando o título não está quitado ─────
    //
    // O borderô é a fonte da verdade da DATA em que o dinheiro se moveu.
    // Para o VALOR ele é traiçoeiro em dois cenários reais:
    //
    //   a) BORDERÔ COMPARTILHADO — uma guia única quita vários títulos
    //      (parcelamentos da Receita Federal, guias da Prefeitura). O borderô
    //      traz o valor da GUIA INTEIRA; atribuí-lo a cada título replica o
    //      mesmo número em todos. Medido em 31/07/2026: nove títulos com
    //      -1.553,63 idênticos, onde o Bling tinha dezoito valores distintos.
    //
    //   b) MÚLTIPLOS BORDERÔS COM ESTORNO — retiradas parciais são estornadas
    //      e reclassificadas, e o título é quitado integralmente depois. Lendo
    //      só `borderos[length-1]` pegava-se o borderô errado. Caso ALEXANDRE
    //      FRANCISCO, título 1414/11 de 10/07/2026: valor 22.000, gravado como
    //      5.000 — a soma exata de três retiradas parciais estornadas.
    //      Somar TODOS os borderôs também erraria: daria 27.000.
    //
    // Regra adotada: título integralmente pago na origem tem valor_liquidado
    // igual ao VALOR DO TÍTULO. Nenhum borderô pode reduzi-lo. O borderô só
    // define o valor quando o título está PARCIAL e o saldo não o informou.
    const quitado = registro.status === 'pago'
    if (['pago','parcial'].includes(registro.status)
        && Array.isArray(base?.borderos) && base.borderos.length
        && sobra() > 4000) {
      const bd = await fetchBordero(integ, base.borderos[base.borderos.length - 1])
      if (bd.data && bd.data !== '0000-00-00') registro.data_liquidacao = bd.data
      // Parcial sem saldo informado: o borderô é a única pista do liquidado.
      if (!quitado && bd.valorPago && !(Number.isFinite(sld) && sld > 0)) {
        registro.valor_liquidado = Math.min(bd.valorPago, registro.valor)
      }
    }
    // Trava final: pago é pago. Um título quitado não pode carregar liquidado
    // menor que o próprio valor — era essa inconsistência que passava calada.
    if (quitado) registro.valor_liquidado = registro.valor
    registros.push(registro)
  }
  return { registros, itens, detalhes, adiados, paginaCheia: itens.length >= limite }
}

// Wrapper que grava (usado pelo cron, que só faz fluxo).
// `orcamento` limita o tempo da página: sem ele valia o padrão de 32s de
// montarRegistrosFluxo, maior que a fatia de cada entidade no cron.
export async function processarPaginaFluxo(admin, integ, recurso, tipoFluxo, pagina, limite, categoriasMap, nomesContato, filtros = {}, orcamento = {}) {
  const { registros, itens, paginaCheia } = await montarRegistrosFluxo(admin, integ, recurso, tipoFluxo, pagina, limite, categoriasMap, nomesContato, null, filtros, orcamento)
  let gravados = 0
  if (registros.length) {
    const { error, count } = await admin.from('fluxo_caixa').upsert(registros, { onConflict: 'doc_ref', count: 'exact' })
    if (!error) gravados = count ?? registros.length
  }
  return { gravados, recebidos: itens.length, paginaCheia }
}


// ── Remoção de título excluído na origem — FONTE ÚNICA ──────────────────────
// Usada pela verificação de exclusões (liquidados recentes) e pela fila de
// reconferência (em aberto fora da listagem). Antes o DELETE morava dentro de
// verificarExclusoes; uma segunda cópia na fila divergiria no registro de
// auditoria, que é o que permite restaurar o título se o 404 tiver sido falso.
export async function removerTituloExcluido(admin, t, autor) {
  const { error } = await admin.from('fluxo_caixa').delete().eq('id', t.id)
  if (error) return false
  admin.from('audit_logs').insert({
    organization_id: t.organization_id, table_name: 'fluxo_caixa', record_id: t.id,
    action: 'DELETE', changed_by_email: autor,
    old_data: { ...t, motivo: 'título não existe mais no Bling (excluído na origem)' },
  }).then(() => {}, () => {})
  return true
}

// ── Verificação de EXCLUSÕES na origem — LIQUIDADOS recentes ────────────────
// A sincronização é "upsert-only": só adiciona/atualiza o que o Bling devolve.
// Um título liquidado excluído lá some da listagem e, como já estava completo
// aqui, nunca mais é reconferido. Foi o que inflou julho/2026 em R$ 329 mil
// (câmbio lançado errado, excluído e relançado). Esta rotina confere a
// EXISTÊNCIA dos liquidados recentes e remove os que sumiram da origem.
//
// ⚠️ Títulos EM ABERTO e PARCIAIS não são mais conferidos aqui (16/10/2026).
// A consulta deles pegava os ~30 de vencimento MAIS DISTANTE dentro de 90 dias
// — parcelas futuras que existem — e nunca os vencidos que tinham sumido
// (DATAPREV R$ 1,34 mi, JULIANO 15/07). Eles agora vão para a fila de
// reconferência (lib/bling-reconferencia.js), montada com o que a listagem
// de fato não devolveu, sem janela de datas e do mais antigo para o mais novo.
export async function verificarExclusoes(admin, integ, { desde, limite = 60, prazoMs = 20000 } = {}) {
  const inicio = Date.now()
  // Registro inteiro: é ele que vai para o audit_logs se o título for removido,
  // e restaurar exige categoria, tipo e competência, não só valor e datas.
  const sel = '*'
  const { data: alvos } = await admin.from('fluxo_caixa').select(sel)
    .eq('empresa_id', integ.empresa_id).like('doc_ref', 'bling:%')
    .eq('origem_ausente', false)
    .gte('data_liquidacao', desde)
    .order('data_liquidacao', { ascending: false }).limit(limite)

  let verificados = 0, removidos = 0, valorRemovido = 0
  for (const t of alvos || []) {
    if (Date.now() - inicio > prazoMs) break
    if (!podeRemover(removidos)) break
    const p = partesDocRef(t.doc_ref)
    if (!p) continue
    const p1 = await blingGet(integ, `${p.recurso}/${p.id}`)
    verificados++
    if (p1.status !== 404) continue
    const p2 = await blingGet(integ, `${p.outroRecurso}/${p.id}`)
    if (decidirDestino(p1.status, p2.status) !== 'remover') continue
    if (await removerTituloExcluido(admin, t, 'sistema:verificacao-exclusoes')) {
      removidos++; valorRemovido += Math.abs(Number(t.valor) || 0)
    }
  }
  return { verificados, removidos, valorRemovido: Number(valorRemovido.toFixed(2)) }
}

// ── Títulos em aberto e parciais do Bling de uma entidade ───────────────────
// Base da fila de reconferência. Pagina de 1.000 em 1.000: a FACE tem ~2.600.
export async function titulosEmAbertoDoBling(admin, empresaId) {
  const sel = 'doc_ref,status,data,origem_ausente'
  let todos = [], pg = 0
  while (true) {
    const { data, error } = await admin.from('fluxo_caixa').select(sel)
      .eq('empresa_id', empresaId).in('status', ['aberto', 'parcial']).like('doc_ref', 'bling:%')
      .order('id', { ascending: true }).range(pg * 1000, pg * 1000 + 999)
    if (error) throw new Error(`Leitura dos títulos em aberto: ${error.message}`)
    if (!data || !data.length) break
    todos = todos.concat(data)
    if (data.length < 1000) break
    pg++
  }
  return todos
}

// ── Fila de reconferência: confere no Bling, um a um, pelo id ───────────────
// Recebe a fila (doc_refs) e processa enquanto houver prazo. Devolve a fila
// restante: o que não coube no prazo, o que falhou de forma transitória e o
// que excederia o teto de remoções continuam nela para a próxima execução.
export async function processarFilaReconferencia(admin, integ, {
  fila = [], prazoMs = 20000, categoriasMap = {}, nomesContato = {},
  statusAlvo = ['aberto', 'parcial'], autor = 'sistema:reconferencia',
} = {}) {
  const inicio = Date.now()
  const restante = []
  const r = { verificados: 0, atualizados: 0, removidos: 0, valorRemovido: 0, descartados: 0, mantidos: 0 }
  // Registro inteiro: é ele que vai para o audit_logs se o título for removido,
  // e restaurar exige categoria, tipo e competência, não só valor e datas.
  const sel = '*'

  for (let i = 0; i < fila.length; i++) {
    const docRef = fila[i]
    // Cada título custa GET próprio + eventual GET do outro recurso + detalhe e
    // borderô na atualização. Sem folga para isso, o resto volta para a fila.
    if (Date.now() - inicio > prazoMs - 4000) { restante.push(...fila.slice(i)); break }
    const p = partesDocRef(docRef)
    if (!p) continue

    const { data: t } = await admin.from('fluxo_caixa').select(sel)
      .eq('empresa_id', integ.empresa_id).eq('doc_ref', docRef).maybeSingle()
    // Já não existe aqui, ou mudou de situação desde que entrou na fila: nada
    // a conferir. A fila dos liquidados passa statusAlvo pago/parcial.
    if (!t || !statusAlvo.includes(t.status)) continue

    const p1 = await blingGet(integ, `${p.recurso}/${p.id}`)
    const p2 = p1.status === 404 ? await blingGet(integ, `${p.outroRecurso}/${p.id}`) : null
    r.verificados++
    const destino = decidirDestino(p1.status, p2?.status)

    if (destino === 'atualizar') {
      const dado = p1.body?.data
      if (!dado) { r.mantidos++; restante.push(docRef); continue }
      const { registros } = await montarRegistrosFluxo(admin, integ, p.recurso, p.tipoFluxo, 0, 1,
        categoriasMap, nomesContato, [dado], {}, { inicio: Date.now(), prazoMs: 8000 })
      if (!registros.length) { r.mantidos++; restante.push(docRef); continue }
      const { error } = await admin.from('fluxo_caixa').upsert(registros, { onConflict: 'doc_ref' })
      if (error) { r.mantidos++; restante.push(docRef); continue }
      r.atualizados++
    } else if (destino === 'remover') {
      if (!podeRemover(r.removidos)) { r.mantidos++; restante.push(docRef); continue }
      if (await removerTituloExcluido(admin, t, autor)) {
        r.removidos++; r.valorRemovido += Math.abs(Number(t.valor) || 0)
      } else { r.mantidos++; restante.push(docRef) }
    } else if (destino === 'descartar') {
      r.descartados++
    } else {
      r.mantidos++; restante.push(docRef)
    }
  }
  r.valorRemovido = Number(r.valorRemovido.toFixed(2))
  return { ...r, fila: restante }
}

// ── Liquidados do sistema numa janela — base da conferência dos liquidados ──
export async function titulosLiquidadosDoSistema(admin, empresaId, janela) {
  const sel = 'doc_ref,status,data_liquidacao,origem_ausente'
  let todos = [], pg = 0
  while (true) {
    const { data, error } = await admin.from('fluxo_caixa').select(sel)
      .eq('empresa_id', empresaId).in('status', ['pago', 'parcial']).like('doc_ref', 'bling:%')
      .gte('data_liquidacao', janela.inicio).lte('data_liquidacao', janela.fim)
      .order('id', { ascending: true }).range(pg * 1000, pg * 1000 + 999)
    if (error) throw new Error(`Leitura dos liquidados: ${error.message}`)
    if (!data || !data.length) break
    todos = todos.concat(data)
    if (data.length < 1000) break
    pg++
  }
  return todos
}

// ── Conferência dos liquidados: uma fatia de trabalho ───────────────────────
// Regras em lib/bling-reconferencia.js. Recebe o estado da rodada
// (integracoes.conferencia_liquidados), trabalha enquanto houver prazo e
// devolve o estado novo — quem chama grava. Etapas:
//   listagem → páginas da listagem filtrada por data de pagamento, só os ids
//   comparar → candidatos: o que a listagem completa não devolveu
//   fila     → cada candidato conferido pelo id (processarFilaReconferencia)
// Página com erro interrompe a fatia SEM avançar: a rodada só compara depois
// de uma listagem inteira lida com sucesso.
export async function conferirLiquidados(admin, integ, { estado, prazoMs = 20000, categoriasMap = {}, nomesContato = {} } = {}) {
  const inicio = Date.now()
  const resumo = { paginas: 0, candidatos: null, verificados: 0, atualizados: 0, removidos: 0, valorRemovido: 0, mantidos: 0 }
  let e = { ...estado }

  while (e.etapa === 'listagem' && Date.now() - inicio < prazoMs - 4000) {
    const fase = FASES_LIQUIDADOS[e.fase]
    let itens
    try {
      itens = await fetchContas(integ, fase.recurso, e.pagina, LIMITE_PAGINA_LIQUIDADOS, filtrosPorPagamento(fase, e.janela))
    } catch (err) {
      resumo.interrompido = `Bling indisponível (HTTP ${err?.status ?? '?'}) na listagem de ${fase.filtro}, pág. ${e.pagina}`
      return { estado: e, resumo }
    }
    resumo.paginas++
    e = avancarListagem(e, { ids: idsDaPagina(itens), paginaCheia: itens.length >= LIMITE_PAGINA_LIQUIDADOS })
  }

  if (e.etapa === 'comparar') {
    const liquidados = await titulosLiquidadosDoSistema(admin, integ.empresa_id, e.janela)
    const fila = candidatosLiquidados(liquidados, e.vistos, e.janela)
    resumo.candidatos = fila.length
    if (!filaPlausivel(fila.length, liquidados.length)) {
      e = { ...e, etapa: 'suspeita', vistos: [], fila: [], candidatos: fila.length,
        liquidados: liquidados.length, concluida_em: new Date().toISOString() }
      return { estado: e, resumo }
    }
    e = { ...e, etapa: 'fila', vistos: [], fila, candidatos: fila.length, liquidados: liquidados.length }
  }

  if (e.etapa === 'fila') {
    const folga = prazoMs - (Date.now() - inicio)
    if (e.fila.length && folga > 6000) {
      const { fila, ...r } = await processarFilaReconferencia(admin, integ, {
        fila: e.fila, prazoMs: folga, categoriasMap, nomesContato,
        statusAlvo: ['pago', 'parcial'], autor: 'sistema:conferencia-liquidados' })
      Object.assign(resumo, { verificados: r.verificados, atualizados: r.atualizados, removidos: r.removidos,
        valorRemovido: r.valorRemovido, mantidos: r.mantidos })
      e = { ...e, fila }
    }
    if (!e.fila.length) e = { ...e, etapa: 'concluida', concluida_em: new Date().toISOString() }
  }
  return { estado: e, resumo }
}
