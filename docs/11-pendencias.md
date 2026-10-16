# 11 — Pendências

> Estado em 16/10/2026 (P0, T1, T7 e T8 fechados). Ordenado por gravidade dentro de cada seção.
> Ao fechar um item, mova-o para [10 — Histórico](10-historico.md) com a data.

---

## 🔴 Estado incerto — verificar antes de qualquer coisa

Nenhum item aberto. O P0 do grupo 9 do Plano de Contas foi fechado em 16/10/2026 — ver [10 — Histórico](10-historico.md).

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

### T10 — Suítes sem execução desde 30/09

As 15 suítes anteriores e a `test-fonte-unica-dre` (2 testes, validada só por emulação em
PowerShell) **não foram executadas com `node` desde o PR #28**. O PR #29 passou
pelo build da Vercel, que não roda testes. Rodar `for t in scripts/test-*.mjs; do node "$t"; done`
numa máquina com Node 24 e atualizar [09](09-testes.md) com o resultado. Aproveitar para
confirmar que as suítes passam em 24 — foram escritas sob Node 20.

### T11 — Plano de Contas: três armadilhas da tela com o grupo 9

Descobertas em 16/10 lendo `app/dashboard/plano-contas/page.jsx`:

1. **Master por contagem.** A tela elege como master a entidade com **mais contas** e replica o plano
   dela para as outras por `codigo`, **apagando** o que o master não tem (`syncEntidades`). Hoje as três
   têm 34 contas, então é seguro; criar conta só numa entidade a tornaria master.
2. **A replicação não leva `natureza`.** Copia `codigo, nome, tipo, descricao`; a conta criada por essa
   via nasce `operacional`. `alterarNatureza` propaga por código, mas a criação não.
3. **`remapearCategoria` grava `tipo_destino` igual ao `tipo` da conta.** No grupo 9 isso é
   `entrada`/`saida` e quebra a importação de DRE (R8.4).

Até corrigir, tratar o grupo 9 **só por SQL**, com `tipo_destino = 'ignorar'`.

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
