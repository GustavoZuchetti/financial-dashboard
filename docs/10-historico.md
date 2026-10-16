# 10 — Histórico

Registro cronológico de entregas e incidentes. Para cada incidente: o sintoma, a causa
raiz e a correção. **Nenhuma entrada é removida** — o histórico explica por que as
regras existem.

---

## Outubro/2026

| Data | PR | Entrega |
|---|---|---|
| 16/10 | — | Documentação do Node corrigida; `.nvmrc` passa a 24 |
| 15/10 | — | **Node 20.x descontinuado na Vercel** — projeto passa a 24.x; deploys voltam a compilar |
| 15/10 | #29 | **Dívida técnica T1, T7 e T8** — `calcDRE` única, PRs obsoletos fechados, código morto removido |

### Detalhe de outubro

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
