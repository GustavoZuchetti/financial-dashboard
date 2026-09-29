# 03 — Banco de dados

**Supabase** projeto `wbrjdehmauaincgtcjrk` · PostgreSQL · RLS ativo em todas as tabelas.

> **Sobre a fonte destas informações.** As tabelas base foram criadas antes de o projeto
> versionar migrações, então `supabase/migrations/` não descreve o schema completo.
> O que está abaixo combina migrações, uso no código e consultas diretas ao catálogo.
> Colunas marcadas **(verificado DD/MM)** foram confirmadas por consulta ao
> `information_schema`; as demais são inferidas do código.

## Tabelas

### `fluxo_caixa` — regime de caixa

Um registro por título do Bling. Alimentada pela sincronização.

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid | |
| `empresa_id` | uuid | |
| `organization_id` | uuid | |
| `tipo` | text | **Somente `entrada` e `saida`** (verificado 11/09) |
| `valor` | numeric | valor do título |
| `valor_liquidado` | numeric | valor efetivamente movimentado — ver § regra do liquidado |
| `status` | text | `aberto` · `pago` · `parcial` · `cancelado` |
| `data` | date | **vencimento** |
| `data_liquidacao` | date | quando o dinheiro moveu — do borderô |
| `data_emissao` | date | |
| `competencia` | date | |
| `categoria` | text | nome da categoria no Bling — chave do De-Para |
| `descricao` | text | |
| `doc_ref` | text | **único.** `bling:<tipo>:<id>` para registros da API |
| `origem_ausente` | boolean | título excluído na origem |
| `created_at` | timestamptz | |

**Não tem** `conta_id` nem `updated_at`.

Volume (verificado 11/09): 17.243 saídas · 1.541 entradas · 130 categorias distintas.

### `lancamentos` — regime de competência

Alimentada pela importação de planilha. Consumida pelo DRE.

| Coluna | Observação |
|---|---|
| `id`, `empresa_id`, `organization_id` | |
| `tipo` | um dos oito tipos contábeis — ver `plano_contas.tipo` |
| `valor`, `data`, `competencia`, `categoria`, `descricao`, `conta_id` | |
| `doc_ref` | único |

Tipos presentes (verificado 11/09): `despesa` 5.886 · `despesa_financeira` 595 ·
`investimento` 538 · e demais.

### `plano_contas`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid | |
| `empresa_id` | uuid | |
| `organization_id` | uuid | |
| `codigo` | text | `1.1`, `2.1`… O grupo **9** é reservado a não operacionais |
| `nome` | text | |
| `descricao` | text | |
| `tipo` | text | **define a posição no DRE** — ver abaixo |
| `natureza` | text | **define a entrada nos KPIs** — `not null default 'operacional'` (verificado 23/09) |
| `pai_id` | uuid | hierarquia |
| `created_at` | timestamptz | |

**Constraint de `tipo`** (verificado 24/09) aceita dez valores:

| Valor | No DRE? |
|---|---|
| `receita` `deducao` `custo` `despesa` `imposto_lucro` `investimento` `receita_financeira` `despesa_financeira` | **Sim** — são os oito que `calcDRE` soma |
| `entrada` `saida` | **Não** — usados pelas contas do grupo 9 |

**Constraint `plano_contas_natureza_check`** (verificado 23/09):
`operacional` · `transferencia_interna` · `aporte_socio` · `emprestimo`

⚠️ **`tipo` e `natureza` são ortogonais.** `tipo` decide onde a conta aparece no DRE;
`natureza` decide se entra nos indicadores operacionais. Alterar um não afeta o outro.

Contas: 42, códigos de `1.1` a `6.1`, todas `operacional` (verificado 23/09, antes do
grupo 9).

### `categoria_mappings` — De-Para

Liga o nome de uma categoria do Bling a uma conta do plano.

| Coluna | Observação |
|---|---|
| `id`, `empresa_id`, `organization_id` | |
| `categoria_origem` | nome exato como vem do Bling — comparado em **minúsculas** |
| `conta_id` | conta do plano |
| `tipo_destino` | tipo contábil, ou **`ignorar`** |

