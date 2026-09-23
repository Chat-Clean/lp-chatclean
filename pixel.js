/* ============================================================
   Os eventos do pixel da Meta
   ------------------------------------------------------------
   O código BASE do pixel — o que cria `fbq`, carrega o
   `fbevents.js` e dispara o `PageView` — está inline no `<head>`
   das duas páginas, e não aqui. Tem motivo: ele precisa existir
   antes de qualquer outra coisa, e um `<script defer>` só roda
   depois do HTML inteiro. Quem chega por anúncio e desiste em
   dois segundos precisa ter contado como visita.

   Este arquivo é a camada de CIMA: os eventos que valem dinheiro.

   ─── O QUE É CONTADO, E QUANDO ──────────────────────────────

   Lead         formulário enviado E gravado. Não no clique do
                botão: clique que deu erro não é lead.
   ViewContent  o vídeo da demonstração começou a tocar.
   Contact      clique em um link de conversa no WhatsApp.

   Nada além disso. Evento inventado para parecer movimentado
   estraga a otimização da campanha: a Meta passa a procurar
   gente que faz aquilo, e aquilo não é venda.

   ─── ESTE ARQUIVO NÃO CONHECE FORMULÁRIO NEM VÍDEO ──────────

   `formulario.js` e `video.js` anunciam o que aconteceu com um
   evento de documento (`chatclean:lead`, `chatclean:video`), e é
   isso que se escuta aqui. Nenhum dos dois sabe que existe
   pixel, e este não sabe como eles funcionam. No dia em que o
   pixel sair, some um `<script>` e nada mais.

   ─── O `event_id` E A CONTAGEM DUPLA ────────────────────────

   O mesmo `Lead` sai por dois caminhos: daqui e do servidor
   (`api/_eventos-da-meta.js`), depois de o lead estar gravado. É
   de propósito — o pixel sozinho perde de 20% a 30% dos eventos
   para bloqueador, ITP do Safari e aba fechada cedo.

   Para a Meta não contar dois, os dois levam o MESMO `event_id`,
   gerado por `formulario.js` antes do envio e mandado junto no
   corpo. Quem chega primeiro conta; o gêmeo é descartado.
   ============================================================ */

(() => {
  "use strict";

  /* O identificador do pixel vem do atributo da própria tag deste script, e
     não de uma constante aqui dentro: o número já está no `<head>` da página,
     e dois lugares com o mesmo número é um lugar a mais para eles
     divergirem sem ninguém notar. */
  const tag = document.currentScript;
  const PIXEL = (tag && tag.dataset.pixel) || "";

  /**
   * Manda um evento, se houver pixel.
   *
   * `fbq` existe desde o código base do `<head>` (ele é uma fila que o
   * `fbevents.js` esvazia ao carregar), mas pode não existir se um bloqueador
   * tiver removido o script inteiro. Nesse caso não há o que fazer, e não há
   * o que quebrar: a página segue igual.
   */
  function contar(evento, dados, opcoes) {
    if (typeof window.fbq !== "function") return;
    try {
      window.fbq("track", evento, dados || {}, opcoes || {});
    } catch (erro) {
      /* Pixel com problema não derruba a página. O lead já está gravado e o
         evento gêmeo do servidor cobre esta perda. */
    }
  }

  /* ─── Lead ─────────────────────────────────────────────────
     Com correspondência avançada: e-mail, telefone e nome vão
     junto, e o próprio `fbevents.js` faz o hash antes de sair
     daqui — valor cru nenhum viaja.

     Isso repete o que o servidor já manda de propósito. Os dois
     eventos são deduplicados pelo `event_id`, e o que sobra é o
     mais bem casado: quanto melhor a correspondência, maior a
     chance de o lead ser atribuído à campanha que o pagou. */
  document.addEventListener("chatclean:lead", (evento) => {
    const lead = (evento && evento.detail) || {};

    if (PIXEL !== "" && typeof window.fbq === "function") {
      try {
        /* Reinicializar com os dados da pessoa é como a Meta documenta a
           correspondência avançada manual. Não dispara `PageView`: init e
           track são chamadas separadas. */
        window.fbq("init", PIXEL, {
          em: lead.email || undefined,
          ph: lead.telefone || undefined,
          fn: lead.primeiroNome || undefined,
          ln: lead.ultimoNome || undefined,
          country: "br",
        });
      } catch (erro) {
        /* Segue sem correspondência avançada: o evento ainda conta. */
      }
    }

    contar(
      "Lead",
      {
        content_name: lead.pagina || undefined,
        content_category: lead.landing || undefined,
      },
      { eventID: lead.eventoId },
    );
  });

  /* ─── ViewContent: o vídeo tocou ───────────────────────────
     Quem dá play na demonstração de sete minutos está muito mais
     perto de pedir do que quem só rolou a página. É público de
     remarketing, e é sinal para a Meta procurar mais gente assim. */
  document.addEventListener("chatclean:video", (evento) => {
    const video = (evento && evento.detail) || {};
    contar("ViewContent", {
      content_name: video.titulo || "Demonstração",
      content_type: "video",
    });
  });

  /* ─── Contact: clique para conversar no WhatsApp ───────────
     Pega qualquer link de conversa da página, do botão do
     cabeçalho em diante, por delegação: link novo em qualquer
     seção já entra sem ninguém lembrar de vir aqui.

     UMA VEZ POR VISITA. Quem clica, volta e clica de novo não
     virou dois contatos, e contar dois ensinaria a Meta a
     procurar quem clica repetido.

     O envio do formulário NÃO cai aqui: ele vai para o WhatsApp
     por navegação, não por clique em link. Lá o evento é `Lead`,
     que é o que aquilo é. */
  let jaContou = false;
  document.addEventListener("click", (evento) => {
    if (jaContou) return;
    const alvo = evento.target;
    if (!alvo || typeof alvo.closest !== "function") return;
    const link = alvo.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!link) return;
    jaContou = true;
    contar("Contact", { content_category: "whatsapp" });
  });
})();
