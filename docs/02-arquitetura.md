# 02 — Arquitetura

## Fluxo de dados

```
                    ┌──────────────────────┐
  Bling API v3 ────▶│ /api/integracoes/    │──┐
  (OAuth + JWT)     │   bling/sync  (manual)│  │
                    │ /api/cron/bling (09h) │  │   upsert por doc_ref
                    └──────────────────────┘  ├──────────────────────▶  Supabase
  Planilha Bling ──▶ /dashboard/importacao ───┘                         (Postgres + RLS)
  (CSV / XLSX)                                                               │
                                                                             │ leitura
                                                                             ▼
                              lib/ (fontes únicas de cálculo)  ◀──── telas do dashboard
```

Duas tabelas de fato, com regimes diferentes:

| Tabela | Regime | Alimentada por | Usada em |
|---|---|---|---|
| `fluxo_caixa` | **Caixa** | Sincronização Bling | Fluxo de Caixa, Visão Geral, Ciclo, Orçamento |
| `lancamentos` | **Competência** | Importação de planilha | DRE |

DRE e caixa **divergem por construção** — competência reconhece quando ocorre,
caixa quando o dinheiro move. Divergência entre eles não é defeito.
Divergência entre **duas telas que exibem a mesma grandeza** é.

## Fontes únicas

O princípio mais importante do código: **nenhuma regra de negócio existe em dois
lugares.** Quase todos os defeitos desta base vieram de uma tela que reimplementou
uma regra que já existia numa lib.

| Arquivo | É a fonte única de… |
|---|---|
| `lib/dre-calc.js` | Cálculo do DRE — `calcDRE`, `calcDREMap`, `DRE_LINES` |
| `lib/fluxo-status.js` | Efeito de caixa de um título, tipos, sinal — `efeitosCaixa`, `sinalDe`, `ENTRADA_TIPOS` |
| `lib/fluxo-agregados.js` | Totais de período, realizado × projetado — `agregarPeriodo` |
| `lib/saldo-abertura.js` | Saldo de partida e série diária — `saldoEm`, `saldoDePartidaConsolidado` |
| `lib/natureza-categoria.js` | O que entra nos KPIs operacionais — `separarPorNatureza` |
| `lib/periodo-padrao.js` | Janela inicial das telas — `mesVigente` |
| `lib/selecao-entidade.js` | **Gravação** da seleção de entidades — `definirSelecaoEntidades`. A leitura validada segue em `getSelectedEntidadeIds` |
| `lib/usar-versao-selecao.js` | Recarga a cada troca de entidade — `useVersaoSelecao`. **Usado pelas treze telas** que resolvem entidades |
| `lib/selecao-lancamentos.js` | Seleção em lote para exclusão — `podarSelecao`, `alternarPagina`, `resumirSelecao` |
| `lib/bling-cursor.js` | Posição de varredura da sincronização |
| `lib/bling-server.js` | Todo acesso à API do Bling |
| `lib/supabase.js` | Resolução de entidades selecionadas — `getSelectedEntidadeIds` |
| `lib/export-excel.js` | Toda exportação Excel |

⚠️ **Violação conhecida:** `app/dashboard/dre/page.jsx` define sua própria `calcDRE`,
hoje byte a byte idêntica à de `lib/dre-calc.js`. Ver [11 — Pendências](11-pendencias.md).

⚠️ **Adoção incompleta:** `agregarPeriodo` é usada apenas na Gestão. As demais telas de
fluxo calculam totais por conta própria. Ver [11 — Pendências](11-pendencias.md).

## Estrutura de diretórios

```
app/
  api/
    admin/                        rotas de administração (super_admin)
      fix-deducoes · list-all-users · reset-user-password
      seed-logo · update-role · upload-logo
    auth/forgot-password          recuperação de senha via admin SDK
    cron/bling                    sincronização agendada (maxDuration 60s)
    integracoes/                  CRUD das integrações
      bling/callback              retorno do OAuth
      bling/enrich                enriquecimento por detalhe (maxDuration 60s)
      bling/sync                  sincronização manual   (maxDuration 60s)
    invite                        convites de usuário
    my-empresas                   empresas da organização — service role
    public/logo                   logo pública da organização
    recalcular-ciclo              recálculo do ciclo financeiro
    saldos-abertura               âncoras de saldo por entidade
  aceitar-convite/                onboarding
  auth/reset-password/
  dashboard/
    overview/                     Visão Geral (page.jsx wrapper + OverviewContent.jsx)
    dre/                          Visão Geral · detalhado · analise · comparativo
    fluxo-caixa/                  Visão Geral · gestao · analise · atrasados
                                  · comparativo · projecao
    ciclo-financeiro/
    orcamento/
    plano-contas/                 plano + auditoria
    importacao/                   importação de planilha + layouts
    configuracoes/                perfil · empresas · usuários · integrações · saldo de abertura
components/                       Sidebar, SvgIcon, IntegracoesTab, SaldoAberturaTab, ...
lib/                              fontes únicas — ver tabela acima
scripts/
  test-*.mjs                      15 suítes de teste — ver 09
  seed_* / setup_* / *_setup.js   ⚠️ legado, com credencial exposta — ver 07
supabase/migrations/              migrações versionadas — aplicar no SQL Editor
docs/                             esta documentação
```

## Bibliotecas auxiliares

