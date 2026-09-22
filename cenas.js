/* ============================================================
   As cenas dos cartões
   ------------------------------------------------------------
   Cada cartão de recurso tem um palco onde a funcionalidade
   ACONTECE, em laço enquanto o cartão está na tela. É o mesmo
   modelo do site institucional (`useCena.js` lá), reescrito sem
   React.

   ─── COMO UMA CENA É DESCRITA ───────────────────────────────

   No HTML, e não aqui:

     <div class="palco" data-cena data-passos="700,900,900">
       <div data-surge-em="1">…</div>
       <div data-surge-em="2">…</div>
     </div>

   `data-passos` são as durações: quanto o passo 0 fica na tela
   antes do 1, e assim por diante. Cada peça diz em que passo
   ela entra, e o motor só liga e desliga `data-visivel` nelas.
   Quem desenha o movimento é o CSS.

   Assim uma cena nova não pede linha de JavaScript nenhuma: é
   marcação mais estilo.

   ─── O LAÇO ─────────────────────────────────────────────────

   Roda até o último passo (o resultado), segura esse quadro,
   apaga o palco e recomeça. O recomeço acontece com o palco
   apagado E com as transições desligadas por dois quadros: as
   peças voltam ao início num salto invisível, em vez de
   "desanimarem" de trás para frente.

   ─── FORA DA TELA, PARADO ───────────────────────────────────

   Cinco cartões animando ao mesmo tempo numa página que a
   pessoa nem rolou até lá é bateria de celular queimada à toa.
   O laço só corre com o cartão visível.

   ─── QUEM PEDIU MENOS MOVIMENTO NÃO GANHA LAÇO ──────────────

   A cena vai direto para o último passo e fica lá. O conteúdo
   continua inteiro; só o movimento some.
   ============================================================ */

(() => {
  "use strict";

  const palcos = document.querySelectorAll("[data-cena]");
  if (palcos.length === 0) return;

  /** Quanto o resultado fica na tela antes de recomeçar. */
  const PAUSA_NO_RESULTADO = 2600;

  /** Quanto o palco leva para apagar entre uma volta e outra. */
  const SAIDA_MS = 350;

  const menosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");

  for (const palco of palcos) {
    const duracoes = String(palco.dataset.passos || "")
      .split(",")
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (duracoes.length === 0) continue;

    const ultimo = duracoes.length;
    const pecas = Array.from(palco.querySelectorAll("[data-surge-em]"));
    const relogios = [];
    let quadro = null;

    function mostrarPasso(passo) {
      palco.dataset.passo = String(passo);
      for (const peca of pecas) {
        const entra = Number(peca.dataset.surgeEm);
        /* `data-some-em` é opcional, e existe por causa do balão "digitando":
           sem ele a peça ficaria na tela depois da resposta chegar, e a cena
           mostraria o bot digitando e respondendo ao mesmo tempo. */
        const sai = peca.dataset.someEm === undefined ? Infinity : Number(peca.dataset.someEm);
        // `data-visivel` em vez de classe: o atributo diz o estado, e o CSS
        // desenha. Peça nova na cena não pede nome de classe novo aqui.
        if (passo >= entra && passo < sai) peca.setAttribute("data-visivel", "");
        else peca.removeAttribute("data-visivel");
      }
    }

    function limpar() {
      for (const r of relogios) clearTimeout(r);
      relogios.length = 0;
      if (quadro !== null) cancelAnimationFrame(quadro);
      quadro = null;
    }

    function correr() {
      limpar();

      /* O recomeço tem que ser invisível. Sem desligar a transição, as peças
         voltariam ao início ANIMANDO para trás, e a cena pareceria dar ré. */
      palco.setAttribute("data-sem-transicao", "");
      palco.removeAttribute("data-saindo");
      mostrarPasso(0);

      quadro = requestAnimationFrame(() => {
        quadro = requestAnimationFrame(() => {
          palco.removeAttribute("data-sem-transicao");
        });
      });

      let t = 0;
      duracoes.forEach((duracao, i) => {
        t += duracao;
        relogios.push(setTimeout(() => mostrarPasso(i + 1), t));
      });

      t += PAUSA_NO_RESULTADO;
      relogios.push(setTimeout(() => palco.setAttribute("data-saindo", ""), t));

      t += SAIDA_MS;
      relogios.push(setTimeout(correr, t));
    }

    function parar() {
      limpar();
      palco.removeAttribute("data-saindo");
    }

    /** Sem laço: a cena mostra o resultado e fica nele. */
    function congelarNoResultado() {
      limpar();
      palco.setAttribute("data-sem-transicao", "");
      palco.removeAttribute("data-saindo");
      mostrarPasso(ultimo);
    }

    if (menosMovimento.matches) {
      congelarNoResultado();
      continue;
    }

    /* 0.35 é a fatia do cartão que precisa estar visível. Menos que isso e a
       cena começa com o cartão ainda na beirada, e a pessoa perde o início
       justo do que a cena tem de melhor. */
    const olho = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) correr();
          else parar();
        }
      },
      { threshold: 0.35 },
    );

    olho.observe(palco);

    /* Quem liga "reduzir movimento" no meio da visita não precisa recarregar
       a página para o movimento parar. */
    const aoTrocar = () => {
      if (menosMovimento.matches) {
        olho.disconnect();
        congelarNoResultado();
      }
    };
    if (typeof menosMovimento.addEventListener === "function") {
      menosMovimento.addEventListener("change", aoTrocar);
    }
  }
})();
