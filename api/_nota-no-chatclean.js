/**
 * A ficha do lead, dentro do CRM da ChatClean, antes de ele dizer "oi".
 *
 * Sai daqui, junto com o aviso por e-mail e a conversão da Meta, no instante
 * em que o lead é gravado. Um segundo depois a pessoa está no WhatsApp
 * mandando a mensagem pré-preenchida — e o ticket dela já tem, em amarelo, o
 * que o formulário respondeu. Quem atende (a IA SDR ou alguém do time) não
 * recomeça perguntando nome, empresa e tamanho do time.
 *
 * ─── DUAS CHAMADAS, NESTA ORDEM ──────────────────────────────────────────
 *
 * 1. A NOTA, pela API Push do canal WABA: `onlyNote: true` grava só a nota
 *    interna, sem mandar nada ao cliente, e cria contato e ticket se ainda
 *    não existem.
 * 2. A ETIQUETA, pela API de Contatos: busca o contato pelo número e manda
 *    `tags` num PATCH. Etiqueta é acumulativa — não apaga as que o contato
 *    já tinha. Vem DEPOIS da nota porque é a nota que cria o contato de quem
 *    nunca falou com a ChatClean.
 *
 * A etiqueta vai pelo NOME, e o nome precisa existir antes em
 * Configurações → Etiquetas. Etiqueta inexistente é recusada, e a nota
 * continua valendo sozinha.
 *
 * ─── POR QUE `body`, SE É SÓ NOTA ────────────────────────────────────────
 *
 * A API exige `number`, `body` e `externalKey` mesmo com `onlyNote`. O texto
 * de `body` é neutro de propósito: se um dia `onlyNote` for ignorado, o que
 * escapa para o cliente é uma frase que não constrange ninguém — e não a
 * ficha dele. Num canal WABA, sem janela de 24h aberta, texto livre nem é
 * entregue.
 *
 * ─── O ENVIO NUNCA DERRUBA O LEAD ────────────────────────────────────────
 *
 * Mesma regra do e-mail e da Meta: sem token, com a ChatClean fora, com a
 * etiqueta recusada, o lead continua gravado e a resposta continua 201 com o
 * link do WhatsApp. A falha vai para o log. O e-mail de aviso segue sendo a
 * rede de segurança do atendimento.
 *
 * ─── O TOKEN ─────────────────────────────────────────────────────────────
 *
 * `CHATCLEAN_TOKEN` e `CHATCLEAN_PUSH_ID` saem do mesmo lugar: Configurações →
 * API/Webhook, no Push do canal WABA. O token é o JWT daquele Push e serve
 * também para a API de Contatos. Vai no cabeçalho `Authorization`, nunca na
 * URL: URL acaba em log, cabeçalho não.
 */

const { campanhaVisivel, quandoVisivel } = require("./_aviso-por-email.js");
const {
  NOME_DA_LANDING,
  limpar,
  rotuloDaFaixa,
  rotuloDoBloqueio,
  somenteDigitos,
  telefoneVisivel,
} = require("./_regras-do-lead.js");

/** O servidor da API da ChatClean. `CHATCLEAN_API_BASE` troca sem código. */
const BASE_PADRAO = "https://betaapi.chatclean.com.br";

/** A etiqueta de cada landing. Os nomes precisam existir no painel. */
const ETIQUETA_DA_LANDING = {
  crm: "Landing CRM",
  "api-oficial": "Landing API Oficial",
};

/**
 * Prazo de CADA chamada. São até três em série (nota, busca, etiqueta), e o
 * formulário espera todas: três vezes isto é o pior caso.
 */
const PRAZO_MS = 2500;

/* ─── O texto da nota ────────────────────────────────────────────────────── */

/**
 * A nota interna. Negrito com `*`, como no WhatsApp, porque é assim que o
 * chat da ChatClean desenha. Linha vazia não entra: campo que não veio não
 * vira "Empresa: " solto.
 */
function textoDaNota(lead, extras) {
  const dados = lead || {};
  const mais = extras || {};
  const linhas = ["*Lead da landing · " + (NOME_DA_LANDING[dados.landing] || dados.landing) + "*"];

  const par = (rotulo, valor) => {
    const v = limpar(valor);
    if (v !== "") linhas.push("*" + rotulo + ":* " + v);
  };

  par("Nome", dados.nome);
  par("Empresa", dados.empresa);
  par("E-mail", dados.email);
  par("WhatsApp", telefoneVisivel(dados.telefone));
  par("Atendentes", rotuloDaFaixa(dados.atendentes));
  if (dados.landing === "api-oficial") {
    par("Já foi bloqueado", rotuloDoBloqueio(dados.bloqueio));
  }
  par("Página", mais.origem);
  par("Campanha", campanhaVisivel(mais.campanha));
  par("Quando", quandoVisivel(mais.criadoEm));

  return linhas.join("\n");
}