| Arquivo | Papel |
|---|---|
| `lib/org-context.js` | `OrgProvider`, `useOrg` — organização corrente, papel e **"ver como"**. Cache em memória que sobrevive à navegação SPA e é limpo no logout |
| `lib/usar-ancoras.js` | `useAncoras(empIds)` — ponto único de acesso às âncoras pelo cliente, usado pelas três telas de caixa · `motivoIndisponivel()` explica por que o saldo é nulo |
| `lib/supabase-paginated.js` | `fetchAllRows` — paginação de 1.000 em 1.000 |
| `lib/design-tokens.js` | Design System v2.1 — cores, paletas, temas. Tokens de texto auditados WCAG 2.1 AA (≥ 4,5:1) |
| `lib/excel.js` | importação de planilhas e geração de templates |

## Componentes

| Componente | Papel |
|---|---|
| `Sidebar` | menu, **seletor multi-entidade** · emite o evento `storage` na troca |
| `IntegracoesTab` | Configurações › Integrações — conexão e sincronização por entidade |
| `SaldoAberturaTab` | Configurações › Saldo de Abertura — âncoras por entidade |
| `SvgIcon` | biblioteca de ícones — **única fonte de ícones do sistema** |
| `LogoAcesso` | logo nas telas anteriores ao login — convite, redefinir senha |
| `IdleTimeout` | logout após 45 min de inatividade |
| `ViewAsBanner` | aviso fixo quando o `super_admin` navega **como outra organização** |
| `OrgLogo` | logo da organização, reage à troca de tema |
| `ThemeProvider`, `ThemeToggle` | tema claro e escuro |
| `TypeBadge` | selo semântico por tipo de lançamento |
| `EmptyState`, `Skeleton`, `Toast` | estado vazio, carregamento, notificações |
| `UploadExcel` | ⚠️ **código morto** — não é importado em lugar nenhum |

### "Ver como" — acesso do super_admin a outra organização

O `super_admin` pode navegar o sistema **como se fosse outra organização**, para suporte.
O `ViewAsBanner` fica visível durante todo o período e oferece a saída.

⚠️ É uma funcionalidade com impacto de segurança: todas as consultas passam a usar o
escopo da organização visualizada. Ver [07](07-seguranca.md).

## Rotas de API

| Rota | Métodos | Papel exigido | Função |
|---|---|---|---|
| `/api/admin/fix-deducoes` | POST | super_admin | reclassifica contas de impostos como `deducao` |
| `/api/admin/list-all-users` | GET | super_admin | lista todos os usuários do Auth |
| `/api/admin/reset-user-password` | POST | super_admin | redefine senha via admin SDK |
| `/api/admin/seed-logo` | POST | — | grava `logo_url` da organização |
| `/api/admin/update-role` | POST | super_admin | altera papel · bloqueia auto-rebaixamento |
| `/api/admin/upload-logo` | POST, DELETE | super_admin, org_admin | logo no Storage (bucket público, 2 MB) |
| `/api/auth/forgot-password` | POST | — | recuperação de senha |
| `/api/cron/bling` | GET | `x-vercel-cron` ou `CRON_SECRET` | sincronização agendada · 60 s |
| `/api/integracoes` | GET, POST | org_admin | lista e cria integrações · monta URL OAuth |
| `/api/integracoes/bling/callback` | GET | `state` assinado | retorno do OAuth |
| `/api/integracoes/bling/enrich` | POST | org_admin | enriquecimento por detalhe · 60 s |
| `/api/integracoes/bling/sync` | POST | org_admin | sincronização manual · 60 s |
| `/api/invite` | GET, POST | org_admin | convites |
| `/api/my-empresas` | GET | autenticado | empresas da organização — service role |
| `/api/public/logo` | GET | público | logo da organização |
| `/api/recalcular-ciclo` | POST | autenticado | recalcula `ciclo_financeiro` |
| `/api/saldos-abertura` | GET, POST, DELETE | org_admin | âncoras de saldo |

## Padrões obrigatórios

| Padrão | Motivo |
|---|---|
| Resolver entidades por `getSelectedEntidadeIds()` | Valida a seleção do `localStorage` contra a organização — defesa em profundidade contra acesso cruzado |
| Listar empresas por `/api/my-empresas` | Nunca consultar `empresas` pelo client sem filtro de organização |
| Alterar a seleção de entidade **só** por `definirSelecaoEntidades()` | Duas telas a alteram — Sidebar e Gestão. Gravar `empresa_ids` direto recria a divergência |
| Toda tela que resolve entidades usa `useVersaoSelecao()` e o põe nas dependências da recarga | `empresa_id` vale `'todas'` para qualquer seleção múltipla — sem o hook, passar de três para duas entidades não recarrega |
| Toda tela que lê a entidade escuta o evento `storage` | O Sidebar emite `window.dispatchEvent(new Event('storage'))` na troca. Sem o listener, a tela mostra a entidade errada — ver PR #19 |
| Paginar leituras do Supabase | O REST devolve no máximo 1.000 linhas por requisição |
| `cursor={false}` em todo `<Tooltip>` do Recharts | Evita artefato visual |
| Ícones por `components/SvgIcon.jsx` | Proibido emoji e caracteres unicode de seta (▶ ▼ → ← ×) |
| `createClient` com URL placeholder | Variáveis de ambiente não existem no build |
| Sem `next/font/google` | Quebra o build |
| Rotas de diagnóstico: `export const dynamic = 'force-dynamic'` | Evita cache do Next |
| Client admin com `cache: 'no-store'` | O Data Cache do Next congelava os SELECTs server-side |

## Multi-tenant

Três camadas de isolamento:

1. **RLS no banco** — políticas `access_*` em todas as tabelas, via funções
   `SECURITY DEFINER` `get_my_role()` e `get_my_org_id()`
2. **Rotas server-side** — escopo por organização resolvido em JavaScript
3. **Validação no client** — `getSelectedEntidadeIds()` rejeita entidade de outra organização

Detalhes em [07 — Segurança](07-seguranca.md).
