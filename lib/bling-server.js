// ─── bling-server.js — Integração Bling API v3 (APENAS server-side) ─────────
// URLs com override por env para calibração sem redeploy de código.
// O mapeamento de campos é DEFENSIVO: a primeira sincronização deve rodar em
// modo diagnóstico (?diag=1) para validar o payload real antes de gravar.
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const pausa = (ms) => new Promise(r => setTimeout(r, ms))

// ── Limitador de taxa das chamadas ao Bling ─────────────────────────────────
// O Bling v3 aceita ~3 requisições/segundo por aplicativo. As rotinas
// disparavam RAJADAS paralelas (o enriquecimento processava 6 títulos ao mesmo
// tempo, cada um com até 3 chamadas — detalhe + contato + borderô — ou seja,
// até 18 requisições quase simultâneas). O Bling rejeitava o excedente com
// HTTP 429, que virava "erro" e deixava o título pendente.
// Este limitador SERIALIZA todas as chamadas com espaçamento mínimo,
// eliminando o 429 na origem — vale para enriquecimento, sync e cron.
// Calibrável por env, no mesmo padrão das URLs (ver cabeçalho) — permite
// afrouxar em produção sem redeploy e acelerar os testes automatizados.
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
//
// CORREÇÃO (HTTP 504 em contas/pagar p29): esta era a ÚNICA chamada ao Bling em
// todo o projeto que NÃO passava por blingGet(). Fazia `fetch` cru — sem
// limitador de taxa, sem retry, sem timeout — e lançava na primeira falha.
// Resultado: um 504 isolado numa página profunda abortava a sincronização
// inteira e descartava o trabalho de todas as páginas anteriores.
// Viola a regra canônica nº 7 (nunca duplicar lógica de negócio).
//
// Erros lançados aqui carregam `.gateway`, `.status`, `.recurso` e `.pagina`
// para que a rota decida entre "repetir a mesma página" e "falhar de verdade".
export async function fetchContas(integ, recurso, pagina = 1, limite = 100, profundidade = 0) {
  const r = await blingGet(integ, `${recurso}?pagina=${pagina}&limite=${limite}`)
  if (r.ok) return Array.isArray(r.body?.data) ? r.body.data : []

  // DEGRADAÇÃO DE LOTE — mitigação real do 504 em página profunda.
  // Em offset alto a consulta do Bling fica lenta e a origem estoura o tempo do
  // Cloudflare. Metade do lote costuma responder dentro da janela.
  // A equivalência é EXATA e preserva o cursor:
  //     página N com limite L  ==  páginas (2N−1) e (2N) com limite L/2
  //     offset (N−1)·L         ==  (2N−2)·(L/2)  e  (2N−1)·(L/2)
  // Só vale com L par — por isso o guard; com L ímpar o offset não fecha e a
  // divisão puliria registros silenciosamente.
  const metade = limite / 2
  if (r.gateway && profundidade < 2 && limite % 2 === 0 && metade >= 10) {
    try {
      const a = await fetchContas(integ, recurso, pagina * 2 - 1, metade, profundidade + 1)
      // Primeira metade incompleta = fim dos dados; a segunda não existe.
      const b = a.length < metade ? [] : await fetchContas(integ, recurso, pagina * 2, metade, profundidade + 1)
      return [...a, ...b]
    } catch (sub) {
      // Reporta SEMPRE a página do cursor de quem chamou, nunca a sub-página —
      // devolver a sub-página corromperia o cursor da sincronização.
      sub.pagina = pagina
      sub.limite = limite
      throw sub
    }
  }

  const err = new Error(`Bling ${recurso} p${pagina} (HTTP ${r.status}): ${r.gateway
    ? 'a origem do Bling não respondeu dentro do tempo permitido (Cloudflare 5xx) após as tentativas de repetição'
    : JSON.stringify(r.body).slice(0, 300)}`)
  err.gateway = !!r.gateway
  err.status  = r.status
  err.recurso = recurso
  err.pagina  = pagina
  err.limite  = limite
  throw err
}

