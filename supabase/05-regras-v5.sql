-- Muitas Ofertas v5: configuração NÃO DESTRUTIVA de vencimento e arquivamento.
-- Executar somente APÓS confirmar o backup e 01-migracao-v4.sql.
-- Não executa expiração; instala estrutura e duas funções (prévia / execução).
-- NÃO executar antigos 02-limpeza-v4.sql e 03-ativar-rotina-diaria.sql.
BEGIN;

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS encerrado_em timestamptz;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS motivo_fora_ar text;
CREATE INDEX IF NOT EXISTS mo_produtos_encerrado_idx ON public.produtos (encerrado_em DESC)
  WHERE encerrado_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS mo_produtos_publicacao_idx ON public.produtos (loja, publicado_em)
  WHERE publicado=true;
CREATE INDEX IF NOT EXISTS mo_cupons_vencimento_idx ON public.cupons (validade, publicado_em)
  WHERE publicado=true;

-- Substitui a função do v4 preservando a data da última publicação das ofertas retiradas do ar.
-- Para campanhas, mantém o comportamento de publicado_em da v4.
CREATE OR REPLACE FUNCTION public.mo_registrar_publicacao()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.publicado THEN NEW.publicado_em := coalesce(NEW.publicado_em,now());
    ELSE NEW.publicado_em := NULL; END IF;
  ELSIF NEW.publicado IS DISTINCT FROM OLD.publicado THEN
    IF NEW.publicado THEN
      NEW.publicado_em := now();
      IF TG_TABLE_NAME='produtos' THEN
        NEW.encerrado_em := NULL;
        NEW.motivo_fora_ar := NULL;
      END IF;
    ELSIF TG_TABLE_NAME='produtos' THEN
      NEW.publicado_em := OLD.publicado_em;
      NEW.encerrado_em := now();
      NEW.motivo_fora_ar := coalesce(NEW.motivo_fora_ar,'Retirada manual');
    ELSE
      NEW.publicado_em := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Se a oferta do ML estiver no ar e o link de afiliado for trocado, reinicia o prazo.
-- Alterações de nome, preço ou categoria NÃO prolongam a vida do link antigo.
CREATE OR REPLACE FUNCTION public.mo_link_ml_renovado_v5()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.publicado=true AND OLD.publicado=true
     AND lower(btrim(NEW.loja))='mercado livre'
     AND NEW.link IS DISTINCT FROM OLD.link THEN
    NEW.publicado_em := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mo_produtos_link_ml_renovado_v5 ON public.produtos;
CREATE TRIGGER mo_produtos_link_ml_renovado_v5
BEFORE UPDATE OF link ON public.produtos FOR EACH ROW
EXECUTE FUNCTION public.mo_link_ml_renovado_v5();

-- Prévia sem alterar nenhum registro.
CREATE OR REPLACE FUNCTION public.mo_previa_rotina_v5()
RETURNS TABLE(acao text, motivo text, quantidade bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT 'Tirar oferta do ar'::text, 'Mercado Livre: 24 horas após publicação/novo link'::text,
         count(*)::bigint
  FROM public.produtos p
  WHERE p.publicado=true AND lower(btrim(p.loja))='mercado livre'
    AND p.publicado_em IS NOT NULL AND p.publicado_em<=now()-interval '24 hours'
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
  WHERE c.publicado=true AND c.validade IS NULL
    AND c.publicado_em IS NOT NULL AND c.publicado_em<=now()-interval '24 hours'
  HAVING count(*)>0;
$$;
REVOKE ALL ON FUNCTION public.mo_previa_rotina_v5() FROM PUBLIC,anon,authenticated;

-- Execute só via cron autorizado ou SQL Editor, depois de revisar a prévia.
CREATE OR REPLACE FUNCTION public.mo_executar_rotina_v5()
RETURNS TABLE(ofertas_retiradas bigint,campanhas_excluidas bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n_ofertas bigint := 0; n_campanhas bigint := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('mo-rotina-v5'));
  UPDATE public.produtos p
     SET publicado=false,
         motivo_fora_ar='Prazo de 24 horas (Mercado Livre)',
         atualizado_em=now()
   WHERE p.publicado=true AND lower(btrim(p.loja))='mercado livre'
     AND p.publicado_em IS NOT NULL AND p.publicado_em<=now()-interval '24 hours';
  GET DIAGNOSTICS n_ofertas = ROW_COUNT;

  -- Cupom com validade vence APÓS o fim do dia indicado, em Brasília.
  -- Rascunhos permanecem protegidos: só há exclusão de campanhas publicadas.
  DELETE FROM public.cupons c
   WHERE c.publicado=true
     AND ((c.validade IS NOT NULL AND c.validade<(now() AT TIME ZONE 'America/Sao_Paulo')::date)
       OR (c.validade IS NULL AND c.publicado_em IS NOT NULL
           AND c.publicado_em<=now()-interval '24 hours'));
  GET DIAGNOSTICS n_campanhas = ROW_COUNT;
  RETURN QUERY SELECT n_ofertas,n_campanhas;
END $$;
REVOKE ALL ON FUNCTION public.mo_executar_rotina_v5() FROM PUBLIC,anon,authenticated;
COMMIT;

-- SEM DELETAR NADA: confira antes de ativar a rotina.
SELECT * FROM public.mo_previa_rotina_v5();
