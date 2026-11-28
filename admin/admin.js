
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
let produtoEmEdicaoOriginal = null;
let somentePendentes = false;
let buscaImagemSeq = 0, timerImagem, controleImagem, imagemAuto = '';
let categoriasAtivas = [];
const NOVA_CATEGORIA = '__nova__';
const normalizarChave = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
function similaridadeTexto(a, b) {
  a = normalizarChave(a); b = normalizarChave(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 5 || b.length < 5) return 0;
  if (Math.min(a.length,b.length) >= 9 && (a.includes(b) || b.includes(a))) return .87;
  const bigramas = s => { const m = new Map(); for(let i=0;i<s.length-1;i++) {const c=s.slice(i,i+2);m.set(c,(m.get(c)||0)+1);} return m; };
  const p=bigramas(a), q=bigramas(b); let inter=0;
  for (const [ch,n] of p) inter+=Math.min(n,q.get(ch)||0);
  return (2*inter)/(a.length+b.length-2);
}
function avisoCategoria() {
  const aviso = $('aviso-categoria-duplicada');
  if ($('categoria-lista').value !== NOVA_CATEGORIA) {aviso.hidden=true; return false;}
  const nome=$('categoria').value.trim();
  const encontrada = categoriasAtivas.find(c=>normalizarChave(c.nome) === normalizarChave(nome));
  aviso.hidden = !encontrada;
  if (encontrada) aviso.textContent=`⚠️ Categoria já cadastrada: ${encontrada.nome}. Selecione-a na lista em vez de criar outra.`;
  return Boolean(encontrada);
}
function atualizarCategorias() {
  const select=$('categoria-lista'), valor=$('categoria').value.trim();
  const nomes=categoriasAtivas.map(c=>c.nome).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const encontrada=nomes.find(n=>normalizarChave(n)===normalizarChave(valor));
  select.replaceChildren(new Option('Selecione uma categoria',''), ...nomes.map(n=>new Option(n,n)), new Option('+ Nova categoria',NOVA_CATEGORIA));
  select.value = encontrada || (valor ? NOVA_CATEGORIA : '');
  $('categoria').hidden=select.value !== NOVA_CATEGORIA;
  atualizarGerenciadorCategorias(); avisoCategoria();
}
function atualizarGerenciadorCategorias() {
  const sel=$('categoria-gerenciar-lista'), idAtual=sel.value;
  sel.replaceChildren(new Option('Selecione',''), ...categoriasAtivas.slice().sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(c=>new Option(c.nome,c.id)));
  sel.value=categoriasAtivas.some(c=>c.id===idAtual)?idAtual:'';
  $('categoria-renomear').value=categoriasAtivas.find(c=>c.id===sel.value)?.nome || '';
  validarNomeGerenciado();
}
async function carregarCategorias() {
  const {data,error}=await supabase.from('categorias').select('id,nome').order('nome');
  if(error) { informar($('resultado'),'Erro ao carregar categorias. Execute primeiro a migração SQL v4 no Supabase.','erro'); throw error; }
  categoriasAtivas=data||[];
  atualizarCategorias();
}
$('categoria-lista').addEventListener('change',()=>{
  const valor=$('categoria-lista').value;
  $('categoria').value=valor===NOVA_CATEGORIA?'':valor;
  $('categoria').hidden=valor!==NOVA_CATEGORIA;
  avisoCategoria();
  if (!$('categoria').hidden) $('categoria').focus();
});
$('categoria').addEventListener('input',avisoCategoria);
function validarNomeGerenciado(){
  const aviso=$('aviso-gerenciar-categoria');
  const escolhido=categoriasAtivas.find(c=>c.id===$('categoria-gerenciar-lista').value);
  const nome=$('categoria-renomear').value.trim();
  const duplicado=nome && categoriasAtivas.find(c=>c.id!==escolhido?.id && normalizarChave(c.nome)===normalizarChave(nome));
  aviso.hidden=!duplicado;
  if(duplicado) aviso.textContent=`⚠️ Já existe a categoria “${duplicado.nome}”.`;
  return Boolean(duplicado);
}
$('categoria-gerenciar-lista').addEventListener('change',()=>{
  $('categoria-renomear').value=categoriasAtivas.find(c=>c.id===$('categoria-gerenciar-lista').value)?.nome||'';
  validarNomeGerenciado();
});
$('categoria-renomear').addEventListener('input',validarNomeGerenciado);
$('btn-renomear-categoria').addEventListener('click', async ()=>{
  const escolhida=categoriasAtivas.find(c=>c.id===$('categoria-gerenciar-lista').value);
  const novo=$('categoria-renomear').value.trim();
  if(!escolhida || !novo || validarNomeGerenciado()) {alert('Escolha uma categoria e informe um nome novo que ainda não exista.');return;}
  if(normalizarChave(escolhida.nome)===normalizarChave(novo)) {alert('O nome continua igual.');return;}
  const n=ofertas.filter(p=>normalizarChave(p.categoria)===normalizarChave(escolhida.nome)).length;
  if(!confirm(`Renomear “${escolhida.nome}” para “${novo}”? ${n} oferta(s) vinculada(s) também terão a categoria atualizada.`)) return;
  try{
    const {error}=await supabase.rpc('mo_editar_categoria',{p_categoria_id:escolhida.id,p_novo_nome:novo});
    if(error) throw error;
    if(normalizarChave($('categoria').value)===normalizarChave(escolhida.nome)) $('categoria').value=novo;
    await carregarCategorias(); await carregarOfertas();
    informar($('resultado'),'✅ Categoria renomeada e ofertas atualizadas.','sucesso');
  }catch(erro){console.error(erro);informar($('resultado'),'Erro ao renomear: '+erro.message,'erro');}
});
$('btn-apagar-categoria').addEventListener('click', async ()=>{
  const escolhida=categoriasAtivas.find(c=>c.id===$('categoria-gerenciar-lista').value);
  if(!escolhida) {alert('Selecione uma categoria.');return;}
  const n=ofertas.filter(p=>normalizarChave(p.categoria)===normalizarChave(escolhida.nome)).length;
  if(!confirm(`APAGAR a categoria “${escolhida.nome}” definitivamente?\n\n${n} oferta(s) serão preservadas, mas ficarão SEM categoria. Essa operação não pode ser desfeita automaticamente.`))return;
  try{
    const {error}=await supabase.rpc('mo_apagar_categoria',{p_categoria_id:escolhida.id});
    if(error) throw error;
    if(normalizarChave($('categoria').value)===normalizarChave(escolhida.nome)) $('categoria').value='';
    await carregarCategorias(); await carregarOfertas();
    informar($('resultado'),'✅ Categoria apagada; ofertas vinculadas foram preservadas, sem categoria.','sucesso');
  }catch(erro){console.error(erro);informar($('resultado'),'Erro ao apagar: '+erro.message,'erro');}
});
let timerDuplicidadeProduto;
function duplicadosProduto(nome) {
  const achados=ofertas.filter(p=>p.id!==produtoEmEdicao).map(p=>({p,nota:similaridadeTexto(p.nome,nome)}))
    .filter(x=>x.nota>=.76).sort((a,b)=>b.nota-a.nota).slice(0,3);
  return achados;
}
function atualizarAvisoProduto() {
  const aviso=$('aviso-duplicidade-produto');
  const nome=$('nome').value.trim();
  const achados=nome.length>=5?duplicadosProduto(nome):[];
  aviso.hidden=!achados.length;
  if(achados.length) aviso.textContent='⚠️ Oferta possivelmente repetida: '+achados.map(({p,nota})=>`“${p.nome}” (${p.publicado?'publicada':'rascunho'}${nota===1?', nome igual':''})`).join(' • ')+'. Confira antes de salvar.';
  return achados;
}
$('nome').addEventListener('input',()=>{clearTimeout(timerDuplicidadeProduto);timerDuplicidadeProduto=setTimeout(atualizarAvisoProduto,200);});

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
  carregarCategorias()
    .then(carregarOfertas)
    .then(abrirOfertaArquivadaDaUrl)
    .catch(erro=>{console.error(erro);informar($("resultado"),"Erro ao abrir oferta: "+erro.message,"erro");});
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
  produtoEmEdicaoOriginal = null;
  cancelarBuscaImagem(); imagemAuto='';
  formularioProduto.reset();
  atualizarCategorias(); mostrarPrevia(''); atualizarAvisoProduto();

  $("titulo-formulario").textContent =
    "➕ Cadastrar nova oferta";

  $("btn-salvar").textContent = "Salvar oferta";

  $("btn-cancelar").style.display = "none";
  $("aviso-edicao").hidden = true;
  $("aviso-edicao").textContent = "✏️ Você está editando uma oferta existente.";
  // Evita reabrir uma oferta já republicada se o Admin for atualizado.
  const endereco = new URL(window.location.href);
  if (endereco.searchParams.has('editar')) {
    endereco.searchParams.delete('editar');
    window.history.replaceState(null, '', endereco.pathname + endereco.search + endereco.hash);
  }
}

