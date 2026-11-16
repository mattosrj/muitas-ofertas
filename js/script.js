// Muitas Ofertas — catálogo público ligado ao Supabase.
// Gerado pelo instalador. Não inserir service_role keys no navegador.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient("https://gtifivpqkmuofhdnkotn.supabase.co", "sb_publishable_5NSEEZgb_TsEucB0-_OCog_re5mvf-O");
const container = document.getElementById("listaProdutos");
const busca = document.getElementById("campoBusca");
const categorias = document.getElementById("listaCategorias");
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const URL_WORKER = "https://muitas-ofertas-imagens.mattosde.workers.dev";
const FAVORITOS_KEY = "muitas-ofertas-favoritos";
let produtos = [];
let categoriaAtual = "Todas";
let favoritos = carregarFavoritos();

function carregarFavoritos() {
  try {
    const dados = JSON.parse(localStorage.getItem(FAVORITOS_KEY) || "[]");
    return new Set(Array.isArray(dados) ? dados.map(String) : []);
  } catch { return new Set(); }
}
function persistirFavoritos() {
  try { localStorage.setItem(FAVORITOS_KEY, JSON.stringify([...favoritos])); }
  catch (erro) { console.warn("Favoritos não puderam ser gravados", erro); }
}
function urlSegura(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}
function tempoDesdeCadastro(valor) {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  const agora = new Date();
  const diaUTC = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.max(0, Math.round((diaUTC(agora) - diaUTC(data)) / 86400000));
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  return `Há ${dias} dias`;
}

function mensagemWhatsApp(produto) {
  return [
    `\u{1F6CD}\uFE0F ${produto.nome}`,
    "",
    `\u{1F449} Veja esta oferta em ${produto.loja}`,
    "",
    `\u{1F4B0} ${moeda.format(produto.preco)}`,
    ...(produto.codigo_cupom
      ? ["", `\u{1F39F}\uFE0F Cupom: ${produto.codigo_cupom}`]
      : []),
    "",
    `\u{1F517} ${produto.link}`,
    "",
    "#publi - Comprando pelo link você economiza e ajuda nosso trabalho.",
    "Produto sujeito a alterações de preço e estoque"
  ].join("\n");
}

