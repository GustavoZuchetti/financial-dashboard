# 11 — Pendências

> Estado em 30/10/2026 (P0, P1, T1, T7, T8, T10, a reconferência com cron e a conferência dos liquidados fechados; D5 e D6 investigados). Ordenado por gravidade dentro de cada seção.
> Ao fechar um item, mova-o para [10 — Histórico](10-historico.md) com a data.

---

## 🔴 Estado incerto — verificar antes de qualquer coisa

Nenhum item em aberto. Fechados: a confirmação das remoções de 19/10 na FACE (28/10), a
conferência dos liquidados (27/10) e o P0 do grupo 9 do Plano de Contas (16/10) — ver
[10 — Histórico](10-historico.md).

---

## 🔴 Segurança

Detalhes e passos em [07 — Segurança](07-seguranca.md).

| # | Item | Gravidade | Decisão |
|---|---|---|---|
| S1 | Chave `service_role` em 4 scripts de repositório público | **Crítico** | manter até o fim do desenvolvimento |
| S2 | Token do GitHub em uso na sessão | Alto | manter até o fim do desenvolvimento |
| S3 | `main` sem proteção de branch | Médio | — |
| S4 | Repositórios públicos | Médio | — |

---

## 🟠 Dados

### D1 — 14 categorias operacionais sem conta · R$ 2,26 mi

Despesas e receitas reais, fora do DRE por falta de mapeamento. **Não vão para o grupo 9.**

| Categoria | Volume | Natureza correta |
|---|---:|---|
| Impostos sobre receitas | 1.676.629 | dedução |
| IRPJ e CSLL — Parcelamento | 320.404 | imposto sobre lucro |
| Vale alimentação | 151.950 | despesa de pessoal |
| Dimensa | 61.545 | despesa |
| Rendimento de aplicação financeira | 25.181 | receita financeira |
| PDTI | 8.349 | despesa |
| Cursos e Treinamentos | 6.889 | despesa |
| Plano de saúde | 3.996 | despesa de pessoal |
| Encargos da folha | 3.666 | despesa de pessoal |
| Serviços de Terceiros | 2.500 | despesa |
| Premiação | 1.961 | despesa de pessoal |
| Comissões | 945 | despesa |
| Variação Monetária Passiva | 865 | despesa financeira |
| Serviços de terceiros | 32 | **duplicata** da anterior, com caixa diferente |

⚠️ **Afeta o DRE.** Conferir o DRE antes e depois do mapeamento.

### D2 — Estornos · R$ 98 mil

Devoluções de Pagamentos (R$ 65.845) e Estorno Recebido (R$ 32.322). Decidido como
operacional; falta vincular a conta. Hoje `Devoluções de Pagamentos` tem De-Para `ignorar` sem conta na
FACE (8 lançamentos), o que resolve para `operacional` — comportamento correto; só falta a conta (verificado 16/10).

### D3 — "Categoria 0"

2 lançamentos, R$ 23. Nome de lixo — provável defeito de importação. Há ainda um De-Para `-` sem
lançamentos na JB (verificado 16/10).

### D4 — 13 variantes de nome para transferência no Bling

Cadastro na origem. Não corrigível pelo sistema; cada variante tem conta própria.

---

### D5 — Liquidação pelos borderôs: aplicar e reprocessar 2026 — item 4

Regra decidida (ADR-012, opção A) e implementada: data do pagamento mais recente e valor
pago com juros. O caso JULIANO de setembro foi esclarecido — o Bling registra R$ 22.000 em
14/09 e R$ 9.000 em 08/09 em títulos distintos: nada a corrigir. Falta, com aprovação:

1. Aplicar `20261103_liquidacao_borderos` e mergear
2. **Reprocessar pagos de 2026** — JAM → JB → FACE, com KPIs antes e depois
3. Conciliar a FACE contra o xls do Bling: esperado diferença zero de jan a set
4. Esvaziar `integracoes.diagnostico_bling`
5. Medir em `liquidacoes` quanto pesam os títulos pagos em parcelas (base para a opção B)

⚠️ Muda números de jan–abr já reportados (FACE: ~R$ 10,5 mil saem de janeiro, ~R$ 18 mil
de março) e acrescenta os juros.

### D6 — Empréstimo Bradesco da JAM lançado em três entidades

Investigado em 30/10. Empréstimo da JAM emitido em 29/01/2026, 60 parcelas mensais no dia
15 de R$ 1.133,59 (R$ 666,67 de principal + R$ 466,92 de juros). O sistema reflete o Bling
de cada entidade; o problema está nos lançamentos:

