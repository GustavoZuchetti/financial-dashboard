-- 20261030 — diagnóstico de borderôs (item 4 do Controller)
--
-- Coleta de evidência, sem efeito nos números. Forma:
--   { pedidos: ['bling:saida:ID', ...],                 -- até 20, gravados por SQL
--     resultados: { 'bling:saida:ID': { coletado_em, status, conta, borderos: [{ id, status, dados }], incompleto? } } }
-- O cron e a sincronização manual coletam os pedidos pendentes
-- (lib/bling-server.js, coletarDiagnostico). Esvaziar a coluna depois da
-- análise: guarda o JSON bruto do Bling, com dados de contato.
alter table public.integracoes add column if not exists diagnostico_bling jsonb;

notify pgrst, 'reload schema';
