# 06 — Telas e KPIs

Cada KPI com regime, fórmula e fonte. **Todas as telas abrem no mês vigente** (R5.1).

Regime: **C** = caixa (`fluxo_caixa`) · **K** = competência (`lancamentos`).

---

## Visão Geral — `/dashboard/overview`

`OverviewContent.jsx` · modo padrão: **mês** · alternativas: mês anterior, trimestres,
semestres, YTD, últimos 12 meses, ano anterior.

| KPI | Regime | Fórmula | Fonte |
|---|---|---|---|
| Receita Bruta, EBITDA, Margem Bruta, Margem Líquida | K | ver DRE | `calcDRE` |
| **Caixa Disponível** | C | âncora + Σ efeitos **realizados** até **hoje** | `saldoDePartidaConsolidado` + `efeitosCaixa` |
| A Receber · 30 dias | C | projetado de entrada, próximos 30 dias | `efeitosCaixa` |
| A Pagar · 30 dias | C | projetado de saída, próximos 30 dias | `efeitosCaixa` |
| Burn Rate Mensal | K | (custos variáveis + despesas fixas) ÷ meses | `calcDRE` |
| **Runway** | misto | Caixa Disponível ÷ Burn Rate | derivado |

**Caixa Disponível** não exibe projeção nem como linha secundária (R4.7). Deve bater com
o extrato bancário — é o critério de aceite.

**Runway** abaixo de um mês é expresso em **dias**; abaixo de três meses, em vermelho.
Não se aplica com caixa negativo.

⚠️ Runway mistura caixa (numerador) e competência (denominador). É deliberado — o burn
rate por competência é mais estável —, mas os dois regimes precisam ser lembrados ao ler.

---

## DRE

Regime **K** · fonte `calcDRE`.

| Rota | Conteúdo |
|---|---|
| `/dashboard/dre` | Visão Geral — cards e gráfico |
| `/dashboard/dre/detalhado` | drill-down em três níveis · exportação Excel (abas DRE e Lançamentos) · coluna Δ Período Anterior com F/D |
| `/dashboard/dre/analise` | análise gráfica |
| `/dashboard/dre/comparativo` | dois períodos lado a lado |

```
  Receita Bruta
- Deduções
= Receita Líquida
- Custos Variáveis
= Lucro Bruto
- Despesas Fixas
= EBITDA
- Impostos sobre Lucro
+ Receitas Financeiras
- Despesas Financeiras
= Resultado Líquido
- Investimentos
= Resultado Final
```

| Linha | `tipo` somado |
|---|---|
| Receita Bruta | `receita` |
| Deduções | `deducao` |
| Custos Variáveis | `custo` |
| Despesas Fixas | `despesa` |
| Impostos sobre Lucro | `imposto_lucro` |
| Receitas Financeiras | `receita_financeira` |
| Despesas Financeiras | `despesa_financeira` |
| Investimentos | `investimento` |

Contas com `tipo` `entrada` ou `saida` — grupo 9 — **não aparecem**.

**Comparativo:** período anterior de mesmo tamanho. ⚠️ Contra bases de 2025 produz
variações sem significado (`+557%`, `+5.834%`) — a base anterior está incompleta. Ver
[11](11-pendencias.md).

⚠️ `dre/page.jsx` tem `calcDRE` própria, duplicada. Hoje idêntica. Ver [11](11-pendencias.md).

---

## Fluxo de Caixa

Regime **C**. Todas as telas escutam o evento `storage` para a troca de entidade (R9.2).

### Visão Geral — `/dashboard/fluxo-caixa`

| KPI | Fórmula |
|---|---|
| Total Recebido | Σ efeitos de entrada no período |
| Total Pago | Σ efeitos de saída no período |
| Saldo do Período | recebido − pago |
| Margem de Caixa | saldo ÷ recebido |

Gráfico com **duas séries acumuladas**: `saldo` (realizado) e `saldoProj` (com a vencer).

### Gestão — `/dashboard/fluxo-caixa/gestao`

Única tela que usa `agregarPeriodo`.

| KPI | Fórmula |
|---|---|
| Entradas · realizado / Saídas · realizado | `agregarPeriodo(...).realizado` |
| Resultado do período | entradas − saídas realizadas — **é fluxo, não posição** |
| **Saldo final em DD/MM** | saldo de partida + resultado — **é posição** |
| Total de registros | |

O cartão de saldo de partida mostra a **âncora** (fixa) separada do **movimento até a
véspera** (varia com o período).

**Entidade.** Com mais de uma entidade na visão, a tabela ganha a coluna **Entidade**.
O filtro de entidade na barra **altera a seleção global** — a mesma do menu lateral —,
para que âncoras, Saldo do Dia, KPIs e exportação reajam juntos. Um filtro local
exibiria o Saldo do Dia com a âncora de outras entidades.

