# 10 — Histórico

Registro cronológico de entregas e incidentes. Para cada incidente: o sintoma, a causa
raiz e a correção. **Nenhuma entrada é removida** — o histórico explica por que as
regras existem.

---

## Outubro/2026

| Data | PR | Entrega |
|---|---|---|
| 16/10 | — | **T10 fechada** — 16 suítes e build rodados pela primeira vez desde o PR #28; `test-bling-jwt` corrigida |
| 16/10 | — | **Grupo 9 do Plano de Contas criado e mapeado** — P0 fechado; transferências, empréstimos e fluxos de sócios saem dos KPIs operacionais |
| 16/10 | — | Documentação do Node corrigida; `.nvmrc` passa a 24 |
| 15/10 | — | **Node 20.x descontinuado na Vercel** — projeto passa a 24.x; deploys voltam a compilar |
| 15/10 | #29 | **Dívida técnica T1, T7 e T8** — `calcDRE` única, PRs obsoletos fechados, código morto removido |

### Detalhe de outubro

**16/10 · T10 · Suítes executadas pela primeira vez desde o PR #28**
Node 24.20.0 e git instalados por `winget`; clone da `main` em 1ffc050; `npm ci`.
- **Resultado inicial:** 15 suítes passando e **1 reprovando**: `test-bling-jwt`, 11 de 12. Falhava `[TRAVA] 401 dispara renovação automática do token`.
- **Causa:** defeito do teste, não do código. `corpo()` recortava 1.400 caracteres a partir de `blingGet`, e o tratamento de 401 está a 1.416. O código sempre tratou o 401 (`status === 401 && adm && tent < tentativas && !jaRenovou`). A função cresceu (retry de gateway, timeout, comentários); o momento exato em que a trava passou a reprovar não foi investigado — provavelmente com o merge do PR #25 (23/09).
- **Correção:** `corpo()` recorta até o `}` na coluna 0 que fecha a função, aceitando CRLF. Só `scripts/test-bling-jwt.mjs` mudou; nenhum código de aplicação.
- **Validação:** sabotagem em `lib/bling-server.js` — sem o tratamento de 401, sem a guarda contra laço e sem `JWT_HEADER` no `fetch` — reprova a trava correspondente nos três casos. Uma primeira tentativa de sabotagem na guarda não reprovou (ver "Limite conhecido" em [09](09-testes.md)); refeita removendo a guarda inteira, reprovou. Código restaurado e conferido por `git status`.
- **Resultado final:** **232/232 em 16 suítes**, `npm run build` ok (36 páginas), `no-undef` sem violações. Dois erros de `react-hooks/exhaustive-deps` aparecem na linha de comando do `CLAUDE.md` por causa dos comentários `eslint-disable` num arquivo com `--no-eslintrc` — não são violações de `no-undef`.
- **Lição:** a contagem "230 passando, verificado 30/09" não valia para `test-bling-jwt`. O PR #25 registrou 12/12 na sua branch; não há registro de que as suítes tenham sido reexecutadas na `main` depois do merge.

