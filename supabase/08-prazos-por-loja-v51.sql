-- Muitas Ofertas v5.1 — vencimento individual de ofertas por loja.
-- Atualização INCREMENTAL da v5, sem apagar ou despublicar dados na instalação.
-- PRÉ-REQUISITO: 01-migracao-v4.sql e 05-regras-v5.sql já executados.
-- NÃO executar o SQL antigo de limpeza v4 (02 / 03).
-- Os prazos são definidos pelo administrador; confirme as condições vigentes dos programas de afiliados.
BEGIN;

-- Todo prazo é contado em horas corridas da última publicação ou troca do link.
CREATE OR REPLACE FUNCTION public.mo_prazo_loja_v51(p_loja text)
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE lower(btrim(coalesce(p_loja,'')))
    WHEN 'mercado livre' THEN interval '24 hours'
    WHEN 'amazon' THEN interval '24 hours'
    WHEN 'magalu' THEN interval '24 hours'
    WHEN 'shopee' THEN interval '7 days'
    WHEN 'shoppee' THEN interval '7 days' -- tolerância à grafia alternativa
    WHEN 'aliexpress' THEN interval '3 days'
    ELSE NULL::interval -- loja não reconhecida: não retirar automaticamente
  END;
$$;
REVOKE ALL ON FUNCTION public.mo_prazo_loja_v51(text) FROM PUBLIC, anon, authenticated;

-- Atualizar SOMENTE o link de uma oferta já publicada reinicia a validade.
-- Preço, nome, categoria e imagem não renovam o prazo por si só.
DROP TRIGGER IF EXISTS mo_produtos_link_ml_renovado_v5 ON public.produtos;
CREATE OR REPLACE FUNCTION public.mo_link_loja_renovado_v51()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.publicado=true AND OLD.publicado=true
     AND NEW.link IS DISTINCT FROM OLD.link
     AND public.mo_prazo_loja_v51(NEW.loja) IS NOT NULL THEN
    NEW.publicado_em := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mo_produtos_link_renovado_v51 ON public.produtos;
CREATE TRIGGER mo_produtos_link_renovado_v51
  BEFORE UPDATE OF link ON public.produtos FOR EACH ROW
  EXECUTE FUNCTION public.mo_link_loja_renovado_v51();

-- Prévia somente de leitura: mostra a quantidade vencida por loja, mais os cupons.
CREATE OR REPLACE FUNCTION public.mo_previa_rotina_v5()
RETURNS TABLE(acao text, motivo text, quantidade bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT 'Tirar oferta do ar'::text,
         ('Prazo vencido — ' || p.loja)::text,
         count(*)::bigint
    FROM public.produtos p
   WHERE p.publicado=true AND p.publicado_em IS NOT NULL
     AND public.mo_prazo_loja_v51(p.loja) IS NOT NULL
     AND p.publicado_em+public.mo_prazo_loja_v51(p.loja)<=now()
   GROUP BY p.loja
  HAVING count(*)>0
  UNION ALL
  SELECT 'Apagar campanha'::text, 'Data de validade encerrada (horário de Brasília)'::text,
         count(*)::bigint
    FROM public.cupons c
   WHERE c.publicado=true AND c.validade IS NOT NULL
     AND c.validade<(now() AT TIME ZONE 'America/Sao_Paulo')::date
  HAVING count(*)>0
  UNION ALL
  SELECT 'Apagar campanha'::text, 'Sem validade: 24 horas após publicação'::text,
         count(*)::bigint
    FROM public.cupons c
   WHERE c.publicado=true AND c.validade IS NULL AND c.publicado_em IS NOT NULL
     AND c.publicado_em<=now()-interval '24 hours'
  HAVING count(*)>0;
$$;
REVOKE ALL ON FUNCTION public.mo_previa_rotina_v5() FROM PUBLIC, anon, authenticated;

-- Função executada pelo cron quando for ativado. NÃO é chamada nesta migração.
-- Preserva a oferta retirada (publicado=false, encerrado_em preenchido por trigger).
-- Campanhas de cupons seguem a exclusão da v5 (somente publicadas e vencidas).
CREATE OR REPLACE FUNCTION public.mo_executar_rotina_v5()
RETURNS TABLE(ofertas_retiradas bigint,campanhas_excluidas bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n_ofertas bigint:=0; n_campanhas bigint:=0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('mo-rotina-v5'));
  UPDATE public.produtos p
     SET publicado=false,
         motivo_fora_ar='Prazo da oferta encerrado (' || p.loja || ')',
         atualizado_em=now()
   WHERE p.publicado=true AND p.publicado_em IS NOT NULL
     AND public.mo_prazo_loja_v51(p.loja) IS NOT NULL
     AND p.publicado_em+public.mo_prazo_loja_v51(p.loja)<=now();
  GET DIAGNOSTICS n_ofertas = ROW_COUNT;

  DELETE FROM public.cupons c
   WHERE c.publicado=true
     AND ((c.validade IS NOT NULL
           AND c.validade<(now() AT TIME ZONE 'America/Sao_Paulo')::date)
       OR (c.validade IS NULL AND c.publicado_em IS NOT NULL
           AND c.publicado_em<=now()-interval '24 hours'));
  GET DIAGNOSTICS n_campanhas = ROW_COUNT;
  RETURN QUERY SELECT n_ofertas,n_campanhas;
END $$;
REVOKE ALL ON FUNCTION public.mo_executar_rotina_v5() FROM PUBLIC, anon, authenticated;
COMMIT;

-- Apenas CONSULTAS, não alteram dados:
SELECT * FROM public.mo_previa_rotina_v5();
