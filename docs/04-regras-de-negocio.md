# 04 — Regras de negócio

> **Leia antes de mexer em qualquer cálculo.** Cada regra abaixo existe porque sua
> violação já produziu um número errado em produção. O incidente que a originou está
> indicado.

---

## 1. Princípio geral

**Nenhuma regra de negócio existe em dois lugares.** Ela vive numa lib e as telas a
consomem. Reimplementar localmente é a causa mais frequente de divergência entre telas
nesta base.

**Divergência entre duas telas que exibem a mesma grandeza é sempre defeito**, e exige
investigação de causa raiz — nunca explicação parcial.

**DRE e Fluxo de Caixa divergem por construção.** DRE é competência, caixa é regime de
caixa. A diferença entre eles tem contrapartida em contas a receber e a pagar.

---

## 2. Efeito de caixa de um título

Fonte única: `efeitosCaixa(r, hoje)` em `lib/fluxo-status.js`.

| Status | Efeito | Data do efeito | Origem |
|---|---|---|---|
| `pago` | `valor_liquidado` (ou `valor`, se ausente) | `data_liquidacao` (ou vencimento, marcado aproximado) | **realizado** |
| `parcial` | parte liquidada | `data_liquidacao` | **realizado** |
| `parcial` | restante, **se ainda não venceu** | vencimento | **projetado** |
| `aberto` | valor, **se ainda não venceu** | vencimento | **projetado** |
| `aberto` vencido | **nenhum** — fora do fluxo | — | — |
| `cancelado` | nenhum | — | — |

### Regras derivadas

**R2.1 — Vencido não liquidado sai do fluxo.** Ele aparece em "Atrasados", não no saldo.
Projetar uma cobrança vencida como se fosse entrar no próximo dia infla o caixa.

**R2.2 — O valor que move o caixa é o do borderô, não o do título.**
*Incidente:* Causa 1 da auditoria de 13/08 — KPIs somavam `r.valor` enquanto o saldo
usava `valor_liquidado`. Mesma tela, duas bases. Corrigido nos PRs #5 e #12.

**R2.3 — O borderô é a fonte da verdade da data de liquidação.**

**R2.4 — Realizado e projetado nunca se misturam num indicador de posição.**
O campo `origem` existe para isso.
*Incidente:* PR #20 — "Caixa Disponível" exibia R$ 1,31 mi contra R$ 22 mil no banco,
porque somava títulos a vencer. Erro de ~60×. O Runway saía em 3,9 meses quando a
autonomia real era de dias.

---

## 3. Valor liquidado

Fonte: `montarRegistrosFluxo` em `lib/bling-server.js` · trava em `test-valor-liquidado`.

**R3.1 — Título integralmente pago tem `valor_liquidado` igual ao valor do título.**
Nenhum borderô pode reduzi-lo.

*Incidente:* PR #16 — dois cenários reais:

- **Borderô compartilhado.** Uma guia única quita vários títulos (parcelamentos da
  Receita Federal). O borderô traz o valor da guia inteira; atribuí-lo a cada título
  replicava o mesmo número. Em 31/07/2026: nove títulos com `−1.553,63` idênticos,
  onde o Bling tinha dezoito valores distintos.
- **Múltiplos borderôs com estorno.** Retiradas parciais estornadas e reclassificadas
  como empréstimo, título quitado depois. Caso ALEXANDRE FRANCISCO, título `1414/11`:
  valor R$ 22.000, gravado como R$ 5.000 — soma de três retiradas estornadas.
  Somar todos os borderôs também erraria: daria R$ 27.000.

**R3.2 — O borderô define o valor apenas quando o título está parcial e o saldo não
informou**, e ainda assim limitado ao valor do título.

**R3.3 — A data continua vindo do borderô em todos os casos.**

**Custo conhecido:** juros, multa e desconto embutidos no pagamento deixam de aparecer
por título. Pelos extratos, R$ 11.074,91 em 143 títulos de todo o histórico (~0,03% do
movimentado). Decisão documentada em [12 § ADR-004](12-decisoes.md).

---

## 4. Saldo de abertura e saldo do período

Fonte: `lib/saldo-abertura.js` · trava em `test-saldo-abertura` (32 testes).

```
saldo(D) = âncora.valor + Σ efeitos com data_corte ≤ efeito.data ≤ D
```

