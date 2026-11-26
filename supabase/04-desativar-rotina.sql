-- Interrompe somente o agendamento futuro; não restaura dados já excluídos.
SELECT cron.unschedule('muitas-ofertas-limpeza-diaria');
