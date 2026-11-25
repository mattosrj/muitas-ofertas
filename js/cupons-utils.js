// Funções compartilhadas entre a vitrine pública e o Admin de cupons.
// Não inclui credenciais secretas nem acesso direto ao banco.
const NOMES_IMAGENS = {
  'mercado livre': 'mercado-livre',
  'amazon': 'amazon',
  'shopee': 'shopee',
  'magalu': 'magalu',
  'magazine luiza': 'magalu',
  'aliexpress': 'aliexpress',
  'ali express': 'aliexpress'
};
export function normalizarLoja(loja) {
  return String(loja || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
}
export function imagemPorLoja(loja) {
  const nome = NOMES_IMAGENS[normalizarLoja(loja)] || 'generico';
  return new URL(`../images/cupom-${nome}.png`, import.meta.url).href;
}
export function imagemDaCampanha(campanha) {
  const url = String(campanha?.imagem || '').trim();
  return /^https:\/\//i.test(url) ? url : imagemPorLoja(campanha?.loja);
}
export function tituloDaCampanha(campanha, itens=[]) {
  if (String(campanha?.titulo || '').trim()) return String(campanha.titulo).trim();
  const loja = String(campanha?.loja || 'LOJA').trim().toLocaleUpperCase('pt-BR');
  if (itens.length > 1) return `LISTA DE CUPONS ${loja}`;
  if (normalizarLoja(loja) === 'mercado livre') return 'CUPOM NO MERCADO LIVRE';
  if (normalizarLoja(loja) === 'magalu') return 'CUPOM MAGALU';
  return `NOVO CUPOM ${loja}`;
}
export function dataCupom(valor) {
  if (!valor) return '';
  const data = new Date(`${valor}T12:00:00`);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR');
}

// Corrige textos de tutorial que foram salvos com as etapas na mesma linha.
// Não altera os dados do banco; apenas a apresentação e o texto compartilhado.
export function normalizarObservacoes(valor) {
  let texto = String(valor || '').replace(/\r\n?/g, '\n').replace(/\\n/g, '\n').trim();
  // Se existir "TUTORIAL:" colado ao texto anterior, separe o título.
  texto = texto.replace(/[ \t]*\b(TUTORIAL\s*:)/gi, '\n\n$1\n');
  // Formatos aceitos: "1- Faça isso", "2 - Faça aquilo", "3) Outra etapa".
  // Exige início de linha ou espaço antes do número para não quebrar URLs.
  texto = texto.replace(/(^|[ \t\n])(\d{1,2})\s*[-–.)]\s*(?=\S)/gm,
    (_, inicio, numero) => `\n${numero}- `);
  return texto.replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function mensagemCupom(campanha, itens=[]) {
  const validos = itens.filter(i => i && String(i.descricao || '').trim());
  const varias = validos.length > 1;
  const linhas = [
    `🎟️ *${tituloDaCampanha(campanha, validos)}*`,
    ''
  ];
  if (campanha.destaque) linhas.push(`🔔 *${String(campanha.destaque).trim()}*`, '');
  if (varias) linhas.push('🔥 Confira os cupons disponíveis:', '');
  validos.forEach((item, index) => {
    if (varias) {
      linhas.push(`*${index+1}. ${item.codigo ? 'Cupom ' + item.codigo : 'Oferta especial'}*`);
      linhas.push(String(item.descricao).trim());
    } else {
      linhas.push(`🔥 *${String(item.descricao).trim()}*`);
      if (item.codigo) linhas.push(`🏷️ Use o cupom: *${item.codigo}*`);
    }
    if (item.link) linhas.push('🔗 Resgate aqui:', item.link);
    if (index < validos.length - 1) linhas.push('');
  });
  if (campanha.link_ativacao) {
    if (validos.length) linhas.push('');
    linhas.push(varias ? '🔗 Lista / ativação geral:' : '🔗 Ative o cupom aqui:', campanha.link_ativacao);
  }
  const validade = dataCupom(campanha.validade);
  if (validade) linhas.push('', `⏰ Válido até ${validade}, conforme condições da loja.`);
  if (campanha.observacoes) linhas.push('', normalizarObservacoes(campanha.observacoes));
  linhas.push('', '#publi — Alguns links podem gerar comissão para o Muitas Ofertas.', 'Preços, regras e disponibilidade sujeitos a alterações.');
  return linhas.join('\n');
}
export function configurarImagem(elemento, campanha, status=null) {
  if (!elemento) return;
  const reserva = imagemPorLoja(campanha.loja);
  const personalizada = /^https:\/\//i.test(String(campanha.imagem || '').trim());
  // Ignorar retorno tardio de uma imagem antiga quando a loja/URL mudar.
  const token = Symbol('imagem'); elemento.__imagemToken = token;
  elemento.onerror = () => {
    if (elemento.__imagemToken !== token) return;
    elemento.onerror = null;
    elemento.src = reserva;
    if (status) status.textContent = 'Imagem não abriu. Usaremos a arte padrão desta loja.';
  };
  elemento.src = personalizada ? campanha.imagem.trim() : reserva;
  if (status) status.textContent = personalizada ? 'Imagem personalizada (se falhar, usa a arte da loja)' : `Imagem padrão: ${campanha.loja || 'Muitas Ofertas'}`;
}
