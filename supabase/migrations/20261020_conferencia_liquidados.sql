-- 20261020 — conferência dos liquidados pela listagem filtrada do Bling
--
-- Estado da rodada que lista no Bling os pagos e parciais dos últimos 365 dias
-- por data de pagamento, compara com os liquidados daqui e confere pelo id o
-- que não apareceu (lib/bling-reconferencia.js, R10.6). Forma:
--   { etapa: 'listagem'|'comparar'|'fila'|'concluida'|'suspeita',
--     janela: { inicio, fim }, fase, pagina, vistos: [ids], fila: [doc_refs],
--     candidatos, liquidados, iniciada_em, concluida_em }
-- Aplicar ANTES do merge. Sem a coluna, a sincronização segue normal e só a
-- conferência dos liquidados informa que não pôde gravar.
alter table public.integracoes add column if not exists conferencia_liquidados jsonb;

notify pgrst, 'reload schema';
