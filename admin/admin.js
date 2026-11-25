
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = "https://gtifivpqkmuofhdnkotn.supabase.co";
const SUPABASE_KEY = "sb_publishable_5NSEEZgb_TsEucB0-_OCog_re5mvf-O";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = id => document.getElementById(id);

const formularioLogin = $("form-login");
const formularioProduto = $("form-produto");
const painel = $("painel");
const botaoEntrar = $("btn-entrar");
const botaoSalvar = $("btn-salvar");

let ofertas = [];
let produtoEmEdicao = null;
let somentePendentes = false;
let buscaImagemSeq = 0, timerImagem, controleImagem, imagemAuto = '';
const CATEGORIAS_BASE = ['Eletrônicos','Smartphones','Moda e Acessórios','Casa e Decoração','Informática','Casa'];
const NOVA_CATEGORIA = '__nova__';
function atualizarCategorias() {
  const select = $('categoria-lista'), valor = $('categoria').value.trim();
  const nomes = [...new Set([...CATEGORIAS_BASE, ...ofertas.map(p => (p.categoria || '').trim()).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  select.replaceChildren(new Option('Selecione uma categoria',''), ...nomes.map(n => new Option(n,n)), new Option('+ Nova categoria',NOVA_CATEGORIA));
  select.value = nomes.includes(valor) ? valor : valor ? NOVA_CATEGORIA : '';
  $('categoria').hidden = select.value !== NOVA_CATEGORIA;
}
$('categoria-lista').addEventListener('change',()=>{
  const valor = $('categoria-lista').value;
  $('categoria').value = valor === NOVA_CATEGORIA ? '' : valor;
  $('categoria').hidden = valor !== NOVA_CATEGORIA;
  if (! $('categoria').hidden) $('categoria').focus();
});
function atualizarPendencias() {
  const total = ofertas.filter(p=>!p.publicado).length;
  $('aviso-pendencias').hidden = total === 0 && !somentePendentes;
  $('texto-pendencias').textContent = total === 1 ? 'Você tem 1 oferta aguardando publicação.' : `Você tem ${total} ofertas aguardando publicação.`;
  $('btn-pendentes').textContent = somentePendentes ? 'Ver todas' : 'Ver pendentes';
}
$('btn-pendentes').addEventListener('click',()=>{ somentePendentes=!somentePendentes; atualizarPendencias(); filtrarOfertas(); $('status-lista').scrollIntoView({block:'center',behavior:'smooth'}); });
function cancelarBuscaImagem() { ++buscaImagemSeq; clearTimeout(timerImagem); controleImagem?.abort(); }
function mostrarPrevia(url, seq=buscaImagemSeq) {
  const foto=$('imagem-previa'), status=$('imagem-status');
  foto.hidden=true; foto.removeAttribute('src'); foto.onload=null; foto.onerror=null;
  if (!url) { status.textContent='Aguardando imagem.'; return; }
  try { url=validarUrl(url); } catch { status.textContent='Informe uma URL HTTPS válida.'; return; }
  status.textContent='Carregando prévia da imagem...';
  foto.referrerPolicy='no-referrer';
  foto.onload=()=>{ if(seq===buscaImagemSeq){foto.hidden=false;status.textContent='Imagem carregada. Confira antes de salvar.';} };
  foto.onerror=()=>{ if(seq===buscaImagemSeq){foto.hidden=true;status.textContent='Não foi possível abrir a imagem. Informe outra URL autorizada.';} };
  foto.src=url;
}
async function buscarImagem(seq, link) {
  if(seq!==buscaImagemSeq) return;
  const status=$('imagem-status'); status.textContent='Buscando imagem do produto...';
  const ctrl=new AbortController(); controleImagem=ctrl;
  const prazo=setTimeout(()=>ctrl.abort(),12000);
  try {
    const r=await fetch('https://muitas-ofertas-imagens.mattosde.workers.dev/?url='+encodeURIComponent(link),{signal:ctrl.signal});
    const dados=await r.json();
    if(seq!==buscaImagemSeq) return;
    if(!r.ok || !dados.sucesso || !dados.imagem) throw new Error(dados.erro || dados.mensagem || 'Imagem não localizada');
    const url=validarUrl(dados.imagem);
    imagemAuto=url; $('imagem').value=url; mostrarPrevia(url,seq);
  } catch(erro) { if(seq===buscaImagemSeq) status.textContent='Não foi possível buscar automaticamente. Cole a URL da imagem. '+(erro.name==='AbortError'?'Tempo de consulta esgotado.':erro.message); }
  finally {clearTimeout(prazo);}
}
function agendarImagem(){
  cancelarBuscaImagem();
  // Ao trocar o link, não reutilizar a imagem de outro produto.
  $('imagem').value=''; imagemAuto=''; mostrarPrevia('');
  let link; try {link=validarUrl($('link').value);} catch {return;}
  const seq=buscaImagemSeq;
  $('imagem-status').textContent='Aguardando busca automática...';
  timerImagem=setTimeout(()=>buscarImagem(seq,link),450);
}
$('link').addEventListener('input',agendarImagem);
$('imagem').addEventListener('input',()=>{cancelarBuscaImagem(); imagemAuto=''; mostrarPrevia($('imagem').value);});
atualizarCategorias();

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function informar(elemento, texto, tipo = "") {
  elemento.textContent = texto;
  elemento.className = tipo;
}

function mostrarLogin() {
  painel.style.display = "none";
  formularioLogin.style.display = "block";
  $("senha").value = "";
}

function mostrarPainel(usuario) {
  formularioLogin.style.display = "none";
  painel.style.display = "block";

  $("usuario-logado").textContent =
    "Administrador: " + usuario.email;

  informar($("mensagem"), "");
  carregarOfertas();
}

// VERIFICAR PERMISSÃO
async function verificarAdministrador(usuario) {
  if (!usuario) {
    mostrarLogin();
    return false;
  }

  const { data, error } = await supabase
    .from("perfis")
    .select("papel")
    .eq("id", usuario.id)
    .single();

  if (error || data?.papel !== "admin") {
    await supabase.auth.signOut();

    mostrarLogin();
    informar(
      $("mensagem"),
      "Acesso administrativo não autorizado.",
      "erro"
    );

    return false;
  }

  mostrarPainel(usuario);
  return true;
}

// LOGIN
formularioLogin.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    botaoEntrar.disabled = true;
    informar($("mensagem"), "Autenticando...");

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: $("email").value.trim(),
          password: $("senha").value
        });

      if (error) {
        mostrarLogin();
        throw new Error("Credenciais inválidas.");
      }

      await verificarAdministrador(data.user);

    } catch (erro) {
      informar(
        $("mensagem"),
        erro.message || "Erro de autenticação.",
        "erro"
      );
    } finally {
      botaoEntrar.disabled = false;
    }
  }
);

