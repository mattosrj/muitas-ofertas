// Vitrine pública de campanhas de cupons. Leitura sujeita às políticas RLS do Supabase.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {tituloDaCampanha, configurarImagem, dataCupom, normalizarObservacoes} from './cupons-utils.js?v=20261125v3';
const supabase=createClient('https://gtifivpqkmuofhdnkotn.supabase.co','sb_publishable_5NSEEZgb_TsEucB0-_OCog_re5mvf-O');
const $=id=>document.getElementById(id);
let campanhas=[], itensPorCampanha=new Map();
function criar(tag,classe,texto) {
  const el=document.createElement(tag);
  if (classe) el.className=classe;
  if (texto!==undefined) el.textContent=texto;
  return el;
}
function linkHttps(valor) {
  try {const u=new URL(valor);return u.protocol==='https:'?u.href:'';}catch{return '';}
}
async function copiar(texto,botao) {
  try {
    await navigator.clipboard.writeText(texto);
    const anterior=botao.textContent;
    botao.textContent='✓ Copiado!';
    setTimeout(()=>{if(botao.isConnected)botao.textContent=anterior;},2000);
  }catch{alert('Copie manualmente: '+texto);}
}
function criarLink(href,texto) {
  const a=criar('a','abrir',texto);
  a.href=href; a.target='_blank'; a.rel='nofollow sponsored noopener noreferrer';
  return a;
}
// Links nas observações são criados como elementos, sem injetar HTML do usuário.
function anexarComLinks(elemento, texto) {
  const urlRegex = /https:\/\/[^\s<>]+/g;
  let inicio = 0;
  for (const achado of texto.matchAll(urlRegex)) {
    const pos = achado.index;
    if (pos > inicio) elemento.append(document.createTextNode(texto.slice(inicio, pos)));
    const encontrado = achado[0];
    const urlTexto = encontrado.replace(/[),.;!?]+$/, '');
    const pontuacao = encontrado.slice(urlTexto.length);
    const endereco = linkHttps(urlTexto);
    if (endereco) {
      const link = criar('a', '', urlTexto);
      link.href = endereco;
      link.target = '_blank';
      link.rel = 'nofollow sponsored noopener noreferrer';
      elemento.append(link);
    } else {
      elemento.append(document.createTextNode(urlTexto));
    }
    if (pontuacao) elemento.append(document.createTextNode(pontuacao));
    inicio = pos + encontrado.length;
  }
  if (inicio < texto.length) elemento.append(document.createTextNode(texto.slice(inicio)));
}
function criarObservacoes(campanha) {
  const texto = normalizarObservacoes(campanha.observacoes);
  if (!texto) return null;
  const bloco = criar('section', 'instrucoes-cupom');
  bloco.append(criar('h3', '', '📋 Como aproveitar este cupom'));
  let lista = null;
  for (const linhaBruta of texto.split('\n')) {
    const linha = linhaBruta.trim();
    if (!linha) { lista = null; continue; }
    const etapa = linha.match(/^(\d{1,2})\s*[-–.)]\s*(.+)$/);
    if (etapa) {
      if (!lista) { lista = criar('ol', 'passos-cupom'); bloco.append(lista); }
      const item = criar('li');
      item.value = Number(etapa[1]);
      anexarComLinks(item, etapa[2]);
      lista.append(item);
    } else {
      lista = null;
      const elemento = /^TUTORIAL\s*:/i.test(linha) ? criar('h4') : criar('p');
      anexarComLinks(elemento, linha);
      bloco.append(elemento);
    }
  }
  return bloco;
}
function criarItem(item) {
  const bloco=criar('div','cupom-item');
  if(item.codigo){
    const linha=criar('div','codigo');
    linha.append(criar('strong','',item.codigo));
    const btn=criar('button','botao','Copiar código');
    btn.type='button';btn.addEventListener('click',()=>copiar(item.codigo,btn));
    linha.append(btn);bloco.append(linha);
  }
  bloco.append(criar('p','',item.descricao));
  const link=linkHttps(item.link);
  if(link){const acoes=criar('div','acoes');acoes.append(criarLink(link,'🔗 Resgatar cupom'));bloco.append(acoes);}
  return bloco;
}
function criarCard(campanha) {
  const itens=itensPorCampanha.get(campanha.id)||[];
  const card=criar('article','cartao');
  const imagem=criar('img','cartao-imagem'); imagem.alt=`Cupom da loja ${campanha.loja}`;imagem.loading='lazy';
  configurarImagem(imagem,campanha);
  card.append(imagem);
  const corpo=criar('div','cartao-conteudo');
  corpo.append(criar('p','loja',campanha.loja));
  corpo.append(criar('h2','',tituloDaCampanha(campanha,itens)));
  if(campanha.destaque)corpo.append(criar('p','destaque','🔔 '+campanha.destaque));
  itens.slice(0,4).forEach(i=>corpo.append(criarItem(i)));
  if(itens.length>4){
    const details=criar('details','lista-restante');
    details.append(criar('summary','',`Mostrar mais ${itens.length-4} cupons`));
    itens.slice(4).forEach(i=>details.append(criarItem(i)));
    corpo.append(details);
  }
  const url=linkHttps(campanha.link_ativacao);
  if(url){const div=criar('div','link-geral');div.append(criarLink(url,'🔗 Ver lista / ativar cupons'));corpo.append(div);}
  const validade=dataCupom(campanha.validade);
  if(validade)corpo.append(criar('p','condicoes',`⏰ Validade informada: ${validade}`));
  if(campanha.observacoes){const observacoes=criarObservacoes(campanha);if(observacoes)corpo.append(observacoes);}
  card.append(corpo);return card;
}
function renderizar(){
  const termo=$('buscar-cupom').value.trim().toLocaleLowerCase('pt-BR');
  const loja=$('filtrar-loja').value;
  const filtradas=campanhas.filter(c=>{
    const itens=itensPorCampanha.get(c.id)||[];
    const texto=[c.titulo,c.loja,c.destaque,...itens.map(i=>i.codigo),...itens.map(i=>i.descricao)].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
    return (!loja||loja===c.loja) && texto.includes(termo);
  });
  $('status-cupons').textContent=`${filtradas.length} campanha(s) disponível(is).`;
  const lista=$('lista-cupons');lista.replaceChildren();
  if(!filtradas.length){lista.append(criar('p','vazio','Nenhum cupom disponível para os filtros escolhidos.'));return;}
  filtradas.forEach(c=>lista.append(criarCard(c)));
}
async function carregar(){
  try{
    const {data,error}=await supabase.from('cupons').select('id,titulo,loja,link_ativacao,imagem,destaque,observacoes,validade,criado_em')
      .eq('publicado',true).order('criado_em',{ascending:false});
    if(error)throw error;
    // Oculta campanhas vencidas na vitrine; ficam disponíveis para o admin editar.
    campanhas=(data||[]).filter(c=>!c.validade||new Date(c.validade+'T23:59:59')>=new Date());
    itensPorCampanha=new Map(campanhas.map(c=>[c.id,[]]));
    if(campanhas.length){
      const {data:itens,error:erroItens}=await supabase.from('cupom_itens').select('id,cupom_id,codigo,descricao,link,ordem')
        .in('cupom_id',campanhas.map(c=>c.id)).order('ordem',{ascending:true});
      if(erroItens)throw erroItens;
      for(const i of itens||[]) itensPorCampanha.get(i.cupom_id)?.push(i);
    }
    const lojas=[...new Set(campanhas.map(c=>c.loja))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    $('filtrar-loja').append(...lojas.map(l=>new Option(l,l)));
    renderizar();
  }catch(erro){console.error(erro);$('status-cupons').textContent='Não foi possível carregar os cupons. Tente novamente mais tarde.';}
}
$('buscar-cupom').addEventListener('input',renderizar);
$('filtrar-loja').addEventListener('change',renderizar);
carregar();
