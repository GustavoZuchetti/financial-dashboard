# 12 — Decisões

Registro de decisões de arquitetura (ADR). Cada uma com o contexto, a alternativa
descartada e o custo aceito. **Decisões não são revogadas por edição** — uma nova ADR
substitui a antiga, que fica marcada como superada.

---

## ADR-001 · Saldo por âncora certificada, por entidade

**Contexto.** Havia três definições de saldo de partida no sistema, e somar o histórico
inteiro produzia "buracos" de milhões — a base anterior a 2026 está incompleta.

**Decisão.** Cada entidade tem uma âncora certificada contra extrato. O saldo de qualquer
dia é a âncora mais o movimento desde a data de corte. Consolidado é a soma das âncoras.

**Descartado.** Âncora única consolidada — impede reconciliar por entidade.

**Custo.** Uma entidade sem âncora anula o consolidado. É deliberado: preferível não
exibir a exibir um número incompleto.

---

## ADR-002 · Nulo, nunca zero, para ausência de informação

**Decisão.** Sem âncora, sem dado, sem cobertura: o valor é nulo e a tela exibe `—`.

**Motivo.** Zero é uma afirmação. Exibir "Caixa: R$ 0,00" quando não se sabe o caixa é
informação falsa para quem decide.

---

## ADR-003 · Nenhum número projetado em indicador de posição

**Contexto.** PR #20: Caixa Disponível somava títulos a vencer — 60× o valor real.

**Decisão do Controller (15/09).** *"O CEO, investidor ou qualquer outra pessoa deve ter
a visão da realidade atual da empresa, sem números projetados, a não ser que seja um KPI
de projeção."*

**Descartado.** Exibir a projeção como linha secundária do mesmo cartão — mesmo rotulada,
convive com o valor principal e induz leitura somada.

---

## ADR-004 · Título quitado: liquidado igual ao valor do título

> **Substituída pela [ADR-012](#adr-012--liquidação-pelos-borderôs-último-pagamento-e-valor-pago) em 03/11/2026.**

**Contexto.** PR #16. O borderô do Bling é compartilhado entre títulos quitados pela
mesma guia e não informa a alocação por título.

**Decisão.** Título quitado tem `valor_liquidado = valor`. O borderô define apenas a data,
e o valor só quando o título está parcial.

**Descartado.**
- *Somar todos os borderôs* — daria R$ 27.000 no caso de R$ 22.000
- *Ratear o borderô proporcionalmente* — produz números que parecem exatos sem ser

**Custo.** Juros, multa e desconto deixam de aparecer por título: R$ 11.074,91 em 143
títulos do histórico.

**Reabrir se:** o JSON do borderô revelar alocação por título.

---

## ADR-005 · Natureza no Plano de Contas, com quatro valores

**Contexto.** Transferências intragrupo eram 44% dos KPIs.

**Decisão.** Coluna `plano_contas.natureza`, resolvida em cadeia pelo De-Para. Quatro
valores: `operacional`, `transferencia_interna`, `aporte_socio`, `emprestimo`.

**Descartado.**
- *Tabela separada `categorias_natureza`* (PR #23) — duas fontes de verdade. Substituída
  no PR #24 por decisão do Controller
- *Booleano "ignorar"* — mistura três tratamentos contábeis distintos
- *Inferir da ausência de mapeamento* — testado contra os dados: excluiria R$ 2,2 mi de
  despesa real

**Custo.** Categoria sem conta entra como operacional até ser mapeada.

---

## ADR-006 · Saldo de caixa soma todas as naturezas

**Decisão.** A exclusão por natureza vale para indicadores de **desempenho**. O saldo
continua somando transferências, aportes e empréstimos.

**Motivo.** Transferência recebida está no banco. Excluí-la do saldo quebraria a
conciliação com o extrato.

---

## ADR-007 · Toda tela abre no mês vigente

**Decisão do Controller (15/09).** O login fica previsível; o recorte vira escolha
consciente do usuário.

**Contexto.** Seis períodos padrão distintos. O Fluxo de Caixa abria em 01/01/2024.

---

## ADR-008 · Bloquear, não filtrar em silêncio

**Contexto.** PR #18. Importação com categoria sem De-Para.

**Decisão.** A importação fica bloqueada até todas as categorias estarem configuradas.

**Descartado.** Filtrar as linhas sem mapeamento — o valor sairia do DRE sem ninguém
perceber, e a planilha seria dada como importada por inteiro.

**Princípio geral.** Falha visível é preferível a resultado errado em silêncio.

---

## ADR-009 · Variantes de nome do Bling não são consolidadas

**Decisão do Controller (24/09).** Cada variante de transferência tem conta própria —
têm origem em empresas diferentes.

**Custo.** 13 contas de transferência em vez de 7.

---

## ADR-010 · Orçamento de tempo com adiamento seguro

**Contexto.** PR #17. Sincronização estourando os 60 s da Vercel.

**Decisão.** Trabalho limitado por tempo, não por quantidade. Título sem detalhe não é
gravado — fica para a próxima varredura. Novos antes de revisões.

**Descartado.** Gravar com os dados da listagem — registro degradado sobrescreveria
dados bons.

---

## ADR-011 · Documentação no repositório

**Decisão (29/09).** A documentação vive em `docs/`, versionada com o código, atualizada
no mesmo PR da mudança.

**Descartado.** Documento externo — desatualiza sem que ninguém perceba. A documentação
anterior, de 02/07, afirmava timeout de 10 s quando as rotas já rodavam com 60 s.

---

## ADR-012 · Liquidação pelos borderôs: último pagamento e valor pago

**Contexto.** A ADR-004 previa reabrir "se o JSON do borderô revelar alocação por título".
O diagnóstico de 31/10–02/11 (9 títulos) mostrou: a lista `borderos` vem do mais recente
para o mais antigo e o sistema lia o mais antigo; pagamento estornado sai da lista; cada
borderô traz `pagamentos[]` com `valorPago`, `juros`, `acrescimo`, `desconto`,
`tarifa`, `numeroDocumento` e `contato` — o item do título se reconhece mesmo na baixa
agrupada. A conciliação das saídas da FACE mostrava datas no primeiro pagamento e
R$ 1.294,47 de juros fora.

**Decisão (03/11, Controller — opção A).** Data = pagamento mais recente; valor liquidado =
soma do pago pelo título, com juros. Só quando todos os borderôs foram lidos, o item do
título foi reconhecido em cada um e o principal bate com o esperado; senão, o valor
esperado e o motivo. A lista de pagamentos fica em `fluxo_caixa.liquidacoes`.

**Descartado.**
- *Opção B — um lançamento por pagamento* — caixa exato contra o extrato em títulos pagos
  em parcelas, mas não bate com o relatório do Bling e exige tabela nova e mudança em todas
  as telas de caixa. Reavaliar medindo `liquidacoes` depois do reprocessamento
- *Ratear a guia agrupada* — números que parecem exatos sem ser

**Custo.** Título pago em parcelas fica inteiro no mês do último pagamento (ALEXANDRE:
R$ 3 mil de março aparecem em abril). Mais chamadas ao Bling: um GET por borderô, com
cache do borderô agrupado por chamada.