// FORMATAR PREÇO
function converterPreco(valor) {
  let texto = valor.trim().replace(/\s/g, "");

  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(texto)) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d{1,2}$/.test(texto)) {
    texto = texto.replace(",", ".");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    throw new Error("Preço inválido. Exemplo: 228,00");
  }

  const preco = Number(texto);

  if (!Number.isFinite(preco) || preco <= 0) {
    throw new Error("Informe um preço maior que zero.");
  }

  return preco;
}

// VALIDAR LINKS
function validarUrl(valor) {
  let url;

  try {
    url = new URL(valor.trim());
  } catch {
    throw new Error("Informe uma URL válida.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Use um endereço HTTPS.");
  }

  return url.href;
}

// VOLTAR AO MODO CADASTRO
function limparEdicao() {
  produtoEmEdicao = null;
  cancelarBuscaImagem(); imagemAuto='';
  formularioProduto.reset();
  atualizarCategorias(); mostrarPrevia('');

  $("titulo-formulario").textContent =
    "➕ Cadastrar nova oferta";

  $("btn-salvar").textContent = "Salvar oferta";

  $("btn-cancelar").style.display = "none";
  $("aviso-edicao").hidden = true;
}

// EDITAR PRODUTO
function editarProduto(produto) {
  produtoEmEdicao = produto.id;

  $("nome").value = produto.nome;
  $("preco").value = Number(produto.preco)
    .toFixed(2).replace(".", ",");
  $("loja").value = produto.loja;
  $("categoria").value = produto.categoria || "";
  atualizarCategorias();
  $("link").value = produto.link;
  cancelarBuscaImagem(); imagemAuto='';
  $("imagem").value = produto.imagem || "";
  if (produto.imagem) mostrarPrevia(produto.imagem);
  else { mostrarPrevia(''); const seq=buscaImagemSeq; try { buscarImagem(seq,validarUrl(produto.link)); } catch {} }
  $("codigo-cupom").value = produto.codigo_cupom || "";

  $("titulo-formulario").textContent =
    "✏️ Editar oferta";

  $("btn-salvar").textContent = "Salvar alterações";

  $("btn-cancelar").style.display = "block";
  $("aviso-edicao").hidden = false;

  informar($("resultado"), "");

  $("titulo-formulario").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  $("nome").focus({ preventScroll: true });
}

