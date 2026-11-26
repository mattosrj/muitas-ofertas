-- Interrompe vencimentos automáticos (não restaura exclusões já realizadas).
DO $$
DECLARE item bigint;
BEGIN
  FOR item IN SELECT jobid FROM cron.job WHERE jobname='muitas-ofertas-validade-v5' LOOP
    PERFORM cron.unschedule(item);
  END LOOP;
END $$;
