-- ═══════════════════════════════════════════════════════════════════════════
-- validate_rls_cross_org.sql — Validação pós-aplicação da migração
-- 20260630_fix_rls_cross_org.sql. Executar no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

-- PASSO 1 — Conferir que as políticas de isolamento existem (esperado: 7 linhas)
select tablename, policyname
from pg_policies
where schemaname = 'public' and policyname like '%org_isolation%'
order by tablename;

-- PASSO 2 — Conferir que NÃO restaram políticas legadas permissivas por user_id
-- (esperado: 0 linhas nas tabelas de dados)
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and policyname ilike '%own empresas%'
order by tablename;

-- PASSO 3 — Teste funcional de isolamento (impersonação)
-- 3a. Descobrir os UUIDs dos usuários de teste:
select u.id, u.email, p.organization_id
from auth.users u
left join public.profiles p on p.id = u.id
order by u.email;

-- 3b. Substituir <UUID_USUARIO_ORG_A> abaixo pelo id de um usuário da
--     Facesign Group e executar o bloco. O resultado deve listar SOMENTE
--     empresas da organização dele (a Demo Corp NÃO pode aparecer):
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', '<UUID_USUARIO_ORG_A>', 'role', 'authenticated')::text, true);
  select id, nome, organization_id from public.empresas;
rollback;

-- 3c. Teste de escrita cruzada — com o MESMO usuário da org A, tentar
--     inserir um lançamento numa empresa da org B (Demo:
--     empresa cccccccc-...). Esperado: ERRO de violação de RLS:
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', '<UUID_USUARIO_ORG_A>', 'role', 'authenticated')::text, true);
  insert into public.lancamentos (empresa_id, tipo, valor, data, descricao)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'despesa', 1, '2026-01-01', 'TESTE RLS — deve falhar');
rollback;

-- PASSO 4 — Regressão rápida: com um usuário válido da org, os fluxos
-- normais devem continuar retornando dados (DRE, FC, Importação na UI).