// EDITAR PRODUTO
function editarProduto(produto) {
  produtoEmEdicao = produto.id;
  produtoEmEdicaoOriginal = produto;
  const arquivada = Boolean(produto.encerrado_em) && !produto.publicado;
  $("aviso-edicao").textContent = arquivada
    ? "✏️ Oferta fora do ar: ao salvar, ela será republicada automaticamente. Confira se o link ainda está válido."
    : "✏️ Você está editando uma oferta existente.";

  $("nome").value = produto.nome;
  $("preco-anterior").value = produto.preco_anterior != null
    ? Number(produto.preco_anterior).toFixed(2).replace('.', ',') : '';
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

  $("btn-salvar").textContent = arquivada ? "Salvar e republicar" : "Salvar alterações";

  $("btn-cancelar").style.display = "block";
  $("aviso-edicao").hidden = false;

  informar($("resultado"), "");

  $("titulo-formulario").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  atualizarAvisoProduto();
  $("nome").focus({ preventScroll: true });
}

// Entrada direta de uma oferta da página "Publicações fora do ar".
// O ID é validado e o registro só pode ser lido após autenticação/admin/RLS.
async function abrirOfertaArquivadaDaUrl() {
  const id = new URLSearchParams(window.location.search).get('editar');
  if (!id) return;
  $("voltar-fora-ar").hidden = false;
  // IDs no Supabase podem ser numéricos (bigint/serial) ou UUID.
  // Aceitar somente um dos dois formatos evita parâmetros arbitrários na URL.
  const idNumerico = /^[1-9][0-9]{0,18}$/.test(id);
  const idUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!idNumerico && !idUuid) {
    throw new Error('Identificador da oferta inválido.');
  }
  const {data,error}=await supabase.from('produtos').select('*').eq('id',id).maybeSingle();
  if (error) throw error;
  if (!data || data.publicado || !data.encerrado_em) {
    throw new Error('A oferta fora do ar não foi encontrada ou já está publicada.');
  }
  editarProduto(data);
  informar($("resultado"),"Oferta fora do ar carregada. Ao salvar, ela será republicada automaticamente.");
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
        preco_anterior: $("preco-anterior").value.trim()
          ? converterPreco($("preco-anterior").value) : null,
        loja: $("loja").value,
        categoria: $("categoria").value.trim() || null,
        link: validarUrl($("link").value),
        codigo_cupom: $("codigo-cupom").value.trim() || null,
        imagem: $("imagem").value.trim()
          ? validarUrl($("imagem").value)
          : null
      };

      if(produto.preco_anterior!==null && produto.preco_anterior<=produto.preco) {
        throw new Error('O preço anterior deve ser maior que o preço da oferta.');
      }
      if(avisoCategoria()) throw new Error('Esta categoria já existe. Selecione-a na lista.');
      const candidatos=duplicadosProduto(produto.nome);
      if(candidatos.length && !confirm('⚠️ Oferta com nome igual ou parecido já cadastrada:\n'+
        candidatos.map(x=>'• '+x.p.nome).join('\n')+'\n\nDeseja salvar mesmo assim?')) {
        throw new Error('Cadastro cancelado para evitar possível duplicidade.');
      }
      // Categoria nova passa a existir de forma independente das ofertas.
      if(produto.categoria && $('categoria-lista').value===NOVA_CATEGORIA){
        const {error:erroCategoria}=await supabase.from('categorias').insert({nome:produto.categoria});
        if(erroCategoria) throw new Error('Não foi possível criar a categoria: '+erroCategoria.message);
      }
      const editando = produtoEmEdicao !== null;
      const eraArquivada = Boolean(produtoEmEdicaoOriginal?.encerrado_em) && !produtoEmEdicaoOriginal?.publicado;
      // Salvar uma oferta arquivada também a republica, sem exigir alteração no link.
      // O prazo de validade automática é reiniciado pelo trigger de publicação no Supabase.
      const republicar = editando && eraArquivada;

      let resultado;

      if (editando) {
        // Atualiza apenas o produto selecionado
        resultado = await supabase
          .from("produtos")
          .update({
            ...produto,
            ...(republicar ? { publicado: true } : {}),
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
        throw new Error("Não foi possível salvar no Supabase: " + resultado.error.message);
      }

      limparEdicao();

      informar(
        $("resultado"),
        editando
          ? (republicar ? "✅ Oferta editada e republicada!" : "✅ Oferta atualizada com sucesso!")
          : "✅ Oferta cadastrada como rascunho!",
        "sucesso"
      );

      await carregarCategorias();
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
    produto.preco_anterior != null && Number(produto.preco_anterior)>Number(produto.preco)
      ? `💰 De: ~${moeda.format(produto.preco_anterior)}~ por *${preco}*`
      : `💰 ${preco}`,
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
  const precoAnterior=produto.preco_anterior != null && Number(produto.preco_anterior)>Number(produto.preco)
    ? document.createElement('p') : null;
  if(precoAnterior){
    precoAnterior.className='preco-antigo-admin';
    precoAnterior.append('De: ');
    const del=document.createElement('del');del.textContent=moeda.format(produto.preco_anterior);
    precoAnterior.append(del,' por:');
  }

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

  const botaoApagar=document.createElement('button');
  botaoApagar.type='button';botaoApagar.textContent='🗑️ Apagar oferta';botaoApagar.className='acao-perigosa';
  botaoApagar.addEventListener('click',async()=>{
    if(!confirm(`Apagar DEFINITIVAMENTE esta oferta (${produto.publicado?'publicada':'rascunho'})?\n\n${produto.nome}\n\nNão será possível recuperá-la pelo painel.`))return;
    botaoApagar.disabled=true;
    try{
      const {data:{user},error:erroAuth}=await supabase.auth.getUser();
      if(erroAuth||!user)throw new Error('Sessão expirada.');
      const {data,error}=await supabase.from('produtos').delete().eq('id',produto.id).select('id').maybeSingle();
      if(error||!data)throw error||new Error('Exclusão negada. Confira as permissões RLS no Supabase.');
      if(produtoEmEdicao===produto.id)limparEdicao();
      informar($('resultado'),'✅ Oferta apagada.','sucesso');
      await carregarOfertas();
    }catch(erro){console.error(erro);informar($('resultado'),erro.message||'Não foi possível apagar.','erro');botaoApagar.disabled=false;}
  });
  acoes.append(botaoEditar, botaoWhatsApp, botaoPublicar, enviarAoGrupo, botaoApagar);

  card.append(nome, preco);
  if (produto.codigo_cupom) {
    const visualizacaoCupom = document.createElement("p");
    visualizacaoCupom.className = "info";
    visualizacaoCupom.textContent = `🎟️ Cupom: ${produto.codigo_cupom}`;
    card.appendChild(visualizacaoCupom);
  }
  if(precoAnterior) card.appendChild(precoAnterior);
  const dataPublicacao=document.createElement('p');
  dataPublicacao.className='data-publicacao-admin';
  dataPublicacao.textContent=(produto.postagem_em||produto.publicado_em)
    ? `🕒 Publicada em: ${formatarDataPublicacao(produto.postagem_em||produto.publicado_em)}`
    : '🕒 Ainda não publicada';
  const textoValidade=textoValidadeDaOfertaV51(produto);
  if(textoValidade){
    const vencimento=document.createElement('p');
    vencimento.className='data-publicacao-admin';
    vencimento.textContent=textoValidade;
    card.append(detalhes, situacao, dataPublicacao, vencimento, acoes);
  } else {
    card.append(detalhes, situacao, dataPublicacao, acoes);
  }

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

  const todas=data||[];
  const foraDoAr=todas.filter(p=>Boolean(p.encerrado_em));
  ofertas=todas.filter(p=>!p.encerrado_em);
  $('contador-fora-do-ar').textContent=`(${foraDoAr.length})`;
  atualizarCategorias(); atualizarPendencias(); atualizarAvisoProduto();

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

// Validade individual por loja. Mesmas regras do SQL 08 da v5.1.
function textoValidadeDaOfertaV51(produto){
  if(!produto.publicado || !produto.publicado_em) return '';
  const loja=String(produto.loja||'').trim().toLocaleLowerCase('pt-BR');
  const prazosEmHoras={
    'mercado livre':24,
    'amazon':24,
    'magalu':24,
    'shopee':168,
    'shoppee':168,
    'aliexpress':72
  };
  const horas=prazosEmHoras[loja];
  if(!horas) return '⚠️ Loja sem prazo automático configurado.';
  const inicio=Date.parse(produto.publicado_em);
  if(!Number.isFinite(inicio)) return '';
  const fim=new Date(inicio+horas*3600000);
  const quando=fim.toLocaleString('pt-BR',{
    timeZone:'America/Sao_Paulo', dateStyle:'short', timeStyle:'short'
  });
  return (fim.getTime()<=Date.now() ? '⚠️ Prazo vencido em ' : '⏳ Sai do ar em ')+quando;
}

function formatarDataPublicacao(valor){
  if(!valor) return '—';
  return new Date(valor).toLocaleString('pt-BR',{
    timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'
  });
}
function ordenarOfertasPorData(a,b){
  const modo=$('ordenacao-ofertas').value;
  const campo=modo==='cadastro'?'criado_em':'postagem_em';
  const dataA=Date.parse(a[campo]||a.publicado_em||a.criado_em||0)||0;
  const dataB=Date.parse(b[campo]||b.publicado_em||b.criado_em||0)||0;
  return modo==='antigas' ? dataA-dataB : dataB-dataA;
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
  }).sort(ordenarOfertasPorData);

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
$('ordenacao-ofertas').addEventListener('change',filtrarOfertas);

iniciar();
