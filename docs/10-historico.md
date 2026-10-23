# 10 — Histórico

Registro cronológico de entregas e incidentes. Para cada incidente: o sintoma, a causa
raiz e a correção. **Nenhuma entrada é removida** — o histórico explica por que as
regras existem.

---

## Outubro/2026

| Data | PR | Entrega |
|---|---|---|
| 23/10 | — | **Paginação da conferência dos liquidados corrigida** — piloto da JB suspenso pela trava; nada removido |
| 23/10 | #34 | **Conferência dos liquidados em produção** — migração aplicada; JAM 0 candidatos; JB suspensa |
| 20/10 | — | **Conferência dos liquidados pela listagem filtrada** — código e migração |
| 20/10 | — | **Conciliação das saídas da FACE com o Bling** — diferenças de julho e do ano explicadas ao centavo; 2 pagos inexistentes no Bling removidos |
| 16–19/10 | #33 | **Reconferência e cron em produção** — piloto JAM, JB e FACE; cron grava todos os dias desde 17/10 |
| 16/10 | — | **Reconferência dos títulos fora da listagem e cron autenticado** — código e migração |
| 16/10 | — | **T10 fechada** — 16 suítes e build rodados pela primeira vez desde o PR #28; `test-bling-jwt` corrigida |
| 16/10 | — | **Grupo 9 do Plano de Contas criado e mapeado** — P0 fechado; transferências, empréstimos e fluxos de sócios saem dos KPIs operacionais |
| 16/10 | — | Documentação do Node corrigida; `.nvmrc` passa a 24 |
| 15/10 | — | **Node 20.x descontinuado na Vercel** — projeto passa a 24.x; deploys voltam a compilar |
| 15/10 | #29 | **Dívida técnica T1, T7 e T8** — `calcDRE` única, PRs obsoletos fechados, código morto removido |

### Detalhe de outubro

**23/10 · Piloto da conferência dos liquidados · paginação corrigida**
Migração `20261020_conferencia_liquidados` aplicada e conferida, PR #34 mergeado (`d42d780`), deploy READY.
- **JAM:** rodada concluída em 2 s — 59 pagos no período, 51 conferíveis, **0 candidatos**, nada removido; KPIs iguais. Cada fase cabia numa página.
- **JB:** rodada **suspensa pela trava** — 721 de 961 conferíveis não apareceram (limite 56). Nada consultado nem removido; KPIs iguais. A rodada levou 3 s, menos que as ~13 páginas de 100 necessárias: a listagem tratava página com menos itens que o pedido como fim da fase. Os ids lidos foram descartados na suspensão, então a página exata não pôde ser confirmada.
- **Correção:** fase termina só com página vazia (ou que só repete ids já vistos); 30 por página, o tamanho da carga histórica; teto de 400 páginas por fase; cada página registrada em `paginas_log`; rodada suspensa guarda motivo e diagnóstico (candidatos por tipo e mês, amostra de 20). FACE não rodada.
- **Validação:** 18 suítes, 292 testes; 20 sabotagens (7 novas), todas reprovadas pela trava certa; build compila.

**20/10 · Conferência dos liquidados pela listagem filtrada**
- **Causa:** a verificação de exclusões dos liquidados lia os 40–60 **mais recentes** (`order desc, limit`); na FACE, 2.160 pagos em 2026, isso é a última semana. Pagamento excluído no Bling depois disso ficava aqui para sempre. A varredura incremental não cobria: no dia 16 tocou ~3.000 em aberto e ~70 pagos.
- **Correção (R10.6):** rodada que lista no Bling os pagos e parciais dos últimos 365 dias **por data de pagamento** (as fases da carga histórica, agora fonte única em `bling-reconferencia`), 100 por página, só ids; compara com os liquidados daqui e confere pelo id o que não apareceu, pela fila e pela regra da reconferência. Página com erro não avança; margem de 45 dias no início da janela por causa da data do borderô; acima de 5% de candidatos a rodada é suspensa sem remover nada. Interface em laço depois da reconferência; cron com fatia diária e rodada nova a cada 7 dias. Junto: o `audit_logs` das remoções passa a guardar o registro inteiro.
- **Validação:** 18 suítes, 285 testes (`test-conferencia-liquidados` nova, 31); 14 sabotagens, uma por trava, todas reprovadas pela trava certa; build compila.

