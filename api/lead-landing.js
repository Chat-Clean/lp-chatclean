/**
 * A captação do lead das duas landing pages.
 *
 * Fino de propósito: traduz requisição em argumento e resultado em resposta. O
 * que é um lead válido está em `_regras-do-lead.js`; como ele é gravado está em
 * `_banco-de-leads.js`.
 *
 * ─── ESTA FUNÇÃO PRECISA VIVER NESTE PROJETO ─────────────────────────────
 *
 * `formulario.js` chama `/api/lead-landing` com caminho RELATIVO, então o
 * endereço resolve para o domínio que serviu a página. As páginas estão em
 * `lp.chatclean.com.br`, que é este projeto da Vercel — e não no projeto do
 * site. Sem esta função aqui, o POST responde 404, que é exatamente o que
 * acontecia antes dela existir.
 *
 * ─── O `/API` DA LANDING E O `/API/` DA FUNÇÃO CONVIVEM ──────────────────
 *
 * A landing da API Oficial é servida em `/api` por um rewrite do `vercel.json`.
 * Esta função ocupa `/api/lead-landing`. Não colidem: a Vercel tenta o sistema
 * de arquivos ANTES dos rewrites, e nenhum arquivo responde por `/api` exato —
 * então `/api` cai no rewrite, e `/api/lead-landing` casa com esta função.
 *
 * ─── NÃO HÁ CORS, PORQUE NÃO PRECISA ─────────────────────────────────────
 *
 * Página e função saem do mesmo domínio. Mesma origem não pede permissão, e a
 * permissão que existia antes não defendia nada: CORS é imposto pelo NAVEGADOR,
 * e quem chama com `curl` nunca o consultou. Medido: com a lista de origens
 * ligada, um POST sem cabeçalho `Origin` gravava normalmente.
 *
 * O que contém abuso são as três coisas abaixo, e nenhuma depende de o chamador
 * ser educado: o teto de corpo, o campo-isca e o teto de envios por IP.
 *
 * ─── O QUE NÃO É LOGADO ──────────────────────────────────────────────────
 *
 * Nem nome, nem e-mail, nem telefone, nem o corpo. O log recebe o identificador
 * da linha, a landing e o tipo do erro. Dado pessoal vai para a tabela, onde a
 * RLS não dá política a ninguém.
 */

const {
  CAMPO_ISCA,
  LIMITE_DE_ENVIOS,
  campanhaDaBusca,
  enderecoDoWhatsApp,
  validarLeadDaLanding,
} = require("./_regras-do-lead.js");

const { TIPOS, bancoDoAmbiente } = require("./_banco-de-leads.js");
const { avisarLeadNovo } = require("./_aviso-por-email.js");
const { avisarConversaoDaMeta } = require("./_eventos-da-meta.js");
const { anotarNoChatClean } = require("./_nota-no-chatclean.js");

/** Um corpo maior que isto não é formulário, é tentativa. */
const TETO_DO_CORPO_BYTES = 8 * 1024;

const FORMULARIO_INVALIDO = "FORMULARIO_INVALIDO";
const EXCESSO_DE_ENVIOS = "EXCESSO_DE_ENVIOS";

const CODIGO_HTTP = {
  [FORMULARIO_INVALIDO]: 422,
  [EXCESSO_DE_ENVIOS]: 429,
  [TIPOS.CONFIGURACAO]: 500,
  [TIPOS.BANCO]: 500,
  [TIPOS.BANCO_INDISPONIVEL]: 503,
};

/** O corpo como objeto, venha ele parseado pela plataforma ou como texto. */
function corpoComoObjeto(corpo) {
  if (corpo === null || corpo === undefined) return {};
  if (typeof corpo === "object" && !Array.isArray(corpo)) return corpo;
  if (typeof corpo === "string") {
    try {
      const lido = JSON.parse(corpo);
      return typeof lido === "object" && lido !== null && !Array.isArray(lido)
        ? lido
        : {};
    } catch (erro) {
      return {};
    }
  }
  return {};
}

/**
 * O tamanho declarado do corpo, quando há.
 *
 * Recusar pelo cabeçalho é recusar ANTES de gastar memória com o parse. Quem
 * mente no `content-length` ainda cai na validação, que tem teto por campo.
 */
