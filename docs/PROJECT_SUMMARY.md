# Facesign Financial Dashboard — Resumo Completo do Projeto

**Data:** Maio 2026 | **Usuário:** Gustavo Garcia, Controller | **Cidade:** Votuporanga-SP

---

## 1. O que é o sistema

SaaS financeiro multi-tenant construído para a Facesign (grupo FACE, JAM, JB).  
Exibe DRE, Fluxo de Caixa, Ciclo Financeiro e Orçamento em tempo real,  
com dados importados do ERP Bling via CSV.

---

## 2. Arquitetura

```
Next.js 14 (App Router)  →  Supabase (PostgreSQL + Auth + RLS)  →  Vercel
```

- **Client:** financial-dashboard-omega-six.vercel.app
- **Repo:** github.com/GustavoZuchetti/financial-dashboard (branch: main)
- **Supabase project:** wbrjdehmauaincgtcjrk
- **empresa_id ativo (FACE):** 2cb67427-fa9f-4f64-a77f-543dca1a1ab7

---

## 3. Estrutura de arquivos principais

```
app/dashboard/
  overview/OverviewContent.jsx       — KPIs gerais + gráfico evolução
  dre/
    page.jsx                         — DRE Visão Geral
    detalhado/page.jsx               — Drill-down: Linha→Categoria→[modal]Clientes→Lançamentos
    analise/page.jsx                 — Análise gráfica
    comparativo/page.jsx             — Comparativo de períodos
  fluxo-caixa/
    page.jsx                         — Visão Geral (KPIs, gráfico, vencidos)
    gestao/page.jsx                  — Extrato bancário + saldo corrente + novo/editar lançamento
    analise/page.jsx                 — Análise gráfica
    comparativo/page.jsx             — Comparativo P1 vs P2
    projecao/page.jsx                — Projeção baseada em histórico
  ciclo-financeiro/page.jsx          — PMR, PMP, PME + botão Recalcular
  importacao/
    page.jsx                         — Importação CSV (FC e DRE)
    layout/page.jsx                  — Configuração de layouts (ADM)
  configuracoes/page.jsx             — Perfil, Empresas, Usuários + roles
  orcamento/page.jsx                 — Orçamento vs Realizado

components/Sidebar.jsx               — Menu lateral com roles/ADM badges
lib/
  supabase.js                        — Client Supabase
  dre-calc.js                        — Cálculos DRE (calcDRE, calcDREMap, DRE_LINES)
  supabase-paginated.js              — fetchAllRows() utilitário
app/api/recalcular-ciclo/route.js    — API para popular ciclo_financeiro retroativamente
```

---

## 4. Módulos e status

### DRE
- Visão Geral com KPIs (RB, RL, LB, EBITDA, Resultado)
- Detalhado com drill: Linha → Categoria → [modal] Lista de Clientes → Lançamentos por mês
- Análise gráfica (barras por conta, pizza por grupo)
- Comparativo de períodos com variação %

### Fluxo de Caixa
- **Visão Geral:** KPIs paginados (>1000 registros), cards de vencidos (A Pagar/Receber vencido e próx. 30 dias)
- **Gestão (ADM):** Extrato bancário agrupado por dia com saldo acumulado. Saldo Inicial editável. Saldo Corrente = Saldo Inicial + Entradas - Saídas (sem filtro de data). Botão "+ Novo Lançamento" e botão ✏️ Editar por linha
- **Análise:** Composição entradas/saídas, evolução mensal, saúde financeira
- **Comparativo:** P1 vs P2 com gráfico e tabela delta
- **Projeção:** Média histórica + tendência, N meses à frente

### Ciclo Financeiro
- PMR = dias_no_mês / count_entradas (proxy para empresa de serviços)
- PMP = dias_no_mês / count_saídas
- Tabela: id, empresa_id, ano, mes, pmr, pmp, pme (sem ciclo_operacional/ciclo_financeiro_valor)
- Botão "🔄 Recalcular" processa todos os lançamentos do FC e faz upsert em lote

