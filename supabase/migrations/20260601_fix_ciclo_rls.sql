-- ============================================================
-- Migration: corrigir RLS de ciclo_financeiro para multi-tenant
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Remover policy antiga (baseada apenas em user_id)
DROP POLICY IF EXISTS "Users can manage ciclo_financeiro of own empresas" ON public.ciclo_financeiro;

-- Nova policy: aceita tanto user_id (legado) quanto organization_id (multi-tenant)
CREATE POLICY "users can manage ciclo_financeiro" ON public.ciclo_financeiro
  FOR ALL USING (
    empresa_id IN (
      SELECT e.id FROM public.empresas e
      WHERE e.user_id = auth.uid()
         OR e.organization_id IN (
              SELECT organization_id FROM public.profiles WHERE id = auth.uid()
            )
    )
  );