**R4.1 — `data_corte` é o saldo na ABERTURA do dia.** Movimentos do próprio dia contam.
Para saldo inicial de julho, a âncora é `01/07`.

**R4.2 — Âncora é sempre por entidade.** Consolidado é a soma das âncoras.

**R4.3 — Sem âncora vigente, o saldo é NULO, nunca zero.** Zero é um valor; nulo é
ausência de informação. Exibir zero seria afirmar algo falso.

**R4.4 — Uma entidade sem âncora anula o consolidado inteiro.**

**R4.5 — O saldo de partida muda com o período; a âncora não.** A partida é a âncora
rolada até a véspera do período. Tornar a partida fixa produziria saldo errado para
qualquer período que não comece na data de corte.

**R4.6 — Caixa Disponível = somente realizado, somente até hoje.**
*Incidentes:* PRs #20, #21, #22. Três causas somadas faziam a Visão Geral e o Fluxo de
Caixa divergirem: períodos padrão diferentes, projetado somado ao saldo, e ponto final
em meses futuros.

**R4.7 — Nenhum número projetado em indicador de posição.** Decisão do Controller
(15/09): *"o CEO, investidor ou qualquer outra pessoa deve ter a visão da realidade
atual da empresa, sem números projetados, a não ser que seja um KPI de projeção."*

---

## 5. Período padrão

Fonte: `lib/periodo-padrao.js` · trava em `test-consistencia-saldo`.

**R5.1 — Toda tela abre no mês vigente.** Decisão do Controller (15/09): o login fica
previsível e o recorte passa a ser escolha consciente do usuário.

*Incidente:* PR #21 — havia seis inicializações diferentes. O Fluxo de Caixa abria em
`01/01/2024`, arrastando dois anos e meio de base incompleta para dentro do saldo.

---

## 6. Recorte por data efetiva

**R6.1 — Um lançamento pertence ao período pela data em que o caixa se moveu**, não
pelo vencimento.

*Incidente:* PR #14 — a exportação filtrava só por vencimento e trazia títulos
liquidados em 2025 dentro do relatório de 2026.

**R6.2 — As abas de um mesmo arquivo exportado usam a mesma base.** O Resumo declara a
amarração com o Extrato e a diferença, que deve ser zero.

---

## 7. Natureza das contas

Fonte: `lib/natureza-categoria.js` · trava em `test-natureza-categoria` (17 testes).

```
categoria do lançamento → categoria_mappings → conta → plano_contas.natureza
```

| Natureza | Nos KPIs operacionais? | No saldo de caixa? |
|---|---|---|
| `operacional` | **Sim** — padrão | Sim |
| `transferencia_interna` | Não — anula-se no consolidado | **Sim** |
| `aporte_socio` | Não — é caixa, não é receita | **Sim** |
| `emprestimo` | Não — é financiamento | **Sim** |

**R7.1 — Transferências entre entidades do grupo saem dos indicadores operacionais.**
*Medição (11/09, consolidado, 01/01 a 12/09):* transferências eram 44,0% das entradas e
44,3% das saídas. O Índice de Cobertura convergia para 1,0 por construção matemática.

**R7.2 — O saldo de caixa continua somando tudo.** Transferência recebida está no
banco. Excluí-la do saldo criaria divergência contra o extrato.

**R7.3 — Categoria sem conta é `operacional`, nunca excluída em silêncio.**
*Verificação (16/09):* das 39 categorias sem conta, 14 são despesa ou receita real —
R$ 2,26 mi, incluindo Impostos sobre receitas (R$ 1,68 mi). Inferir "não mapeado = fora
do KPI" inflaria o resultado operacional.

**R7.4 — Toda exclusão é declarada na tela.** `separarPorNatureza` devolve o excluído
em vez de descartá-lo, para que a tela mostre o que tirou.

**R7.5 — Sugestão automática nunca é aplicada sozinha.** `sugerirNatureza` devolve
`null` sem pista — nunca `operacional`.

**R7.6 — Variantes de nome não são consolidadas.** Decisão do Controller (24/09):
"Transferência JB", "Transferências JB" e "Transferências Realizada JB" são contas
distintas — têm origem em empresas diferentes.

---

## 8. De-Para

