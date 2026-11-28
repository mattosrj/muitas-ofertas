// Muitas Ofertas v5: consulta de ofertas fora do ar, exclusão em lote só para admin.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const supabase=createClient('https://gtifivpqkmuofhdnkotn.supabase.co','sb_publishable_5NSEEZgb_TsEucB0-_OCog_re5mvf-O');
const $=id=>document.getElementById(id);
let ofertas=[];
const selecionados=new Set();
let bloqueado=false;
const criar=(tag,classe,texto)=>{const e=document.createElement(tag);if(classe)e.className=classe;if(texto!==undefined)e.textContent=texto;return e;};
const dataBR=valor=>valor?new Date(valor).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}):'—';
const moeda=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const normalizar=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

async function confirmarAdmin(){
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user)return false;
  const {data:perfil,error:e}=await supabase.from('perfis').select('papel').eq('id',user.id).single();
  return !e && perfil?.papel==='admin';
}
function encontrados(){
  const termo=normalizar($('pesquisa').value.trim());
  const ordem=$('ordenacao').value;
  const campo=ordem.startsWith('publicacao')?'publicado_em':'encerrado_em';
  const asc=ordem.endsWith('asc');
  return ofertas.filter(p=>normalizar([p.nome,p.loja,p.categoria,p.motivo_fora_ar].filter(Boolean).join(' ')).includes(termo))
    .sort((a,b)=>{const x=Date.parse(a[campo]||a.criado_em)||0,y=Date.parse(b[campo]||b.criado_em)||0;return asc?x-y:y-x;});
}
function atualizarAcoes(){
  $('apagar-selecionadas').disabled=bloqueado||selecionados.size===0;
  $('apagar-selecionadas').textContent=`🗑️ Apagar selecionadas (${selecionados.size})`;
  const visiveis=encontrados();
  $('selecionar-visiveis').checked=visiveis.length>0&&visiveis.every(p=>selecionados.has(p.id));
  $('selecionar-visiveis').indeterminate=visiveis.some(p=>selecionados.has(p.id))&&!$('selecionar-visiveis').checked;
}
function renderizar(){
  const lista=$('lista');lista.replaceChildren();
  const visiveis=encontrados();
  $('total').textContent=`(${ofertas.length})`;
  if(!visiveis.length)lista.append(criar('p','vazio','Nenhuma publicação fora do ar encontrada.'));
  for(const oferta of visiveis){
    const linha=criar('article','linha-oferta');
    const check=criar('input');check.type='checkbox';check.checked=selecionados.has(oferta.id);
    check.setAttribute('aria-label',`Selecionar ${oferta.nome}`);
    check.addEventListener('change',()=>{if(check.checked)selecionados.add(oferta.id);else selecionados.delete(oferta.id);atualizarAcoes();});
    const corpo=criar('div','oferta-corpo');
    corpo.append(criar('strong','',oferta.nome),criar('p','nome-loja',`${oferta.loja||'Loja não informada'} | ${oferta.categoria||'Sem categoria'}`),
      criar('p','',moeda.format(Number(oferta.preco)||0)),
      criar('p','',`🕒 Última postagem: ${dataBR(oferta.postagem_em||oferta.publicado_em)}`),
      criar('p','',`📥 Retirada do ar: ${dataBR(oferta.encerrado_em)}`),
      criar('p','muted',`Motivo: ${oferta.motivo_fora_ar||'Retirada do ar'}`));
    const editar=criar('a','btn-editar-oferta','✏️ Editar / republicar');
    editar.href='./index.html?editar='+encodeURIComponent(oferta.id);
    editar.setAttribute('aria-label',`Editar ou republicar ${oferta.nome}`);
    corpo.append(editar);
    linha.append(check,corpo);lista.append(linha);
  }
  atualizarAcoes();
}
async function carregar(){
  $('status').textContent='Carregando publicações fora do ar...';
  try{
    if(!await confirmarAdmin())throw new Error('Sua sessão expirou ou não tem permissão de administrador.');
    // A lista pode ser maior que 1000 registros; paginação evita omissões silenciosas.
    let todos=[];const tamanho=500;
    for(let inicio=0;inicio<10000;inicio+=tamanho){
      const {data,error}=await supabase.from('produtos').select('id,nome,loja,categoria,preco,publicado_em,postagem_em,encerrado_em,motivo_fora_ar,criado_em')
        .not('encerrado_em','is',null).eq('publicado',false).order('encerrado_em',{ascending:false}).range(inicio,inicio+tamanho-1);
      if(error)throw error;
      todos.push(...(data||[]));if(!data||data.length<tamanho)break;
    }
    ofertas=todos;selecionados.clear();renderizar();
    $('status').textContent=`${ofertas.length} publicação(ões) fora do ar.`;
  }catch(e){console.error(e);$('status').textContent='Erro: '+(e.message||e);}
}
$('selecionar-visiveis').addEventListener('change',e=>{
  for(const oferta of encontrados()){if(e.target.checked)selecionados.add(oferta.id);else selecionados.delete(oferta.id);}
  renderizar();
});
$('pesquisa').addEventListener('input',renderizar);
$('ordenacao').addEventListener('change',renderizar);
$('atualizar').addEventListener('click',carregar);
$('apagar-selecionadas').addEventListener('click',async()=>{
  if(bloqueado||!selecionados.size)return;
  const ids=[...selecionados];
  if(!confirm(`Apagar DEFINITIVAMENTE ${ids.length} oferta(s) fora do ar?\n\nEsta exclusão não poderá ser desfeita no painel.`))return;
  bloqueado=true;atualizarAcoes();let excluidas=0;
  try{
    if(!await confirmarAdmin())throw new Error('Sessão expirada ou sem acesso administrativo.');
    for(let i=0;i<ids.length;i+=40){
      const lote=ids.slice(i,i+40);
      const {data,error}=await supabase.from('produtos').delete().in('id',lote)
        .eq('publicado',false).not('encerrado_em','is',null).select('id');
      if(error)throw error;
      excluidas+=(data||[]).length;
      $('status').textContent=`Excluídas ${excluidas} de ${ids.length} oferta(s)...`;
    }
    if(excluidas!==ids.length)throw new Error(`Somente ${excluidas} de ${ids.length} foram excluídas. Atualize a lista.`);
    await carregar();
    $('status').textContent=`✅ ${excluidas} oferta(s) excluída(s) definitivamente.`;
  }catch(e){console.error(e);$('status').textContent='Erro: '+(e.message||e)+` (${excluidas} exclusão(ões) concluída(s)).`;await carregar();}
  finally{bloqueado=false;atualizarAcoes();}
});
(async()=>{
  if(!await confirmarAdmin()){$('aviso-login').hidden=false;return;}
  $('painel-fora').hidden=false;await carregar();
})();
