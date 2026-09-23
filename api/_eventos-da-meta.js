/**
 * O evento de conversão que sai DAQUI para a Meta (Conversions API).
 *
 * O pixel do navegador (`pixel.js` e o código base no `<head>` das páginas)
 * manda o mesmo `Lead` pelo lado de lá. Os dois carregam o MESMO `event_id`, e
 * é isso que faz a Meta contar uma conversão, e não duas.
 *
 * ─── POR QUE MANDAR PELOS DOIS LADOS ─────────────────────────────────────
 *
 * O pixel sozinho perde eventos, e não pouco: bloqueador de anúncio, o ITP do
 * Safari, iOS com rastreamento negado, aba fechada antes do beacon sair. Nada
 * disso alcança este arquivo — aqui o evento sai do servidor, depois de o lead
 * já estar GRAVADO, e por um caminho que o navegador não pode cortar.
 *
 * O pixel sozinho também casa mal: no navegador a Meta recebe o que a página
 * dá. Daqui vai o conjunto inteiro, com hash: e-mail, telefone, nome, o id da
 * linha no banco, o IP e o agente de quem enviou, mais os cookies `_fbp` e
 * `_fbc`. É o que a Meta chama de qualidade de correspondência, e é o que
 * decide se o lead é atribuído à campanha que o pagou.
 *
 * ─── O ENVIO NUNCA DERRUBA O LEAD ────────────────────────────────────────
 *
 * Mesma regra do aviso por e-mail: se o token faltar, se a Meta recusar, se a
 * rede cair, o lead continua gravado e a resposta continua 201 com o link do
 * WhatsApp. A falha vai para o log e para lugar nenhum mais. Trocar receita
 * por telemetria seria o negócio errado.
 *
 * ─── O QUE VAI EM HASH, E O QUE NÃO VAI ──────────────────────────────────
 *
 * Tudo que identifica pessoa vai em SHA-256, normalizado antes (minúsculas,
 * sem espaço sobrando, telefone com código do país). É o que a Meta exige e é
 * o que impede o dado cru de viajar. IP, agente, `_fbp` e `_fbc` vão crus,
 * porque é assim que a API os espera — nenhum dos quatro é dado de cadastro.
 *
 * ─── PRECISA DE UM TOKEN, E SÓ DELE ──────────────────────────────────────
 *
 * `META_TOKEN_DE_CONVERSOES` no ambiente da Vercel. Sai do Gerenciador de
 * Eventos: Configurações > API de Conversões > Gerar token de acesso. Sem ele
 * este módulo não faz nada e diz por quê — o pixel do navegador continua
 * funcionando sozinho.
 *
 * Opcionais: `META_PIXEL_ID` (o padrão abaixo é o mesmo que está no HTML das
 * páginas, e pixel não é segredo), `META_VERSAO_DA_API` e
 * `META_CODIGO_DE_TESTE`, que faz o evento aparecer na aba "Eventos de teste"
 * do Gerenciador em vez de entrar na conta de verdade.
 */

const { createHash, randomUUID } = require("crypto");

const { NOME_DA_LANDING, limpar, somenteDigitos } = require("./_regras-do-lead.js");

/** O pixel das duas landings. Não é segredo: ele está no HTML das páginas. */
const PIXEL_PADRAO = "1773986837313693";

/**
 * A versão da Graph API.
 *
 * A Meta aposenta versão em rodízio (cada uma vive uns dois anos). v26.0 é a
 * de julho de 2026. Quando envelhecer, a chamada passa a responder erro, o log
 * mostra o HTTP e `META_VERSAO_DA_API` troca sem mexer no código.
 */
const VERSAO_DA_API = "v26.0";

/** O nome padrão da Meta para "alguém pediu contato". Não invente outro. */
const EVENTO = "Lead";

/** Brasil. O banco guarda o telefone sem ele, porque é assim que se digita. */
const CODIGO_DO_PAIS = "55";

/** Prazo curto: o formulário está esperando esta chamada terminar. */
const PRAZO_MS = 3000;

/* ─── As formas do que vem do navegador ──────────────────────────────────
   Tudo abaixo chega pelo corpo da requisição, que é escrito por quem chama, e
   quem chama pode não ser a nossa página. Cada valor é conferido contra a
   forma que a Meta documenta: o que não casa é descartado, e o evento sai sem
   ele em vez de sair com lixo dentro. */

const FORMA_DO_EVENTO_ID = /^[A-Za-z0-9_.:-]{8,100}$/;
const FORMA_DO_FBP = /^fb\.\d\.\d{1,20}\.\d{1,30}$/;
const FORMA_DO_FBC = /^fb\.\d\.\d{1,20}\.[A-Za-z0-9_-]{1,255}$/;
const FORMA_DO_FBCLID = /^[A-Za-z0-9_-]{1,255}$/;

/* ─── Normalizar e embaralhar ────────────────────────────────────────────── */

