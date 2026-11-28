-- Muitas Ofertas v5.3 - edição de arquivadas e data da postagem.
-- Executar UMA VEZ no SQL Editor após backup. Incremental, não apaga produtos/cupons.
-- IMPORTANTE: publicado_em permanece sendo o início de validade do LINK (cron v5.1).
-- postagem_em é a data exibida no catálogo e muda ao editar preço de oferta NO AR.
BEGIN;

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS postagem_em timestamptz;

-- Registros já existentes mantêm a última publicação conhecida.
UPDATE public.produtos
SET postagem_em=COALESCE(publicado_em, criado_em)
WHERE postagem_em IS NULL
  AND (publicado=true OR encerrado_em IS NOT NULL);

CREATE OR REPLACE FUNCTION public.mo_atualizar_postagem_v53()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.publicado=true THEN
      NEW.postagem_em := COALESCE(NEW.postagem_em,NEW.publicado_em,now());
    END IF;
  ELSIF NEW.publicado IS DISTINCT FROM OLD.publicado THEN
    -- Republicação: o trigger existente também renova a validade do link.
    IF NEW.publicado=true THEN NEW.postagem_em := now(); END IF;
  ELSIF NEW.publicado=true AND
      (NEW.preco IS DISTINCT FROM OLD.preco
       OR NEW.preco_anterior IS DISTINCT FROM OLD.preco_anterior
       OR NEW.link IS DISTINCT FROM OLD.link) THEN
    -- Atualizar preço ou trocar link atualiza a data da postagem.
    -- Importante: preço não mexe em publicado_em, portanto não prorroga a validade.
    NEW.postagem_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mo_produtos_postagem_v53 ON public.produtos;
CREATE TRIGGER mo_produtos_postagem_v53
BEFORE INSERT OR UPDATE OF publicado,preco,preco_anterior,link ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.mo_atualizar_postagem_v53();

-- Registra em código a correção de permissão da v5.1 aplicada anteriormente.
GRANT EXECUTE ON FUNCTION public.mo_prazo_loja_v51(text) TO authenticated;
COMMIT;

-- Conferência somente leitura:
SELECT column_name,data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='produtos'
  AND column_name IN ('publicado_em','postagem_em');
