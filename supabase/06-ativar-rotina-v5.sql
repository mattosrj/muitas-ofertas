-- ATENÇÃO: agenda rotina com ações reais (inclusive EXCLUSÃO DEFINITIVA DE CUPONS).
-- Execute somente após instalar 05, fazer backup e revisar mo_previa_rotina_v5().
-- Requer extensão pg_cron habilitada no Supabase (Database > Extensions).
-- A cada 5 minutos. Vencimentos podem ocorrer com atraso de até ~5 minutos.
-- Desativa antigo job v4, caso exista, para não apagar ofertas arquivadas.
DO $$
DECLARE job_antigo bigint;
BEGIN
  FOR job_antigo IN SELECT jobid FROM cron.job WHERE jobname='muitas-ofertas-limpeza-diaria' LOOP
    PERFORM cron.unschedule(job_antigo);
  END LOOP;
  FOR job_antigo IN SELECT jobid FROM cron.job WHERE jobname='muitas-ofertas-validade-v5' LOOP
    PERFORM cron.unschedule(job_antigo);
  END LOOP;
END $$;
SELECT cron.schedule(
  'muitas-ofertas-validade-v5', '*/5 * * * *',
  $$ SELECT * FROM public.mo_executar_rotina_v5(); $$
);
SELECT jobid,jobname,schedule,active FROM cron.job
WHERE jobname='muitas-ofertas-validade-v5';