$("btn-cancelar").addEventListener("click", () => {
  limparEdicao();
  informar($("resultado"), "Edição cancelada.");
});

// CADASTRAR OU ATUALIZAR PRODUTO
formularioProduto.addEventListener(
  "submit",
  async (evento) => {
    evento.preventDefault();

    cancelarBuscaImagem();
    botaoSalvar.disabled = true;
    informar($("resultado"), "Salvando...");

    try {
      const { data: { user }, error: erroUsuario } =
        await supabase.auth.getUser();

      if (erroUsuario || !user) {
        mostrarLogin();
        throw new Error("Sessão expirada.");
      }

      const { data: perfil, error: erroPerfil } =
        await supabase
          .from("perfis")
          .select("papel")
          .eq("id", user.id)
          .single();

      if (erroPerfil || perfil?.papel !== "admin") {
        throw new Error("Acesso não autorizado.");
      }

      const produto = {
        nome: $("nome").value.trim(),
        preco: converterPreco($("preco").value),
        loja: $("loja").value,
        categoria: $("categoria").value.trim() || null,
        link: validarUrl($("link").value),
        codigo_cupom: $("codigo-cupom").value.trim() || null,
        imagem: $("imagem").value.trim()
          ? validarUrl($("imagem").value)
          : null
      };

      const editando = produtoEmEdicao !== null;

      let resultado;

      if (editando) {
        // Atualiza apenas o produto selecionado
        resultado = await supabase
          .from("produtos")
          .update({
            ...produto,
            atualizado_em: new Date().toISOString()
          })
          .eq("id", produtoEmEdicao)
          .select("id")
          .single();

      } else {
        // Cadastra como rascunho
        resultado = await supabase
          .from("produtos")
          .insert({
            ...produto,
            publicado: false
          })
          .select("id")
          .single();
      }

      if (resultado.error) {
        console.error(resultado.error);
        throw new Error(
          "Não foi possível salvar no Supabase."
        );
      }

      limparEdicao();

      informar(
        $("resultado"),
        editando
          ? "✅ Oferta atualizada com sucesso!"
          : "✅ Oferta cadastrada como rascunho!",
        "sucesso"
      );

      await carregarOfertas();

    } catch (erro) {
      informar(
        $("resultado"),
        erro.message || "Erro ao salvar.",
        "erro"
      );
    } finally {
      botaoSalvar.disabled = false;
    }
  }
);

