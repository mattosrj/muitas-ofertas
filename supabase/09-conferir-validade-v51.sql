-- Consultas SOMENTE DE LEITURA: validade calculada por loja.
-- Execute depois de 08-prazos-por-loja-v51.sql.
SELECT
  p.nome,
  p.loja,
  p.publicado,
  p.publicado_em AT TIME ZONE 'America/Sao_Paulo' AS publicado_em_brasilia,
  (p.publicado_em + public.mo_prazo_loja_v51(p.loja)) AT TIME ZONE 'America/Sao_Paulo' AS vence_em_brasilia,
  CASE
    WHEN public.mo_prazo_loja_v51(p.loja) IS NULL THEN 'Sem regra de expiração'
    WHEN p.publicado_em IS NULL THEN 'Ainda não publicada'
    WHEN p.publicado=false THEN 'Fora do ar / rascunho'
    WHEN now() >= p.publicado_em + public.mo_prazo_loja_v51(p.loja) THEN 'Vencida — aguarda rotina'
    ELSE 'Dentro do prazo'
  END AS situacao
FROM public.produtos AS p
ORDER BY p.publicado_em DESC NULLS LAST
LIMIT 50;

SELECT * FROM public.mo_previa_rotina_v5();
