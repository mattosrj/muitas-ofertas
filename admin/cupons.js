// Painel de campanhas de cupons — Muitas Ofertas.
// Usa somente chave PÚBLICA do Supabase. Permissões reais são impostas pela RLS.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { imagemPorLoja, imagemDaCampanha, tituloDaCampanha, mensagemCupom, configurarImagem, normalizarObservacoes } from '../js/cupons-utils.js?v=20261125v3';
const supabase = createClient('https://gtifivpqkmuofhdnkotn.supabase.co', 'sb_publishable_5NSEEZgb_TsEucB0-_OCog_re5mvf-O');
const $ = id => document.getElementById(id);
const LOJA_OUTRA = 'Outra';
let campanhas = [];
let itensPorCampanha = new Map();
let idEmEdicao = null;
let idsOriginais = new Set();
let bloqueado = false;

function aviso(texto, tipo='info') {
  const el = $('resultado-cupons');
  el.textContent = texto;
  el.className = `aviso ${tipo}`;
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function urlHttps(valor, obrigatoria=false) {
  const texto = String(valor || '').trim();
  if (!texto && !obrigatoria) return null;
  try { const u = new URL(texto); if (u.protocol === 'https:') return u.href; }
  catch { /* valor inválido */ }
  throw new Error('Informe um link HTTPS válido' + (obrigatoria ? ' para ativação.' : '.'));
}
function ajustarOutraLoja() {
  const outra = $('outra-loja');
  outra.hidden = $('loja-cupom').value !== LOJA_OUTRA;
  outra.required = !outra.hidden;
  if (outra.hidden) outra.value = '';
}
$('loja-cupom').addEventListener('change', ajustarOutraLoja);

// Imagens: URL HTTPS fornecida primeiro; arte da loja quando não houver URL ou a foto falhar.
function dadosDaPrevia() {
  let loja = $('loja-cupom').value;
  if (loja === LOJA_OUTRA) loja = $('outra-loja').value.trim() || 'Outra loja';
  return {
    titulo:$('titulo').value.trim(), loja,
    link_ativacao:$('ativacao').value.trim(),
    imagem:$('imagem').value.trim(),
    destaque:$('destaque').value.trim(),
    observacoes:$('observacoes').value.trim(),
    validade:$('validade').value
  };
}
function itensDaPrevia() {
  return [...$('itens-form').children].map(b=>({
    codigo:b.querySelector('.codigo')?.value.trim() || '',
    descricao:b.querySelector('.descricao')?.value.trim() || '',
    link:b.querySelector('.link')?.value.trim() || ''
  })).filter(i=>i.descricao);
}
function atualizarPreviaImagemCupom() {
  configurarImagem($('imagem-previa-cupom'), dadosDaPrevia(), $('texto-imagem-previa'));
}
function atualizarPreviaPostagem() {
  const campanha = dadosDaPrevia();
  const itens = itensDaPrevia();
  $('texto-previa-postagem').textContent = mensagemCupom(campanha, itens);
}
function atualizarPrevias() { atualizarPreviaImagemCupom(); atualizarPreviaPostagem(); }
$('form-campanha').addEventListener('input', atualizarPreviaPostagem);
$('form-campanha').addEventListener('change', atualizarPreviaPostagem);
$('imagem').addEventListener('change', atualizarPreviaImagemCupom);
$('loja-cupom').addEventListener('change', atualizarPreviaImagemCupom);
$('outra-loja').addEventListener('input', atualizarPreviaImagemCupom);
function criarCampo(rotulo, classe, valor='', tipo='text', required=false, max=500) {
  const label = document.createElement('label');
  label.textContent = rotulo;
  const entrada = document.createElement('input');
  entrada.className = classe;
  entrada.type = tipo;
  entrada.value = valor || '';
  entrada.maxLength = max;
  entrada.required = required;
  label.appendChild(entrada);
  return label;
}
function adicionarItem(item={}) {
  const bloco = document.createElement('div');
  bloco.className = 'item-form';
  if (item.id) bloco.dataset.id = item.id;
  const campos = document.createElement('div');
  campos.className = 'duas-colunas';
  campos.append(
    criarCampo('Código (opcional)', 'codigo', item.codigo, 'text', false, 90),
    criarCampo('Descrição / desconto *', 'descricao', item.descricao, 'text', true, 400),
    criarCampo('Link direto deste cupom (opcional)', 'link', item.link, 'url', false, 1500)
  );
  const remover = document.createElement('button');
  remover.type = 'button'; remover.textContent = 'Remover este cupom';
  remover.className = 'botao remover';
  remover.addEventListener('click', () => {
    if ($('itens-form').children.length <= 1) {
      aviso('A campanha precisa ter pelo menos um cupom.', 'erro');
      return;
    }
    bloco.remove();
    atualizarPreviaPostagem();
  });
  bloco.append(campos, remover);
  $('itens-form').appendChild(bloco);
  atualizarPreviaPostagem();
}
$('adicionar-item').addEventListener('click', () => adicionarItem());

function novoCadastro() {
  idEmEdicao = null;
  idsOriginais = new Set();
  $('form-campanha').reset();
  $('itens-form').replaceChildren();
  adicionarItem();
  $('titulo-formulario').textContent = '➕ Nova campanha';
  $('salvar').textContent = 'Salvar como rascunho';
  $('cancelar').hidden = true;
  ajustarOutraLoja();
  atualizarPrevias();
}
$('cancelar').addEventListener('click', () => { novoCadastro(); aviso('Edição cancelada.'); });

function coletarItens() {
  const blocos = [...$('itens-form').children];
  if (!blocos.length) throw new Error('Adicione pelo menos um cupom.');
  return blocos.map((bloco, ordem) => {
    const codigo = bloco.querySelector('.codigo').value.trim();
    const descricao = bloco.querySelector('.descricao').value.trim();
    const link = urlHttps(bloco.querySelector('.link').value);
    if (descricao.length < 2) throw new Error(`Preencha a descrição do cupom ${ordem + 1}.`);
    return {id:bloco.dataset.id || undefined, codigo:codigo || null, descricao, link, ordem};
  });
}
function coletarCampanha(itens) {
  let loja = $('loja-cupom').value;
  if (loja === LOJA_OUTRA) loja = $('outra-loja').value.trim();
  if (!loja) throw new Error('Selecione uma loja.');
  const titulo = $('titulo').value.trim();
  const link_ativacao = urlHttps($('ativacao').value);
  return {
    titulo:titulo || tituloDaCampanha({loja}, itens), loja, link_ativacao,
    imagem:urlHttps($('imagem').value),
    destaque:$('destaque').value.trim() || null,
    observacoes:$('observacoes').value.trim() || null,
    validade:$('validade').value || null,
    atualizado_em:new Date().toISOString()
  };
}
function editarCampanha(campanha) {
  idEmEdicao = campanha.id;
  $('titulo').value = campanha.titulo;
  $('ativacao').value = campanha.link_ativacao || '';
  $('imagem').value = campanha.imagem || '';
  $('destaque').value = campanha.destaque || '';
  $('observacoes').value = campanha.observacoes || '';
  $('validade').value = campanha.validade || '';
  const lojas = [...$('loja-cupom').options].map(o => o.value);
  if (lojas.includes(campanha.loja)) {
    $('loja-cupom').value = campanha.loja;
  } else {
    $('loja-cupom').value = LOJA_OUTRA;
  }
  ajustarOutraLoja();
  if ($('loja-cupom').value === LOJA_OUTRA) $('outra-loja').value = campanha.loja;
  atualizarPrevias();
  const itens = itensPorCampanha.get(campanha.id) || [];
  idsOriginais = new Set(itens.map(i=>i.id));
  $('itens-form').replaceChildren();
  (itens.length ? itens : [{}]).forEach(adicionarItem);
  $('titulo-formulario').textContent = '✏️ Editar campanha';
  $('salvar').textContent = 'Salvar alterações';
  $('cancelar').hidden = false;
  $('titulo-formulario').scrollIntoView({behavior:'smooth',block:'start'});
}

async function conferirAdmin() {
  const {data:{user},error} = await supabase.auth.getUser();
  if (error || !user) return false;
  const {data:perfil,error:erroPerfil} = await supabase.from('perfis')
    .select('papel').eq('id',user.id).single();
  return !erroPerfil && perfil?.papel === 'admin';
}

$('form-campanha').addEventListener('submit', async evento => {
  evento.preventDefault();
  if (bloqueado) return;
  bloqueado = true;
  $('salvar').disabled = true;
  aviso('Salvando campanha...');
  try {
    if (!await conferirAdmin()) throw new Error('Sessão expirada ou sem permissão de administrador.');
    const itens = coletarItens();
    const dados = coletarCampanha(itens);
    const editando = Boolean(idEmEdicao);
    let id = idEmEdicao;
    if (editando) {
      const {error} = await supabase.from('cupons').update(dados).eq('id',id);
      if (error) throw error;
    } else {
      const {data, error} = await supabase.from('cupons')
        .insert({...dados, publicado:false}).select('id').single();
      if (error || !data) throw error || new Error('Não retornou o ID da campanha.');
      id = data.id;
    }

    // Primeiro grava/atualiza os itens. Só depois remove itens excluídos.
    // Supabase JS não faz transação de duas tabelas; se houver erro, mantenha
    // a campanha como rascunho e revise a lista antes de tentar novamente.
    const payload = itens.map(item => ({
      ...(item.id ? {id:item.id} : {}),
      cupom_id:id,
      codigo:item.codigo,
      descricao:item.descricao,
      link:item.link,
      ordem:item.ordem
    }));
    // Separa inclusões de atualizações. Evita enviar IDs nulos para o banco.
    for (const item of payload.filter(i => i.id)) {
      const {id:itemId, ...alteracoes} = item;
      const {error} = await supabase.from('cupom_itens')
        .update(alteracoes).eq('id',itemId).eq('cupom_id',id);
      if (error) throw error;
    }
    const novos = payload.filter(i => !i.id);
    if (novos.length) {
      const {error} = await supabase.from('cupom_itens').insert(novos);
      if (error) {
        if (!editando) await supabase.from('cupons').delete().eq('id',id).eq('publicado',false);
        throw error;
      }
    }
    const presentes = new Set(itens.map(i => i.id).filter(Boolean));
    const removidos = [...idsOriginais].filter(itemId => !presentes.has(itemId));
    if (removidos.length) {
      const {error:erroRemocao} = await supabase.from('cupom_itens')
        .delete().eq('cupom_id',id).in('id',removidos);
      if (erroRemocao) throw erroRemocao;
    }
    novoCadastro();
    aviso(editando ? '✅ Campanha atualizada com sucesso.' : '✅ Campanha salva como rascunho. Clique em Publicar quando estiver pronta.', 'sucesso');
    await carregarCampanhas();
  } catch (erro) {
    console.error('Erro ao salvar campanha', erro);
    aviso(erro.message || 'Não foi possível salvar a campanha.', 'erro');
  } finally {
    bloqueado = false;
    $('salvar').disabled = false;
  }
});

function mensagemWhatsApp(campanha) {
  return mensagemCupom(campanha, itensPorCampanha.get(campanha.id) || []);
}
async function copiarWhatsApp(campanha) {
  try {
    await navigator.clipboard.writeText(mensagemWhatsApp(campanha));
    aviso('✅ Mensagem copiada. Cole no WhatsApp.', 'sucesso');
  } catch { aviso('Não foi possível copiar automaticamente. Verifique a permissão de área de transferência.', 'erro'); }
}
function criar(tag, classe='', texto) {
  const el = document.createElement(tag);
  if (classe) el.className=classe;
  if (texto != null) el.textContent=texto;
  return el;
}
function criarLinkEnvioWhatsApp(campanha) {
  // Abre seleção de conversas com texto pronto, não envia automaticamente ao grupo.
  const link = criar('a', 'botao principal', '💬 Abrir WhatsApp (texto)');
  link.href = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(mensagemWhatsApp(campanha));
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.title = 'A imagem NÃO acompanha automaticamente este link; use Compartilhar imagem + texto ou Baixar imagem.';
  return link;
}
async function arquivoPngDaCampanha(campanha) {
  const url = imagemDaCampanha(campanha);
  let r;
  try { r = await fetch(url, {mode:'cors'}); }
  catch { throw new Error('A imagem externa não permite download automático (CORS). Abra a imagem manualmente ou use a arte padrão da loja.'); }
  if (!r.ok) throw new Error('Não foi possível baixar a imagem.');
  const blob = await r.blob();
  if (!blob.type.startsWith('image/')) throw new Error('O endereço não retornou uma imagem.');
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap,0,0);
  bitmap.close?.();
  const png = await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha na conversão da imagem.')),'image/png'));
  return new File([png], 'muitas-ofertas-cupom.png',{type:'image/png'});
}
async function baixarImagem(campanha) {
  try {
    const file = await arquivoPngDaCampanha(campanha);
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href=url; a.download=file.name; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
    aviso('✅ Imagem salva. Anexe-a no grupo ao enviar a mensagem.', 'sucesso');
  } catch(erro) {
    const src=imagemDaCampanha(campanha);
    window.open(src,'_blank','noopener,noreferrer');
    aviso(`${erro.message} A imagem foi aberta em outra aba para salvar manualmente.`, 'erro');
  }
}
async function copiarImagem(campanha) {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem==='undefined') throw new Error('Seu navegador não permite copiar imagens.');
    const file=await arquivoPngDaCampanha(campanha);
    await navigator.clipboard.write([new ClipboardItem({'image/png':file})]);
    aviso('✅ Imagem copiada. No WhatsApp, use Ctrl+V na conversa e depois acrescente a mensagem como legenda.', 'sucesso');
  } catch(erro){aviso(erro.message+' Use Baixar imagem como alternativa.','erro');}
}
async function compartilharImagemTexto(campanha, itens) {
  const mensagem = mensagemCupom(campanha,itens);
  try {
    const arquivo = await arquivoPngDaCampanha(campanha);
    if (!navigator.share || !navigator.canShare?.({files:[arquivo]})) throw new Error('Compartilhamento de arquivos não disponível neste navegador.');
    await navigator.share({files:[arquivo],title:tituloDaCampanha(campanha,itens),text:mensagem});
    aviso('Confira no WhatsApp se a foto e o texto apareceram antes de confirmar o envio.','sucesso');
  } catch(erro) {
    if (erro.name==='AbortError') return;
    // Alternativa em PCs: texto para colar e imagem para anexar separadamente.
    try { await navigator.clipboard.writeText(mensagem); }
    catch { /* navegador pode bloquear clipboard */ }
    aviso('Não foi possível enviar imagem e texto juntos por este navegador. Use Copiar mensagem + Baixar imagem; depois anexe a foto no WhatsApp. '+erro.message,'info');
  }
}
$('copiar-previa').addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText($('texto-previa-postagem').textContent);aviso('✅ Mensagem da prévia copiada.','sucesso');}
  catch{aviso('Não foi possível copiar a mensagem.','erro');}
});
$('baixar-previa').addEventListener('click',()=>baixarImagem(dadosDaPrevia()));
$('compartilhar-previa').addEventListener('click',()=>compartilharImagemTexto(dadosDaPrevia(),itensDaPrevia()));
function criarBotao(texto, classe, callback) {
  const btn = criar('button','botao '+classe,texto);
  btn.type='button'; btn.addEventListener('click',callback); return btn;
}