// GERAR MENSAGEM DO WHATSAPP
function gerarMensagem(produto) {
  const preco = moeda.format(produto.preco);

  return [
    `🛍️ ${produto.nome}`,
    "",
    `👉 Veja esta oferta em ${produto.loja}`,
    "",
    `💰 ${preco}`,
    ...(produto.codigo_cupom ? ["", `🎟️ Cupom: ${produto.codigo_cupom}`] : []),
    "",
    `🔗 ${produto.link}`,
    "",
    "#publi - Comprando pelo link você economiza e ajuda nosso trabalho.",
    "Produto sujeito a alterações de preço e estoque"
  ].join("\n");
}

async function copiarMensagem(produto) {
  const mensagem = gerarMensagem(produto);

  try {
    await navigator.clipboard.writeText(mensagem);
    alert("Mensagem copiada! Cole no WhatsApp.");
  } catch (erro) {
    console.error(erro);
    alert("Não foi possível copiar a mensagem.");
  }
}

// CRIAR CARD VISUAL
function criarCard(produto) {
  const card = document.createElement("article");
  card.className = "card-produto";

  const nome = document.createElement("h4");
  nome.textContent = produto.nome;

  const preco = document.createElement("p");
  preco.className = "destaque";
  preco.textContent = moeda.format(produto.preco);

  const detalhes = document.createElement("p");
  detalhes.className = "info";
  detalhes.textContent = [
    produto.loja,
    produto.categoria || "Sem categoria"
  ].join(" | ");

  const situacao = document.createElement("p");
  situacao.textContent = produto.publicado
    ? "🟢 Publicado"
    : "🟡 Rascunho";

  const acoes = document.createElement("div");
  acoes.className = "acoes";

  const botaoEditar = document.createElement("button");
  botaoEditar.type = "button";
  botaoEditar.textContent = "✏️ Editar";

  botaoEditar.addEventListener("click", () => {
    editarProduto(produto);
  });

  const botaoWhatsApp = document.createElement("button");
  botaoWhatsApp.type = "button";
  botaoWhatsApp.textContent = "📋 Copiar WhatsApp";
  botaoWhatsApp.className = "secundario";

  botaoWhatsApp.addEventListener("click", () => {
    copiarMensagem(produto);
  });

  // Publicar ou tirar do ar: mantém o cadastro, sem apagar a oferta.
  const botaoPublicar = document.createElement("button");
  botaoPublicar.type = "button";
  botaoPublicar.textContent = produto.publicado
    ? "📥 Tirar do ar"
    : "🚀 Publicar";
  botaoPublicar.className = produto.publicado ? "secundario" : "";

  botaoPublicar.addEventListener("click", async () => {
    const novoStatus = !Boolean(produto.publicado);
    botaoPublicar.disabled = true;
    informar($("resultado"), novoStatus ? "Publicando oferta..." : "Retirando oferta do ar...");

    try {
      // Confirmar a sessão e o papel do usuário antes de enviar a alteração.
      // A proteção definitiva deve ser reforçada pelas políticas RLS do banco.
      const { data: usuarioDados, error: erroUsuario } = await supabase.auth.getUser();
      const usuario = usuarioDados?.user;
      if (erroUsuario || !usuario) throw new Error("Faça login novamente.");

      const { data: perfil, error: erroPerfil } = await supabase
        .from("perfis")
        .select("papel")
        .eq("id", usuario.id)
        .single();
      if (erroPerfil || perfil?.papel !== "admin") {
        throw new Error("Seu usuário não tem permissão de administrador.");
      }

      const { data: alterado, error } = await supabase
        .from("produtos")
        .update({
          publicado: novoStatus,
          atualizado_em: new Date().toISOString()
        })
        .eq("id", produto.id)
        .eq("publicado", Boolean(produto.publicado))
        .select("id, publicado")
        .single();
      if (error || !alterado || alterado.publicado !== novoStatus) {
        throw new Error("Não foi possível alterar a publicação. Verifique as permissões RLS.");
      }

      informar($("resultado"), novoStatus
        ? "✅ Oferta publicada com sucesso!"
        : "✅ Oferta retirada do ar!", "sucesso");
      await carregarOfertas();
    } catch (erro) {
      console.error("Erro ao publicar/despublicar:", erro);
      informar($("resultado"), erro.message || "Erro ao atualizar publicação.", "erro");
      botaoPublicar.disabled = false;
    }
  });

  // MO-ADMIN-WHATSAPP-GRUPO-2026
  // O link abre a tela de compartilhamento, sem enviar automaticamente.
  const enviarAoGrupo = document.createElement("button");
  enviarAoGrupo.type = "button";
  enviarAoGrupo.className = "secundario";
  enviarAoGrupo.textContent = "📲 Abrir no WhatsApp";
  enviarAoGrupo.title = produto.publicado
    ? "Selecione o grupo Muitas Ofertas e confirme o envio no WhatsApp"
    : "Publique a oferta antes de divulgá-la no grupo";
  enviarAoGrupo.disabled = !produto.publicado;
  enviarAoGrupo.addEventListener("click", () => {
    // O navegador não tem permissão para enviar diretamente ao grupo existente.
    const url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(gerarMensagem(produto));
    window.open(url, "_blank", "noopener,noreferrer");
  });

  acoes.append(botaoEditar, botaoWhatsApp, botaoPublicar, enviarAoGrupo);

  card.append(nome, preco);
  if (produto.codigo_cupom) {
    const visualizacaoCupom = document.createElement("p");
    visualizacaoCupom.className = "info";
    visualizacaoCupom.textContent = `🎟️ Cupom: ${produto.codigo_cupom}`;
    card.appendChild(visualizacaoCupom);
  }
  card.append(detalhes, situacao, acoes);

  return card;
}

