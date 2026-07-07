-- Competência (regime) vinda do detalhe do título Bling — enriquecimento 06/07
alter table public.fluxo_caixa add column if not exists competencia date;
alter table public.lancamentos add column if not exists competencia date;
