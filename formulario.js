/* ============================================================
   O formulário das duas landing pages
   ------------------------------------------------------------
   Máscara no telefone, validação campo a campo, envio para
   `/api/lead-landing` e, com a gravação confirmada, a conversa
   no WhatsApp.

   ─── A VALIDAÇÃO DAQUI NÃO É A VALIDAÇÃO ────────────────────

   Qualquer um manda um POST direto para o endereço sem nunca
   abrir a página. Quem decide se grava é o servidor, com a
   regra de `src/domain/lead/leadDaLanding.js`. O que roda aqui
   é cortesia: acusar o erro enquanto a pessoa digita, em vez de
   depois de uma ida ao servidor.

   Por isso as checagens daqui são as baratas (vazio, forma
   óbvia) e o servidor é a autoridade: quando ele recusa, as
   frases DELE são pintadas nos campos, sem tradução. Se um dia
   as duas regras divergirem, quem ganha é a de lá, e a pessoa
   vê a mensagem certa.

   Estas páginas são HTML estático, sem empacotador, então não
   dá para importar aquele módulo aqui. Essa é a razão de a
   duplicação existir, e o motivo de ela ser mínima de
   propósito.

   ─── O NÚMERO DO WHATSAPP NÃO MORA AQUI ─────────────────────

   O endereço da conversa vem na resposta do servidor. Se
   alguém adulterar esta página, o pior que consegue é gravar um
   lead com o próprio nome errado, não desviar a conversa para
   outro número.
   ============================================================ */

