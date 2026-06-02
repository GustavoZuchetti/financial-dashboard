-- ============================================================
-- Migration: converter plano_contas existente para MAIÚSCULAS
-- Execute no SQL Editor do Supabase (Settings → SQL Editor)
-- ============================================================
UPDATE public.plano_contas
SET
  nome    = UPPER(TRIM(nome)),
  codigo  = UPPER(TRIM(COALESCE(codigo, '')))
WHERE nome IS NOT NULL;

-- Verificação após execução:
-- SELECT codigo, nome FROM public.plano_contas ORDER BY codigo;
