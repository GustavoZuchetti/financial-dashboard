# 11 — Pendências

> Estado em 29/09/2026. Ordenado por gravidade dentro de cada seção.
> Ao fechar um item, mova-o para [10 — Histórico](10-historico.md) com a data.

---

## 🔴 Estado incerto — verificar antes de qualquer coisa

### P0 — Grupo 9 do Plano de Contas: INSERT de resultado desconhecido

Em 24/09, o INSERT das 20 contas do grupo 9 foi disparado e **a página travou antes
de confirmar**. O Supabase estava com incidente de plataforma.

**Não se sabe se rodou, se rodou parcialmente, ou se não rodou.**

```sql
select count(*) contas, count(distinct codigo) codigos, count(distinct empresa_id) empresas
  from public.plano_contas where codigo like '9.%';
```

| Resultado | Significado | Ação |
|---|---|---|
| 0 | não rodou | executar o INSERT — é idempotente |
| **60** (20 × 3 entidades) | rodou por completo | falta o De-Para |
| outro | parcial | investigar antes de mexer |

**Depois, o De-Para** — com `tipo_destino = 'ignorar'`, **nunca** `'saida'`. Ver R8.4.

As 20 categorias, confirmadas contra o banco em 24/09:

| Grupo | Categorias |
|---|---|
| 9.1 Transferências (13) | Transferência entre contas Facesign · …JAM · …JB · Transferência FaceSign · JAM · JB · Transferência Realizada Facesign · Transferências · Transferências Facesign · Transferências JB · Transferências Realizada JB · Transferências Recebidas · Transferências recebidas JAM |
| 9.2 Empréstimos (3) | Empréstimo · Obtenção de Empréstimos · Pagamento de Empréstimos |
| 9.3 Sócios (4) | Aporte de Capital · Distribuição de Resultados AF · Distribuição de Resultados JB · Retirada de Capital |

Decisões do Controller: **não consolidar** variantes; **não unificar** Distribuição AF e JB;
Devoluções e Estornos permanecem **operacional**.

---

## 🔴 Funcional

### F1 — Onze telas não recarregam ao mudar entre seleções múltiplas

Passar de três para duas entidades no menu lateral **não recarrega** Visão Geral, DRE
(as quatro), Fluxo de Caixa, Análise, Atrasados, Comparativo, Projeção, Ciclo nem
Orçamento. Elas recalculam as entidades só quando `empresa_id` muda, e ele vale
`'todas'` para qualquer seleção múltipla. **Continuam exibindo as três.**

Anterior a 30/09. Corrigido **apenas na Gestão**, por meio de `versaoSel`.
Correção proposta: o mesmo contador nas onze telas, ou um hook compartilhado.
**Aguarda autorização** — são onze arquivos.

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
operacional; falta vincular a conta.

### D3 — "Categoria 0"

2 lançamentos, R$ 23. Nome de lixo — provável defeito de importação.

### D4 — 13 variantes de nome para transferência no Bling

Cadastro na origem. Não corrigível pelo sistema; cada variante tem conta própria.

---

## 🟡 Dívida técnica

### T1 — `calcDRE` duplicada

`app/dashboard/dre/page.jsx:52` tem função própria, hoje idêntica à de `lib/dre-calc.js`.
Qualquer ajuste na fonte única não alcança a tela principal do DRE.
**Correção:** remover a local, importar da lib. Risco muito baixo.

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

### T7 — PRs obsoletos abertos

**#1** e **#5** continuam abertos. O conteúdo do #5 entrou pelo #12; o do #1 foi coberto
pelos #8 e #9. Fechar.

### T8a — Emoji na tela de convite

`app/aceitar-convite/page.jsx` usa ⏳ no estado "validando" — viola o padrão de ícones
por `SvgIcon`. Encontrado em 30/09, fora do escopo daquele PR.

### T8b — Login sem marca por organização

Antes da autenticação não se sabe a organização do usuário; `/api/public/logo` devolve a
da primeira organização com logo, em ordem determinística. Com vários clientes, cada um
precisaria de uma URL de login própria.

### T8 — `components/UploadExcel.jsx` é código morto

Não é importado em lugar nenhum (verificado 29/09). Remover.

### T9 — Scripts legados em `scripts/`

`seed_*`, `setup_*`, `*_setup.js` — sem uso atual, quatro deles com credencial (S1).

---

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
