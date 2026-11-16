/* Muitas Ofertas — escolha de tema no desktop e tema automático no celular. */
(() => {
  'use strict';

  const CHAVE = 'muitas-ofertas-tema';
  const telaPequena = window.matchMedia('(max-width: 768px)');
  const temaEscuroSistema = window.matchMedia('(prefers-color-scheme: dark)');
  const botoes = document.querySelectorAll('.tema-botao[data-tema]');

  let preferencia = null;
  try {
    const valor = localStorage.getItem(CHAVE);
    if (valor === 'light' || valor === 'dark') preferencia = valor;
  } catch (erro) {
    // Sem armazenamento, os botões funcionam até a página ser recarregada.
  }

  function aplicarTema() {
    const modoAutomatico = telaPequena.matches || !preferencia;

    if (modoAutomatico) {
      // No celular, ignoramos a preferência manual do computador.
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', preferencia);
    }

    // aria-pressed indica uma escolha manual; quando automático, ambos neutros.
    botoes.forEach((botao) => {
      const selecionado = !modoAutomatico && botao.dataset.tema === preferencia;
      botao.setAttribute('aria-pressed', String(selecionado));
    });
  }

  botoes.forEach((botao) => {
    botao.addEventListener('click', () => {
      // Um segundo clique no ícone selecionado restaura o modo automático.
      preferencia = preferencia === botao.dataset.tema ? null : botao.dataset.tema;
      try {
        if (preferencia) {
          localStorage.setItem(CHAVE, preferencia);
        } else {
          localStorage.removeItem(CHAVE);
        }
      } catch (erro) {
        // A troca de tema continua funcionando mesmo sem localStorage.
      }
      aplicarTema();
    });
  });

  // Ao redimensionar para celular, o tema acompanha o sistema imediatamente.
  if (typeof telaPequena.addEventListener === 'function') {
    telaPequena.addEventListener('change', aplicarTema);
  } else if (typeof telaPequena.addListener === 'function') {
    telaPequena.addListener(aplicarTema);
  }

  // O CSS já acompanha o sistema; atualizamos o estado por consistência.
  if (typeof temaEscuroSistema.addEventListener === 'function') {
    temaEscuroSistema.addEventListener('change', aplicarTema);
  } else if (typeof temaEscuroSistema.addListener === 'function') {
    temaEscuroSistema.addListener(aplicarTema);
  }

  aplicarTema();
})();