### Importação
- CSV do Bling (separador `;`, encoding UTF-8 BOM)
- parseCSV robusto: trata quebras de linha dentro de campos com aspas
- FC: valor = valor_pago > 0 ? valor_pago : valor_previsto
- Tipo: "Conta a receber" → entrada | "Conta a pagar" → saída
- Data: Liquidação → Vencimento → Data
- Modal de reimportação: 2 opções: "Atualizar previsões" (parcial) ou "Substituir tudo" (replace total)

### Configurações
- 3 abas: Perfil, Empresas, Usuários
- Roles: super_admin, org_admin, user
- Select editável de role na lista de usuários
- Convite com opção Super Admin
- Sidebar: item único (sem cascata)

---

## 5. Regras críticas do código

| Regra | Detalhe |
|---|---|
| Paginação Supabase | Sempre `.range(pg*1000, (pg+1)*1000-1)` ou loop while |
| cursor Recharts | `cursor={false}` em TODOS os `<Tooltip>` — sem exceção |
| fluxo_caixa | Não tem coluna `conta_id` |
| ciclo_financeiro | Não tem `ciclo_operacional` nem `ciclo_financeiro_valor` |
| Vercel Hobby | Timeout 10s em serverless — usar upsert em lote, não loop sequencial |
| empresa_config | tabela para saldo_inicial: `{empresa_id, chave, valor}` |

---

## 6. Últimos commits relevantes (mai/2026)

| Hash | O que fez |
|---|---|
| 79703b1 | DRE Detalhado: hierarquia Categoria→Clientes→Lançamentos no modal |
| 6271660 | DRE Detalhado: primeiro modal com backdrop blur |
| b24fc2f | Sidebar: Configurações sem cascata |
| f562bae | cursor={false} em TODOS os Tooltips (varredura completa) |
| 58bb219 | Config: useSearchParams, super_admin, roles editáveis |
| f32d27d | Remover colunas inexistentes ciclo_operacional/ciclo_financeiro_valor |
| dfe8c0e | Ciclo Financeiro: recálculo client-side sem API route |
| f681acd | Paginação em todas as queries (fix limite 1000 Supabase) |
| 8590b22 | Importação: botão "Substituir Tudo" no modal de reimportação |
| db00239 | FC Gestão: saldo inicial, saldo corrente, cards vencidos, novo lançamento |
| 83a9f3e | FC Gestão: extrato bancário com saldo acumulado dia a dia |
| 20b0d4a | Ciclo Financeiro: reformulação com dados reais e seletor de período |

---

## 7. Pendências / próximos passos sugeridos

- [ ] Exportar para Excel (DRE Detalhado e FC Gestão)
- [ ] Notificações de vencimentos no badge do sidebar
- [ ] Skeleton loading nas páginas (em vez de "Carregando...")
- [ ] Drill-down nos gráficos (clicar numa barra = ver lançamentos daquele mês)
- [ ] DRE multi-entidade: comparativo FACE vs JAM vs JB
- [ ] Ciclo Financeiro: o usuário deve clicar em "Recalcular" ao acessar pela primeira vez (tabela vazia até então)
- [ ] PME real: atualmente fixo em 0 pois o estoque não é capturado no CSV do Bling

---

## 8. Como retomar em nova conversa

Cole este prompt para o Claude:

> "Estou trabalhando no projeto Facesign Financial Dashboard.
> Stack: Next.js 14 + Supabase + Vercel.
> Repo: github.com/GustavoZuchetti/financial-dashboard
> Referência completa em: docs/PROJECT_REFERENCE.md e docs/PROJECT_SUMMARY.md
> empresa_id: 2cb67427-fa9f-4f64-a77f-543dca1a1ab7
> Supabase: wbrjdehmauaincgtcjrk.supabase.co
> Client: financial-dashboard-omega-six.vercel.app
> Continue de onde paramos."