**Seleção em lote.** Sobrevive à troca de página; zera ao mudar qualquer filtro;
"selecionar todos" age na página atual. Regras em [04 § 9A](04-regras-de-negocio.md#9a-seleção-em-lote-para-exclusão).

**Novo Lançamento.** Com mais de uma entidade na visão, a entidade de destino é
obrigatória. Antes o lançamento era gravado com `empresa_id = 'todas'` e rejeitado.

**Exportação Excel** — abas Resumo e Extrato:
- Recorte por **data efetiva** (R6.1)
- Extrato imprime o **efeito de caixa**, não o valor do título
- Resumo declara a **amarração** com o Extrato; a diferença deve ser `0,00`
- Coluna **Entidade** é a **última** — colunas A a J idênticas às versões anteriores, para não quebrar planilhas que leem por posição
- A amarração localiza as colunas **pelo nome**, não pela posição

### Análise — `/dashboard/fluxo-caixa/analise`

Aplica **natureza** (R7.1).

| KPI | Fórmula |
|---|---|
| Recebido · operacional | Σ entradas de natureza `operacional` |
| Pago · operacional | Σ saídas de natureza `operacional` |
| Saldo Líquido | recebido − pago operacionais |
| **Índice de Cobertura** | recebido ÷ pago operacionais |
| Ticket Médio Entradas / Saídas | total ÷ quantidade |
| Burn Rate Médio (diário) | pago ÷ dias do período |
| Total de Transações | |

Bloco **"Fora dos indicadores operacionais"** declara o total excluído por natureza.

### Demais

| Rota | Conteúdo |
|---|---|
| `/dashboard/fluxo-caixa/atrasados` | títulos vencidos não liquidados, por faixa de aging |
| `/dashboard/fluxo-caixa/comparativo` | dois períodos lado a lado |
| `/dashboard/fluxo-caixa/projecao` | fluxo futuro por vencimento |

---

## Ciclo Financeiro — `/dashboard/ciclo-financeiro`

Regime **C**. Consolidação por R9.1: numeradores e denominadores somados antes da razão.

| KPI | Definição |
|---|---|
| **PMR** | Prazo Médio de Recebimento — Σ(valor × dias) ÷ Σ valor, entradas liquidadas |
| **PMP** | Prazo Médio de Pagamento — idem, saídas |
| **PME** | Prazo Médio de Estoque — **fixo em 0**: estoque não vem do Bling |
| Ciclo Operacional | PME + PMR |
| Ciclo Financeiro | Ciclo Operacional − PMP |

⚠️ Usa valor do título para `pago`, não o borderô. Hoje converge pela R3.1, mas é base
divergente. Ver [11](11-pendencias.md).

---

## Orçamento — `/dashboard/orcamento`

Orçado × realizado, com escopo por entidade ou consolidado. Realizado expandido por
`efeitosCaixa`.

---

## Plano de Contas — `/dashboard/plano-contas`

| Coluna | Função |
|---|---|
| Código, Nome, Descrição | |
| **Natureza** | seletor das quatro naturezas — propaga a todas as entidades |
| De-Para | categorias vinculadas |

Grupo **9 — Não operacional** reservado para transferências, empréstimos e sócios.

Sub-tela **`/dashboard/plano-contas/auditoria`**: conferência de classificação.

---

## Importação — `/dashboard/importacao`

Planilha do Bling, CSV com `;` ou XLSX, UTF-8 com BOM.

| Card | Significado |
|---|---|
| Linhas carregadas | total do arquivo |
| Entram no DRE | com mapeamento para tipo contábil |
| Marcados p/ ignorar | `tipo_destino = 'ignorar'` — decisão consciente |
| **Sem configuração** | sem mapeamento — **bloqueia a importação** (R8.1) |

⚠️ Aqui `empresa_id` define **onde os dados são gravados**, não apenas o filtro.

Sub-tela **`/dashboard/importacao/layout`**: layouts de importação por empresa —
mapeamento de colunas do arquivo. Também grava por empresa.

---

## Configurações — `/dashboard/configuracoes`

| Rota | Conteúdo |
|---|---|
| `/dashboard/configuracoes` | abas: Usuários · Identidade Visual · **Integrações** · **Saldo de Abertura** · Admin |
| `/dashboard/configuracoes/perfil` | dados do usuário |
| `/dashboard/configuracoes/empresas` | entidades da organização |

**Integrações:** conectar, reconectar e sincronizar cada entidade. A mensagem final
informa varredura completa ou parcial, títulos removidos por exclusão na origem, e
títulos adiados por tempo.