function corpoGrandeDemais(cabecalhos) {
  const fonte = cabecalhos || {};
  const bruto = fonte["content-length"] || fonte["Content-Length"];
  const tamanho = Number(bruto);
  return Number.isFinite(tamanho) && tamanho > TETO_DO_CORPO_BYTES;
}

/**
 * O IP de quem pediu. Auditoria do consentimento e chave do teto de envios.
 * Não autoriza nada: nenhuma decisão de acesso depende dele.
 */
function ipDoPedido(cabecalhos) {
  const fonte = cabecalhos || {};
  const bruto = fonte["x-forwarded-for"] || fonte["X-Forwarded-For"];
  if (typeof bruto !== "string" || bruto.trim() === "") return null;
  return bruto.split(",")[0].trim().slice(0, 60) || null;
}

/** O caminho de onde o clique veio, limitado e sem querystring. */
function origemDoPedido(corpo) {
  const bruto = (corpo || {}).origem;
  if (typeof bruto !== "string" || bruto.trim() === "") return null;
  return bruto.trim().split("?")[0].slice(0, 200) || null;
}

/**
 * O que o navegador juntou para o pixel da Meta.
 *
 * Objeto solto no corpo, e nunca confiado: quem monta o corpo pode não ser a
 * nossa página. Cada campo é conferido contra a forma que a Meta documenta em
 * `_eventos-da-meta.js`, e o que não casa é descartado.
 */
function metaDoPedido(corpo, cabecalhos, leadId) {
  const bruto = (corpo || {}).meta;
  const pacote = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? bruto : {};
  const fonte = cabecalhos || {};
  return {
    eventoId: pacote.eventoId,
    fbp: pacote.fbp,
    fbc: pacote.fbc,
    fbclid: pacote.fbclid,
    url: pacote.url,
    /* Estes três NÃO vêm do corpo: vêm de quem fez a requisição. É o que a
       Meta usa para casar a conversão com a pessoa que viu o anúncio, e é
       justamente o que não se deve deixar o chamador escolher. */
    ip: ipDoPedido(fonte),
    agente: fonte["user-agent"] || fonte["User-Agent"] || null,
    cookies: fonte.cookie || fonte.Cookie || null,
    leadId: leadId,
  };
}

