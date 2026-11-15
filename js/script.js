
const produtos = [
    {
        nome: "Fone Bluetooth",
        categoria: "Eletrônicos",
        preco: 59.90,
        loja: "Mercado Livre",
        icone: "🎧",
        imagem: "https://http2.mlstatic.com/D_NQ_NP_2X_980003-MLA118040140302_102026-F.webp",
        link: ""
    },
    {
        nome: "Air Fryer",
        categoria: "Casa",
        preco: 299.90,
        loja: "Amazon",
        icone: "🍟",
        imagem: "",
        link: ""
    },
    {
        nome: "Teclado Gamer",
        categoria: "Informática",
        preco: 89.90,
        loja: "Shopee",
        icone: "⌨️",
        imagem: "",
        link: ""
    },
    {
        nome: "Caixa de Som",
        categoria: "Eletrônicos",
        preco: 79.90,
        loja: "Mercado Livre",
        icone: "🔊",
        imagem: "",
        link: ""
    },  
    {
        nome: "Tênis Ultimashow 2.0 Adidas",
        categoria: "Moda",
        preco: 228,
        loja: "Mercado Livre",
        icone: "👟",
        imagem: "",
        link: "https://meli.la/1gLBJdV"
    },

];


const listaProdutos = document.getElementById("listaProdutos");
const campoBusca = document.getElementById("campoBusca");
const botoesCategoria = document.querySelectorAll(".categoria");

let categoriaSelecionada = "Todas";

function formatarPreco(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caractere]);
}

function urlSegura(endereco) {
    try {
        const url = new URL(endereco);
        return url.protocol === "https:" ? url.href : "";
    } catch {
        return "";
    }
}

function mostrarProdutos(lista = produtos) {
    const container = document.getElementById("listaProdutos");

    container.innerHTML = "";

    lista.forEach(produto => {
        const imagemSegura = urlSegura(produto.imagem);
        const linkSeguro = urlSegura(produto.link);

        const imagemHTML = imagemSegura
            ? `
                <img
                    src="${escaparHTML(imagemSegura)}"
                    alt="${escaparHTML(produto.nome)}"
                    loading="lazy"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='grid'"
                >
                <div class="imagem-fallback" style="display:none">
                    ${escaparHTML(produto.icone)}
                </div>
            `
            : `
                <div class="imagem-fallback">
                    ${escaparHTML(produto.icone)}
                </div>
            `;

        const botaoHTML = linkSeguro
            ? `
                <a
                    href="${escaparHTML(linkSeguro)}"
                    target="_blank"
                    rel="sponsored nofollow noopener noreferrer"
                    class="botao-oferta"
                >
                    Ver oferta
                </a>
            `
            : `
                <span class="link-pendente">
                    Link de afiliado pendente
                </span>
            `;

        const card = document.createElement("div");
        card.className = "produto";

        card.innerHTML = `
            <div class="produto-imagem">
                ${imagemHTML}
            </div>

            <span class="produto-loja">
                ${escaparHTML(produto.loja)}
            </span>

            <h3>${escaparHTML(produto.nome)}</h3>

            <p class="produto-preco">
                ${formatarPreco(produto.preco)}
            </p>

            ${botaoHTML}
        `;

        container.appendChild(card);
    });
}


function filtrarProdutos() {
    const busca = campoBusca.value.toLowerCase().trim();

    const filtrados = produtos.filter(produto => {
        const correspondeBusca =
            produto.nome.toLowerCase().includes(busca);

        const correspondeCategoria =
            categoriaSelecionada === "Todas" ||
            produto.categoria === categoriaSelecionada;

        return correspondeBusca && correspondeCategoria;
    });

    mostrarProdutos(filtrados);
}

botoesCategoria.forEach(botao => {
    botao.addEventListener("click", () => {
        botoesCategoria.forEach(b =>
            b.classList.remove("ativa")
        );

        botao.classList.add("ativa");

        categoriaSelecionada = botao.dataset.categoria;

        filtrarProdutos();
    });
});

campoBusca.addEventListener("input", filtrarProdutos);

mostrarProdutos(produtos);

const URL_WORKER = "https://muitas-ofertas-imagens.mattosde.workers.dev";

async function carregarImagensAutomaticas() {
  await Promise.all(produtos.map(async (produto) => {
    // Preserva imagens cadastradas manualmente
    if (produto.imagem || !produto.link) return;

    try {
      const endpoint = URL_WORKER +
        "?url=" + encodeURIComponent(produto.link);

      const resposta = await fetch(endpoint);

      if (!resposta.ok) return;

      const dados = await resposta.json();

      if (dados.sucesso && dados.imagem) {
        const endereco = new URL(dados.imagem);

        if (endereco.protocol === "https:") {
          produto.imagem = endereco.href;
        }
      }
    } catch (erro) {
      console.warn(
        "Imagem não encontrada:",
        produto.nome,
        erro
      );
    }
  }));

  // Atualiza os cards respeitando a busca e os filtros
  filtrarProdutos();
}

carregarImagensAutomaticas();