// LISTAR OFERTAS
async function carregarOfertas() {
  const lista = $("lista-produtos");
  const status = $("status-lista");

  lista.replaceChildren();
  status.textContent = "Carregando ofertas...";

  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    console.error(error);
    status.textContent =
      "Não foi possível carregar as ofertas.";
    return;
  }

  ofertas = data || [];
  atualizarCategorias(); atualizarPendencias();

  status.textContent = ofertas.length
    ? `${ofertas.length} oferta(s) cadastrada(s)`
    : "Nenhuma oferta cadastrada.";

  
filtrarOfertas();

}

$("btn-atualizar").addEventListener(
  "click",
  carregarOfertas
);

// SAIR
$("btn-sair").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    informar($("resultado"), "Erro ao sair.", "erro");
    return;
  }

  ofertas = []; somentePendentes=false; atualizarPendencias();
  $("lista-produtos").replaceChildren();
  $("status-lista").textContent = "";

  limparEdicao();
  mostrarLogin();

  informar($("mensagem"), "Sessão encerrada.");
});

// RECUPERAR SESSÃO
async function iniciar() {
  try {
    const { data: { user }, error } =
      await supabase.auth.getUser();

    if (error || !user) {
      mostrarLogin();
      return;
    }

    await verificarAdministrador(user);

  } catch (erro) {
    console.error(erro);
    mostrarLogin();

    informar(
      $("mensagem"),
      "Não foi possível verificar sua sessão.",
      "erro"
    );
  }
}

function filtrarOfertas() {
  const termo = $("pesquisar-produto")
    .value.trim().toLocaleLowerCase("pt-BR");

  const encontrados = ofertas.filter(produto => {
    const conteudo = [
      produto.nome,
      produto.loja,
      produto.categoria
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("pt-BR");

    return (!somentePendentes || !produto.publicado) && conteudo.includes(termo);
  });

  const lista = $("lista-produtos");
  lista.replaceChildren();

  encontrados.forEach(produto => {
    lista.appendChild(criarCard(produto));
  });

  $("status-lista").textContent =
    `${encontrados.length} oferta(s) encontrada(s)`;
}

$("pesquisar-produto").addEventListener(
  "input",
  filtrarOfertas
);

iniciar();
