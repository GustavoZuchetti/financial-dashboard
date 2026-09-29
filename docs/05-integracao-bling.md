# 05 — Integração Bling

API v3 · OAuth 2.0 · tokens **JWT** · uma integração por entidade.

## Autenticação

### Fluxo OAuth

1. **Autorização** — `GET /api/integracoes` monta a URL de autorização com `state`
   assinado (`signState`)
2. **Callback** — `/api/integracoes/bling/callback` verifica o `state` e troca o
   código por tokens (`exchangeCode`)
3. **Renovação** — `ensureToken` renova quando faltam menos de 2 minutos para expirar

Todas as trocas passam por `tokenRequest` em `lib/bling-server.js`, com `Basic` de
`client_id:client_secret` e `grant_type` `authorization_code` ou `refresh_token`.

### Migração JWT — concluída

O Bling descontinuou tokens opacos. **Sem o header `enable-jwt: 1`, o endpoint devolve
token opaco**, que será bloqueado na data de corte (em definição pelo Bling).

O header é exigido em **três** momentos, e faltar em qualquer um quebra:

| Momento | Onde no código | Se faltar |
|---|---|---|
| Obter token | `tokenRequest` · `authorization_code` | token opaco na conexão |
| **Renovar token** | `tokenRequest` · `refresh_token` | **a migração se desfaz sozinha** |
| Chamar a API | `blingGet` | rejeição da chamada |

Implementado em PR #25 pela constante `JWT_HEADER`, aplicada nos dois únicos pontos de
chamada ao Bling do projeto.

**Estado (verificado 24/09):** as três entidades com token no formato JWT, 959
caracteres cada. As colunas são `text` sem limite, sem necessidade de migração.

**Escape:** `BLING_DISABLE_JWT=1` na Vercel reverte o comportamento sem redeploy.

### Renovação automática em 401

`blingGet` trata 401 renovando o token (forçado) e repetindo a chamada, **uma vez por
chamada** para evitar laço contra o rate limit.

Antes do PR #25, um 401 caía direto no erro e a sincronização parava até reconexão
manual. `ensureToken` só renovava por tempo, não por rejeição.

## Cliente HTTP — `blingGet`

Única porta de entrada para a API. As sete funções de busca passam por ela:
`fetchContas`, `fetchDetalhe`, `fetchCategoriasMap`, `fetchCategoriaNome`,
`fetchContatoNome`, `fetchBordero`, `fetchBorderoData`.

| Parâmetro | Padrão | Variável de ambiente |
|---|---|---|
| Espaçamento mínimo entre chamadas | **380 ms** (~2,6 req/s; o limite do Bling é 3) | `BLING_RATE_MIN_MS` |
| Timeout por requisição | 20 s | `BLING_REQ_TIMEOUT_MS` |
| Backoff em 5xx / gateway | 2 s | `BLING_BACKOFF_GATEWAY_MS` |
| Backoff em 429 | 500 ms | `BLING_BACKOFF_RATE_MS` |
| Tentativas | 4 | — |

Repete em 429 e 5xx. Renova e repete em 401. Demais códigos retornam erro.

**Custo real por chamada ≈ 880 ms** — os 380 ms de espaçamento mais ~500 ms de latência.
Estimar custo contando só o espaçamento subestima pela metade — foi o erro que causou o
incidente do PR #17.

## Sincronização manual — `/api/integracoes/bling/sync`

Disparada pelo botão "Sincronizar Fluxo agora" em Configurações › Integrações.
`maxDuration = 60s`.

### Fases

| Escopo | Fases |
|---|---|
| `incremental` (padrão) | `contas/receber` → entrada · `contas/pagar` → saída |
| `historico` | receber (situações 2, 3) · pagar (situação 2) · pagar (situação 3), em janelas de datas |

### Cursor persistente

A posição da varredura vive em `integracoes.sync_cursor`. Cada chamada processa uma
página e devolve o próximo cursor; a interface itera enquanto houver próximo.

*Incidente:* PR #10 — a sincronização manual era stateless e recomeçava da página 1 a
cada execução. Com 60 iterações de 50 títulos, o teto era 3.000; a FACE tinha 5.407.
O excedente **nunca era alcançado**, dia após dia. Origem de boa parte dos R$ 44,6 mi
de divergência identificados na conciliação de 25/08.

`null` = varredura completa. Grava `ultima_varredura_completa`.

### Orçamento de tempo

| Parâmetro | Valor |
|---|---|
| Títulos por página | **30** (`BLING_LIMITE_PAGINA`) |
| Prazo da montagem | 34 s |
| Reserva para borderôs e upsert | 40% do prazo |
| Folga mínima para buscar borderô | 4 s |
| Verificação de exclusões | só com mais de 8 s restantes, até 12 s |

**Prioridade:** títulos novos antes de revisões.

**Adiamento seguro:** título que precisava de detalhe e não coube **não é gravado** —
fica para a próxima varredura.

*Incidente:* PR #17 — "Failed to fetch" em todas as entidades. `LIMITE` era 50 sob a
premissa de que "muitos títulos são pulados". A verificação de coerência do liquidado
quebrou a premissa; 50 títulos com detalhe e borderô custavam ~88 s contra 60 s de teto.

### Reprocessamento

Um título é reprocessado quando **não está completo**: status, valor, vencimento **ou**
`liquidadoCoerente()` divergem do Bling.

*Incidente:* PR #16 — sem a verificação do liquidado, um título com status, valor e
vencimento corretos mas liquidado deformado nunca era reprocessado.

### Exclusões na origem

`verificarExclusoes` compara títulos da base com o Bling e marca `origem_ausente` nos
que sumiram. Roda ao **fechar** a varredura.

- Verifica **liquidados** (pela data de liquidação) **e em aberto** (pelo vencimento)
- Nunca remove registro que não começa com `bling:` — lançamento manual não é alvo
- Registra em `audit_logs`

*Incidente:* PR #15 — o filtro era `.gte('data_liquidacao', desde)`. Em Postgres,
comparação com NULL é falsa: títulos em aberto nunca eram verificados. Caso TELEFÔNICA
(JAM): valores apagados no Bling há meses continuavam como "em aberto".

## Cron — `/api/cron/bling`

`0 9 * * *` UTC (**06:00 BRT**) · `maxDuration = 60s` · autenticação por
`x-vercel-cron` ou `CRON_SECRET`.

Estado em `cron_cursor`, `cron_resultado`, `ultima_sync_cron`. Verifica exclusões com
orçamento de 8 s e limite de 40.

⚠️ Vercel Hobby permite crons, mas não garante o horário exato.

## Enriquecimento — `/api/integracoes/bling/enrich`

Busca detalhe e borderô de títulos sem data de liquidação. `maxDuration = 60s`.

## Mapeamento de situação

`mapSituacao` · padrão `aberto` quando desconhecido.

| Bling | Sistema |
|---|---|
| `1`, `em aberto`, `atrasada` | `aberto` |
| `2`, `pago`, `paga`, `recebido`, `liquidado` | `pago` |
| `3`, `parcial` | `parcial` |
| `5`, `cancelado` | `cancelado` |

## Limitações conhecidas

- **Listagem não traz data de liquidação** — exige detalhe e borderô, que custam chamada
- **Borderô compartilhado não informa alocação por título** — ver R3.1 em
  [04](04-regras-de-negocio.md)
- **Categorias com 13 variantes de nome** para a mesma operação de transferência —
  cadastro no Bling, não corrigível pelo sistema
- **`Accept: '1.0'`** no endpoint de token — versão antiga, mantida porque a documentação
  do Bling a usa nos exemplos
