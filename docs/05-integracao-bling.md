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
| Fila de reconferência, ao fechar | só com mais de 10 s restantes, até 20 s; o resto em laço pela interface |
| Verificação de exclusões | só com mais de 8 s restantes, até 12 s |
| Conferência dos liquidados | chamada própria (`{ conferir_liquidados: true }`), até 40 s por chamada, em laço pela interface |

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

### Reconferência dos títulos fora da listagem

Fonte: `lib/bling-reconferencia.js` (regra pura) e `processarFilaReconferencia` em
`lib/bling-server.js` · trava em `test-reconferencia`.

A varredura percorre a **listagem** do Bling. Título que sai dela — excluído,
substituído, cancelado — deixa de aparecer, e o registro daqui ficaria congelado.

1. Durante a varredura incremental do Fluxo, os ids devolvidos pela listagem são
   acumulados em `integracoes.sync_vistos`. Zeram quando a varredura **recomeça**
   (fase 0, página 1, sem retomar); numa **retomada** continuam.
2. Ao fechar a varredura, todo título **em aberto ou parcial**, do Bling, que **não**
   apareceu vai para a fila `integracoes.reconferir`, do **vencimento mais antigo**
   para o mais novo.
3. Cada item é consultado pelo id (`GET contas/{receber|pagar}/{id}`):

| Resposta | Ação |
|---|---|
| existe | grava o que o Bling diz — pago, cancelado, novo valor ou vencimento |
| 404 no recurso e 404 no outro | **remove**, com o registro completo em `audit_logs` |
| 404 no recurso, existe no outro | sai da fila — não é exclusão |
| qualquer outra (401, 403, 429, 5xx, timeout) | **fica na fila** — nunca remove por falha transitória |

- **Teto de 15 remoções por execução.** O excedente fica na fila.
- A interface processa a fila em laço ao fim da varredura (corpo `{ reconferir: true }`
  na mesma rota); o cron processa uma fatia por dia.
- A remoção é a função única `removerTituloExcluido`, compartilhada com a verificação
  de exclusões.

*Incidente:* 16/10/2026 — 165 títulos em aberto que nenhuma varredura revisitava (FACE
R$ 2,3 mi). Confirmados com o Controller: DATAPREV `26280211663`, R$ 1,34 mi "a receber
vencido", excluído e substituído no Bling; JULIANO BASILIO `23648043154`, parcial de
R$ 10.000 de um título excluído, contado em dobro em julho.

### Conferência dos liquidados — listagem filtrada por data de pagamento

Fonte: `lib/bling-reconferencia.js` (regra pura) e `conferirLiquidados` em
`lib/bling-server.js` · trava em `test-conferencia-liquidados` · regra R10.6.

O mesmo defeito da seção anterior, do lado dos pagos: pagamento excluído no Bling some
da listagem e, completo aqui, nunca mais era conferido. A varredura incremental não
ajuda — percorre os ~3.000 em aberto e só toca os pagos dos últimos dias.

Uma **rodada**, com estado em `integracoes.conferencia_liquidados`:

1. **listagem** — as três fases da carga histórica (`FASES_LIQUIDADOS`: recebidos e
   parciais; pagos; pagos parciais), filtradas pela **data de pagamento** de hoje e dos
   365 dias anteriores, **100 por página**, só os ids. Na FACE, ~25 páginas.
   **Página com erro não avança**: a rodada só compara depois de uma listagem inteira
   lida com sucesso.
2. **comparar** — candidatos: pagos e parciais do Bling daqui, liquidados no período, que
   a listagem não devolveu. Os liquidados nos **45 primeiros dias** da janela ficam de
   fora: a data gravada vem do borderô (ADR-004) e pode diferir da data de pagamento do
   Bling (FGTS: 16/01 aqui, 20/02 lá).
3. **Trava de plausibilidade** — acima de 5% dos liquidados do período (mínimo 20), a
   rodada termina como `suspeita`: **nada é consultado nem removido**, e a interface avisa.
