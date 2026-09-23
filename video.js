/* ============================================================
   O vídeo da demonstração
   ------------------------------------------------------------
   A página carrega uma CAPA, não um player. O <iframe> do
   YouTube só nasce quando alguém clica.

   ─── POR QUE NÃO EMBUTIR DE LARGADA ─────────────────────────

   Um <iframe> do YouTube puxa mais de um mega de script de
   terceiro, abre conexão para três domínios e entra na conta do
   tempo de carga mesmo de quem nunca vai dar play. Numa página
   de anúncio isso é dinheiro: o clique já foi pago, e a página
   lenta perde a pessoa antes de ela ler o título.

   O que carrega no lugar é uma imagem de 96 KB, com `loading`
   preguiçoso. O player entra depois, e já tocando.

   ─── ISTO NÃO É UM COMPONENTE DE VÍDEO ──────────────────────

   Não tem controle próprio, não tem estado, não guarda nada.
   Uma troca, uma vez, e o script não faz mais nada na página.
   Quem controla a reprodução é o player do YouTube.
   ============================================================ */

(() => {
  "use strict";

  const capas = document.querySelectorAll(".video__capa[data-video]");
  if (capas.length === 0) return;

  /* O id vem de atributo escrito no nosso próprio HTML, mas é
     conferido assim mesmo: o valor entra numa URL, e id torto
     viraria um endereço estranho em vez de um erro visível. */
  const FORMA_DO_ID = /^[A-Za-z0-9_-]{6,20}$/;

  for (const capa of capas) {
    capa.addEventListener(
      "click",
      () => {
        const id = capa.dataset.video;
        if (!FORMA_DO_ID.test(id || "")) return;

        const quadro = capa.parentElement;
        if (!quadro) return;

        const busca = new URLSearchParams({
          autoplay: "1",
          // Sem vídeo "relacionado" de outro canal no fim: a tela final
          // ficaria oferecendo concorrente dentro da nossa landing.
          rel: "0",
          modestbranding: "1",
          // No iPhone, sem isto o vídeo sequestra a tela inteira.
          playsinline: "1",
        });

        const player = document.createElement("iframe");
        // `nocookie` não deixa o YouTube gravar cookie de quem só assistiu.
        player.src =
          "https://www.youtube-nocookie.com/embed/" + id + "?" + busca;
        // O título é o que o leitor de tela anuncia ao entrar no quadro.
        player.title = capa.dataset.titulo || "Vídeo de demonstração";
        player.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        player.allowFullscreen = true;
        player.referrerPolicy = "strict-origin-when-cross-origin";

        quadro.replaceChild(player, capa);

        /* Quem dá play está mais perto de pedir do que quem só rolou a
           página. Quem escuta é `pixel.js`; este arquivo não sabe o que
           ele faz com isso, e o vídeo funciona igual sem ele. */
        document.dispatchEvent(
          new CustomEvent("chatclean:video", {
            detail: { id: id, titulo: capa.dataset.titulo || null },
          }),
        );

        /* Quem chegou aqui pelo teclado acabou de ter o botão arrancado
           debaixo do foco. Sem esta linha o foco volta para o <body> e a
           pessoa recomeça a navegação do topo da página. */
        player.focus();
      },
      { once: true },
    );
  }
})();
