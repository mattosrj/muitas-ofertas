-- OBSOLETO desde v5. NÃO EXECUTAR: a regra v4 apagaria ofertas que agora devem ser arquivadas.
-- Use supabase/05-regras-v5.sql e 06-ativar-rotina-v5.sql em vez disso.
DO $$ BEGIN RAISE EXCEPTION 'ROTINA V4 OBSOLETA: use os arquivos 05 e 06 da v5.'; END $$;

-- Muitas Ofertas v4 - regras de retenção. ESTE SCRIPT NÃO EXECUTA EXCLUSÕES.
-- Instale após 01-migracao-v4.sql. Revise a prévia antes de ativar o cron (03).
-- 30 dias: publicados desde publicado_em; rascunhos desde criado_em.
-- Até 1.000 registros no TOTAL: produtos + campanhas. Códigos de cupons seguem
-- as campanhas por ON DELETE CASCADE e NÃO contam separadamente.

CREATE OR REPLACE FUNCTION public.mo_previa_limpeza()
RETURNS TABLE (tipo text, motivo text, quantidade bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH registros AS (
    SELECT 'oferta'::text tipo, id, coalesce(publicado_em,criado_em) referencia,
      CASE WHEN publicado THEN publicado_em < now()-interval '30 days'
           ELSE criado_em < now()-interval '30 days' END expirado
      FROM public.produtos
    UNION ALL
    SELECT 'campanha'::text, id, coalesce(publicado_em,criado_em),
      CASE WHEN publicado THEN publicado_em < now()-interval '30 days'
           ELSE criado_em < now()-interval '30 days' END
      FROM public.cupons
  ), marcados AS (
    SELECT *,row_number() OVER (ORDER BY referencia DESC NULLS LAST,tipo,id) ordem
    FROM registros
  )
  SELECT tipo, CASE WHEN expirado THEN 'mais de 30 dias'
                    ELSE 'acima do limite de 1.000' END,
         count(*)::bigint
  FROM marcados WHERE coalesce(expirado,false) OR ordem>1000
  GROUP BY tipo, CASE WHEN expirado THEN 'mais de 30 dias'
                      ELSE 'acima do limite de 1.000' END
  ORDER BY tipo,motivo;
$$;
REVOKE ALL ON FUNCTION public.mo_previa_limpeza() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.mo_executar_limpeza()
RETURNS TABLE(ofertas_apagadas bigint,campanhas_apagadas bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Impede duas execuções concorrentes do mesmo trabalho.
  PERFORM pg_advisory_xact_lock(hashtext('mo-limpeza-v4'));
  RETURN QUERY
  WITH registros AS (
    SELECT 'oferta'::text tipo, id, coalesce(publicado_em,criado_em) referencia,
      CASE WHEN publicado THEN publicado_em < now()-interval '30 days'
           ELSE criado_em < now()-interval '30 days' END expirado
      FROM public.produtos
    UNION ALL
    SELECT 'campanha'::text, id, coalesce(publicado_em,criado_em),
      CASE WHEN publicado THEN publicado_em < now()-interval '30 days'
           ELSE criado_em < now()-interval '30 days' END
      FROM public.cupons
  ), marcados AS (
    SELECT *,row_number() OVER (ORDER BY referencia DESC NULLS LAST,tipo,id) ordem
    FROM registros
  ), apagar AS (
    SELECT tipo,id FROM marcados WHERE coalesce(expirado,false) OR ordem>1000
  ), removidas_ofertas AS (
    DELETE FROM public.produtos p USING apagar a
      WHERE a.tipo='oferta' AND p.id=a.id RETURNING p.id
  ), removidas_campanhas AS (
    DELETE FROM public.cupons c USING apagar a
      WHERE a.tipo='campanha' AND c.id=a.id RETURNING c.id
  )
  SELECT (SELECT count(*) FROM removidas_ofertas)::bigint,
         (SELECT count(*) FROM removidas_campanhas)::bigint;
END $$;
REVOKE ALL ON FUNCTION public.mo_executar_limpeza() FROM PUBLIC,anon,authenticated;

-- PRÉVIA SEM EXCLUSÃO, execute no SQL Editor após a instalação:
SELECT * FROM public.mo_previa_limpeza();
-- Se retornar 0 linhas, nenhuma oferta/campanha seria apagada agora.
-- ATENÇÃO: NÃO execute mo_executar_limpeza() antes de revisar a prévia.
