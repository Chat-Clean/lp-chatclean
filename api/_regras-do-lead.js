/**
 * O que é um lead válido, em regra pura.
 *
 * Sem rede e sem `req`/`res`: valida o formulário, monta a mensagem que abre a
 * conversa no WhatsApp e nada mais.
 *
 * ─── POR QUE ESTE ARQUIVO É UMA CÓPIA, E NÃO UM IMPORT ───────────────────
 *
 * Este repositório é um projeto de deploy inteiro e sozinho: o que ele publica
 * é o que está aqui dentro. Ele NÃO enxerga o repositório do site, onde vive o
 * gêmeo deste arquivo (`src/domain/lead/leadDaLanding.js`). A duplicação é o
 * preço da separação em dois projetos, e é escolha, não descuido.
 *
 * As frases de erro são as MESMAS de `formulario.js`, palavra por palavra. Se
 * divergirem, a pessoa vê o campo passar no navegador e ser recusado pelo
 * servidor sem entender o que mudou — e é assim que um formulário vira uma
 * porta que abre às vezes.
 *
 * ─── COMMONJS DE PROPÓSITO ───────────────────────────────────────────────
 *
 * Este projeto não tem `package.json`, e sem ele o runtime Node da Vercel lê
 * `.js` como CommonJS. `import`/`export` aqui quebraria na primeira chamada.
 * Acrescentar um `package.json` só para trocar de sintaxe mudaria a detecção
 * de build de um site que hoje publica estático sem build nenhum.
 *
 * ─── O UNDERLINE NO NOME NÃO É ENFEITE ───────────────────────────────────
 *
 * Arquivo dentro de `api/` vira endpoint. Os que começam com `_` não viram: é
 * como este módulo fica ao lado da função sem ganhar uma URL própria.
 */

/** O WhatsApp para onde o lead segue depois de gravado. NÚMERO DE EXEMPLO. */
const WHATSAPP_DAS_LANDINGS = "5584998900718";

/** A versão do texto de consentimento aceito nos formulários. */
const VERSAO_DO_ACEITE = "2026-09-22";

/** As duas páginas. Vocabulário fechado: o banco tem o mesmo `check`. */
const LANDINGS = ["crm", "api-oficial"];

const IDS_DAS_FAIXAS = ["so-eu", "2-5", "6-15", "16-40", "40+"];
const IDS_DE_BLOQUEIO = ["sim", "quase", "nao"];

const LIMITES = { nome: 120, email: 160, empresa: 120 };

/**
 * Quanto um mesmo IP pode enviar antes de a porta fechar.
 *
 * Seis em dez minutos é folgado para gente de verdade — inclui errar o
 * formulário e reenviar, e inclui um escritório inteiro atrás do mesmo IP de
 * saída. É apertado para um laço de `curl`, que faz seis em dois segundos.
 *
 * Não é mais apertado porque, num formulário de LEAD, recusar quem é de
 * verdade custa muito mais caro do que deixar passar alguns falsos.
 */
const LIMITE_DE_ENVIOS = { porIp: 6, janelaMinutos: 10 };

/**
 * O campo-isca.
 *
 * Escondido fora da tela e fora da ordem de tabulação: quem usa a página com
 * olho, mouse ou leitor de tela nunca chega nele. Robô que preenche pelo nome
 * dos campos preenche, porque `site` parece um campo desejável.
 */
const CAMPO_ISCA = "site";

/* ─── As formas ──────────────────────────────────────────────────────────── */

const somenteDigitos = (bruto) => String(bruto == null ? "" : bruto).replace(/\D+/g, "");

const limpar = (bruto) =>
  String(bruto == null ? "" : bruto)
    .trim()
    .replace(/\s+/g, " ");

const FORMA_DO_EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

function telefoneEhValido(bruto) {
  const d = somenteDigitos(bruto);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  // Onze dígitos é celular, e celular brasileiro começa com 9 depois do DDD.
  if (d.length === 11 && d[2] !== "9") return false;
  return true;
}

/* ─── A validação ────────────────────────────────────────────────────────── */

/** A frase de erro de um campo, ou `null`. Diz o que fazer, não o que quebrou. */
function erroDoCampo(campo, valor, contexto) {
  const landing = (contexto || {}).landing;
  switch (campo) {
    case "nome": {
      const v = limpar(valor);
      if (v === "") return "Diga como podemos chamar você.";
      if (v.length > LIMITES.nome) return "Use até " + LIMITES.nome + " caracteres.";
      return null;
    }
    case "empresa": {
      const v = limpar(valor);
      if (v === "") return "Diga o nome da sua empresa.";
      if (v.length > LIMITES.empresa)
        return "Use até " + LIMITES.empresa + " caracteres.";
      return null;
    }
    case "email": {
      const v = limpar(valor).toLowerCase();
      if (v === "") return "Precisamos de um e-mail para enviar a proposta.";
      if (v.length > LIMITES.email) return "Use até " + LIMITES.email + " caracteres.";
      if (!FORMA_DO_EMAIL.test(v)) return "Confira o e-mail: falta o @ ou o domínio.";
      return null;
    }
    case "telefone": {
      const v = somenteDigitos(valor);
      if (v === "") return "Precisamos do WhatsApp para falar com você.";
      if (!telefoneEhValido(v)) return "Confira o número: DDD mais 8 ou 9 dígitos.";
      return null;
    }
    case "atendentes": {
      const v = limpar(valor);
      if (v === "") return "Escolha uma das opções.";
      // O navegador só confere se está vazio, porque as opções são pílulas de
      // rádio e não há como digitar outra coisa. Aqui o valor é conferido: o
      // corpo da requisição é escrito por quem chama, e quem chama pode não ser
      // a página. O `check` do banco recusaria de todo jeito, mas como erro de
      // banco — que a pessoa lê como "algo deu errado do nosso lado".
      if (IDS_DAS_FAIXAS.indexOf(v) === -1) return "Escolha uma das opções.";
      return null;
    }
    case "bloqueio": {
      // Só a landing da API Oficial pergunta: onde a pergunta não existe, a
      // ausência não é erro.
      if (landing !== "api-oficial") return null;
      const v = limpar(valor);
      if (v === "") return "Escolha uma das opções.";
      if (IDS_DE_BLOQUEIO.indexOf(v) === -1) return "Escolha uma das opções.";
      return null;
    }
    case "aceite":
      return valor === true ? null : "Marque para autorizar o contato.";
    default:
      return null;
  }
}

