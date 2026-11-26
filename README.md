# 🛍️ Muitas Ofertas

Portal responsivo de **ofertas, promoções e cupons** com painel de gerenciamento, publicado gratuitamente no **GitHub Pages**. Projeto desenvolvido como aplicação prática de desenvolvimento web, Git/GitHub e integração com banco de dados.

🌐 **[Acessar o site](https://mattosrj.github.io/muitas-ofertas/)** · 🎟️ **[Página de cupons](https://mattosrj.github.io/muitas-ofertas/cupons.html)**

## Funcionalidades

**Para visitantes:** catálogo de produtos publicados, busca, filtros por categoria, links de ofertas, cupons associados a produtos, campanhas de cupons, compartilhamento via WhatsApp, favoritos salvos no navegador, data relativa da oferta e tema claro/escuro. Quando informado, o preço anterior aparece riscado ao lado do preço promocional.

**Para administração:** login com autenticação Supabase e controle de acesso por políticas RLS; cadastro e edição de ofertas; rascunhos e publicação; exclusão de ofertas; categorias cadastradas, renomeadas ou removidas sem apagar os produtos; alertas de possíveis produtos repetidos; preço anterior opcional; geração da mensagem para WhatsApp; cadastro de campanhas de cupons, incluindo múltiplos códigos, imagens e alertas de códigos iguais ou parecidos; exclusão de campanhas e códigos vinculados.

**Manutenção v5.1:** ofertas publicadas saem do ar conforme a loja: Mercado Livre (24h), Amazon (24h), Magalu (24h), Shopee (7 dias) e AliExpress (3 dias), sempre sem exclusão automática. Trocar o link reinicia esse prazo, mas alterar somente o nome/preço não. A área **Publicações fora do ar** reúne ofertas arquivadas, com exclusão em lote. Campanhas de cupons **publicadas** são excluídas após o término da data de validade (fuso de Brasília) ou, sem validade, 24 horas após a publicação. Os rascunhos são preservados. A execução automática via `pg_cron` é opcional e só deve ser ativada após backup e revisão da prévia. A antiga rotina v4 de 30 dias/1.000 registros está descontinuada; **não execute os arquivos 02/03 da v4**. O limite de 1.000 registros não é aplicado à força para evitar apagar ofertas que devem permanecer arquivadas

## Tecnologias

- **HTML5, CSS3 e JavaScript (ES modules)** — interface responsiva sem framework de front-end.
- **Supabase / PostgreSQL** — persistência, autenticação, Row Level Security (RLS), funções SQL e agendamento opcional com `pg_cron`.
- **Git e GitHub** — versionamento e revisão por Pull Requests.
- **GitHub Pages** — hospedagem do site estático.
- **Web APIs** — Clipboard API, `localStorage` e links de compartilhamento do WhatsApp.

## Estrutura do projeto

```text
muitas-ofertas/
├── index.html              # Página principal
├── cupons.html             # Campanhas públicas
├── admin/
│   ├── index.html          # Painel de produtos
│   ├── admin.js
│   ├── cupons.html          # Painel de campanhas de cupons
│   ├── cupons.js
│   ├── fora-do-ar.html       # Histórico de ofertas retiradas
│   └── fora-do-ar.js
├── js/                     # Catálogo público, utilitários e tema
├── css/                    # Estilos públicos e administrativos
├── images/                 # Artes e imagens locais
└── supabase/               # Migrações SQL e manutenção
```

## Executar localmente

1. Clone o repositório: `git clone https://github.com/mattosrj/muitas-ofertas.git`.
2. Abra a pasta no VS Code e utilize a extensão **Live Server** (ou outro servidor estático local).
3. Acesse `index.html`, `cupons.html` e `admin/index.html` pelo servidor local.
4. Para funcionalidades dependentes de dados, configure o projeto Supabase e **execute as migrações SQL na ordem**, seguindo a documentação em `supabase/` e a instrução da atualização correspondente.

> A chave **publishable** do Supabase pode estar no front-end; chaves **secret** ou `service_role` nunca devem ser incluídas em HTML/JS públicos. O banco protege as ações administrativas via RLS e funções com verificação de papel.

## Cuidados com dados e segurança

- A página pública acessa somente registros publicados, conforme as políticas de acesso do Supabase.
- Criar, editar, publicar e apagar são operações exclusivas de administradores autorizados.
- Ofertas vencidas são arquivadas, não apagadas automaticamente. Excluir ofertas do arquivo e excluir campanhas de cupons são ações permanentes; faça backup antes de ativar a rotina.
- Ofertas podem mudar de preço, estoque, regras e disponibilidade. Confira as condições diretamente na loja.
- Links de afiliado podem gerar comissão para manter o projeto.
- O envio para o WhatsApp exige confirmação humana; abrir o compartilhamento **não envia automaticamente** mensagens a um grupo.

## Fluxo de desenvolvimento

`feature branch → dev → Pull Request → main → GitHub Pages`

A `main` representa a produção. As melhorias são desenvolvidas e testadas em branches separadas antes da integração.

## Próximas melhorias

Automação de manutenção com acompanhamento, aprimoramento de acessibilidade e testes, melhoria das buscas, relatórios administrativos e evolução contínua do catálogo.

---

**Projeto Muitas Ofertas** — aprendizado prático com foco em ferramentas gratuitas e evolução gradual.
