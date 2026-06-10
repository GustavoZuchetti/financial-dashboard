-- ============================================================
-- DIAGNÓSTICO: Verificar e corrigir usuário demo
-- Execute PASSO A PASSO no SQL Editor do Supabase
-- ============================================================

-- PASSO 1: Identificar o usuário demo (anote o UUID retornado)
SELECT
  au.id,
  au.email,
  au.last_sign_in_at,
  au.confirmed_at,
  p.role,
  p.organization_id,
  o.nome AS organizacao,
  COUNT(e.id) AS total_empresas
FROM auth.users au
LEFT JOIN public.profiles      p ON p.id = au.id
LEFT JOIN public.organizations o ON o.id = p.organization_id
LEFT JOIN public.empresas      e ON e.organization_id = p.organization_id
WHERE au.email ILIKE '%demo%'
   OR au.email ILIKE '%test%'
   OR au.email ILIKE '%facesign%'
GROUP BY au.id, au.email, au.last_sign_in_at, au.confirmed_at,
         p.role, p.organization_id, o.nome
ORDER BY au.last_sign_in_at DESC NULLS LAST;

-- ============================================================
-- PASSO 2: Se o perfil estiver faltando, criar com org_admin
-- Substitua 'DEMO_USER_UUID' e 'ORG_UUID' pelos valores do passo 1
-- ============================================================
/*
INSERT INTO public.profiles (id, email, role, organization_id)
SELECT
  id,
  email,
  'org_admin',
  'ORG_UUID_AQUI'           -- copie da coluna organization_id de outro usuário da mesma org
FROM auth.users
WHERE id = 'DEMO_USER_UUID'
ON CONFLICT (id) DO UPDATE SET
  role            = 'org_admin',
  organization_id = EXCLUDED.organization_id;
*/

-- ============================================================
-- PASSO 3: Verificar se a org do demo tem empresas cadastradas
-- Substitua 'ORG_UUID_AQUI' pelo UUID da organização
-- ============================================================
/*
SELECT id, nome, cnpj, organization_id
FROM public.empresas
WHERE organization_id = 'ORG_UUID_AQUI';
*/
