/* ============================================================
   Os pontinhos do carrossel do celular
   ------------------------------------------------------------
   O arrasto NÃO passa por aqui. Quem rola é o navegador, com
   `scroll-snap` no CSS: ele já tem a inércia certa, respeita o
   gesto de voltar do sistema, funciona com o dedo, com a roda do
   mouse e com as setas do teclado.

   E o CSS está preso ao atributo `data-carrossel`, não a uma
   classe que este script precisasse pôr. A diferença aparece no
   dia em que o script não carrega: o arrasto continua inteiro, e
   o que falta são só os pontinhos.

   Este script faz uma coisa só: desenhar os pontinhos e manter o
   aceso combinando com o cartão que está na frente.

   ─── POR QUE OS PONTINHOS NÃO ESTÃO NO HTML ─────────────────

   Porque eles são consequência, não conteúdo. A quantidade sai
   do número de cartões, e escrever à mão significa alguém
   acrescentar um cartão e esquecer o ponto, ficando com três
   bolinhas para quatro cartões até alguém reparar.

   ─── O CORTE É O MESMO DO CSS, E ISSO É FRÁGIL ──────────────

   639px aparece aqui e na media query. Se um mudar sem o outro,
   os pontinhos aparecem sem carrossel ou o contrário. Não há
   como ler a media query do CSS sem parsear a folha inteira, e
   por isso o valor está numa constante com nome, e não solto no
   meio de uma condição.
   ============================================================ */

(() => {
  "use strict";

  const CORTE_DO_CELULAR = "(max-width: 639px)";

  const trilhos = document.querySelectorAll("[data-carrossel]");
  if (trilhos.length === 0) return;

  const medida = window.matchMedia(CORTE_DO_CELULAR);

  /** O índice do cartão que está mais perto do centro do trilho. */
  function cartaoDaVez(trilho) {
    const cartoes = Array.from(trilho.children);
    const centro = trilho.scrollLeft + trilho.clientWidth / 2;
    let melhor = 0;
    let menorDistancia = Infinity;

    for (let i = 0; i < cartoes.length; i++) {
      const cartao = cartoes[i];
      const meio = cartao.offsetLeft + cartao.offsetWidth / 2;
      const distancia = Math.abs(meio - centro);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        melhor = i;
      }
    }
    return melhor;
  }

  for (const trilho of trilhos) {
    const cartoes = Array.from(trilho.children);
    if (cartoes.length < 2) continue;

    /* Região rolável precisa ser alcançável pelo teclado. Sem `tabindex`
       quem navega por teclado não consegue rolar, e o Chrome inclusive
       acusa isso como problema de acessibilidade. */
    trilho.tabIndex = 0;
    trilho.setAttribute("role", "group");
    trilho.setAttribute("aria-label", "Cartões, arraste para o lado");

    const barra = document.createElement("div");
    barra.className = "pontos";

    const pontos = cartoes.map((_, i) => {
      const ponto = document.createElement("button");
      ponto.type = "button";
      ponto.className = "pontos__ponto";
      ponto.setAttribute(
        "aria-label",
        "Ir para o cartão " + (i + 1) + " de " + cartoes.length,
      );
      ponto.addEventListener("click", () => {
        cartoes[i].scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "nearest",
          inline: "center",
        });
      });
      barra.appendChild(ponto);
      return ponto;
    });

    trilho.insertAdjacentElement("afterend", barra);

    let marcado = -1;
    function acender() {
      const atual = cartaoDaVez(trilho);
      if (atual === marcado) return;
      marcado = atual;
      for (let i = 0; i < pontos.length; i++) {
        // `aria-current` em vez de uma classe: o CSS pinta a partir dele, e
        // o leitor de tela anuncia qual é o de agora sem precisar de texto
        // escondido que alguém esqueceria de traduzir depois.
        pontos[i].setAttribute("aria-current", i === atual ? "true" : "false");
      }
    }

    /* O evento de rolagem dispara dezenas de vezes por gesto. Sem a
       represa do quadro, seriam dezenas de leituras de layout por
       segundo, e no celular isso aparece como arrasto travado. */
    let agendado = false;
    trilho.addEventListener(
      "scroll",
      () => {
        if (agendado) return;
        agendado = true;
        requestAnimationFrame(() => {
          agendado = false;
          acender();
        });
      },
      { passive: true },
    );

    /* Girar o aparelho muda a largura dos cartões e, com ela, qual está
       no centro. Sem recalcular, o ponto aceso passa a apontar errado. */
    window.addEventListener("resize", () => {
      marcado = -1;
      acender();
    });

    /* Acima do corte não há carrossel: a grade volta, e o índice guardado
       ficaria preso no cartão de antes. */
    const aoTrocarDeTamanho = () => {
      marcado = -1;
      if (medida.matches) acender();
    };
    if (typeof medida.addEventListener === "function") {
      medida.addEventListener("change", aoTrocarDeTamanho);
    }

    acender();
  }
})();
