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

-- BACKFILL — NÃO EXECUTAR.
-- A premissa "vencimento passado = pago" mostrou-se incorreta para a Facesign:
-- o relatório do Bling só exporta títulos EM ABERTO/ATRASADOS, logo títulos
-- passados podem estar vencidos (não pagos). Um backfill assim marcou como
-- 'pago' justamente os 8 títulos 'Atrasada' de junho/2026 — foi revertido.
-- A verdade de liquidação deve vir SEMPRE da importação com De-Para de
-- Situação (Em aberto|Atrasada→aberto, Parcial→parcial, Pago/Recebido→pago).
-- Novos registros nascem 'aberto' (default) até a importação informar o status.
