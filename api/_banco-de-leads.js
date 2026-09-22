/**
 * A gravação do lead no Supabase, pelo PostgREST.
 *
 * Duas operações: inserir e contar os envios recentes de um IP. Não lê lead,
 * não atualiza, não apaga — a landing não tem motivo para nenhuma dessas
 * coisas, e superfície menor é a defesa mais barata que existe.
 *
 * ─── POR QUE A CHAVE DE SERVIÇO ──────────────────────────────────────────
 *
 * A tabela `leads_das_landings` tem RLS ligada e NENHUMA policy, e `anon` e
 * `authenticated` tiveram o privilégio revogado. Isso é deny por construção:
 * nem com a chave publicável alguém lê ou escreve ali. Esta função é o único
 * caminho, e ela entra com a chave de serviço, que ignora RLS.
 *
 * Por isso a chave vive SÓ aqui: variável de ambiente sem prefixo `VITE_`,
 * nunca em arquivo do repositório, nunca impressa. Se ela vazasse para o
 * navegador, a tabela inteira vazaria junto.
 *
 * ─── A CREDENCIAL NUNCA APARECE NA MENSAGEM DE ERRO ──────────────────────
 *
 * `esconder` troca a chave por um marcador antes de qualquer texto sair daqui.
 * Erro de rede às vezes carrega a URL inteira, e a URL às vezes carrega o
 * cabeçalho — é assim que credencial vai parar num log de plataforma sem
 * ninguém ter escrito `console.log(chave)`.
 */

const TABELA = "leads_das_landings";

const PRAZO_PADRAO_MS = 5000;

const TIPOS = {
  CONFIGURACAO: "CONFIGURACAO",
  BANCO: "BANCO",
  BANCO_INDISPONIVEL: "BANCO_INDISPONIVEL",
};

/**
 * A configuração, lida do ambiente.
 *
 * Os dois nomes são os MESMOS do repositório do site, de propósito: quem for
 * preencher o painel da Vercel copia os valores de um projeto para o outro sem
 * traduzir nome de variável — e nome traduzido é como uma das duas metades
 * silenciosamente para de funcionar.
 */