4. **fila** — cada candidato pelo id, com a mesma regra e o mesmo teto da reconferência
   (`processarFilaReconferencia` com `statusAlvo` pago/parcial). Existir lá com outra
   situação — um pagamento **estornado** — atualiza o título; 404 nos dois recursos remove.

| Quem roda | Quando |
|---|---|
| Interface | depois da reconferência, em laço até a rodada fechar. Continua uma rodada em curso de até 3 dias; não repete uma concluída há menos de 24 h |
| Cron | uma fatia por dia; continua a rodada em curso e abre uma nova a cada 7 dias |

*Incidente:* 20/10/2026 — conciliação do Controller contra o relatório de pagamentos do
Bling. MERCADO LIVRE `26414983916` (R$ 1.805,99, 23/07) e RAPHAEL BERBEL PITTA
`26317080212` (R$ 946,40, 10/07; no Bling virou dois títulos de R$ 173,53 e R$ 772,87)
existiam só aqui e foram removidos com confirmação do Controller. PLAYSTATION CURITIBA
R$ 43,90 de 17/08 está em dobro (`26652202409` e `26751577999`); a primeira rodada decide
qual dos dois saiu do Bling.

### Exclusões na origem — liquidados recentes

`verificarExclusoes` confere a existência dos títulos **liquidados** nos últimos 90 dias
e **remove** os que sumiram do Bling (404 nos dois recursos). Roda ao **fechar** a
varredura e no cron.

- Nunca remove registro que não começa com `bling:` — lançamento manual não é alvo
- Registra em `audit_logs`, com o registro completo
- Desde 16/10/2026 **não confere títulos em aberto** — eles vão para a fila de
  reconferência acima
- ⚠️ Confere só os 40–60 liquidados **mais recentes** (`order desc, limit`): na FACE, a
  última semana. A cobertura do período inteiro é da conferência dos liquidados, acima;
  esta fica como checagem rápida do que acabou de ser pago

*Incidentes:*
- PR #15 — o filtro era só `.gte('data_liquidacao', desde)`; títulos em aberto nunca eram
  verificados (caso TELEFÔNICA, JAM). Corrigido com um segundo grupo "em aberto".
- 16/10/2026 — esse segundo grupo pegava os ~30 em aberto de vencimento **mais distante**
  dentro de 90 dias — parcelas futuras que existem — e nunca os vencidos que haviam
  sumido. Substituído pela fila de reconferência.

## Cron — `/api/cron/bling`

`0 9 * * *` UTC (**06:00 BRT**) · `maxDuration = 60s` · autenticação **somente** por
`Authorization: Bearer <CRON_SECRET>`, que a Vercel envia quando a variável existe.

Por execução, para cada entidade, numa fatia de tempo igual ao que sobra do teto de
50 s dividido pelas entidades restantes (ordem em **rodízio diário**):

| Parte da fatia | Trabalho |
|---|---|
| ~50% | páginas da listagem (30 títulos, prazo limitado à fatia), cursor em `cron_cursor` |
| ~20% | fila de reconferência |
| ~20% | conferência dos liquidados — rodada nova a cada 7 dias |
| restante | exclusões dos liquidados recentes (limite 40) |

Estado em `cron_cursor`, `cron_resultado`, `ultima_sync_cron`. Erro também é gravado em
`cron_resultado`.

*Incidente:* 15/07 a 16/10/2026 — **o cron nunca rodou**. A rota aceitava o header
`x-vercel-cron`, que a Vercel não envia, ou `Bearer CRON_SECRET`, e a variável nunca foi
criada: 401 todo dia. Nenhuma escrita às 06:00 BRT desde 14/07. O header e o `?key=` na
URL também permitiam a qualquer um disparar a rota.

⚠️ Vercel Hobby permite crons, mas não garante o horário exato, e guarda **só 1 hora**
de log de execução — a verificação é pelo banco (`ultima_sync_cron`, `cron_resultado`).

⚠️ O cron **não substitui** a varredura manual: com algumas páginas por dia, uma
varredura completa da FACE pelo cron levaria semanas.

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
