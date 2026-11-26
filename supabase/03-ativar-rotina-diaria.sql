-- OBSOLETO desde v5. NÃO EXECUTAR: a regra v4 apagaria ofertas que agora devem ser arquivadas.
-- Use supabase/05-regras-v5.sql e 06-ativar-rotina-v5.sql em vez disso.
DO $$ BEGIN RAISE EXCEPTION 'ROTINA V4 OBSOLETA: use os arquivos 05 e 06 da v5.'; END $$;

-- AÇÃO DESTRUTIVA AGENDADA! Só execute depois de rever o resultado de
-- select * from public.mo_previa_limpeza(); e fazer backup/exportar dados.
-- No painel Supabase, habilite a extensão 'pg_cron' (Supabase Cron) previamente.
-- Agendamento 06:00 UTC diariamente (= 03:00 em Brasília, UTC-3).
-- Usuário da rotina precisa ter permissão de executar mo_executar_limpeza.
SELECT cron.schedule(
  'muitas-ofertas-limpeza-diaria',
  '0 6 * * *',
  $$ SELECT * FROM public.mo_executar_limpeza(); $$
);
-- Conferência:
SELECT jobid,jobname,schedule,command,active FROM cron.job
WHERE jobname='muitas-ofertas-limpeza-diaria';
