-- ═══════════════════════════════════════════════════════════════════════════
-- 20260825_sync_cursor.sql
-- CURSOR PERSISTENTE DA SINCRONIZAÇÃO MANUAL DO BLING
--
-- Contexto: a conciliação de 25/08/2026 contra 17 extratos do Bling apontou
-- 7.156 títulos e R$ 44,6 milhões ausentes no sistema, com viés — 65% das
-- entradas contra 42% das saídas.
--
-- Causa raiz: a sincronização manual era ESTATELESS. Toda execução recomeçava
-- em { fase 0, página 1 } e a interface parava após 60 iterações. Com 50
-- títulos por iteração, o teto era de 3.000 títulos por execução para AS DUAS
-- fases. A FACE tem 5.407 registros. O excedente nunca era alcançado, e como o
-- cursor reiniciava do zero, ficava de fora indefinidamente. O viés vem da
-- ordem: recebimentos rodam primeiro e consomem iterações.
--
-- O cron já persistia posição em integracoes.cron_cursor. Esta migração dá o
-- mesmo tratamento à sincronização manual, em coluna PRÓPRIA para que os dois
-- fluxos não disputem a mesma posição.
--
-- ⚠️ APLICAR NO SQL EDITOR DO SUPABASE ANTES DO DEPLOY. Idempotente.
-- Sem ela a rota grava numa coluna inexistente: o update falha em silêncio
-- (está encadeado com .then de captura) e a sincronização volta ao
-- comportamento antigo, sem retomada — degrada, não quebra.
-- ═══════════════════════════════════════════════════════════════════════════

-- Posição da varredura manual: { escopo, fase, pagina, janela }
-- NULL = nenhuma varredura em curso; a próxima execução começa do início.
alter table public.integracoes
  add column if not exists sync_cursor jsonb;

-- Quando a última varredura chegou ao fim. Permite responder "há quanto tempo
-- o sistema não percorreu a base inteira?" — pergunta que hoje não tem resposta.
alter table public.integracoes
  add column if not exists ultima_varredura_completa timestamptz;

comment on column public.integracoes.sync_cursor is
  'Posição da sincronizacao manual: {escopo,fase,pagina,janela}. NULL = varredura completa ou nao iniciada. Ver lib/bling-cursor.js';
comment on column public.integracoes.ultima_varredura_completa is
  'Ultima vez que a varredura manual percorreu a base inteira (next === null).';

-- ── Conferência pós-aplicação ───────────────────────────────────────────────
-- select id, empresa_id, sync_cursor, ultima_varredura_completa, cron_cursor,
--        ultima_sync
--   from public.integracoes order by empresa_id;