/** SHA-256 em hexadecimal minúsculo, que é o formato que a Meta aceita. */
function embaralhar(valor) {
  const texto = String(valor == null ? "" : valor);
  if (texto === "") return null;
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

const normalizarEmail = (bruto) => limpar(bruto).toLowerCase();

/**
 * Nome: minúsculas, sem pontuação.
 *
 * O acento FICA. A normalização da Meta pede minúsculas e sem símbolo, e é
 * UTF-8: tirar o acento de "Fabrício" mudaria o texto que vai virar hash e
 * faria ele deixar de casar com o mesmo nome vindo de outra fonte.
 */
const normalizarNome = (bruto) =>
  limpar(bruto)
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();

/**
 * Telefone no formato internacional, só dígitos e sem o "+".
 *
 * ─── POR QUE NÃO BASTA OLHAR SE COMEÇA COM 55 ────────────────────────────
 *
 * DDD 55 existe (Santa Maria, RS). Um celular de lá é `55 9xxxx-xxxx`: onze
 * dígitos começando com 55, e mesmo assim SEM código de país. Só é código de
 * país quando o número passa de onze dígitos, que é o tamanho máximo de um
 * telefone brasileiro. Confiar no prefixo sozinho mandaria `55` a mais e o
 * hash deixaria de casar com o dono do número.
 */
function normalizarTelefone(bruto) {
  const digitos = somenteDigitos(bruto);
  if (digitos === "") return "";
  const jaTemPais = digitos.length > 11 && digitos.indexOf(CODIGO_DO_PAIS) === 0;
  return jaTemPais ? digitos : CODIGO_DO_PAIS + digitos;
}

/** O primeiro nome e o último sobrenome, que é o que a Meta casa. */
function partesDoNome(bruto) {
  const pedacos = normalizarNome(bruto).split(" ").filter((p) => p !== "");
  if (pedacos.length === 0) return { primeiro: "", ultimo: "" };
  return {
    primeiro: pedacos[0],
    ultimo: pedacos.length > 1 ? pedacos[pedacos.length - 1] : "",
  };
}

/* ─── O que o navegador mandou ───────────────────────────────────────────── */

/** Um valor só se ele tiver a forma certa. Caso contrário, `null`. */
function seTiverForma(bruto, forma) {
  const texto = typeof bruto === "string" ? bruto.trim() : "";
  return texto !== "" && forma.test(texto) ? texto : null;
}

/**
 * O valor de um cookie no cabeçalho da requisição.
 *
 * Rede de segurança do que `formulario.js` já manda no corpo: a página e a
 * função saem do mesmo domínio, então `_fbp` e `_fbc` viajam sozinhos no
 * cabeçalho. Serve para quando a página em cache for de uma versão anterior à
 * que passou a mandar os dois no corpo.
 */
function cookieDoPedido(cabecalhoDeCookies, nome) {
  if (typeof cabecalhoDeCookies !== "string" || cabecalhoDeCookies === "") return null;
  for (const pedaco of cabecalhoDeCookies.split(";")) {
    const corte = pedaco.indexOf("=");
    if (corte === -1) continue;
    if (pedaco.slice(0, corte).trim() !== nome) continue;
    return pedaco.slice(corte + 1).trim() || null;
  }
  return null;
}

/**
 * O `_fbc` montado a partir do `fbclid` da URL.
 *
 * Só entra quando o cookie não existe, e esse caso importa mais do que parece:
 * é exatamente o de quem tem o pixel bloqueado. O `fbclid` continua na URL do
 * anúncio, a página manda o parâmetro para cá, e a atribuição do clique se
 * salva por este caminho.
 *
 * Formato da Meta: `fb.{subdomínio}.{quando}.{fbclid}`.
 */
function fbcDoClique(fbclid, segundos) {
  const id = seTiverForma(fbclid, FORMA_DO_FBCLID);
  return id === null ? null : "fb.1." + segundos + "." + id;
}

/* ─── O evento ───────────────────────────────────────────────────────────── */

/**
 * Monta o corpo que vai para a Meta. Puro: sem rede e sem relógio próprio.
 *
 * Separado do envio para o teste poder afirmar o que a Meta recebe sem tocar
 * na rede — que é onde os erros deste tipo de integração se escondem.
 */
function montarEvento(lead, dados, segundos) {
  const info = dados || {};
  const nome = partesDoNome(lead.nome);

  const fbp = seTiverForma(info.fbp, FORMA_DO_FBP) || cookieDoPedido(info.cookies, "_fbp");
  const fbc =
    seTiverForma(info.fbc, FORMA_DO_FBC) ||
    cookieDoPedido(info.cookies, "_fbc") ||
    fbcDoClique(info.fbclid, segundos);

  /* Só o que existe entra. Chave com `null` dentro de `user_data` conta contra
     a qualidade de correspondência em vez de ser ignorada. */
  const pessoa = {};
  const porHash = {
    em: normalizarEmail(lead.email),
    ph: normalizarTelefone(lead.telefone),
    fn: nome.primeiro,
    ln: nome.ultimo,
    /* O país é do telefone, não de um palpite: o DDD já foi validado como
       brasileiro na regra do lead, e sem DDD brasileiro o formulário não
       passa. */
    country: lead.telefone ? "br" : "",
    /* O id da linha no banco. Não identifica ninguém fora daqui, e é o que
       permite a Meta ligar este lead a um evento futuro do mesmo cliente. */
    external_id: info.leadId || "",
  };

  for (const chave of Object.keys(porHash)) {
    const embaralhado = embaralhar(porHash[chave]);
    if (embaralhado !== null) pessoa[chave] = embaralhado;
  }

  /* Estes quatro vão crus: é o formato que a API espera, e nenhum deles é
     dado de cadastro. */
  if (fbp) pessoa.fbp = fbp;
  if (fbc) pessoa.fbc = fbc;
  if (info.ip) pessoa.client_ip_address = info.ip;
  if (info.agente) pessoa.client_user_agent = String(info.agente).slice(0, 500);

  const evento = {
    event_name: EVENTO,
    event_time: segundos,
    /* Sem id do navegador não há o que deduplicar: ou o pixel foi bloqueado,
       ou o POST não veio da nossa página. Um id novo faz o evento contar
       sozinho, que é o certo — sem ele a Meta descartaria como repetido. */
    event_id: seTiverForma(info.eventoId, FORMA_DO_EVENTO_ID) || "lead-" + randomUUID(),
    action_source: "website",
    user_data: pessoa,
    custom_data: {
      content_name: NOME_DA_LANDING[lead.landing] || lead.landing,
      content_category: lead.landing,
    },
  };

  const url = typeof info.url === "string" ? info.url.trim().slice(0, 500) : "";
  if (url.indexOf("https://") === 0) evento.event_source_url = url;

  return evento;
}

/* ─── O envio ────────────────────────────────────────────────────────────── */

function enderecoDosEventos(pixel, versao) {
  return "https://graph.facebook.com/" + versao + "/" + pixel + "/events";
}

/**
 * Manda a conversão para a Meta. Devolve `{ ok, enviado, motivo }` e NUNCA lança.
 *
 * `enviado: false` com `ok: true` é o caso de não haver token: não é falha, é
 * integração desligada, e quem chama não deve tratar como erro.
 */
async function avisarConversaoDaMeta(lead, dados, ambiente, buscar) {
  const env = ambiente || {};
  const fetchar = buscar || globalThis.fetch;

  const token = limpar(env.META_TOKEN_DE_CONVERSOES);
  if (token === "") {
    return { ok: true, enviado: false, motivo: "META_TOKEN_DE_CONVERSOES ausente" };
  }
  if (typeof fetchar !== "function") {
    return { ok: false, enviado: false, motivo: "sem fetch neste ambiente" };
  }

  const pixel = limpar(env.META_PIXEL_ID) || PIXEL_PADRAO;
  const versao = limpar(env.META_VERSAO_DA_API) || VERSAO_DA_API;
  const segundos = Math.floor(Date.now() / 1000);

  const corpo = { data: [montarEvento(lead, dados, segundos)], access_token: token };

  /* O código de teste faz o evento cair na aba "Eventos de teste" do
     Gerenciador em vez de entrar na conta. Serve para conferir a integração
     sem sujar a otimização das campanhas — e por isso mora em variável de
     ambiente, para sair sem deploy. */
  const codigoDeTeste = limpar(env.META_CODIGO_DE_TESTE);
  if (codigoDeTeste !== "") corpo.test_event_code = codigoDeTeste;

  let sinal;
  try {
    sinal = AbortSignal.timeout(PRAZO_MS);
  } catch (erro) {
    sinal = undefined;
  }

  let resposta;
  try {
    resposta = await fetchar(enderecoDosEventos(pixel, versao), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: sinal,
    });
  } catch (erro) {
    return { ok: false, enviado: false, motivo: (erro && erro.message) || "falha de rede" };
  }

  if (!resposta.ok) {
    const bruto = await resposta.text().catch(() => "");
    /* O token não aparece aqui: a Meta não o ecoa, e o corte evita despejar um
       corpo de erro inteiro no log. */
    return {
      ok: false,
      enviado: false,
      motivo: "HTTP " + resposta.status + " " + bruto.slice(0, 200),
    };
  }

  return { ok: true, enviado: true, motivo: null };
}

module.exports = {
  CODIGO_DO_PAIS,
  EVENTO,
  PIXEL_PADRAO,
  PRAZO_MS,
  VERSAO_DA_API,
  avisarConversaoDaMeta,
  cookieDoPedido,
  embaralhar,
  enderecoDosEventos,
  fbcDoClique,
  montarEvento,
  normalizarEmail,
  normalizarNome,
  normalizarTelefone,
  partesDoNome,
  seTiverForma,
};
