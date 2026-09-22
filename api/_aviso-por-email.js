/**
 * O aviso de lead novo, por e-mail, pelo Resend.
 *
 * Sai logo depois da gravação, da própria função da landing. Quem escreve
 * nessa tabela é só ela — a RLS nega todo mundo e a chave de serviço mora aqui
 * — então "gravou" e "avisar" são o mesmo instante, sem gatilho no banco.
 *
 * ─── O ENVIO NUNCA DERRUBA O LEAD ────────────────────────────────────────
 *
 * Se o Resend estiver fora, se a chave faltar, se o e-mail for recusado: o
 * lead já está gravado, e a resposta continua 201 com o link do WhatsApp. A
 * falha vai para o log e para lugar nenhum mais. O contrário — perder um lead
 * porque o provedor de e-mail piscou — troca um problema de aviso por um
 * problema de receita.
 *
 * ─── POR QUE O `await` ANTES DE RESPONDER ────────────────────────────────
 *
 * Função serverless pode ser congelada assim que responde, e trabalho deixado
 * para depois do `res.json()` às vezes simplesmente não acontece. Por isso o
 * envio é esperado, com prazo curto: melhor uns 400 ms a mais no formulário do
 * que um aviso que sai só às vezes.
 *
 * ─── POR QUE TABELA E ESTILO INLINE NO HTML ──────────────────────────────
 *
 * Cliente de e-mail não é navegador. Gmail descarta boa parte do `<style>`,
 * Outlook não conhece flex nem grid, e `<div>` empilhada quebra em coluna
 * larga. Tabela aninhada com estilo em cada célula é feio de ler e é o que
 * chega inteiro nos três.
 */

const {
  EMAIL_DO_ATENDIMENTO,
  NOME_DA_LANDING,
  limpar,
  rotuloDaFaixa,
  rotuloDoBloqueio,
  telefoneVisivel,
  whatsappDoLead,
} = require("./_regras-do-lead.js");

const ENDERECO_DO_RESEND = "https://api.resend.com/emails";

/**
 * O remetente.
 *
 * O padrão é o domínio de teste do Resend, que funciona sem configurar nada
 * MAS só entrega para o e-mail dono da conta. Para o aviso chegar em
 * `chatcleanatendimento@gmail.com` de verdade, verifique `chatclean.com.br` no
 * Resend e ponha `RESEND_REMETENTE` como `ChatClean <lead@chatclean.com.br>`.
 */
const REMETENTE_PADRAO = "ChatClean <onboarding@resend.dev>";

/** Prazo curto: o formulário está esperando esta chamada terminar. */
const PRAZO_MS = 4000;

/**
 * De onde o e-mail busca o logotipo.
 *
 * Endereço absoluto e público, porque e-mail não tem "caminho relativo": o
 * cliente de quem lê baixa a imagem do servidor, sem contexto de origem.
 *
 * ─── POR QUE PNG, E NÃO O SVG QUE AS PÁGINAS USAM ────────────────────────
 *
 * Gmail e Outlook descartam `<img>` apontando para SVG, e `data:` URI embutido
 * no HTML também não passa nos dois. `ativos/chatclean-email.png` existe só
 * para isto: é o logotipo latão recortado e reduzido, servido pelo mesmo
 * domínio das landings.
 */
const BASE_DOS_ATIVOS = "https://lp.chatclean.com.br";

/* Tamanho de exibição: o arquivo tem o dobro, para não borrar em tela retina. */
const LOGO = { arquivo: "/ativos/chatclean-email.png", largura: 170, altura: 32 };

/* ─── As cores, copiadas de base.css ─────────────────────────────────────── */

const COR = {
  noite: "#14231b",
  verde: "#51bc69",
  verdeTexto: "#256339",
  creme: "#f1efe5",
  cremeFio: "#ddd8c6",
  latao: "#b7923e",
  cinza: "#5e6560",
  tinta: "#1b2a21",
  alerta: "#b3261e",
};

/**
 * Escapa o que veio do formulário.
 *
 * Nome e empresa são texto livre digitado por qualquer um, e vão parar dentro
 * de HTML. Sem isto, uma empresa chamada `<b>` já bagunça o layout do aviso, e
 * coisa pior que `<b>` também passa.
 */