⚠️ **Contas não operacionais precisam de `tipo_destino = 'ignorar'`.** Se receberem
`'saida'`, a linha passa no filtro da importação (`'saida' !== 'ignorar'`) e depois
`classificar()` lança erro — **a importação de DRE inteira quebra**, inclusive para
categorias sem relação com a conta. Ver [04](04-regras-de-negocio.md#8-de-para).

Cobertura (verificado 16/09): 91 das 130 categorias de `fluxo_caixa` têm conta.

### `saldos_abertura`

Âncora certificada de saldo bancário, **por entidade**. Criada em `20260812`.

| Coluna | Observação |
|---|---|
| `empresa_id` | uma âncora vigente por entidade |
| `data_corte` | saldo **na abertura** deste dia — movimentos do próprio dia contam |
| `valor` | saldo certificado contra extrato |

Regra: consolidado é a **soma** das âncoras, nunca uma âncora única. Uma entidade sem
âncora **anula o consolidado inteiro** — saldo nulo, nunca zero.

### `integracoes`

Uma por entidade. RLS **deny-all**: acesso apenas por service role.

| Coluna | Tipo | Observação |
|---|---|---|
| `access_token` | text | **sem limite** — JWT cabe (verificado 23/09) |
| `refresh_token` | text | sem limite |
| `client_id`, `client_secret` | text | sem limite |
| `token_expira_em` | timestamptz | |
| `sync_cursor` | jsonb | posição da varredura manual — `null` = completa |
| `ultima_varredura_completa` | timestamptz | |
| `cron_cursor`, `cron_resultado`, `ultima_sync_cron` | | estado do cron |
| `ultima_sync`, `ultimo_resultado` | | última execução manual |
| `contatos_cache` | jsonb | cache de nomes de contato |

Tokens (verificado 24/09): formato **JWT**, 959 caracteres, nas três entidades.

### Demais tabelas

| Tabela | Papel |
|---|---|
| `organizations` | tenants · `api_dre_liberado`, `api_fluxo_liberado` liberam a API por módulo |
| `profiles` | `organization_id`, `role` |
| `empresas` | entidades · `organization_id` obrigatório |
| `invites` | convites pendentes |
| `ciclo_financeiro` | `ano`, `mes`, `pmr`, `pmp`, `pme` — **não** tem `ciclo_operacional` |
| `orcamentos` | `modulo`, `escopo` |
| `import_layouts` | layouts de importação por empresa |
| `empresa_config` | configuração por entidade |
| `org_settings` | configuração por organização |
| `audit_logs` | trilha de auditoria — exclusões na origem, entre outras |

### Tabela removida

`categorias_natureza` — criada em `20260915`, substituída antes de entrar em uso pela
coluna `plano_contas.natureza`. **Removida em 24/09** após verificação de que estava
vazia (0 linhas).

## Segurança no banco

Funções `SECURITY DEFINER`, usadas pelas políticas para evitar recursão:

```sql
get_my_role()     -- papel do usuário corrente
get_my_org_id()   -- organização do usuário corrente
```

Padrão das políticas: `access_<tabela>_<operação>`, filtrando por
`organization_id = get_my_org_id()`. Escrita restrita a `org_admin` e `super_admin`
onde aplicável.

⚠️ **Ao recriar políticas, apague por varredura, não por nome.** `DROP POLICY IF EXISTS`
com nome explícito deixa para trás políticas legadas com outro nome, que combinam
permissivamente por OR. Foi o vetor da falha cross-tenant de 30/06. Use:

```sql
do $$ declare pol record; begin
  for pol in select policyname from pg_policies
             where schemaname='public' and tablename='<tabela>'
  loop execute format('drop policy if exists %I on public.<tabela>', pol.policyname);
  end loop;
end $$;
```

## Migrações

Aplicadas manualmente no SQL Editor. **Não há runner automático** — o arquivo existir
no repositório não significa que rodou.

| Arquivo | Conteúdo | Aplicada? |
|---|---|---|
| `20260515_import_layouts.sql` | tabela `import_layouts` | sim |
| `20260601_diagnostico_demo_user.sql` | diagnóstico | — |
| `20260601_fix_ciclo_rls.sql` | RLS do ciclo | sim |
| `20260601_org_settings.sql` | tabela `org_settings` | sim |
| `20260601_protect_role_escalation.sql` | bloqueio de escalada de papel | sim |
| `20260601_uppercase_plano_contas.sql` | normalização | sim |
| `20260630_fix_rls_cross_org.sql` | **isolamento cross-tenant** | sim · validada 02/07 |
| `20260703_fc_status_liquidacao.sql` | `status`, `data_liquidacao`, `valor_liquidado`, `doc_ref` | sim |
| `20260703_integracoes_api.sql` | tabela `integracoes` · liberação por módulo | sim |
| `20260706_fc_competencia.sql` | `competencia` | sim |
| `20260710_cron_cursor.sql` | estado do cron | sim · validada 14/07 |
| `20260715_orcamento_modulo.sql` | `modulo` | sim |
| `20260723_orcamento_escopo.sql` | `escopo` | sim |
| `20260726_origem_ausente.sql` | `origem_ausente` | sim |
| `20260812_saldos_abertura.sql` | tabela `saldos_abertura` | sim |
| `20260825_sync_cursor.sql` | `sync_cursor`, `ultima_varredura_completa` | sim · verificada 28/08 |
| `20260916_natureza_plano_contas.sql` | `plano_contas.natureza` · remove `categorias_natureza` | sim · verificada 23/09 |

**Script de validação** — `validate_rls_cross_org.sql` não é migração: verifica a
aplicação da `20260630`. Espera 7 políticas `*_org_isolation` e zero políticas legadas
por `user_id`. Rodar após qualquer mudança em RLS.

**Para confirmar se uma migração rodou**, consulte o catálogo em vez de confiar na
tabela acima:

```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='<tabela>' and column_name='<coluna>';
```