// ── Erros de GATEWAY × rate limit ───────────────────────────────────────────
// 429 = nós estamos rápidos demais → basta desacelerar.
// 502/503/504/52x = a ORIGEM do Bling não respondeu ao Cloudflare → não é
// excesso nosso, é sobrecarga deles. Precisa de espera maior e, no caso da
// listagem paginada, de lote menor (ver fetchContas).
const GATEWAY_STATUS = new Set([502, 503, 504, 520, 521, 522, 523, 524])
export const ehGateway = (status) => GATEWAY_STATUS.has(Number(status))

// Timeout de cada requisição. Sem ele, uma origem pendurada consome todo o
// orçamento da função serverless ANTES de o erro sequer chegar até nós — foi
// o que transformou um 504 do Bling em falha total da sincronização.
const REQ_TIMEOUT_MS = Number(process.env.BLING_REQ_TIMEOUT_MS) || 20000

// Bases do backoff exponencial, também calibráveis sem redeploy.
const BACKOFF_GATEWAY_MS = Number(process.env.BLING_BACKOFF_GATEWAY_MS) || 2000
const BACKOFF_RATE_MS    = Number(process.env.BLING_BACKOFF_RATE_MS)    || 500

// GET no Bling com retry em 429/5xx/timeout (backoff progressivo) —
// o Bling aplica rate limit por app; sem retry, lotes paralelos viram erro.
// Retorna { ok, status, body, gateway }.
export async function blingGet(integ, path, { tentativas = 4, timeoutMs = REQ_TIMEOUT_MS } = {}) {
  let ultimoStatus = 0
  for (let tent = 1; tent <= tentativas; tent++) {
    await aguardarVez()   // respeita o teto de req/s do Bling

    let r = null
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      r = await fetch(`${BLING.API_BASE}/${path}`, {
        headers: { 'Authorization': `Bearer ${integ.access_token}`, 'Accept': 'application/json' },
        signal: ctl.signal,
        cache: 'no-store',
      })
    } catch {
      r = null   // abort por timeout ou falha de rede → tratado como 504
    } finally {
      clearTimeout(timer)
    }

    const status = r ? r.status : 504
    ultimoStatus = status
    const gateway = ehGateway(status)

    if (!r || status === 429 || status >= 500) {
      if (tent < tentativas) {
        // Retry-After quando o Bling informa; senão backoff exponencial + jitter.
        // Base maior para gateway: a origem precisa se RECUPERAR, não apenas
        // receber menos requisições.
        const ra = Number(r?.headers?.get('retry-after'))
        const base = gateway ? BACKOFF_GATEWAY_MS : BACKOFF_RATE_MS
        const espera = Number.isFinite(ra) && ra > 0
          ? Math.min(ra * 1000, 15000)
          : Math.min(20000, base * 2 ** (tent - 1)) + Math.floor(Math.random() * 400)
        await pausa(espera)
        continue
      }
      return { ok: false, status, body: null, gateway }
    }

    const body = await r.json().catch(() => null)
    return { ok: r.ok, status, body, gateway: false }
  }
  // Inalcançável na prática — o laço sempre retorna. Antes esta saída devolvia
  // `undefined` e estourava "cannot read property 'ok' of undefined" no chamador.
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
  return dadosOk && pagoOk && !statusPodeMudar
}

// Monta os registros de fluxo COMPLETOS de uma página (sem gravar) — núcleo
// compartilhado. Retorna { registros, itens, detalhes, paginaCheia }.
export async function montarRegistrosFluxo(admin, integ, recurso, tipoFluxo, pagina, limite, categoriasMap, nomesContato, itensPre = null) {
  const itens = itensPre || await fetchContas(integ, recurso, pagina, limite)
  const docRefs = itens.map(i => `bling:${tipoFluxo}:${i.id}`)
  const { data: existentes } = await admin.from('fluxo_caixa')
    .select('doc_ref,descricao,categoria,competencia,status,data,data_liquidacao,valor').in('doc_ref', docRefs)
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
    completo[i.id] = (statusBling === e.status) && mesmoValor && mesmoVenc
  }
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
    if (catId != null && !categoriasMap[catId]) {
      const nome = await fetchCategoriaNome(integ, catId)
      if (nome) categoriasMap[catId] = nome  // cacheia p/ os próximos da página
    }
    if (catId != null && categoriasMap[catId]) registro.categoria = categoriasMap[catId]
    if (base?.competencia && base.competencia !== '0000-00-00') registro.competencia = base.competencia
    const sld = Number(base?.saldo)
    if (Number.isFinite(sld) && sld > 0 && sld < registro.valor) { registro.status = 'parcial'; registro.valor_liquidado = Number((registro.valor - sld).toFixed(2)) }
    // Data de liquidação via borderô — FONTE DA VERDADE p/ pago e parcial.
    // Sobrescreve mesmo se já houver data: o item pode trazer dataLiquidacao
    // divergente (ex.: gravada quando o título ainda estava em aberto), mas o
    // borderô reflete o recebimento/pagamento efetivo. Só cai no valor do item
    // quando não há borderô.
    if (['pago','parcial'].includes(registro.status)
        && Array.isArray(base?.borderos) && base.borderos.length) {
      const bd = await fetchBordero(integ, base.borderos[base.borderos.length - 1])
      const dt = bd.data
      if (bd.valorPago) registro.valor_liquidado = bd.valorPago
      if (dt && dt !== '0000-00-00') registro.data_liquidacao = dt
    }
    registros.push(registro)
  }
  return { registros, itens, detalhes, paginaCheia: itens.length >= limite }
}

