-- ═══════════════════════════════════════════════════════════════════════════
-- 20260703_fc_status_liquidacao.sql — Ciclo de vida dos títulos no fluxo
-- status: aberto | pago | parcial | cancelado  ("vencido" é DERIVADO: status
-- em aberto + data de vencimento < hoje — nunca gravado)
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.fluxo_caixa add column if not exists status text not null default 'aberto';
alter table public.fluxo_caixa add column if not exists data_liquidacao date;
alter table public.fluxo_caixa add column if not exists valor_liquidado numeric;
alter table public.fluxo_caixa add column if not exists doc_ref text;
alter table public.fluxo_caixa add column if not exists data_emissao date;

alter table public.fluxo_caixa drop constraint if exists fc_status_check;
alter table public.fluxo_caixa add constraint fc_status_check
  check (status in ('aberto','pago','parcial','cancelado'));

create index if not exists idx_fc_emp_status_data
  on public.fluxo_caixa (empresa_id, status, data);

-- BACKFILL (EXECUTAR UMA ÚNICA VEZ — não incluir em reexecuções):
-- premissa conservadora aprovada: registros com vencimento passado assumem-se
-- liquidados na data; a primeira reimportação com o novo De-Para corrige os
-- que estavam de fato em aberto/atrasados.
-- update public.fluxo_caixa
--   set status='pago', data_liquidacao=data, valor_liquidado=valor
--   where data < current_date and status='aberto' and data_liquidacao is null;
