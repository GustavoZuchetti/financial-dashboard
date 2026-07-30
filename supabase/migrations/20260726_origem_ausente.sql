-- Título excluído no Bling (404 permanente no detalhe, nos dois recursos)
-- mas ainda presente na nossa base. Marcado para não ser reprocessado a cada
-- enriquecimento — do contrário 'restantes' nunca zera e o job aborta ao
-- encontrar um lote composto só de órfãos.
alter table public.fluxo_caixa add column if not exists origem_ausente boolean not null default false;
create index if not exists fluxo_caixa_origem_ausente_idx on public.fluxo_caixa (empresa_id) where origem_ausente;
notify pgrst, 'reload schema';
