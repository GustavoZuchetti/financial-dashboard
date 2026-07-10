-- Cursor e resultado do cron em colunas dedicadas — isolados de
-- ultimo_resultado (que a sync manual e o enriquecimento também escrevem),
-- evitando sobrescrita mútua que zerava o cursor de retomada do cron.
alter table public.integracoes add column if not exists cron_cursor jsonb;
alter table public.integracoes add column if not exists cron_resultado jsonb;
alter table public.integracoes add column if not exists ultima_sync_cron timestamptz;
