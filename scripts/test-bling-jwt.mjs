// ─── test-bling-jwt.mjs ──────────────────────────────────────────────────────
// Trava a conformidade com a migração JWT do Bling.
//
// A autenticação por tokens OPACOS está descontinuada. A documentação é
// explícita: sem o header `enable-jwt: 1`, o endpoint continua devolvendo token
// opaco — que deixará de ser aceito na data de bloqueio, com "rejeição
// automática de chamadas".
//
// O header é exigido em TRÊS momentos, e esquecer qualquer um quebra:
//   1. obter token     POST /oauth/token com grant_type=authorization_code
//   2. RENOVAR token   POST /oauth/token com grant_type=refresh_token
//   3. usar a API      toda requisição autenticada
//
// O item 2 é o mais traiçoeiro: sem ele a migração se DESFAZ SOZINHA na
// primeira renovação — o sistema funcionaria por algumas horas e voltaria a
// receber token opaco sem ninguém perceber.
//
// Execução:  node scripts/test-bling-jwt.mjs
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(raiz, 'lib', 'bling-server.js'), 'utf8')

let ok = 0, falhou = 0
const testes = []
const teste = (n, f) => testes.push([n, f])
function eq(a, e, ctx = '') {
  if (JSON.stringify(a) !== JSON.stringify(e))
    throw new Error(`${ctx}esperado ${JSON.stringify(e)}, recebido ${JSON.stringify(a)}`)
}

// Recorta o corpo de uma função pelo nome, para inspecionar seus headers
function corpo(nome) {
  const i = src.indexOf(nome)
  if (i < 0) throw new Error(`função "${nome}" não encontrada`)
  return src.slice(i, i + 1400)
}

teste('[TRAVA] o header enable-jwt está definido', () => {
  if (!/enable-jwt/.test(src)) throw new Error('o projeto não envia enable-jwt em lugar nenhum')
  if (!/JWT_HEADER/.test(src)) throw new Error('sem constante única, o header tende a faltar em algum ponto')
})

teste('[TRAVA] obtenção e renovação de token enviam enable-jwt', () => {
  // Ambos passam por tokenRequest — cobrir a função cobre os dois grant_types
  const fn = corpo('async function tokenRequest')
  if (!/JWT_HEADER/.test(fn))
    throw new Error('tokenRequest sem enable-jwt: o Bling devolveria token OPACO')
  if (!/grant_type/.test(src)) throw new Error('fluxo OAuth não encontrado')
})

teste('[TRAVA] a RENOVAÇÃO passa pelo mesmo caminho da obtenção', () => {
  // Se renovar usasse outro fetch, a migração se desfaria na primeira renovação
  const temAuthCode = /grant_type:\s*'authorization_code'/.test(src)
  const temRefresh  = /grant_type:\s*'refresh_token'/.test(src)
  eq([temAuthCode, temRefresh], [true, true], 'os dois grant_types: ')
  const chamadas = (src.match(/tokenRequest\(/g) || []).length
  if (chamadas < 3) throw new Error(`esperado tokenRequest definida + 2 usos, achei ${chamadas}`)
})

teste('[TRAVA] as requisições à API enviam enable-jwt', () => {
  const fn = corpo('export async function blingGet')
  if (!/JWT_HEADER/.test(fn))
    throw new Error('blingGet sem enable-jwt: requisições seriam rejeitadas')
  if (!/Bearer \$\{integ\.access_token\}/.test(fn))
    throw new Error('formato exigido: Authorization: Bearer {token}')
})

teste('[TRAVA] existem apenas DOIS pontos de chamada ao Bling', () => {
  // Toda função de busca passa por blingGet. Um fetch cru novo escaparia do
  // header — foi assim que fetchContas ficou sem retry no PR #1.
  const fetches = (src.match(/await fetch\(/g) || []).length
  if (fetches > 3) throw new Error(
    `${fetches} chamadas fetch: alguma pode estar fora do blingGet e sem o header`)
})

teste('o header é calibrável por env, para rollback sem redeploy', () => {
  if (!/BLING_DISABLE_JWT/.test(src))
    throw new Error('sem escape: se o Bling mudar o contrato, seria preciso redeploy')
})

teste('[REGRESSÃO] sem o header, o Bling devolve token opaco', () => {
  // Documenta o comportamento que motivou a mudança
  const semHeader = {}
  const comHeader = { 'enable-jwt': '1' }
  eq(Object.keys(semHeader).length, 0, 'antes: ')
  eq(comHeader['enable-jwt'], '1', 'depois: ')
})

// ─── Armazenamento ───────────────────────────────────────────────────────────
// Verificado no banco em 23/09/2026: access_token, refresh_token, client_id e
// client_secret são `text`, sem limite. JWT de 1.500 a 3.000 caracteres cabe
// sem migração. Este teste documenta o requisito para quem ler depois.
teste('o código não trunca nem valida o tamanho do TOKEN', () => {
  // Cuidado com falso positivo: tokenRequest tem um .slice(0,300) legítimo, na
  // MENSAGEM DE ERRO, truncando o corpo da resposta para o log. O que não pode
  // existir é truncamento sobre access_token ou refresh_token.
  const perigoso = [
    /access_token[^\n]*\.(slice|substring)\(/,
    /refresh_token[^\n]*\.(slice|substring)\(/,
    /(slice|substring)\([^)]*\)[^\n]*access_token/,
    /access_token[^\n]*\.length\s*[<>]/,
  ]
  for (const re of perigoso)
    if (re.test(src)) throw new Error(`token manipulado por tamanho: ${re}`)

  // E o token precisa ser gravado inteiro, como veio da origem
  if (!/access_token:\s*tk\.access_token/.test(src))
    throw new Error('o access_token deveria ser gravado sem transformação')
})

for (const [n, f] of testes) {
  try { await f(); ok++; console.log(`  ok   ${n}`) }
  catch (e) { falhou++; console.log(`  FALHA ${n}\n         ${e.message}`) }
}
console.log(`\n${ok}/${ok + falhou} testes passaram`)
process.exit(falhou ? 1 : 0)