function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}
async function copiar(texto, botao) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
    } else {
      const area = document.createElement("textarea");
      area.value = texto;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) throw new Error("Cópia indisponível");
    }
    const original = botao.textContent;
    botao.textContent = "✓ Copiado!";
    setTimeout(() => { if (botao.isConnected) botao.textContent = original; }, 1800);
  } catch (erro) {
    console.error(erro);
    alert("Não foi possível copiar automaticamente. Selecione e copie o código: " + texto);
  }
}
function criarCard(produto) {
  const card = criar("article", "produto");
  const imagem = criar("div", "produto-imagem");
  const origemImagem = urlSegura(produto.imagem);
  const fallback = criar("div", "imagem-fallback", "🛍️");
  if (origemImagem) {
    const foto = criar("img");
    foto.src = origemImagem;
    foto.alt = produto.nome;
    foto.loading = "lazy";
    foto.onerror = () => { foto.remove(); imagem.appendChild(fallback); };
    imagem.appendChild(foto);
  } else {
    imagem.appendChild(fallback);
  }
  card.appendChild(imagem);
  card.appendChild(criar("span", "produto-loja", produto.loja));
  card.appendChild(criar("h3", "", produto.nome));
  card.appendChild(criar("p", "produto-preco", moeda.format(produto.preco)));

  // Exibir o código somente quando preenchido, imediatamente após o preço.
  if (produto.codigo_cupom) {
    const cupom = criar("div", "produto-cupom");
    const texto = criar("span", "", `🎟️ Cupom: ${produto.codigo_cupom}`);
    const botao = criar("button", "botao-copiar-cupom", "Copiar");
    botao.type = "button";
    botao.setAttribute("aria-label", `Copiar cupom ${produto.codigo_cupom}`);
    botao.addEventListener("click", () => copiar(produto.codigo_cupom, botao));
    cupom.append(texto, botao);
    card.appendChild(cupom);
  }
  const tempo = tempoDesdeCadastro(produto.criado_em);
  if (tempo) card.appendChild(criar("p", "produto-tempo", `🕒 ${tempo}`));

  const acoes = criar("div", "produto-acoes");
  const link = urlSegura(produto.link);
  if (link) {
    const abrir = criar("a", "botao-oferta", "Ver oferta");
    abrir.href = link;
    abrir.target = "_blank";
    abrir.rel = "sponsored nofollow noopener noreferrer";
    acoes.appendChild(abrir);
  }
  const compartilhar = criar("a", "botao-whatsapp", "Compartilhar");
  compartilhar.href = "https://api.whatsapp.com/send?text=" + encodeURIComponent(mensagemWhatsApp(produto));
  compartilhar.target = "_blank";
  compartilhar.rel = "noopener noreferrer";
  compartilhar.setAttribute("aria-label", `Compartilhar ${produto.nome} pelo WhatsApp`);
  // Ícone verde de telefone em balão, integrado ao botão de compartilhamento.
  compartilhar.insertAdjacentHTML("afterbegin", '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/><path d="M9 8.5c1 3 3.5 5.4 6.5 6.5l1.1-1.2"/></svg>');
  acoes.appendChild(compartilhar);

  const id = String(produto.id);
  const favorito = criar("button", "botao-favorito", favoritos.has(id) ? "♥" : "♡");
  favorito.type = "button";
  favorito.setAttribute("aria-label", favoritos.has(id) ? "Remover dos favoritos" : "Adicionar aos favoritos");
  favorito.setAttribute("aria-pressed", String(favoritos.has(id)));
  favorito.addEventListener("click", () => {
    if (favoritos.has(id)) favoritos.delete(id);
    else favoritos.add(id);
    persistirFavoritos();
    favorito.textContent = favoritos.has(id) ? "♥" : "♡";
    favorito.setAttribute("aria-label", favoritos.has(id) ? "Remover dos favoritos" : "Adicionar aos favoritos");
    favorito.setAttribute("aria-pressed", String(favoritos.has(id)));
  });
  acoes.appendChild(favorito);
  card.appendChild(acoes);
  return card;
}
function desenharCategorias() {
  if (!categorias) return;
  const valores = ["Todas", ...new Set(produtos.map(p => p.categoria).filter(Boolean))];
  if (!valores.includes(categoriaAtual)) categoriaAtual = "Todas";
  categorias.replaceChildren();
  valores.forEach(nome => {
    const botao = criar("button", "categoria" + (nome === categoriaAtual ? " ativa" : ""), nome);
    botao.type = "button";
    botao.dataset.categoria = nome;
    botao.addEventListener("click", () => {
      categoriaAtual = nome;
      desenharCategorias();
      filtrarProdutos();
    });
    categorias.appendChild(botao);
  });
}
function filtrarProdutos() {
  if (!container) return;
  const termo = (busca?.value || "").trim().toLocaleLowerCase("pt-BR");
  const filtrados = produtos.filter(produto => {
    const procura = [produto.nome, produto.loja, produto.categoria, produto.codigo_cupom]
      .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return (categoriaAtual === "Todas" || produto.categoria === categoriaAtual) && procura.includes(termo);
  });
  container.replaceChildren();
  if (!filtrados.length) {
    const texto = produtos.length
      ? "Nenhuma oferta corresponde à sua pesquisa."
      : "Ainda não há ofertas publicadas. Volte em breve!";
    container.appendChild(criar("p", "catalogo-vazio", texto));
    return;
  }
  filtrados.forEach(produto => container.appendChild(criarCard(produto)));
}
async function carregarOfertasPublicadas() {
  if (!container) return;
  container.replaceChildren(criar("p", "catalogo-vazio", "Carregando ofertas..."));
  const { data, error } = await supabase
    .from("produtos")
    .select("id,nome,preco,loja,categoria,link,imagem,codigo_cupom,criado_em")
    .eq("publicado", true)
    .order("criado_em", { ascending: false });
  if (error) {
    console.error("Falha ao carregar ofertas publicadas:", error);
    container.replaceChildren(criar("p", "catalogo-vazio", "Não foi possível carregar as ofertas agora."));
    return;
  }
  produtos = data || [];
  desenharCategorias();
  filtrarProdutos();
  // Tenta preencher imagens sem URL; falhas do serviço externo não impedem o catálogo.
  Promise.all(produtos.map(async produto => {
    if (produto.imagem || !urlSegura(produto.link)) return;
    try {
      const resposta = await fetch(URL_WORKER + "?url=" + encodeURIComponent(produto.link));
      if (!resposta.ok) return;
      const json = await resposta.json();
      const imagem = urlSegura(json.imagem);
      if (json.sucesso && imagem) { produto.imagem = imagem; filtrarProdutos(); }
    } catch (erro) { console.debug("Prévia de imagem indisponível", erro); }
  })).catch(console.error);
}
if (busca) busca.addEventListener("input", filtrarProdutos);
carregarOfertasPublicadas();