Fonte: `buildDrePayload` em `app/dashboard/importacao/page.jsx` · trava em
`test-importacao-mapeamento` (15 testes).

**R8.1 — Categoria sem mapeamento bloqueia a importação do DRE.**
*Incidente:* PR #18 — o filtro era `map?.tipo_destino !== 'ignorar'`. Sem mapeamento,
`undefined !== 'ignorar'` é verdadeiro e a linha passava. A tela afirmava *"registros
sem mapeamento não entram no DRE"* enquanto o código fazia o oposto.

**R8.2 — Sem adivinhação de tipo.** Ausência de classificação lança erro nomeando a
categoria. O fallback antigo classificava pela palavra "pagar" no arquivo de origem —
a mesma transferência virava despesa ou receita conforme o arquivo.

**R8.3 — Tipo não reconhecido lança erro, nunca vira receita.**

**R8.4 — Contas não operacionais têm `tipo_destino = 'ignorar'`.** Com `'saida'` a
importação de DRE inteira quebraria — ver [03](03-banco-de-dados.md#categoria_mappings--de-para).

---

## 9. Consolidação multi-entidade

**R9.1 — Consolidado agrega dados brutos, nunca média de métricas.**
Para razões (PMR, PMP), some numeradores e denominadores de todas as entidades antes de
dividir. Média de razões pré-calculadas é matematicamente incorreta.

**R9.2 — Toda tela que lê a entidade reage à troca dela** — e **recalcula as entidades a cada troca**, não só quando `empresa_id` muda. `empresa_id` vale `'todas'` para qualquer seleção com mais de uma entidade: passar de três para duas não o altera. Implementado em todas as telas pelo hook `useVersaoSelecao` (PR #28).
*Incidente:* PR #19 — três telas liam a seleção uma única vez. Na Análise, desmarcar JAM
e JB deixava os valores byte a byte idênticos. Em `importacao`, **gravava na empresa
errada**. Trava estrutural em `test-escopo-entidade`.

---

## 9A. Seleção em lote para exclusão

Fonte: `lib/selecao-lancamentos.js` · trava em `test-selecao-lancamentos` (22 testes).

A seleção alimenta **exclusão permanente** — sem lixeira nem desfazer.

**R9A.1 — A seleção sobrevive à troca de página.**
*Incidente (30/09):* marcar lançamentos e ir à próxima página desmarcava tudo.

**R9A.2 — A seleção zera quando qualquer filtro muda** — período, tipo, situação, busca,
entidade. Senão seria possível excluir itens que já não aparecem.

**R9A.3 — "Selecionar todos" age só na página atual.**
*Duas falhas na regra antiga*, que comparava o total selecionado com o tamanho da página:
com itens em outras páginas, **substituía** a seleção em silêncio; quando os tamanhos
coincidiam por acaso, **desmarcava tudo**, inclusive o que não estava na página.

**R9A.4 — A confirmação declara o que não está à vista:** valor total, itens em outras
páginas, quantos serão removidos de fato e quantos a sincronização recriará.

**R9A.5 — Exclusão de lançamento do Bling não é bloqueada, é avisada.** Enquanto
existir no Bling, a sincronização o recria. Mas título marcado `origem_ausente` **não**
volta — removê-lo é legítimo. Decisão de 30/09.

**R9A.6 — Só ids do conjunto filtrado vão para o DELETE**, nunca o conjunto de seleção cru.

## 10. Integração Bling

Detalhes em [05](05-integracao-bling.md). As regras de negócio:

**R10.1 — Título excluído no Bling sai do fluxo**, incluindo títulos em aberto.
**R10.2 — Registro não originado do Bling nunca é removido** por "não existir lá".
**R10.3 — Título sem detalhe não é gravado.** Registro degradado sobrescreveria dados bons.

---

## 11. Mudanças de comportamento

**R11.1 — Perguntar antes de alterar comportamento não solicitado.**
**R11.2 — Operação em massa sobre dados exige confirmação explícita.**
**R11.3 — Operação destrutiva exige verificação prévia com dados, não com expectativa.**
*Caso (24/09):* antes do `DROP TABLE categorias_natureza`, afirmou-se que ela estava
vazia sem ter consultado. A consulta foi exigida e executada — estava vazia, mas a
afirmação anterior foi indevida.