(() => {
  "use strict";

  const formulario = document.querySelector(".formulario");
  if (!formulario) return;

  const landing = formulario.dataset.landing;
  const endereco = formulario.dataset.endereco || "/api/lead-landing";

  /* ----- Telefone: máscara e forma -------------------------
     As mesmas regras de `src/domain/assinatura/pedido.js`, que
     é de onde o servidor tira as dele. */

  const somenteDigitos = (bruto) => String(bruto ?? "").replace(/\D+/g, "");

  function formatarTelefone(bruto) {
    const d = somenteDigitos(bruto).slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function telefoneEhValido(bruto) {
    const d = somenteDigitos(bruto);
    if (d.length !== 10 && d.length !== 11) return false;
    const ddd = Number(d.slice(0, 2));
    if (ddd < 11 || ddd > 99) return false;
    // Onze dígitos é celular, e celular brasileiro começa com 9 depois do DDD.
    if (d.length === 11 && d[2] !== "9") return false;
    return true;
  }

  const FORMA_DO_EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  const limpar = (bruto) => String(bruto ?? "").trim().replace(/\s+/g, " ");

  const LIMITES = { nome: 120, email: 160, empresa: 120 };

  /* ----- A frase de erro de cada campo ---------------------
     Diz o que fazer, não que o valor é inválido. */

  function erroDoCampo(campo, valor) {
    switch (campo) {
      case "nome": {
        const v = limpar(valor);
        if (v === "") return "Diga como podemos chamar você.";
        if (v.length > LIMITES.nome) return `Use até ${LIMITES.nome} caracteres.`;
        return null;
      }
      case "empresa": {
        const v = limpar(valor);
        if (v === "") return "Diga o nome da sua empresa.";
        if (v.length > LIMITES.empresa) return `Use até ${LIMITES.empresa} caracteres.`;
        return null;
      }
      case "email": {
        const v = limpar(valor).toLowerCase();
        if (v === "") return "Precisamos de um e-mail para enviar a proposta.";
        if (v.length > LIMITES.email) return `Use até ${LIMITES.email} caracteres.`;
        if (!FORMA_DO_EMAIL.test(v)) return "Confira o e-mail: falta o @ ou o domínio.";
        return null;
      }
      case "telefone": {
        const v = somenteDigitos(valor);
        if (v === "") return "Precisamos do WhatsApp para falar com você.";
        if (!telefoneEhValido(v)) return "Confira o número: DDD e o telefone, com ou sem o 9 na frente.";
        return null;
      }
      case "atendentes":
      case "bloqueio":
        return limpar(valor) === "" ? "Escolha uma das opções." : null;
      case "aceite":
        return valor === true ? null : "Marque para autorizar o contato.";
      default:
        return null;
    }
  }

  /* ----- Ler e pintar o formulário -------------------------- */

  /** Os campos que existem NESTA página, na ordem em que aparecem. */
  const campos = ["nome", "empresa", "email", "telefone", "atendentes"]
    .concat(landing === "api-oficial" ? ["bloqueio"] : [])
    .concat(["aceite"]);

  const controle = (campo) => formulario.elements[campo];

  function valorDoCampo(campo) {
    const c = controle(campo);
    if (!c) return "";
    if (campo === "aceite") return c.checked === true;
    // RadioNodeList (as pílulas) devolve o valor do que está marcado, ou "".
    return c.value ?? "";
  }

  /**
   * Onde a frase de erro aparece.
   *
   * O elemento já existe no HTML, vazio: criar no momento do erro faria o
   * layout pular, e leitor de tela só anuncia o que já estava lá quando o
   * `aria-describedby` aponta.
   */
  const aviso = (campo) => formulario.querySelector(`[data-erro="${campo}"]`);

  /** O bloco visual que recebe a borda vermelha. */
  function bloco(campo) {
    const c = controle(campo);
    const primeiro = c instanceof RadioNodeList ? c[0] : c;
    return primeiro?.closest(".campo, .pilulas, .aceite") ?? null;
  }

  function pintarErro(campo, frase) {
    const caixa = aviso(campo);
    const area = bloco(campo);
    const c = controle(campo);

    if (caixa) caixa.textContent = frase ?? "";
    if (area) area.classList.toggle("com-erro", Boolean(frase));

    // `aria-invalid` vai no controle, não na caixa: é o controle que está
    // inválido, e é nele que o leitor de tela para.
    const alvos = c instanceof RadioNodeList ? Array.from(c) : c ? [c] : [];
    for (const alvo of alvos) {
      if (frase) alvo.setAttribute("aria-invalid", "true");
      else alvo.removeAttribute("aria-invalid");
    }
  }

  function conferir(campo) {
    const frase = erroDoCampo(campo, valorDoCampo(campo));
    pintarErro(campo, frase);
    return frase === null;
  }

  /* ----- Máscara, enquanto digita --------------------------- */

  const telefone = controle("telefone");
  if (telefone) {
    /* A máscara reescreve o valor inteiro a cada tecla, e isso jogaria o
       cursor para o fim. Não dá: apagar o 9 de um número já digitado é
       mexer no meio, e com o cursor pulando fora a pessoa conclui que o
       campo não deixa tirar o 9.

       A posição é guardada em DÍGITOS, não em caracteres: os parênteses,
       o espaço e o traço aparecem e somem sozinhos conforme o tamanho
       muda, então contar caractere devolveria o cursor para o lugar
       errado justamente quando a formatação muda. */
    function reescreverComCursor() {
      const antes = telefone.value;
      const cursor = telefone.selectionStart;
      const depois = formatarTelefone(antes);

      if (cursor === null || cursor === undefined) {
        telefone.value = depois;
        return;
      }

      const digitosAntesDoCursor = somenteDigitos(antes.slice(0, cursor)).length;
      telefone.value = depois;

      let posicao = 0;
      let contados = 0;
      while (posicao < depois.length && contados < digitosAntesDoCursor) {
        if (/\d/.test(depois[posicao])) contados++;
        posicao++;
      }
      // Pula a pontuação à frente, para o cursor parar colado no próximo
      // dígito e não entre o ")" e o espaço.
      while (posicao < depois.length && !/\d/.test(depois[posicao])) posicao++;

      try {
        telefone.setSelectionRange(posicao, posicao);
      } catch (erro) {
        /* Navegador que não deixa mexer na seleção deste tipo de campo: o
           valor já está formatado, e só o cursor fica no fim. */
      }
    }

    telefone.addEventListener("input", reescreverComCursor);
    // Colar traz o texto do jeito que estava na área de transferência.
    telefone.addEventListener("paste", () => {
      setTimeout(reescreverComCursor, 0);
    });
  }

  /* ----- Quando acusar -------------------------------------
     Ao sair do campo, e não a cada tecla: acusar "e-mail
     inválido" na terceira letra é acusar alguém de não ter
     terminado de digitar.

     Depois que o campo JÁ errou uma vez, aí sim ele passa a se
     corrigir a cada tecla, para a pessoa ver o erro sumir no
     momento em que conserta. */

  for (const campo of campos) {
    const c = controle(campo);
    if (!c) continue;
    const alvos = c instanceof RadioNodeList ? Array.from(c) : [c];
    for (const alvo of alvos) {
      alvo.addEventListener("blur", () => conferir(campo));
      alvo.addEventListener("change", () => {
        if (campo === "atendentes" || campo === "bloqueio" || campo === "aceite") {
          conferir(campo);
        }
      });
      alvo.addEventListener("input", () => {
        if (alvo.getAttribute("aria-invalid") === "true") conferir(campo);
      });
    }
  }

  /* ----- O recado geral, acima do botão --------------------- */

  const recado = formulario.querySelector("[data-recado]");

  function dizer(texto, tom) {
    if (!recado) return;
    recado.textContent = texto ?? "";
    recado.dataset.tom = tom ?? "";
    recado.hidden = !texto;
  }

  /* ----- De onde a pessoa veio -----------------------------
     Lista de permissão fechada, igual à do servidor: copiar a
     querystring inteira levaria para o banco qualquer coisa que
     um link carregasse, inclusive dado pessoal colado por
     engano numa URL compartilhada. */

  const PARAMETROS_DE_CAMPANHA = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ];

  function campanhaDaBusca() {
    const veio = new URLSearchParams(window.location.search);
    const campanha = new URLSearchParams();
    for (const chave of PARAMETROS_DE_CAMPANHA) {
      const valor = limpar(veio.get(chave)).slice(0, 120);
      if (valor !== "") campanha.set(chave, valor);
    }
    return campanha.toString();
  }

  /* ----- O envio -------------------------------------------- */

  const botao = formulario.querySelector('button[type="submit"]');
  const rotuloOriginal = botao ? botao.innerHTML : "";
  let enviando = false;

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (enviando) return;

    // Confere TODOS os campos, e não só o que a pessoa tocou: é aqui que
    // "preencheu tudo" é decidido.
    let primeiroRuim = null;
    for (const campo of campos) {
      if (!conferir(campo) && primeiroRuim === null) primeiroRuim = campo;
    }

    if (primeiroRuim) {
      dizer("Confira os campos marcados em vermelho.", "erro");
      const c = controle(primeiroRuim);
      const foco = c instanceof RadioNodeList ? c[0] : c;
      foco?.focus();
      foco?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    enviando = true;
    dizer("Enviando…", "");
    if (botao) {
      botao.disabled = true;
      botao.textContent = "Enviando…";
    }

    const corpo = {
      landing,
      nome: valorDoCampo("nome"),
      empresa: valorDoCampo("empresa"),
      email: valorDoCampo("email"),
      telefone: valorDoCampo("telefone"),
      atendentes: valorDoCampo("atendentes"),
      aceite: valorDoCampo("aceite") === true,
      // O campo-isca vai sempre, e vazio quando é gente. Ver o comentário
      // dele no HTML: quem preenche é robô, e o servidor descarta.
      site: valorDoCampo("site"),
      origem: window.location.pathname,
      campanha: campanhaDaBusca(),
    };
    if (landing === "api-oficial") corpo.bloqueio = valorDoCampo("bloqueio");

    const restaurar = () => {
      enviando = false;
      if (botao) {
        botao.disabled = false;
        botao.innerHTML = rotuloOriginal;
      }
    };

    let resposta;
    try {
      resposta = await fetch(endereco, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
    } catch {
      restaurar();
      dizer(
        "Não conseguimos enviar agora. Confira sua conexão e tente de novo.",
        "erro",
      );
      return;
    }

    let dados = null;
    try {
      dados = await resposta.json();
    } catch {
      dados = null;
    }

    // 422: o servidor recusou campo a campo. As frases DELE são pintadas,
    // sem tradução — ele é a autoridade sobre o que é válido.
    if (resposta.status === 422 && dados?.erros) {
      restaurar();
      for (const campo of campos) pintarErro(campo, dados.erros[campo] ?? null);
      dizer(dados.mensagem || "Confira os campos marcados.", "erro");
      const ruim = campos.find((c) => dados.erros[c]);
      if (ruim) {
        const c = controle(ruim);
        (c instanceof RadioNodeList ? c[0] : c)?.focus();
      }
      return;
    }

    if (!resposta.ok || !dados?.whatsappUrl) {
      restaurar();
      dizer(
        dados?.mensagem ||
          "Algo deu errado do nosso lado. Tente de novo em instantes.",
        "erro",
      );
      return;
    }

    // Gravou. A partir daqui o botão continua desabilitado de propósito: a
    // pessoa está saindo da página, e reabilitar convidaria a um segundo envio.
    dizer("Pronto! Abrindo o WhatsApp…", "ok");
    if (botao) botao.textContent = "Abrindo o WhatsApp…";
    window.location.href = dados.whatsappUrl;
  });
})();