function escapar(bruto) {
  return String(bruto == null ? "" : bruto)
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

/** A data em português, no fuso de São Paulo. */
function quandoVisivel(instante) {
  const data = instante ? new Date(instante) : new Date();
  if (Number.isNaN(data.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(data)
      .replace(", ", " às ");
  } catch (erro) {
    return data.toISOString();
  }
}

/** A campanha em uma linha legível, ou `null`. */
function campanhaVisivel(campanha) {
  const dados = campanha || {};
  const partes = [];
  if (dados.utm_source) partes.push(dados.utm_source);
  if (dados.utm_medium) partes.push(dados.utm_medium);
  if (dados.utm_campaign) partes.push(dados.utm_campaign);
  return partes.length > 0 ? partes.join(" · ") : null;
}

/**
 * O assunto.
 *
 * Feito para ser lido na lista da caixa de entrada, sem abrir: o que é, de
 * onde veio e quem é. Quando a pessoa já foi bloqueada, isso vai no assunto —
 * é o lead mais quente que esta landing produz, e ele não pode esperar a fila.
 */
function assuntoDoAviso(lead) {
  const pagina = NOME_DA_LANDING[lead.landing] || lead.landing;
  const urgente = lead.bloqueio === "sim" ? " · JÁ FOI BLOQUEADO" : "";
  const quem = limpar(lead.nome);
  const onde = limpar(lead.empresa);
  const assunto =
    "Lead novo · " + pagina + urgente + " · " + quem + " (" + onde + ")";
  // Quebra de linha em assunto é injeção de cabeçalho. `limpar` já colapsa
  // espaço, e este corte é o cinto de segurança.
  return assunto.replace(/[\r\n]+/g, " ").slice(0, 180);
}

/* ─── O corpo ────────────────────────────────────────────────────────────── */

/** Uma linha da ficha: rótulo à esquerda, valor à direita. */
function linhaDaFicha(rotulo, valorHtml, destaque) {
  if (!valorHtml) return "";
  const cor = destaque ? COR.alerta : COR.tinta;
  const peso = destaque ? "700" : "600";
  return (
    '<tr>' +
    '<td style="padding:10px 0;border-bottom:1px solid ' +
    COR.cremeFio +
    ';font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:' +
    COR.cinza +
    ';white-space:nowrap;vertical-align:top">' +
    escapar(rotulo) +
    "</td>" +
    '<td style="padding:10px 0 10px 16px;border-bottom:1px solid ' +
    COR.cremeFio +
    ';font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:' +
    peso +
    ";color:" +
    cor +
    ';text-align:right">' +
    valorHtml +
    "</td>" +
    "</tr>"
  );
}

function corpoEmHtml(lead, extras) {
  const dados = extras || {};
  const pagina = NOME_DA_LANDING[lead.landing] || lead.landing;
  const telefone = telefoneVisivel(lead.telefone);
  const linkDoWhatsApp = whatsappDoLead(lead.telefone, lead);
  const campanha = campanhaVisivel(dados.campanha);
  const bloqueio = rotuloDoBloqueio(lead.bloqueio);

  const ficha =
    linhaDaFicha(
      "WhatsApp",
      '<a href="tel:+55' +
        escapar(lead.telefone) +
        '" style="color:' +
        COR.verdeTexto +
        ';text-decoration:none">' +
        escapar(telefone) +
        "</a>",
    ) +
    linhaDaFicha(
      "E-mail",
      '<a href="mailto:' +
        escapar(lead.email) +
        '" style="color:' +
        COR.verdeTexto +
        ';text-decoration:none">' +
        escapar(lead.email) +
        "</a>",
    ) +
    linhaDaFicha("Atendentes", escapar(rotuloDaFaixa(lead.atendentes))) +
    linhaDaFicha("Já foi bloqueado", escapar(bloqueio), lead.bloqueio === "sim") +
    linhaDaFicha("Veio de", escapar(dados.origem || "/")) +
    linhaDaFicha("Campanha", escapar(campanha)) +
    linhaDaFicha("Quando", escapar(quandoVisivel(dados.criadoEm)));

  const botao = linkDoWhatsApp
    ? '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">' +
      "<tr><td " +
      'style="background:' +
      COR.verde +
      ';border-radius:999px" align="center">' +
      '<a href="' +
      escapar(linkDoWhatsApp) +
      '" style="display:inline-block;padding:16px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;letter-spacing:.03em;color:' +
      COR.noite +
      ';text-decoration:none">Falar no WhatsApp &nbsp;&rarr;</a>' +
      "</td></tr></table>" +
      '<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:' +
      COR.tinta +
      ';text-align:center">' +
      escapar(telefone) +
      '<br /><span style="font-size:12px;color:' +
      COR.cinza +
      '">o botão abre a conversa com este número</span></p>'
    : '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:' +
      COR.alerta +
      ';text-align:center">Telefone fora do formato esperado: ' +
      escapar(lead.telefone) +
      "</p>";

  return (
    '<!doctype html><html lang="pt-BR"><head>' +
    '<meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width,initial-scale=1" />' +
    '<meta name="color-scheme" content="light only" />' +
    "<title>" +
    escapar(assuntoDoAviso(lead)) +
    "</title>" +
    "</head>" +
    '<body style="margin:0;padding:0;background:' +
    COR.creme +
    '">' +
    // Pré-cabeçalho: o trecho que a caixa de entrada mostra depois do assunto.
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' +
    escapar(limpar(lead.nome) + " · " + telefone + " · " + limpar(lead.empresa)) +
    "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' +
    COR.creme +
    ';padding:28px 12px">' +
    "<tr><td align=\"center\">" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid ' +
    COR.cremeFio +
    '">' +
    // Faixa escura, com o logotipo
    '<tr><td style="background:' +
    COR.noite +
    ';padding:22px 28px">' +
    /* O `alt` não é acessório: Gmail bloqueia imagem de remetente desconhecido
       por padrão, e o primeiro aviso que o time receber vai chegar com o
       logotipo desligado. A cor no `style` pinta o próprio texto do `alt`,
       para ele não sair em preto sobre o verde-noite. */
    '<img src="' +
    escapar(dados.baseDosAtivos || BASE_DOS_ATIVOS) +
    escapar(LOGO.arquivo) +
    '" alt="ChatClean" width="' +
    LOGO.largura +
    '" height="' +
    LOGO.altura +
    '" style="display:block;border:0;outline:none;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;letter-spacing:.14em;color:' +
    COR.latao +
    '" />' +
    '<p style="margin:14px 0 0;font-family:Georgia,\'Times New Roman\',serif;font-size:22px;color:#ffffff">Lead novo pela landing de ' +
    escapar(pagina) +
    "</p>" +
    "</td></tr>" +
    // Quem é
    '<tr><td style="padding:26px 28px 6px">' +
    '<p style="margin:0;font-family:Georgia,\'Times New Roman\',serif;font-size:26px;line-height:1.2;color:' +
    COR.tinta +
    '">' +
    escapar(limpar(lead.nome)) +
    "</p>" +
    '<p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:' +
    COR.cinza +
    '">' +
    escapar(limpar(lead.empresa)) +
    "</p>" +
    "</td></tr>" +
    // A ficha
    '<tr><td style="padding:10px 28px 4px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    ficha +
    "</table>" +
    "</td></tr>" +
    // O botão
    '<tr><td style="padding:26px 28px 30px">' +
    botao +
    "</td></tr>" +
    "</table>" +
    '<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:' +
    COR.cinza +
    ';max-width:560px;text-align:center">Aviso automático de lead. Responder este e-mail responde direto para ' +
    escapar(lead.email) +
    "</p>" +
    "</td></tr></table>" +
    "</body></html>"
  );
}

/**
 * A versão em texto puro.
 *
 * Não é enfeite: cliente que bloqueia HTML mostra esta, filtro de spam
 * desconfia de e-mail que só tem HTML, e ela é o que aparece na prévia do
 * relógio e do celular em modo econômico.
 */
function corpoEmTexto(lead, extras) {
  const dados = extras || {};
  const pagina = NOME_DA_LANDING[lead.landing] || lead.landing;
  const telefone = telefoneVisivel(lead.telefone);
  const linhas = [
    "LEAD NOVO — landing de " + pagina,
    "",
    limpar(lead.nome) + " · " + limpar(lead.empresa),
    "",
    "WhatsApp:   " + telefone,
    "E-mail:     " + lead.email,
    "Atendentes: " + (rotuloDaFaixa(lead.atendentes) || "-"),
  ];
  const bloqueio = rotuloDoBloqueio(lead.bloqueio);
  if (bloqueio) linhas.push("Bloqueado:  " + bloqueio);
  linhas.push("Veio de:    " + (dados.origem || "/"));
  const campanha = campanhaVisivel(dados.campanha);
  if (campanha) linhas.push("Campanha:   " + campanha);
  linhas.push("Quando:     " + quandoVisivel(dados.criadoEm));

  const link = whatsappDoLead(lead.telefone, lead);
  linhas.push("", "Falar no WhatsApp (" + telefone + "):", link || "-");
  return linhas.join("\n");
}

/* ─── O envio ────────────────────────────────────────────────────────────── */

/**
 * Manda o aviso. Devolve `{ ok }` e NUNCA lança.
 *
 * Quem chama trata a falha como aviso perdido, não como lead perdido.
 */
async function avisarLeadNovo(lead, extras, ambiente, buscar) {
  const env = ambiente || {};
  const fetchar = buscar || globalThis.fetch;

  const chave = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  if (chave === "") {
    return { ok: false, motivo: "RESEND_API_KEY ausente" };
  }

  const destino =
    typeof env.LANDINGS_EMAIL_DESTINO === "string" &&
    env.LANDINGS_EMAIL_DESTINO.trim() !== ""
      ? env.LANDINGS_EMAIL_DESTINO.trim()
      : EMAIL_DO_ATENDIMENTO;

  const remetente =
    typeof env.RESEND_REMETENTE === "string" && env.RESEND_REMETENTE.trim() !== ""
      ? env.RESEND_REMETENTE.trim()
      : REMETENTE_PADRAO;

  /* O domínio que serve o logotipo. Sai daqui para o corpo do e-mail porque um
     dia estas páginas podem mudar de endereço, e aí o aviso continuaria
     apontando para um logotipo que não existe mais. */
  const base =
    typeof env.LANDINGS_BASE_PUBLICA === "string" &&
    env.LANDINGS_BASE_PUBLICA.trim() !== ""
      ? env.LANDINGS_BASE_PUBLICA.trim().replace(/\/+$/, "")
      : BASE_DOS_ATIVOS;

  const comBase = Object.assign({}, extras || {}, { baseDosAtivos: base });

  let sinal;
  try {
    sinal = AbortSignal.timeout(PRAZO_MS);
  } catch (erro) {
    sinal = undefined;
  }

  let resposta;
  try {
    resposta = await fetchar(ENDERECO_DO_RESEND, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + chave,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remetente,
        to: [destino],
        // Responder o aviso responde para o lead, sem copiar e colar endereço.
        reply_to: lead.email,
        subject: assuntoDoAviso(lead),
        html: corpoEmHtml(lead, comBase),
        text: corpoEmTexto(lead, comBase),
      }),
      signal: sinal,
    });
  } catch (erro) {
    return { ok: false, motivo: (erro && erro.message) || "falha de rede" };
  }

  if (!resposta.ok) {
    const bruto = await resposta.text().catch(() => "");
    // A chave não aparece aqui: ela não é ecoada pelo Resend, e o corte evita
    // despejar um corpo de erro inteiro no log.
    return { ok: false, motivo: "HTTP " + resposta.status + " " + bruto.slice(0, 200) };
  }

  return { ok: true };
}

module.exports = {
  BASE_DOS_ATIVOS,
  ENDERECO_DO_RESEND,
  LOGO,
  PRAZO_MS,
  REMETENTE_PADRAO,
  assuntoDoAviso,
  avisarLeadNovo,
  campanhaVisivel,
  corpoEmHtml,
  corpoEmTexto,
  escapar,
  quandoVisivel,
};