async function alterarPublicacao(campanha) {
  if (bloqueado) return;
  const publicar = !campanha.publicado;
  if (!await conferirAdmin()) { aviso('Acesso administrativo não autorizado.','erro'); return; }
  const itens = itensPorCampanha.get(campanha.id) || [];
  if (publicar && !itens.length) { aviso('Adicione pelo menos um cupom antes de publicar.','erro'); return; }
  bloqueado = true;
  try {
    const {data,error} = await supabase.from('cupons').update({
      publicado:publicar, atualizado_em:new Date().toISOString()
    }).eq('id',campanha.id).eq('publicado',campanha.publicado)
      .select('id,publicado').single();
    if (error || data?.publicado !== publicar) throw error || new Error('Não foi possível confirmar a publicação.');
    aviso(publicar ? '✅ Campanha publicada.' : '✅ Campanha retirada do ar.', 'sucesso');
    await carregarCampanhas();
  } catch (erro) { aviso(erro.message || 'Erro ao atualizar publicação.', 'erro'); }
  finally { bloqueado=false; }
}

function renderizarCampanhas() {
  const termo = $('pesquisar').value.toLocaleLowerCase('pt-BR').trim();
  const filtro = $('filtro-publicacao').value;
  const filtradas = campanhas.filter(c => {
    const itens = itensPorCampanha.get(c.id) || [];
    const pesquisa = [c.titulo,c.loja,...itens.map(i => i.codigo),...itens.map(i=>i.descricao)]
      .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
    return pesquisa.includes(termo) && (filtro==='todas' ||
      (filtro==='publicadas' ? c.publicado : !c.publicado));
  });
  $('contador').textContent = `${campanhas.length} campanha(s) cadastrada(s). ${campanhas.filter(c => !c.publicado).length} rascunho(s).`;
  const lista = $('lista-campanhas');
  lista.replaceChildren();
  if (!filtradas.length) { lista.appendChild(criar('p','vazio','Nenhuma campanha encontrada.')); return; }
  filtradas.forEach(campanha => {
    const card = criar('article','campanha-card');
    const imagem = criar('img','campanha-imagem');
    imagem.alt = `Imagem de cupom ${campanha.loja}`;
    imagem.loading = 'lazy';
    configurarImagem(imagem, campanha);
    card.appendChild(imagem);
    card.appendChild(criar('h3','',tituloDaCampanha(campanha,itensPorCampanha.get(campanha.id)||[])));
    card.appendChild(criar('p','muted',campanha.loja));
    card.appendChild(criar('p','estado '+(campanha.publicado?'ativo':''),campanha.publicado?'🟢 Publicada':'🟡 Rascunho'));
    if (campanha.destaque) card.appendChild(criar('p','',campanha.destaque));
    if (campanha.validade) card.appendChild(criar('p','muted',`Validade informada: ${new Date(campanha.validade+'T12:00:00').toLocaleDateString('pt-BR')}`));
    if (campanha.observacoes) card.appendChild(criar('p','muted observacoes-admin',campanha.observacoes));
    if (campanha.observacoes) card.appendChild(criar('p','muted observacoes-admin',normalizarObservacoes(campanha.observacoes)));
    const ul = criar('ul');
    (itensPorCampanha.get(campanha.id)||[]).forEach(item => ul.appendChild(criar('li','', `${item.codigo ? item.codigo+' — ' : ''}${item.descricao}`)));
    card.appendChild(ul);
    const acoes = criar('div','acoes');
    acoes.append(
      criarBotao('✏️ Editar','secundario',()=>editarCampanha(campanha)),
      criarBotao('📋 Copiar texto','secundario',()=>copiarWhatsApp(campanha)),
      criarBotao('🖼️ Baixar imagem','secundario',()=>baixarImagem(campanha)),
      criarBotao('📸 Copiar imagem','secundario',()=>copiarImagem(campanha)),
      criarBotao('📲 Imagem + texto','principal',()=>compartilharImagemTexto(campanha,itensPorCampanha.get(campanha.id)||[])),
      criarBotao(campanha.publicado?'📥 Tirar do ar':'🚀 Publicar',campanha.publicado?'secundario':'principal',()=>alterarPublicacao(campanha))
    );
    if (campanha.publicado) {
      acoes.appendChild(criarLinkEnvioWhatsApp(campanha));
    } else {
      const aguardando = criarBotao('📲 Publique para compartilhar','secundario',()=>{});
      aguardando.disabled = true;
      aguardando.title = 'Publique a campanha primeiro para habilitar o envio';
      acoes.appendChild(aguardando);
    }
    card.appendChild(acoes);
    lista.appendChild(card);
  });
}
$('pesquisar').addEventListener('input',renderizarCampanhas);
$('filtro-publicacao').addEventListener('change',renderizarCampanhas);
$('atualizar').addEventListener('click',carregarCampanhas);

async function carregarCampanhas() {
  $('contador').textContent = 'Carregando campanhas...';
  try {
    const {data,error} = await supabase.from('cupons').select('*').order('criado_em',{ascending:false});
    if (error) throw error;
    campanhas = data || [];
    itensPorCampanha = new Map(campanhas.map(c => [c.id,[]]));
    if (campanhas.length) {
      const {data:itens,error:erroItens} = await supabase.from('cupom_itens').select('*')
        .in('cupom_id',campanhas.map(c=>c.id)).order('ordem',{ascending:true});
      if (erroItens) throw erroItens;
      for (const item of (itens||[])) itensPorCampanha.get(item.cupom_id)?.push(item);
    }
    renderizarCampanhas();
  } catch (erro) {
    console.error('Erro ao listar campanhas:',erro);
    $('contador').textContent = 'Erro ao carregar campanhas. Confirme que executou o SQL de instalação.';
  }
}

async function iniciar() {
  if (!await conferirAdmin()) {
    $('aviso-sessao').hidden = false;
    return;
  }
  $('painel-cupons').hidden = false;
  novoCadastro();
  await carregarCampanhas();
}
iniciar();