| Parcela | No Bling | Problema |
|---|---|---|
| mar, abr | JAM, paga | — |
| mai | JB, paga | lançada na JB |
| jun | JAM pagou o Bradesco em 27/07 **e** FACE pagou "JAM SERVIÇOS FINANCEIROS" em 29/06 como empréstimo e juros | **em dobro no grupo** — o repasse devia ser transferência interna |
| jul | nenhuma entidade | **parcela faltando** |
| ago | FACE, paga | lançada na FACE |
| set | FACE paga em 14/10 **e** JAM em aberto | **duplicada** — infla o vencido da JAM |
| out | JAM em aberto **e** 7 "Tarifa bancária" BRADESCO em 13/10 somando R$ 1.133,59, com dinheiro da JB | provável duplicidade e categoria errada |

O "a pagar vencido" da JAM está inflado em R$ 2.267,18 (set + out). "Nenhuma baixa desde
27/07" não vale mais: a JAM teve 8 baixas em 13/10.

**Correção — no Bling, pela equipe do Controller:** decidir quem paga e como o repasse é
lançado (recomendado: parcela sempre na JAM; repasse de FACE ou JB como transferência
interna nas duas pontas); baixar ou excluir set e out na JAM; reclassificar o repasse de jun
na FACE; localizar jul; reclassificar as 7 tarifas de out. A sincronização e a conferência
dos liquidados refletem. Opcional depois: checagem de "mesma contraparte, valor e
vencimento em duas entidades".

## 🟡 Dívida técnica

### T2 — `agregarPeriodo` adotada em 1 de 8 telas

Só a Gestão usa. As demais calculam totais por conta própria. Hoje convergem; sem trava,
divergirão na próxima mudança de regra.

### T3 — Listas de tipo literais

Análise e Ciclo comparam `tipo === 'entrada'`. Funciona porque `fluxo_caixa` só tem
`entrada` e `saida` (verificado 11/09). Um tipo novo seria tratado diferente em cada tela.
Projeção usa `else → saída`, contrariando R2 (tipo desconhecido é contado, nunca somado).

### T4 — Ciclo Financeiro usa valor do título para `pago`

Converge hoje pela R3.1. Divergirá se a regra do liquidado mudar.

### T5 — Comparativo do DRE contra base incompleta

Períodos de 2025 produzem variações sem significado (`+557%`, `+5.834%`) exibidas como
crescimento. **Sugestão:** suprimir quando a base anterior tiver cobertura insuficiente.

### T6 — Lint no build

`no-use-before-define` e `no-undef` pegariam os defeitos dos PRs #11 e #13. Adicionar
`.eslintrc.json` hoje ligaria o `next/core-web-vitals` completo, que falha em dezenas de
violações preexistentes. Exige limpeza prévia.

### T8a — Emoji na tela de convite

`app/aceitar-convite/page.jsx` usa ⏳ no estado "validando" — viola o padrão de ícones
por `SvgIcon`. Encontrado em 30/09, fora do escopo daquele PR.

### T8b — Login sem marca por organização

Antes da autenticação não se sabe a organização do usuário; `/api/public/logo` devolve a
da primeira organização com logo, em ordem determinística. Com vários clientes, cada um
precisaria de uma URL de login própria.

### T9 — Scripts legados em `scripts/`

`seed_*`, `setup_*`, `*_setup.js` — sem uso atual, quatro deles com credencial (S1).

---

### T11a — Varredura manual roda no navegador

A sincronização é um laço no navegador de ~30 min por entidade; fechar a aba interrompe em
silêncio (o cursor fica salvo). Com o cron limitado a algumas páginas por dia, a varredura
completa depende de alguém deixar a tela aberta. Avaliar uma execução em segundo plano.

## 🔵 Evolução

| Item | Observação |
|---|---|
| Alocação de borderô por título | Permitiria preservar juros e multa por título — R$ 11 mil no histórico. Exige inspecionar o JSON do borderô |
| Auditoria de reversões | Registrar em `audit_logs` quando um título liquidado volta a aberto |
| PME real | Fixo em 0 — estoque não vem do Bling |
| Notificações de vencimento | Badge no sidebar |
| Drill-down nos gráficos | Clicar na barra e ver os lançamentos |
| Runner de migrações | Hoje manuais — risco de código dependente de coluna inexistente |
| Acesso direto ao Supabase no ambiente de desenvolvimento | Liberar `api.supabase.com` eliminaria a dependência da extensão do navegador |
| Teste de regressão multi-entidade | FACE × JAM × JB nos módulos DRE, Fluxo e Ciclo — pendente desde 02/07 |
| Ciclo Financeiro sem dados iniciais | Primeiro acesso exige clique em "Recalcular" |
