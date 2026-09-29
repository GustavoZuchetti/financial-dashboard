# 09 — Testes

**13 suítes · 182 testes · todas passando** (verificado 29/09).

```bash
for t in scripts/test-*.mjs; do node "$t"; done
```

Cada suíte roda isolada, sem banco e sem rede. Testam **regras puras** extraídas das libs,
ou verificam **estrutura** do código-fonte.

## Convenção de nomes

| Prefixo | Significado |
|---|---|
| `[TRAVA]` | protege uma regra que já foi violada em produção. **Nunca remover** |
| `[REGRESSÃO]` | reproduz o comportamento defeituoso antigo, para documentar o que não pode voltar |
| `[CENÁRIO]` | caso real, com os números medidos na época |
| sem prefixo | comportamento esperado |

Um `[TRAVA]` falhando não é teste a ajustar — é defeito a corrigir.

---

## Suítes

| Suíte | Testes | Protege | Origem |
|---|---:|---|---|
| `test-saldo-abertura` | 32 | Saldo por âncora, série diária, consolidação | PRs #2–#4 |
| `test-fluxo-agregados` | 19 | Realizado × projetado, base do borderô, amarração do Excel | PRs #5, #12, #14 |
| `test-valor-liquidado` | 19 | Liquidado de título quitado, coerência que força reprocessamento | PR #16 |
| `test-bling-cursor` | 17 | Posição de varredura persistente | PR #10 |
| `test-natureza-categoria` | 17 | Exclusão de transferências dos KPIs | PRs #23, #24 |
| `test-importacao-mapeamento` | 15 | Bloqueio de importação sem De-Para | PR #18 |
| `test-orcamento-sync` | 13 | Orçamento de tempo, adiamento seguro | PR #17 |
| `test-bling-jwt` | 12 | Header JWT nos três pontos, renovação em 401 | PR #25 |
| `test-caixa-disponivel` | 11 | Caixa só realizado e só até hoje, Runway | PRs #20, #22 |
| `test-exclusoes-alvos` | 10 | Títulos em aberto verificados contra a origem | PR #15 |
| `test-consistencia-saldo` | 8 | Mesmo saldo entre telas, período padrão | PR #21 |
| `test-bling-resiliencia` | 5 | Degradação de página em 504 | PRs #8, #9 |
| `test-escopo-entidade` | 4 | Toda tela reage à troca de entidade | PR #19 |

---

## Travas mais importantes

As que protegem contra os incidentes de maior impacto:

**`test-caixa-disponivel`**
- título a vencer NÃO entra no caixa disponível
- meses FUTUROS do período não entram no caixa de hoje
- o cartão de Caixa Disponível não exibe projeção

**`test-consistencia-saldo`**
- Visão Geral e Fluxo de Caixa chegam ao MESMO saldo
- nenhuma tela inicializa período por conta própria — *varre os fontes*

**`test-saldo-abertura`**
- sem âncora o saldo é NULO, nunca zero
- uma entidade sem âncora anula o consolidado inteiro
- movimentos anteriores à data de corte NÃO entram no saldo

**`test-importacao-mapeamento`**
- categoria SEM mapeamento não entra no payload
- sem classificação LANÇA erro, não vira receita
- pendências bloqueiam a importação

**`test-natureza-categoria`**
- categoria SEM conta é operacional, nunca excluída em silêncio
- sem pista de sugestão devolve NULL, não "operacional"

**`test-escopo-entidade`**
- toda tela que lê a entidade reage à troca dela — *varre os fontes*
- telas que GRAVAM por empresa exigem entidade específica

**`test-bling-jwt`**
- a RENOVAÇÃO passa pelo mesmo caminho da obtenção
- existem apenas DOIS pontos de chamada ao Bling

---

## Testes estruturais

Alguns testes não executam código: **varrem os fontes** e exigem um padrão. São
deliberadamente simples — não simulam React nem rede — para pegar o caso de um arquivo
**novo** nascer com um defeito já conhecido.

| Suíte | Exige |
|---|---|
| `test-escopo-entidade` | listener de `storage` em toda tela que lê a entidade |
| `test-consistencia-saldo` | período inicial vindo de `lib/periodo-padrao` |
| `test-bling-jwt` | `JWT_HEADER` nos dois pontos de chamada, e só dois |
| `test-caixa-disponivel` | `InfoTip` com `position:'fixed'`; cartão sem projeção |

**Exceções documentadas:** `app/dashboard/layout.jsx` lê a entidade só na inicialização,
para validar a seleção salva — reagir à troca ali causaria laço com o Sidebar.

---

## O que os testes NÃO cobrem

- **Integração real com o Bling** — nenhum teste chama a API
- **Banco** — nenhum teste executa SQL; RLS não é testado automaticamente
- **Interface** — nenhum teste renderiza componentes
- **Erro de execução** — ver [08 § Deploy](08-operacao.md) para `no-undef`

Os incidentes de maior impacto — Caixa Disponível 60× inflado, transferências em 44% dos
KPIs — **só foram encontrados navegando o sistema com dados de produção**. A auditoria
por leitura de código de 11/09 havia apontado três divergências, todas preventivas; a
navegação encontrou quatro defeitos reais.

**Nenhuma auditoria de KPI é completa sem passagem pela tela, com dados reais.**
