# Documentação — Facesign Financial Dashboard

> **Fonte da verdade** do sistema. Mantida junto ao código, versionada no mesmo
> repositório, atualizada a cada mudança relevante.
>
> **Última revisão completa:** 29/09/2026 · **Última atualização:** 30/09/2026 · 223 testes · build ✓

---

## Como usar esta documentação

| Se você precisa… | Leia |
|---|---|
| Entender o que o sistema é e para quem | [01 — Visão geral](01-visao-geral.md) |
| Saber onde está cada coisa no código | [02 — Arquitetura](02-arquitetura.md) |
| Consultar uma tabela, coluna ou política RLS | [03 — Banco de dados](03-banco-de-dados.md) |
| **Entender por que um número é calculado de certo jeito** | [04 — Regras de negócio](04-regras-de-negocio.md) |
| Mexer na integração com o Bling | [05 — Integração Bling](05-integracao-bling.md) |
| Saber de onde vem cada KPI de cada tela | [06 — Telas e KPIs](06-telas-e-kpis.md) |
| Avaliar risco de segurança | [07 — Segurança](07-seguranca.md) |
| Fazer deploy, aplicar migração, resolver incidente | [08 — Operação](08-operacao.md) |
| Saber o que cada teste protege | [09 — Testes](09-testes.md) |
| Entender o que aconteceu e quando | [10 — Histórico](10-historico.md) |
| **Ver o que está pendente, e em que ordem** | [11 — Pendências](11-pendencias.md) |
| Entender uma decisão de arquitetura | [12 — Decisões](12-decisoes.md) |

## Leitura obrigatória antes de qualquer mudança

1. **[04 — Regras de negócio](04-regras-de-negocio.md)** — as regras canônicas.
   Quase todo defeito deste projeto foi a violação de uma delas.
2. **[11 — Pendências](11-pendencias.md)** — o que está aberto, incluindo riscos
   de segurança não resolvidos.
3. **[09 — Testes](09-testes.md)** — rode todas as suítes antes e depois.

---

## Convenções deste repositório de documentação

**Verificado × inferido.** Toda afirmação sobre o estado do banco ou da produção
indica se foi **verificada** (consulta executada, com data) ou **inferida**
(derivada do código). A distinção importa: nesta base, afirmações não
verificadas já causaram retrabalho.

**Nenhum segredo.** O repositório é público. Nenhuma chave, token ou fragmento
de token aparece aqui — nem truncado. Credenciais vivem nas variáveis de
ambiente da Vercel e no gerenciador de senhas.

**Datas absolutas.** "Ontem" e "semana passada" perdem o sentido em um mês.
Sempre DD/MM/AAAA.

**Números com fonte.** Todo valor em reais citado aqui indica o período e a
consulta de onde veio.

## Protocolo de atualização

Toda mudança relevante atualiza a documentação **no mesmo PR**:

| Mudou… | Atualize |
|---|---|
| Uma regra de cálculo | 04, 06, 09 |
| Uma tabela ou coluna | 03, e a migração em `supabase/migrations/` |
| A integração Bling | 05, 08 |
| Uma tela ou KPI | 06 |
| Qualquer coisa | 10 (histórico) e 11 (pendências, se fechou ou abriu algo) |

PR que muda comportamento sem atualizar a documentação está incompleto.