// Wrapper que grava (usado pelo cron, que só faz fluxo)
export async function processarPaginaFluxo(admin, integ, recurso, tipoFluxo, pagina, limite, categoriasMap, nomesContato) {
  const { registros, itens, paginaCheia } = await montarRegistrosFluxo(admin, integ, recurso, tipoFluxo, pagina, limite, categoriasMap, nomesContato)
  let gravados = 0
  if (registros.length) {
    const { error, count } = await admin.from('fluxo_caixa').upsert(registros, { onConflict: 'doc_ref', count: 'exact' })
    if (!error) gravados = count ?? registros.length
  }
  return { gravados, recebidos: itens.length, paginaCheia }
}


// ── Verificação de EXCLUSÕES na origem ──────────────────────────────────────
// A sincronização é "upsert-only": só adiciona/atualiza o que o Bling devolve.
// Um título excluído lá simplesmente some da listagem — e, se já estava
// completo na nossa base, nunca mais é reconferido, ficando órfão para sempre.
// Foi o que inflou julho/2026 em R$ 329 mil (câmbio lançado errado, excluído e
// relançado). Esta rotina confere a EXISTÊNCIA dos títulos liquidados recentes
// e remove os que sumiram da origem, registrando tudo em audit_logs.
export async function verificarExclusoes(admin, integ, { desde, limite = 60, prazoMs = 20000 } = {}) {
  const inicio = Date.now()
  const { data: alvos } = await admin.from('fluxo_caixa')
    .select('id,doc_ref,descricao,valor,status,data,data_liquidacao,organization_id')
    .eq('empresa_id', integ.empresa_id).like('doc_ref', 'bling:%')
    .eq('origem_ausente', false)
    .gte('data_liquidacao', desde)
    .order('data_liquidacao', { ascending: false }).limit(limite)

  let verificados = 0, removidos = 0, valorRemovido = 0
  for (const t of alvos || []) {
    if (Date.now() - inicio > prazoMs) break
    const [, tRef, id] = t.doc_ref.split(':')
    const rec = tRef === 'entrada' ? 'contas/receber' : 'contas/pagar'
    const alt = tRef === 'entrada' ? 'contas/pagar'   : 'contas/receber'
    const p1 = await blingGet(integ, `${rec}/${id}`)
    verificados++
    if (p1.status !== 404) continue
    const p2 = await blingGet(integ, `${alt}/${id}`)
    if (p2.status !== 404) continue          // existe do outro lado: não é exclusão
    await admin.from('fluxo_caixa').delete().eq('id', t.id)
    removidos++; valorRemovido += Math.abs(Number(t.valor) || 0)
    admin.from('audit_logs').insert({
      organization_id: t.organization_id, table_name: 'fluxo_caixa', record_id: t.id,
      action: 'DELETE', changed_by_email: 'sistema:verificacao-exclusoes',
      old_data: { doc_ref: t.doc_ref, descricao: t.descricao, valor: t.valor,
                  status: t.status, data_liquidacao: t.data_liquidacao,
                  motivo: 'título não existe mais no Bling (excluído na origem)' },
    }).then(() => {}, () => {})
  }
  return { verificados, removidos, valorRemovido: Number(valorRemovido.toFixed(2)) }
}