/* ─── O envio ────────────────────────────────────────────────────────────── */

function prazo() {
  try {
    return AbortSignal.timeout(PRAZO_MS);
  } catch (erro) {
    return undefined;
  }
}

/** Uma chamada à API da ChatClean. Devolve `{ ok, dados?, motivo? }` e não lança. */
async function chamar(fetchar, endereco, metodo, token, corpo) {
  let resposta;
  try {
    resposta = await fetchar(endereco, {
      method: metodo,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: prazo(),
    });
  } catch (erro) {
    return { ok: false, motivo: (erro && erro.message) || "falha de rede" };
  }

  const bruto = await resposta.text().catch(() => "");
  if (!resposta.ok) {
    // O corte evita despejar um corpo de erro inteiro — com dado do lead — no log.
    return { ok: false, motivo: "HTTP " + resposta.status + " " + bruto.slice(0, 200) };
  }

  let dados = null;
  try {
    dados = bruto === "" ? null : JSON.parse(bruto);
  } catch (erro) {
    dados = null;
  }
  return { ok: true, dados: dados };
}

/**
 * Grava a nota e a etiqueta. Devolve `{ ok, enviado, motivo? }` e NUNCA lança.
 *
 * Sem token ou sem Push configurado, `ok` vem verdadeiro e `enviado` falso:
 * integração desligada não é falha, como na Meta.
 */
async function anotarNoChatClean(lead, extras, ambiente, buscar) {
  const env = ambiente || {};
  const fetchar = buscar || globalThis.fetch;

  const token = typeof env.CHATCLEAN_TOKEN === "string" ? env.CHATCLEAN_TOKEN.trim() : "";
  const pushId = typeof env.CHATCLEAN_PUSH_ID === "string" ? env.CHATCLEAN_PUSH_ID.trim() : "";
  if (token === "" || pushId === "") {
    return { ok: true, enviado: false, motivo: "CHATCLEAN_TOKEN ou CHATCLEAN_PUSH_ID ausente" };
  }

  const base =
    typeof env.CHATCLEAN_API_BASE === "string" && env.CHATCLEAN_API_BASE.trim() !== ""
      ? env.CHATCLEAN_API_BASE.trim().replace(/\/+$/, "")
      : BASE_PADRAO;

  // O banco guarda sem o 55, porque é assim que se digita. A ChatClean quer com.
  const numero = "55" + somenteDigitos(lead.telefone);
  const mais = extras || {};

  const nota = await chamar(
    fetchar,
    base + "/v1/api/external/" + encodeURIComponent(pushId),
    "POST",
    token,
    {
      number: numero,
      body: "Contato pelo site da ChatClean.",
      externalKey: "landing-" + (mais.leadId || "sem-id"),
      onlyNote: true,
      note: { body: textoDaNota(lead, mais) },
    },
  );
  if (!nota.ok) return { ok: false, enviado: false, motivo: "nota: " + nota.motivo };

  const etiqueta = ETIQUETA_DA_LANDING[lead.landing];
  if (!etiqueta) return { ok: true, enviado: true };

  const contato = await chamar(
    fetchar,
    base + "/v1/contacts/number/" + numero,
    "GET",
    token,
  );
  const id = contato.ok && contato.dados ? contato.dados.id : null;
  if (!id) {
    return {
      ok: false,
      enviado: true,
      motivo: "etiqueta: contato não encontrado (" + (contato.motivo || "sem id") + ")",
    };
  }

  const marcado = await chamar(
    fetchar,
    base + "/v1/contacts/" + encodeURIComponent(id),
    "PATCH",
    token,
    { tags: [etiqueta] },
  );
  if (!marcado.ok) return { ok: false, enviado: true, motivo: "etiqueta: " + marcado.motivo };

  return { ok: true, enviado: true };
}

module.exports = {
  BASE_PADRAO,
  ETIQUETA_DA_LANDING,
  PRAZO_MS,
  anotarNoChatClean,
  textoDaNota,
};