**20/10 · Conciliação das saídas da FACE contra o relatório de pagamentos do Bling**
Relato do Controller: julho com o sistema R$ 2.567,98 acima do Bling, 2026 com R$ 1.501,82 acima. Cruzamento linha a linha das 1.803 linhas do relatório por valor do título e data de liquidação.
- **Julho:** MERCADO LIVRE `26414983916` (R$ 1.805,99) e RAPHAEL BERBEL PITTA `26317080212` (R$ 946,40, que no Bling virou R$ 173,53 + R$ 772,87) existiam só aqui; menos R$ 184,41 de juros pagos que o sistema não registra (ADR-004). Fecha ao centavo.
- **Jan–set:** os dois de julho + PLAYSTATION R$ 43,90 em dobro em 17/08 = R$ 2.796,29, menos R$ 1.294,47 de juros e multas = R$ 1.501,82. Outubro: o parcial de R$ 5.000 da DataDog, que o relatório do Bling não lista. Nada do Bling falta aqui.
- **Remoção:** os dois de julho, com confirmação do Controller no Bling, por SQL com o motivo e o registro completo em `audit_logs` (`controller:conciliacao-2026-10-20`). Julho passou de R$ 1.065.070,12 para R$ 1.062.317,73 — igual ao valor dos títulos no Bling. O PLAYSTATION fica para a primeira rodada da conferência dos liquidados, que identifica qual dos dois saiu do Bling.
- Datas de liquidação diferentes e juros: ver D5 em [11](11-pendencias.md).

**16–19/10 · Reconferência e cron em produção (PR #33)**
Migração `20261016_reconferencia` aplicada, `CRON_SECRET` criada como variável sensível, merge e piloto JAM → JB → FACE acompanhado no banco.
- **Removidos por exclusão no Bling:** JAM 36 títulos (R$ 52.356,02), JB 72 (R$ 24.165,52), FACE 58 (R$ 2.287.519,04), além de 4 atualizados. Saíram o DATAPREV `26280211663` e o JULIANO `23648043154`; os títulos que os substituíram ficaram intactos.
- **Cron:** gravou em 17, 18 e 19/10.
- Na primeira tentativa da JAM a aba usava o JavaScript anterior ao deploy e parou em 15 remoções; resolvido recarregando a página (Ctrl+Shift+R).

**16/10 · Sincronização "com sucesso" que não registrava atualizações · cron que nunca rodou**
Relato do Controller: a sincronização diária retorna sucesso, mas as atualizações não chegam, e nada roda sozinho. Investigação só com leitura (código, banco, trilha de auditoria, documentação da Vercel) e teste ao vivo com a sincronização da FACE acompanhada no banco.
- **Cron — causa confirmada:** a variável `CRON_SECRET` não existia. A Vercel autentica o cron **só** com `Authorization: Bearer <CRON_SECRET>`; a rota esperava também um header `x-vercel-cron` que a Vercel não envia. Resultado: 401 diário, nenhuma escrita às 06:00 BRT desde 14/07. Os logs não ajudaram: o plano Hobby guarda 1 hora.
- **Sincronização manual — funciona quando roda:** o teste ao vivo de 16/10 (14:34–15:03) gravou 497 títulos novos e 43 baixas, sem duplicidade. Os dias "sem atualização" foram dias em que nenhuma chamada chegou ao servidor — a varredura roda no navegador e para em silêncio se a aba fecha.
- **Causa estrutural — títulos congelados:** título que sai da listagem do Bling (excluído, substituído, cancelado) nunca mais era conferido. 165 títulos em aberto ou parciais sem conferência (FACE R$ 2,3 mi). Confirmados com o Controller: **DATAPREV `26280211663`**, R$ 1.335.639,20 "a receber vencido", excluído e substituído pelo título de 21/10; **JULIANO BASILIO `23648043154`**, parcial de R$ 10.000 de título excluído e substituído pelo de 10/07 — R$ 10.000 em dobro no caixa de julho. A verificação de exclusões não os alcançava: olhava os ~30 em aberto de vencimento **mais distante** dentro de 90 dias.
- **Correção:** fila de reconferência por id (`lib/bling-reconferencia.js`, R10.4/R10.5) — títulos em aberto que a varredura não viu são consultados um a um; 404 nos dois recursos remove, com teto de 15 por execução e registro completo em `audit_logs`; qualquer outra falha mantém. `verificarExclusoes` passa a cuidar só dos liquidados recentes. Cron autenticado só por `CRON_SECRET`, com prazo por página, fatia por entidade e rodízio diário; erro gravado em `cron_resultado`.
- **Validação:** 17 suítes, 254 testes; 10 sabotagens (uma por trava nova), todas reprovadas pela trava certa; build compila.
- **Pendente:** aplicar a migração `20261016_reconferencia`, criar `CRON_SECRET`, mergear e rodar o piloto (JAM, JB, FACE) — sob aprovação. O item 4 do Controller (regra do borderô, ADR-004) fica para depois.

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
