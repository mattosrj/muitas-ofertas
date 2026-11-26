-- Muitas Ofertas v4 - executar UMA VEZ no SQL Editor do Supabase.
-- Faça backup/exportação dos dados ANTES. Este SQL não exclui registros.
-- Pré-requisito: tabelas public.produtos, public.cupons, public.perfis.
BEGIN;

-- Preço anterior opcional para exibir De/Por. O preço atual continua obrigatório.
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS preco_anterior numeric(12,2);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mo_produtos_preco_anterior_positivo'
                 AND conrelid='public.produtos'::regclass) THEN
    ALTER TABLE public.produtos ADD CONSTRAINT mo_produtos_preco_anterior_positivo
      CHECK (preco_anterior IS NULL OR preco_anterior > 0);
  END IF;
END $$;

-- Data da entrada em publicação, mantida automaticamente por trigger.
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS publicado_em timestamptz;
ALTER TABLE public.cupons ADD COLUMN IF NOT EXISTS publicado_em timestamptz;

-- Para registros antigos, começa contagem de 30 dias a partir desta migração;
-- assim não se apagam publicações antigas de forma inesperada.
UPDATE public.produtos SET publicado_em=now() WHERE publicado=true AND publicado_em IS NULL;
UPDATE public.cupons SET publicado_em=now() WHERE publicado=true AND publicado_em IS NULL;

CREATE OR REPLACE FUNCTION public.mo_registrar_publicacao()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.publicado=true THEN NEW.publicado_em:=coalesce(NEW.publicado_em, now());
    ELSE NEW.publicado_em:=NULL; END IF;
  ELSIF NEW.publicado IS DISTINCT FROM OLD.publicado THEN
    IF NEW.publicado=true THEN NEW.publicado_em:=now();
    ELSE NEW.publicado_em:=NULL; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mo_produtos_publicado_em ON public.produtos;
CREATE TRIGGER mo_produtos_publicado_em BEFORE INSERT OR UPDATE OF publicado ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.mo_registrar_publicacao();
DROP TRIGGER IF EXISTS mo_cupons_publicado_em ON public.cupons;
CREATE TRIGGER mo_cupons_publicado_em BEFORE INSERT OR UPDATE OF publicado ON public.cupons
  FOR EACH ROW EXECUTE FUNCTION public.mo_registrar_publicacao();

-- Categorias: antes eram uma combinação de nomes fixos e categorias dos produtos.
CREATE TABLE IF NOT EXISTS public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 100),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mo_categorias_nome_unico ON public.categorias (lower(btrim(nome)));

-- Migração de categorias reais + opções originais do Admin, sem duplicar por maiúsculas/minúsculas.
INSERT INTO public.categorias (nome)
SELECT DISTINCT ON (lower(btrim(nome))) btrim(nome)
FROM (
  SELECT categoria AS nome FROM public.produtos WHERE categoria IS NOT NULL AND btrim(categoria)<>''
  UNION ALL SELECT unnest(ARRAY['Eletrônicos','Smartphones','Moda e Acessórios',
                                'Casa e Decoração','Informática','Casa'])
) AS origens
WHERE length(btrim(nome)) BETWEEN 1 AND 100
ORDER BY lower(btrim(nome)), nome
ON CONFLICT DO NOTHING;

-- Acesso a categorias somente para o administrador autenticado.
-- mo_usuario_admin() já foi criada no SQL da área de cupons.
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mo_categorias_admin ON public.categorias;
CREATE POLICY mo_categorias_admin ON public.categorias FOR ALL TO authenticated
  USING (public.mo_usuario_admin()) WITH CHECK (public.mo_usuario_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias TO authenticated;
REVOKE ALL ON public.categorias FROM anon;

-- Garantir remoção de ofertas pelo administrador; políticas existentes continuam.
GRANT DELETE ON public.produtos TO authenticated;
DROP POLICY IF EXISTS mo_produtos_admin_delete_v4 ON public.produtos;
CREATE POLICY mo_produtos_admin_delete_v4 ON public.produtos FOR DELETE TO authenticated
  USING (public.mo_usuario_admin());

-- Operações de categoria atômicas: sincronizam todas as ofertas na mesma transação.
CREATE OR REPLACE FUNCTION public.mo_editar_categoria(p_categoria_id uuid, p_novo_nome text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_antigo text; v_novo text;
BEGIN
  IF NOT public.mo_usuario_admin() THEN RAISE EXCEPTION 'Acesso administrativo não autorizado'; END IF;
  v_novo:=btrim(p_novo_nome);
  IF v_novo IS NULL OR length(v_novo) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Nome da categoria inválido'; END IF;
  SELECT nome INTO v_antigo FROM public.categorias WHERE id=p_categoria_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoria não localizada'; END IF;
  IF EXISTS (SELECT 1 FROM public.categorias WHERE id<>p_categoria_id
             AND lower(btrim(nome))=lower(v_novo)) THEN
    RAISE EXCEPTION 'Categoria com esse nome já existe'; END IF;
  UPDATE public.categorias SET nome=v_novo WHERE id=p_categoria_id;
  UPDATE public.produtos SET categoria=v_novo, atualizado_em=now()
    WHERE lower(btrim(categoria))=lower(btrim(v_antigo));
END $$;
CREATE OR REPLACE FUNCTION public.mo_apagar_categoria(p_categoria_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_antigo text;
BEGIN
  IF NOT public.mo_usuario_admin() THEN RAISE EXCEPTION 'Acesso administrativo não autorizado'; END IF;
  SELECT nome INTO v_antigo FROM public.categorias WHERE id=p_categoria_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoria não localizada'; END IF;
  UPDATE public.produtos SET categoria=NULL, atualizado_em=now()
    WHERE lower(btrim(categoria))=lower(btrim(v_antigo));
  DELETE FROM public.categorias WHERE id=p_categoria_id;
END $$;
REVOKE ALL ON FUNCTION public.mo_editar_categoria(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mo_apagar_categoria(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mo_editar_categoria(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mo_apagar_categoria(uuid) TO authenticated;

COMMIT;

-- Conferência (não altera dados):
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='produtos'
  AND column_name IN ('preco','preco_anterior','publicado_em');
SELECT count(*) AS total_categorias FROM public.categorias;