/** Os campos que a página pede, na ordem em que aparecem. */
function camposDaLanding(landing) {
  const comuns = ["nome", "empresa", "email", "telefone", "atendentes"];
  return landing === "api-oficial"
    ? comuns.concat(["bloqueio", "aceite"])
    : comuns.concat(["aceite"]);
}

/** Valida o formulário inteiro. Devolve `{ ok, erros, lead }`. */
function validarLeadDaLanding(bruto) {
  const corpo = bruto || {};
  const landing = limpar(corpo.landing);
  if (LANDINGS.indexOf(landing) === -1) {
    return { ok: false, erros: { landing: "Origem desconhecida." } };
  }

  const erros = {};
  for (const campo of camposDaLanding(landing)) {
    const valor = campo === "aceite" ? corpo.aceite === true : corpo[campo];
    const erro = erroDoCampo(campo, valor, { landing });
    if (erro) erros[campo] = erro;
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };

  return {
    ok: true,
    erros: {},
    lead: {
      landing: landing,
      nome: limpar(corpo.nome),
      email: limpar(corpo.email).toLowerCase(),
      telefone: somenteDigitos(corpo.telefone),
      empresa: limpar(corpo.empresa),
      atendentes: limpar(corpo.atendentes),
      bloqueio: landing === "api-oficial" ? limpar(corpo.bloqueio) : null,
      aceiteVersao: VERSAO_DO_ACEITE,
    },
  };
}

/* ─── A campanha ─────────────────────────────────────────────────────────── */

/**
 * Lista de permissão fechada: só os cinco `utm_*` padrão entram.
 *
 * `formulario.js` já filtra do lado de lá. Filtra de novo aqui porque o corpo
 * da requisição é escrito por quem chama, e copiar a querystring inteira
 * levaria para o banco qualquer coisa que um link carregasse — inclusive dado
 * pessoal colado por engano numa URL compartilhada.
 */
const PARAMETROS_DE_CAMPANHA = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

function campanhaDaBusca(busca) {
  const campanha = {};
  let parametros;
  try {
    parametros = new URLSearchParams(busca == null ? "" : busca);
  } catch (erro) {
    return campanha;
  }
  for (const chave of PARAMETROS_DE_CAMPANHA) {
    const valor = limpar(parametros.get(chave)).slice(0, 120);
    if (valor !== "") campanha[chave] = valor;
  }
  return campanha;
}

/* ─── O WhatsApp ─────────────────────────────────────────────────────────── */

/**
 * A mensagem que já vai escrita.
 *
 * Na voz de quem manda: é a pessoa que envia, não a ChatClean. Diz quem é, de
 * onde veio e o que quer, para o atendimento não recomeçar do zero perguntando
 * o que o formulário já respondeu.
 */
function mensagemDoWhatsApp(lead) {
  const dados = lead || {};
  const quem = limpar(dados.nome);
  const onde = limpar(dados.empresa);
  const pedido =
    dados.landing === "api-oficial"
      ? "Acabei de pedir a API Oficial do WhatsApp pelo site"
      : "Acabei de pedir uma demonstração do CRM pelo site";
  const abertura =
    "Olá! Sou " +
    (quem === "" ? "da" : quem + ", da") +
    " " +
    (onde === "" ? "minha empresa" : onde) +
    ".";
  return abertura + " " + pedido + " e quero continuar por aqui.";
}

/**
 * O endereço completo da conversa.
 *
 * Montado AQUI, e não no navegador: o número de destino é decisão do servidor.
 * Se alguém adulterar o formulário, o pior que consegue é gravar um lead com o
 * próprio nome errado, não desviar a conversa para outro número.
 */
function enderecoDoWhatsApp(lead, numero) {
  const texto = encodeURIComponent(mensagemDoWhatsApp(lead));
  return "https://wa.me/" + (numero || WHATSAPP_DAS_LANDINGS) + "?text=" + texto;
}

module.exports = {
  CAMPO_ISCA,
  LANDINGS,
  LIMITES,
  LIMITE_DE_ENVIOS,
  PARAMETROS_DE_CAMPANHA,
  VERSAO_DO_ACEITE,
  WHATSAPP_DAS_LANDINGS,
  campanhaDaBusca,
  camposDaLanding,
  enderecoDoWhatsApp,
  erroDoCampo,
  limpar,
  mensagemDoWhatsApp,
  somenteDigitos,
  telefoneEhValido,
  validarLeadDaLanding,
};
