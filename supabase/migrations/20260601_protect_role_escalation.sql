-- ============================================================
-- SEGURANÇA: Impedir escalada de privilégio na coluna role
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Função auxiliar: retorna o role do usuário logado (SECURITY DEFINER
--    bypassa RLS para conseguir ler a própria linha sem recursão)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Trigger: bloqueia qualquer alteração de role feita por quem NÃO é super_admin
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o role está sendo alterado
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Apenas super_admin pode alterar roles
    IF public.current_user_role() <> 'super_admin' THEN
      RAISE EXCEPTION 'Apenas Super Admin pode alterar permissões de usuários';
    END IF;
    -- Impede que um super_admin remova o próprio status (evita lockout acidental)
    IF NEW.id = auth.uid() AND OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
      RAISE EXCEPTION 'Você não pode remover seu próprio status de Super Admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

-- 3. Garantir que a policy de UPDATE em profiles não permita alterar linhas de outros
--    (cada um só edita o próprio perfil; super_admin usa o trigger acima + service role)
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- RESULTADO:
-- · Usuário comum tenta mudar próprio role via console → BLOQUEADO pelo trigger
-- · Usuário comum tenta mudar role de outro → BLOQUEADO pela policy (não é dono da linha)
-- · Super admin altera roles → PERMITIDO (via service role na API ou trigger valida)
-- · Super admin tenta se rebaixar → BLOQUEADO (evita lockout)
-- ============================================================
