# 07 — Segurança

## ⚠️ Riscos abertos

Em ordem de gravidade. **Nenhum destes está resolvido.**

### S1 — Chave `service_role` versionada em repositório público · CRÍTICO

**Onde:** quatro scripts legados em `scripts/`:
`deep_clean_and_setup.js`, `force_setup_totalizadores.js`, `full_setup.js`,
`setup_totalizadores.js`.

**Desde:** 08/05/2026. **Validade da chave:** até 2036.

**Impacto:** a `service_role` **ignora toda política RLS**. Quem a tiver lê, altera e
apaga dados de **qualquer organização**, sem autenticação. O isolamento multi-tenant
inteiro depende de ela não vazar — e ela está pública.

**Por que tornar o repositório privado não resolve:** a chave permanece no histórico do
Git e em qualquer clone já feito.

**Correção:**
1. Supabase → Project Settings → API → **regenerar** a chave `service_role`
2. Atualizar `SUPABASE_SERVICE_ROLE_KEY` na Vercel e fazer redeploy
3. Remover a chave dos quatro scripts — ler de variável de ambiente
4. Tornar os dois repositórios privados
5. Revisar logs do Supabase por acessos anômalos desde 08/05
6. Avaliar obrigação de comunicação — LGPD, art. 46 e 48 — conforme o resultado de (5)

**Decisão do Controller (24/09):** manter como está durante a fase de desenvolvimento.

### S2 — Token pessoal do GitHub em uso na sessão de desenvolvimento · ALTO

Um token *fine-grained* com escopo de escrita no repositório foi usado em texto claro na
sessão de desenvolvimento assistido, para publicar PRs.

**Correção:** revogar ao encerrar a fase de desenvolvimento, em
https://github.com/settings/personal-access-tokens.

**Decisão do Controller (24/09):** manter ativo durante o desenvolvimento.

### S3 — Branch `main` sem proteção · MÉDIO

Qualquer push vai direto a produção. Não há revisão obrigatória.

**Correção:** GitHub → Settings → Branches → proteger `main`, exigindo PR.

### S4 — Repositórios públicos · MÉDIO

Independente de S1, expõe a arquitetura, as regras de negócio e os IDs de entidade.

---

## Modelo de segurança

### Isolamento multi-tenant — três camadas

| Camada | Mecanismo |
|---|---|
| **Banco** | RLS em todas as tabelas · `get_my_org_id()`, `get_my_role()` `SECURITY DEFINER` |
| **Servidor** | rotas resolvem a organização pelo token e filtram em JavaScript |
| **Cliente** | `getSelectedEntidadeIds()` valida a seleção contra a organização |

### Incidente cross-tenant — 30/06

Telas expunham empresas de outras organizações. Duas causas: consulta a `empresas` pelo
client sem filtro, e políticas RLS legadas com nomes distintos combinando por OR.

Correção em `38f616e` e `20260630_fix_rls_cross_org.sql`. **Validada em 02/07** por
testes de impersonação: SELECT restrito à própria organização, INSERT cruzado bloqueado
com `ERROR 42501`.

### Controles em vigor

| Controle | Onde |
|---|---|
| Anti-escalada de papel | `20260601_protect_role_escalation.sql` |
| Logout por inatividade — 45 min | `components/IdleTimeout.jsx` |
| Recuperação de senha via admin SDK | `/api/auth/forgot-password` |
| `state` assinado no OAuth | `signState` / `verifyState` |
| `integracoes` com RLS deny-all | apenas service role acessa tokens |
| Escrita em classificação só por admin | políticas e rotas verificam `org_admin`/`super_admin` |
| Exclusão confere posse antes de apagar | rotas nunca apagam por chave sem escopo |

### "Ver como" outra organização

O `super_admin` pode navegar como outra organização — `lib/org-context.js`, sinalizado
pelo `ViewAsBanner`. Todas as consultas passam a usar o escopo da organização visualizada.
É a única via legítima de acesso cruzado entre tenants.

⚠️ Não há registro em `audit_logs` do uso do "ver como" (verificado no código, 29/09).
Para um sistema com dados de investidores, o acesso de suporte deveria ser auditado.

### Regras para código novo

- Nunca consultar `empresas` pelo client — usar `/api/my-empresas`
- Toda rota que usa service role resolve a organização pelo token do usuário
- Ao recriar políticas RLS, apagar por **varredura**, nunca por nome — ver [03](03-banco-de-dados.md)
- Nenhum segredo em código, documentação, mensagem de commit ou log