**16/10 · Grupo 9 do Plano de Contas · P0 fechado**
A exclusão por natureza (PRs #23 e #24) **não tinha efeito em produção**: o INSERT das contas do grupo 9, disparado em 24/09, não tinha rodado (0 contas `9.%`), e as 42 contas existentes eram todas `operacional`. Transferências, empréstimos e fluxos de sócios entravam nos KPIs operacionais. 15 das 20 categorias tinham De-Para `ignorar` sem conta, que resolve para `operacional` (R7.3).
- **Contas:** 60, 20 por entidade — `9.1.1` a `9.1.13` (transferência, 13), `9.2.1` a `9.2.3` (empréstimo, 3), `9.3.1` a `9.3.4` (sócios, 4). `tipo` `entrada` em Transferências Recebidas, Recebidas JAM, Obtenção de Empréstimos e Aporte de Capital; `saida` nas demais. Nomes em maiúsculas, como a tela grava.
- **De-Para, só por SQL e sempre `ignorar` (R8.4):** JAM 10 (piloto, validado na tela pelo Controller), depois FACE 11 e JB 8. Só categorias com lançamentos na entidade. 9 foram UPDATE e 10 INSERT em FACE e JB; as 5 categorias sem De-Para em nenhuma entidade ficaram incluídas.
- **Efeito no consolidado, realizado por data de liquidação, de 01/01 a 16/10/2026:** entradas operacionais R$ 9.125.863,74 → R$ 3.112.844,17; saídas R$ 8.746.656,59 → R$ 3.732.252,36. Em 2025: entradas R$ 14.340.856,75 → R$ 5.169.016,73; saídas R$ 17.432.010,90 → R$ 6.697.837,22. Totais realizados inalterados (2026: R$ 17.872.520,33).
- **Atenção:** as entradas operacionais da JB em 2026 ficaram em R$ 976,44 — confirmado pelo Controller.
- **Verificação:** pré-checagem, checagem de contagens (FACE 77/11, JAM 33/10, JB 15/8 mapeamentos/ligados ao grupo 9, tipo errado 0) e simulação por SELECT batendo com o resultado. As três telas de caixa não foram reabertas após FACE e JB.
- **Descoberta:** três armadilhas da tela do Plano de Contas com o grupo 9 — ver T11 em [11](11-pendencias.md).

**15/10 · Deploy falhando antes de compilar · Node 20.x descontinuado**
O preview do PR #29 falhou na Vercel. O log terminava em `Node.js Version "20.x" is discontinued and must be upgraded`, antes de qualquer etapa de build. Não era o PR: o último deploy que passou foi o de 29/09, e qualquer deploy novo — inclusive da `main` — falharia igual. O projeto `financial-dashboard` estava em 20.x; o `admin-portal` já estava em 24.x. A documentação afirmava que o Node 24 quebrava o build; o `admin-portal` em 24.x e o próprio build do PR #29 mostraram que não.
- **Correção:** Node.js Version do projeto passou a `24.x` (Vercel, 15/10), com redeploy do último deployment que falhou.
- **Verificação:** o build de preview compilou todas as telas e o deploy de produção seguinte (`main` em 1fb804c) ficou `READY`. As suítes com `node` seguem sem execução — ver T10 em [11](11-pendencias.md).
- **Lição:** a versão que vale é a do projeto na Vercel, não a do `.nvmrc`. Sinal de alerta: falha de deploy sem erro de build no log.

**15/10 · Dívida técnica T1, T7 e T8**
- **T1:** `app/dashboard/dre/page.jsx` deixou de definir `calcDRE` e importa de `@/lib/dre-calc`. As duas funções eram idênticas (a lib só acrescenta o parâmetro padrão `= []`), então nenhum número muda. Nova trava `test-fonte-unica-dre`.
- **T7:** PRs #1 e #5 fechados com comentário. O conteúdo do #1 está na `main` por #8 e #9; o do #5, por #12.
- **T8:** `components/UploadExcel.jsx` removido. Busca por `UploadExcel` em todo o código da `main` (95980be) achou só o próprio arquivo.
- **Validação:** a trava nova foi validada por sabotagem emulada (cópia local reintroduzida; import removido), com reprovação nos dois casos. `npm run build` e as suítes não rodaram neste ambiente (sem Node). **Resultado:** o build de preview e o deploy de produção passaram na Vercel (verificado 15/10); as suítes com `node` seguem sem execução.

## Setembro/2026

| Data | PR | Entrega |
|---|---|---|
| 30/09 | #28 | **Treze telas recarregam a cada troca de entidade** — hook compartilhado `useVersaoSelecao` |
| 30/09 | #27 | Logo nas telas de acesso · seleção em lote entre páginas · filtro e coluna de entidade na Gestão |
| 29/09 | — | `34e95d3` — onboarding permitido sem empresa cadastrada |
| 29/09 | — | Documentação completa em `docs/` |
| 24/09 | — | Tabela `categorias_natureza` removida após verificação de que estava vazia |
| 23/09 | #25 | **Migração JWT do Bling** + renovação automática em 401 |
| 17/09 | #24 | Natureza passa a viver no Plano de Contas |
| 15/09 | #23 | Natureza das categorias — exclusão de transferências dos KPIs |
| 15/09 | #22 | Caixa Disponível só efetivo; balão de ajuda não recortado |
| 15/09 | #21 | Saldo unificado entre telas; toda tela abre no mês vigente |
| 12/09 | #20 | Caixa Disponível deixa de somar título a vencer |
| 12/09 | #19 | Três telas passam a reagir à troca de entidade |
| 10/09 | #18 | Importação de DRE bloqueada com categoria sem De-Para |
| 02/09 | #17 | Orçamento de tempo na sincronização |
| 01/09 | #16 | Título quitado não pode ter liquidado menor que o valor |
| 01/09 | #15 | Títulos em aberto excluídos na origem deixam de ficar órfãos |
| 01/09 | #14 | Exportação: recorte por data efetiva e amarração entre abas |

### Incidentes de setembro

**30/09 · Telas não recarregavam ao trocar a seleção · PR #28**
Onze telas recalculavam as entidades só quando `empresa_id` mudava — e ele vale `'todas'`
para qualquer seleção múltipla. Passar de três para duas entidades não recarregava nada.
O levantamento encontrou um caso pior: **Atrasados e Orçamento não reagiam a troca
nenhuma**, nem de uma entidade para outra — resolviam as entidades uma única vez, ao
abrir. A trava do PR #19 não as pegou porque exigia o listener só em quem lê o
`localStorage` diretamente; as duas o leem por `getSelectedEntidadeIds()`.

**30/09 · Três falhas básicas relatadas · PR #27**
Logo ausente no cadastro; seleção perdida ao trocar de página; sem identificação de
entidade na Gestão. O estudo prévio encontrou mais seis defeitos:
- endpoint público de logo com resultado **indefinido** entre organizações
- Apresentação do DRE com a marca "Facesign" **fixa no código**
- "selecionar todos" **substituía** a seleção em silêncio — e **desmarcava tudo** quando
  os tamanhos coincidiam
- "Novo Lançamento" **não funcionava** no consolidado — gravava `empresa_id = 'todas'`
- menu lateral não refletia mudanças feitas por outras telas
- **defeito sistêmico:** as telas não recarregam ao passar de três para duas entidades —
  corrigido só na Gestão


**23/09 · Integração não conforme com a migração JWT · PR #25**
Validação inicial concluiu "conforme" com base em armazenamento e fluxo OAuth. A
documentação do Bling revelou o header `enable-jwt: 1`, ausente em todo o projeto.
A avaliação de risco pré-merge encontrou outra falha: um 401 não disparava renovação,
e a sincronização pararia até reconexão manual.

**16/09 · Hipótese "não mapeado = não operacional" · PR #24**
Testada contra os dados antes de implementar: das 23 categorias sem mapeamento no
período, só 5 eram não operacionais. As outras somavam R$ 2,2 mi de despesa real.
A inferência teria inflado o resultado.

**15/09 · Caixa Disponível divergindo entre Visão Geral e Fluxo de Caixa · PR #21**
Três causas independentes: seis períodos padrão distintos, projetado somado ao saldo, e
ponto final em meses futuros. O PR #20 havia corrigido a Visão Geral **isoladamente**,
ampliando a divergência — corrigir uma tela por vez produz inconsistência.

**11/09 · Caixa Disponível 60× inflado · PR #20**
R$ 1,31 mi exibido contra R$ 22 mil no banco. Somava títulos a vencer. Runway em 3,9
meses quando a autonomia real era de dias. Encontrado **navegando o sistema** — a
auditoria de código do mesmo dia não o havia previsto.

**11/09 · Análise ignorava a troca de entidade · PR #19**
Desmarcar JAM e JB deixava os valores idênticos. O levantamento encontrou mais duas
telas — as de importação, que **gravavam na empresa errada**.

**11/09 · Transferências em 44% dos KPIs · PRs #23, #24**
Consolidado somava as duas pontas das transferências entre FACE, JAM e JB.

**02/09 · "Failed to fetch" em todas as entidades · PR #17**
A verificação de coerência do PR #16 multiplicou o custo por página sem ajuste do
orçamento: 50 títulos custavam ~88 s contra 60 s de teto.

**01/09 · Caso ALEXANDRE 1414/11 · PR #16**
Título de R$ 22.000 gravado como R$ 5.000 — soma de retiradas parciais estornadas.
Diagnóstico fechado com o contexto de negócio fornecido pelo Controller.

**01/09 · Caso TELEFÔNICA · PR #15**
Títulos em aberto apagados no Bling continuavam no sistema. `.gte()` com NULL é falso.

---

## Agosto/2026

| Data | PR | Entrega |
|---|---|---|
| 31/08 | #13 | Quatro identificadores indefinidos corrigidos |
| 31/08 | #12 | Saldo final do período; bases unificadas — incorpora o #5 |
| 28/08 | #11 | TDZ que derrubou a sincronização |
| 28/08 | #10 | **Cursor persistente na sincronização manual** |
| 28/08 | #9 | Timeout não-JSON não aborta a sincronização |
| 28/08 | #8 | Paginação resiliente a 504 e timeout |
| 28/08 | #7 | Limite de 366 dias no backfill |
| 27/08 | #6 | Histórico de pagamentos e recebimentos |
| 21/08 | #3, #4 | Composição do saldo de partida; Gestão reagindo às âncoras |
| 20/08 | #2 | **Data de corte e saldo de abertura certificado** |

Os PRs #6 a #9 foram produzidos em outra sessão de desenvolvimento.

### Incidentes de agosto

**31/08 · Exportação quebrada · PR #13**
`hoje is not defined`. A varredura com `no-undef` achou mais três — um deles no `catch`
da sincronização, que tornava a recuperação do 504 inoperante desde sempre.

**28/08 · Sincronização caiu após o PR #10 · PR #11**
Variável usada antes da declaração (TDZ). `npm run build` não detecta.

**25/08 · Conciliação Bling × sistema**
17 extratos, 14.830 linhas. O sistema perdia 65% das entradas e 42% das saídas —
aparecia R$ 7,9 mi pior que a realidade. Causa raiz: a sincronização manual recomeçava
da página 1 a cada execução, com teto de 3.000 títulos. Corrigida no PR #10.

**13/08 · Auditoria de divergência de saldos**
Cinco causas: KPIs somando valor do título, três definições de saldo de partida, três
definições de "em atraso", exportação divergindo da tela, subtotal diário em base
distinta. Base do trabalho de agosto e setembro.

---

## Julho/2026

| Data | Entrega |
|---|---|
| 14/07 | **Automação validada ponta a ponta** — cron diário 06:00 BRT com cursor persistente |
| 03/07 | **Go-live da integração Bling por API** — FACE conectada, 4.942 títulos |
| 03/07 | Ciclo de vida dos títulos: `status`, `data_liquidacao`, `valor_liquidado`, `doc_ref` |
| 02/07 | Exportação Excel; RLS multi-org validada |

**14/07 · Cron não gravava** — três causas encadeadas: a Vercel não envia `Bearer`,
aceita-se `x-vercel-cron`; colunas não existiam, migração nunca aplicada e `.catch`
silencioso; e o **Data Cache do Next.js congelava todos os SELECTs** do supabase-js
server-side, resolvido com `cache: 'no-store'` no client admin.

**03/07 · Backfill "vencimento passado = pago"** testado e **descartado** — marcava
atrasados como pagos.

---

## Junho/2026

| Período | Entrega |
|---|---|
| 26–30/06 | Multi-entidade; **correção de segurança cross-tenant** |
| 21–25/06 | Plano de contas editável; sidebar reformulado |
| 19/06 | DRE: impostos como dedução |
| 15/06 | Logo adaptativa por tema |
| 11/06 | Idle timeout, error boundary, skeleton loading |
| 10–12/06 | Recuperação de senha; build estabilizado em Node 20 |
| 02/06 | Ícones SVG substituindo emojis |
