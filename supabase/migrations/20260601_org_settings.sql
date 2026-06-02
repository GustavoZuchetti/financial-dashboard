-- ============================================================
-- Migration: org_settings — logo e configurações da organização
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_settings (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE,
  logo_url        text,
  nome_fantasia   text,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

-- Leitura pública (logo não é dado sensível — necessário para página de login)
CREATE POLICY "public select org logo" ON public.org_settings
  FOR SELECT USING (true);

-- Escrita restrita a org_admin e super_admin
CREATE POLICY "admins manage org settings" ON public.org_settings
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('org_admin', 'super_admin')
    )
  );

-- ============================================================
-- TAMBÉM execute no Supabase Dashboard → Storage:
--   1. Criar bucket: "org-assets"
--   2. Marcar como "Public bucket" (leitura pública)
--   3. Policy de upload: authenticated users can INSERT
-- ============================================================