function lerAmbiente(ambiente) {
  const fonte = ambiente || {};
  const faltando = [];

  const pegar = (nomes) => {
    for (const nome of nomes) {
      const bruto = fonte[nome];
      if (typeof bruto === "string" && bruto.trim() !== "") return bruto.trim();
    }
    faltando.push(nomes[0]);
    return "";
  };

  const url = pegar(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const chaveDeServico = pegar(["SUPABASE_CHAVE_DE_SERVICO"]);

  if (faltando.length > 0) return { ok: false, faltando: faltando };

  // Sem a barra final, para que a concatenação não produza `//rest/v1` — que o
  // PostgREST responde com 404 e ninguém entende por quê.
  return {
    ok: true,
    config: { url: url.replace(/\/+$/, ""), chaveDeServico: chaveDeServico },
  };
}

function criarBancoDeLeads(opcoes) {
  const url = opcoes.url;
  const chaveDeServico = opcoes.chaveDeServico;
  const buscar = opcoes.buscar || globalThis.fetch;
  const prazoMs = opcoes.prazoMs || PRAZO_PADRAO_MS;

  const esconder = (texto) => {
    let s = String(texto == null ? "" : texto);
    if (typeof chaveDeServico === "string" && chaveDeServico.length >= 8) {
      s = s.split(chaveDeServico).join("«credencial oculta»");
    }
    return s;
  };

  const cabecalhos = () => ({
    apikey: chaveDeServico,
    Authorization: "Bearer " + chaveDeServico,
  });

  function sinal(ms) {
    try {
      return AbortSignal.timeout(ms);
    } catch (erro) {
      return undefined;
    }
  }

  return {
    /**
     * Grava o lead e devolve o `id` gerado pelo banco.
     *
     * `Prefer: return=representation` traz a linha de volta na mesma ida: o
     * `id` serve para correlacionar o registro com o log sem uma segunda
     * viagem, que poderia falhar sozinha.
     */
    async inserir(linha) {
      let resposta;
      try {
        resposta = await buscar(url + "/rest/v1/" + TABELA, {
          method: "POST",
          headers: Object.assign(cabecalhos(), {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          }),
          body: JSON.stringify(linha),
          signal: sinal(prazoMs),
        });
      } catch (erro) {
        return {
          ok: false,
          tipo: TIPOS.BANCO_INDISPONIVEL,
          mensagem: "não conseguimos falar com o banco agora",
          detalhe: esconder((erro && erro.message) || "falha de rede"),
        };
      }

      const bruto = await resposta.text().catch(() => "");

      if (!resposta.ok) {
        return {
          ok: false,
          tipo: resposta.status >= 500 ? TIPOS.BANCO_INDISPONIVEL : TIPOS.BANCO,
          mensagem: "o banco recusou a gravação",
          detalhe: esconder("HTTP " + resposta.status + " " + bruto),
        };
      }

      let dados = null;
      if (bruto !== "") {
        try {
          dados = JSON.parse(bruto);
        } catch (erro) {
          return {
            ok: false,
            tipo: TIPOS.BANCO,
            mensagem: "o banco respondeu algo que não é JSON",
            detalhe: esconder(bruto.slice(0, 300)),
          };
        }
      }

      const gravada = Array.isArray(dados) ? dados[0] : dados;
      if (!gravada || !gravada.id) {
        return {
          ok: false,
          tipo: TIPOS.BANCO,
          mensagem: "a gravação não devolveu identificador",
          detalhe: esconder(JSON.stringify(dados).slice(0, 300)),
        };
      }

      // `criado_em` vem junto porque o aviso por e-mail mostra a hora, e a
      // hora certa é a que o banco carimbou — não a que a função achava que
      // era um instante depois.
      return { ok: true, id: gravada.id, criadoEm: gravada.criado_em || null };
    },

    /**
     * Quantos envios este IP já fez na janela, até o teto.
     *
     * Pede no máximo `teto` linhas de propósito: a pergunta não é "quantos ao
     * todo", é "já passou do limite". Contar tudo faria uma varredura crescer
     * junto com o ataque que ela deveria conter.
     *
     * ─── FALHA ABERTA, E ISSO É ESCOLHA ──────────────────────────────────
     *
     * Se a consulta não responde, devolve `{ ok: false }` e quem chama deixa
     * passar. O contrário — banco lento derrubando a captação de leads — troca
     * um problema de lixo por um problema de receita. O teto existe para
     * conter enchente, não para ser o portão principal.
     */
    async contarRecentes(pedido) {
      const ip = pedido.ip;
      if (!ip) return { ok: true, total: 0 };

      const desde = new Date(Date.now() - pedido.minutos * 60000).toISOString();
      const busca = new URLSearchParams({
        select: "id",
        aceite_ip: "eq." + ip,
        criado_em: "gte." + desde,
        limit: String(pedido.teto),
      });

      let resposta;
      try {
        resposta = await buscar(url + "/rest/v1/" + TABELA + "?" + busca, {
          headers: cabecalhos(),
          signal: sinal(prazoMs),
        });
      } catch (erro) {
        return {
          ok: false,
          detalhe: esconder((erro && erro.message) || "falha de rede"),
        };
      }

      if (!resposta.ok) {
        const bruto = await resposta.text().catch(() => "");
        return {
          ok: false,
          detalhe: esconder("HTTP " + resposta.status + " " + bruto),
        };
      }

      let dados;
      try {
        dados = await resposta.json();
      } catch (erro) {
        return { ok: false, detalhe: "contagem não devolveu JSON" };
      }

      return { ok: true, total: Array.isArray(dados) ? dados.length : 0 };
    },
  };
}

/** O banco a partir das variáveis de ambiente, ou o erro de configuração. */
function bancoDoAmbiente(ambiente) {
  const lido = lerAmbiente(ambiente);
  if (!lido.ok) {
    // O que faltou vira uma linha de diagnóstico que vai para o log do
    // servidor — nunca para a resposta.
    return {
      ok: false,
      tipo: TIPOS.CONFIGURACAO,
      mensagem: "a captação de leads não está configurada neste ambiente",
      detalhe: lido.faltando.map((nome) => "ausente: " + nome).join("; "),
    };
  }
  return { ok: true, banco: criarBancoDeLeads(lido.config) };
}

module.exports = {
  PRAZO_PADRAO_MS,
  TABELA,
  TIPOS,
  bancoDoAmbiente,
  criarBancoDeLeads,
  lerAmbiente,
};