/** O campo-isca veio preenchido? Só robô chega nele. */
function caiuNaIsca(corpo) {
  const valor = (corpo || {})[CAMPO_ISCA];
  return typeof valor === "string" && valor.trim() !== "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      tipo: "MetodoNaoPermitido",
      mensagem: "use POST para pedir contato.",
    });
  }

  if (corpoGrandeDemais(req.headers)) {
    return res.status(413).json({
      tipo: "CorpoGrandeDemais",
      mensagem: "o pedido é maior do que este formulário aceita.",
    });
  }

  const corpo = corpoComoObjeto(req.body);
  const ip = ipDoPedido(req.headers);

  const validado = validarLeadDaLanding(corpo);
  if (!validado.ok) {
    return res.status(CODIGO_HTTP[FORMULARIO_INVALIDO]).json({
      tipo: FORMULARIO_INVALIDO,
      mensagem: "confira os campos marcados.",
      erros: validado.erros,
    });
  }

  const lead = validado.lead;

  /* A isca é conferida DEPOIS da validação, de propósito: assim a resposta ao
     robô é indistinguível da resposta a uma pessoa, inclusive na demora. Se
     recusasse antes, o tempo de resposta denunciaria a armadilha. */
  if (caiuNaIsca(corpo)) {
    console.log("[lead-landing] isca (" + lead.landing + ")");
    return res.status(201).json({
      leadId: null,
      whatsappUrl: enderecoDoWhatsApp(lead),
    });
  }

  const banco = bancoDoAmbiente(process.env);
  if (!banco.ok) {
    console.error("[lead-landing] " + banco.tipo + ": " + banco.detalhe);
    return res.status(CODIGO_HTTP[TIPOS.CONFIGURACAO]).json({
      tipo: TIPOS.CONFIGURACAO,
      mensagem: "o pedido de contato está indisponível. Já fomos avisados.",
    });
  }

  /* O teto por IP. Falha aberta: se a contagem não responde, o lead passa —
     ver o comentário em `contarRecentes`. */
  const recentes = await banco.banco.contarRecentes({
    ip: ip,
    minutos: LIMITE_DE_ENVIOS.janelaMinutos,
    teto: LIMITE_DE_ENVIOS.porIp,
  });

  if (!recentes.ok) {
    console.error("[lead-landing] contagem falhou: " + (recentes.detalhe || ""));
  } else if (recentes.total >= LIMITE_DE_ENVIOS.porIp) {
    console.warn("[lead-landing] teto de envios atingido (" + lead.landing + ")");
    res.setHeader("Retry-After", String(LIMITE_DE_ENVIOS.janelaMinutos * 60));
    return res.status(CODIGO_HTTP[EXCESSO_DE_ENVIOS]).json({
      tipo: EXCESSO_DE_ENVIOS,
      mensagem:
        "recebemos vários pedidos deste acesso. Aguarde alguns minutos ou chame a gente no WhatsApp.",
    });
  }

  // Calculados uma vez: vão para o banco e, iguais, para o aviso por e-mail.
  const origem = origemDoPedido(corpo);
  const campanha = campanhaDaBusca(corpo.campanha);

  const gravado = await banco.banco.inserir({
    landing: lead.landing,
    nome: lead.nome,
    email: lead.email,
    telefone: lead.telefone,
    empresa: lead.empresa,
    atendentes: lead.atendentes,
    bloqueio: lead.bloqueio,
    origem: origem,
    campanha: campanha,
    aceite_versao: lead.aceiteVersao,
    aceite_ip: ip,
  });

  if (!gravado.ok) {
    console.error("[lead-landing] " + gravado.tipo + ": " + (gravado.detalhe || ""));
    return res.status(CODIGO_HTTP[gravado.tipo] || 500).json({
      tipo: gravado.tipo,
      mensagem: gravado.mensagem,
    });
  }

  console.log("[lead-landing] gravado " + gravado.id + " (" + lead.landing + ")");

  /* Os três recados do lead gravado: o aviso para o atendimento, a conversão
     para a Meta e a ficha como nota interna no CRM da ChatClean.

     EM PARALELO, porque um não depende do outro e o formulário está esperando
     os três: em série os prazos se somariam, e assim a espera é a do mais
     lento.

     ESPERADOS antes de responder, porque função serverless pode ser congelada
     assim que a resposta sai, e trabalho deixado para depois às vezes não
     acontece.

     E NENHUM DELES muda o código da resposta: o lead já está gravado. Aviso
     perdido não é lead perdido, e conversão não contada também não. */
  const seguro = (promessa) =>
    promessa.then(
      (r) => r,
      (erro) => ({ ok: false, motivo: (erro && erro.message) || "exceção" }),
    );

  const extras = { origem: origem, campanha: campanha, criadoEm: gravado.criadoEm };

  const [aviso, conversao, nota] = await Promise.all([
    seguro(avisarLeadNovo(lead, extras, process.env)),
    seguro(
      avisarConversaoDaMeta(
        lead,
        metaDoPedido(corpo, req.headers, gravado.id),
        process.env,
      ),
    ),
    seguro(
      anotarNoChatClean(lead, Object.assign({ leadId: gravado.id }, extras), process.env),
    ),
  ]);

  if (!aviso.ok) {
    console.error(
      "[lead-landing] aviso por e-mail falhou (" +
        gravado.id +
        "): " +
        aviso.motivo,
    );
  }

  /* Integração desligada não é falha: sem token, `ok` vem verdadeiro e
     `enviado` falso. Vira log comum, para não encher o painel de erro
     vermelho enquanto a chave não é criada. */
  if (!conversao.ok) {
    console.error(
      "[lead-landing] conversão da Meta falhou (" + gravado.id + "): " + conversao.motivo,
    );
  } else if (!conversao.enviado) {
    console.log("[lead-landing] conversão da Meta pulada: " + conversao.motivo);
  }

  if (!nota.ok) {
    console.error(
      "[lead-landing] nota no ChatClean falhou (" + gravado.id + "): " + nota.motivo,
    );
  } else if (!nota.enviado) {
    console.log("[lead-landing] nota no ChatClean pulada: " + nota.motivo);
  }

  return res.status(201).json({
    leadId: gravado.id,
    whatsappUrl: enderecoDoWhatsApp(lead),
  });
};
