# Landing pages da ChatClean

Duas páginas em HTML e CSS puros, sem build e sem dependência. **Um projeto só
da Vercel**, no domínio `lp.chatclean.com.br`, com as duas landings em caminhos
diferentes:

| Caminho | Página | Para quem | Chamada |
|---|---|---|---|
| `/` | CRM | quem já atende no WhatsApp e perde negócio no meio da conversa | agendar demonstração |
| `/api` | API Oficial | quem atende por chip e tem medo de bloqueio | ativar a API Oficial |

```
index.html               a landing de CRM, na raiz do domínio
api-oficial.html         a landing de API Oficial, servida em /api
estilo-crm.css           só o que é da página de CRM (o quadro do funil)
estilo-api-oficial.css   só o que é da de API (os dois estados do WhatsApp)
base.css                 identidade compartilhada pelas duas
formulario.js            máscara, validação e envio, compartilhado pelas duas
video.js                 troca a capa pelo player do YouTube, só na de CRM
ativos/                  logotipos e as marcas dos clientes
ativos/chatclean-email.png   o logotipo do e-mail, em PNG (ver abaixo)
ativos/video-crm.jpg     a capa do vídeo da demonstração
api/lead-landing.js      a função que grava o lead (o endpoint do formulário)
api/_regras-do-lead.js   o que é um lead válido, sem rede
api/_banco-de-leads.js   a gravação no Supabase com a chave de serviço
api/_aviso-por-email.js  o e-mail de lead novo para o atendimento
vercel.json              o rewrite de /api e o cabeçalho noindex
```

Uma cópia de cada arquivo compartilhado, que é a vantagem de ter voltado a um
projeto só: corrigir `base.css` ou `formulario.js` conserta as duas de uma vez.

### Como `/api` é uma página e `/api/lead-landing` é uma função

As duas coisas moram no mesmo prefixo, e isso é de propósito.

A landing da API Oficial é `api-oficial.html` na raiz, e um rewrite no
`vercel.json` dá a ela o endereço `/api`. A função do formulário é
`api/lead-landing.js`, que a Vercel publica em `/api/lead-landing` pela
convenção de Serverless Functions.

Elas não colidem porque a Vercel tenta o **sistema de arquivos antes dos
rewrites**: `/api/lead-landing` casa com a função e para ali; `/api` exato não
casa com arquivo nenhum — não existe `api/index.js` — e só então cai no
rewrite, que entrega a página.

Os módulos ao lado começam com `_` justamente por causa dessa convenção:
arquivo dentro de `api/` vira endpoint, e os prefixados com `_` não viram. É
como `_regras-do-lead.js` fica perto da função sem ganhar uma URL própria.

> Se um dia a página `/api` começar a responder 404, é este arranjo que
> quebrou. O teste é direto: `curl -I https://lp.chatclean.com.br/api` deve
> devolver HTML, e `curl -X POST .../api/lead-landing` deve devolver JSON.

## A identidade não foi reinventada

Cores, fontes e os dois tratamentos de latão vêm do site institucional
(`chatclean/src/App.css` e `chatclean/src/index.css`), copiados valor a valor
para CSS puro: verde `#51bc69`, verde-noite `#14231b`, creme `#f1efe5`, latão
`#b7923e`; Playfair Display nos títulos, Poppins no texto, Montserrat nos
rótulos e botões. Se a marca mudar lá, o lugar de mexer aqui é `base.css`.

O latão recortado no texto (`.latao`) só aparece sobre fundo escuro, que é onde
ele tem contraste e é como o site usa. Em seção clara a palavra destacada vai no
verde escuro (`.destaque`).

## As regras de escrita destas páginas

Valem para qualquer texto novo que entrar aqui:

- **Sem travessão.** Vira vírgula, dois-pontos ou frase nova.
- **Sem ponto final no fim de parágrafo, rótulo, item de lista ou cartão.** A
  pontuação interna continua: só o último ponto cai.
- **Cartão não é parágrafo.** Título curto, uma linha de apoio, e o resto vira
  chip (`<span class="chip">`). Se precisa de três linhas para explicar, o
  assunto é conversa com o time comercial, não texto de landing.
- **Exceção: depoimento de cliente.** As citações ficam palavra por palavra,
  com a pontuação de quem falou. Encurtar fala de cliente para caber num estilo
  é reescrever o depoimento.

## O que é interativo

Sem framework e quase sem JavaScript, tudo em CSS:

- cartão sobe, acende a borda, o selo do ícone vira verde cheio e um fio de
  latão se desenha no topo (`:hover` e `:focus-within`, então funciona pelo
  teclado também);
- na landing de CRM, o cartão do funil paira em laço sobre a vaga pontilhada, e
  os pontos dos canais soltam uma onda em sequência;
- na landing de API, o fio tracejado corre do WhatsApp para a ChatClean, o
  pulso verde bate no perfil verificado e a linha da tabela acende no hover;
- tudo respeita `prefers-reduced-motion`.

## Onde a logo aparece

Cabeçalho, marca d'água de uma seção por página, cabeçalho do painel do funil
(ali entra o logotipo horizontal branco, porque o painel é verde-escuro), topo
do formulário, azulejo ao lado do WhatsApp na landing de API, rodapé e favicon.
A marca d'água só vive em seção clara, e some abaixo de 760px, onde ela
sentaria atrás do próprio título.

`ativos/marca-chatclean.svg` é o símbolo sozinho, e é cópia do `logo-cc.svg`
do site, que já vem quadrado e completo.

**Não tente recortar o símbolo do logotipo horizontal pelo `viewBox`.** Já foi
tentado e não funciona: o pontinho solto do símbolo e a letra "C" se sobrepõem
no eixo x, então nenhum retângulo separa os dois. Recorte apertado come o rabo
do balão, e recorte folgado deixa entrar uma lasca da letra. Existindo
necessidade de uma versão branca do símbolo, ela tem que ser exportada do
arquivo de origem da marca, não derivada aqui.

## Sobre a marca do WhatsApp

A landing de API usa o símbolo do WhatsApp, apagado com selo de bloqueio de um
lado e aceso do outro, ao lado da marca da ChatClean. É referência ao produto de
que a página fala, e o aviso de marca registrada da Meta está no rodapé. Nenhuma
das duas cenas reproduz a interface do WhatsApp: são ilustrações da ChatClean,
na paleta da ChatClean.

## A demonstração em vídeo, só na landing de CRM

A seção `#ver-rodando` fica logo depois da faixa de clientes, na pegada de VSL:
rótulo curto, promessa de uma linha, o vídeo grande e **uma** saída embaixo,
que leva para o formulário. O vídeo é "Conheça nossa FERRAMENTA de CRM", e é
por isso que ele vive só nesta página: a de API Oficial fala de outra dor.

### A página não carrega um player, carrega uma capa

`ativos/video-crm.jpg` são 96 KB. O `<iframe>` do YouTube **não existe no HTML
entregue**: `video.js` cria ele no clique, já tocando.

Isso não é preciosismo. Um `<iframe>` do YouTube puxa mais de um mega de script
de terceiro, abre conexão para três domínios e entra na conta do tempo de carga
**mesmo de quem nunca dá play**. Aqui o clique já foi pago no anúncio, e página
lenta perde a pessoa antes de ela ler o título.

O player entra com `youtube-nocookie.com` (sem cookie para quem só assistiu),
`rel=0` (sem vídeo de concorrente na tela final, dentro da nossa landing) e
`playsinline=1` (sem sequestrar a tela no iPhone). Depois da troca, o foco vai
para o player: quem chegou pelo teclado acabou de ter o botão arrancado debaixo
do foco, e sem isso recomeçaria a navegação do topo da página.

> Para trocar o vídeo, mude `data-video` no HTML e regere a capa a partir de
> `https://i.ytimg.com/vi/<id>/maxresdefault.jpg`. A capa é servida daqui, e não
> do YouTube, para não pendurar a primeira dobra num domínio de terceiro.

## O formulário: máscara, validação e para onde vai

`formulario.js` cuida dos dois. Ao enviar, ele grava em `leads_das_landings` no
Supabase e leva a pessoa para o WhatsApp com a mensagem já escrita.

O caminho inteiro:

```
formulario.js            máscara do telefone, validação por campo, envio
  └─ POST /api/lead-landing          (api/lead-landing.js, deste projeto)
       └─ valida de novo             (api/_regras-do-lead.js)
       └─ confere o teto por IP      (api/_banco-de-leads.js)
       └─ grava com a chave de serviço
            └─ tabela leads_das_landings, RLS sem policy nenhuma
       └─ avisa o atendimento        (api/_aviso-por-email.js)
            └─ falhou aqui? o lead continua gravado
       └─ devolve { leadId, whatsappUrl }
  └─ navega para o whatsappUrl
```

**Todos os campos são obrigatórios**, inclusive as perguntas de pílula. O envio
só sai depois que todos passam.

### O telefone aceita com e sem o 9

Dez ou onze dígitos, os dois passam: `(84) 9890-0718` e `(84) 99890-0718`. Fixo
também. O único formato recusado é onze dígitos que não começam com 9 depois do
DDD, porque celular brasileiro não existe assim, e quase sempre é um dígito
digitado a mais.

O que impedia na prática **não era a validação, era a máscara**: ela reescreve o
valor inteiro a cada tecla, e o cursor pulava para o fim. Apagar o 9 do meio de
um número já digitado era brigar com o campo, e a conclusão natural é que ele
não deixa. Agora a posição é preservada, contada em **dígitos** e não em
caracteres, porque os parênteses e o traço aparecem e somem conforme o tamanho
muda.

**A validação do navegador não é a validação.** Qualquer um manda um POST direto
sem nunca abrir a página, então quem decide é o servidor. Quando ele recusa com
422, as frases dele são pintadas nos campos sem tradução: se as duas regras um
dia divergirem, quem ganha é a de lá.

**O número do WhatsApp não mora na página.** O endereço da conversa vem na
resposta do servidor, montado em `_regras-do-lead.js`
(`WHATSAPP_DAS_LANDINGS`). Quem adulterar o HTML consegue, no máximo, gravar um
lead com o próprio nome errado, não desviar a conversa.

### As regras são uma cópia, e isso é escolha

`api/_regras-do-lead.js` é gêmeo de `src/domain/lead/leadDaLanding.js`, no
repositório do site. Não é import: este projeto é uma unidade de deploy inteira
e sozinha, e não enxerga o outro repositório.

As frases de erro estão escritas **três vezes** — aqui, em `formulario.js` e no
site. Se divergirem, a pessoa vê o campo passar no navegador e ser recusado
pelo servidor sem entender o que mudou. Mexeu numa, confira as outras.

## O deploy: o que precisa estar no painel

As páginas e a função saem **do mesmo domínio**, este projeto. O formulário
posta em `/api/lead-landing`, caminho relativo, e mesma origem não pede
permissão a ninguém: não há `data-endereco` e não há CORS.

No projeto da Vercel, em *Settings → Environment Variables*, os dois nomes são
os **mesmos** do repositório do site, para os valores serem copiados sem
tradução:

| Variável | O que é | Onde achar |
|---|---|---|
| `SUPABASE_URL` | a URL do projeto Supabase | *Project Settings → Data API* |
| `SUPABASE_CHAVE_DE_SERVICO` | a `service_role` | *Project Settings → API Keys* |
| `RESEND_API_KEY` | a chave do Resend, para o aviso de lead novo | *resend.com → API Keys* |
| `RESEND_REMETENTE` | opcional: de quem o aviso vem | veja a seção do aviso |
| `LANDINGS_EMAIL_DESTINO` | opcional: para onde o aviso vai | o padrão está no código |
| `LANDINGS_BASE_PUBLICA` | opcional: o domínio que serve o logotipo do e-mail | o padrão é `lp.chatclean.com.br` |

A chave de serviço **ignora RLS**: é por isso que ela funciona contra uma
tabela que nega tudo, e é por isso que ela nunca pode levar prefixo `VITE_`,
que a mandaria para o navegador junto com a tabela inteira.

Sem as duas, a função responde 500 e a página diz *"o pedido de contato está
indisponível"*. O motivo exato fica no log da Vercel, nunca na resposta.

Abrir o arquivo com duplo clique (`file://`) mostra a página e a máscara, mas o
envio falha: não há função do outro lado. O `/api` também só existe depois do
deploy, porque é rewrite; localmente a página é `api-oficial.html`.

## O aviso de lead novo, por e-mail

Gravou, avisa: cada lead dispara um e-mail para
`chatcleanatendimento@gmail.com` com a ficha e um botão que abre a conversa no
WhatsApp **com o lead**. O número aparece uma vez só, na ficha, e clicável:
repetir embaixo do botão era dizer a mesma coisa duas vezes na mesma tela.

O aviso sai de `api/_aviso-por-email.js`, chamado pela função logo depois da
gravação. Não há gatilho no banco: quem escreve nessa tabela é só essa função,
então "gravou" e "avisar" são o mesmo instante.

O que vai no e-mail: nome, empresa, WhatsApp clicável, e-mail clicável, quantos
atendentes, se já foi bloqueado (só na de API), de qual página veio, a campanha
(`utm`) e a hora. **Não vai o IP** — ele existe para auditoria do consentimento
e para o teto de envios, não para a caixa de entrada do time.

Três detalhes que economizam tempo de quem recebe:

- o **assunto** traz página, nome e empresa, para triar sem abrir;
- quando a resposta de bloqueio é *"Sim, já caiu"*, o assunto grita
  `JÁ FOI BLOQUEADO`: é o lead mais quente que estas páginas produzem;
- **responder o e-mail responde para o lead** (`reply_to`), sem copiar endereço.

### O logotipo do e-mail é um PNG, e existe só para isso

`ativos/chatclean-email.png` é o logotipo latão, 340x68, exibido a 170x34 (o
dobro é para não borrar em tela retina). Ele não é o mesmo que as páginas usam,
e a diferença tem motivo:

- **cliente de e-mail não renderiza SVG.** Gmail e Outlook descartam `<img>`
  apontando para SVG, que é o formato dos ativos das páginas;
- **`data:` URI embutido também não passa** nos dois, então não adianta colar a
  imagem dentro do HTML: ela precisa ser baixada de um endereço público;
- por isso o `src` é absoluto, apontando para este mesmo domínio.

O `<img>` leva `alt="ChatClean"` pintado de latão, e isso **não é enfeite**:
Gmail bloqueia imagem de remetente desconhecido por padrão, então o primeiro
aviso que o time receber vai chegar com o logotipo desligado.

Se o domínio das páginas mudar, `LANDINGS_BASE_PUBLICA` conserta o endereço sem
mexer no código.

> Para gerar de novo, a partir do PNG de origem da marca: o recorte descarta a
> folga transparente em volta (eram 780px só na horizontal) e a redução usa
> média por área com alfa pré-multiplicado, senão a borda do logotipo ganha
> auréola. Não tente rasterizar `ativos/chatclean-white.svg`: ele é uma imagem
> raster embutida com `feColorMatrix`, e sai em branco.

### Um aviso perdido não é um lead perdido

Se o Resend estiver fora, se a chave faltar ou se o e-mail for recusado, o lead
**continua gravado** e a pessoa continua indo para o WhatsApp. A falha vai para
o log da Vercel com o `leadId`, e é por ali que se acha o lead que não virou
e-mail. O contrário — perder um lead porque o provedor de e-mail piscou —
trocaria um problema de aviso por um problema de receita.

O envio é esperado antes da resposta, e não largado para depois: função
serverless pode ser congelada assim que responde, e o que fica para trás às
vezes simplesmente não acontece. O prazo é curto (4s) para o formulário não
ficar pendurado.

### O remetente precisa de domínio verificado

Sem configurar nada, o aviso sai de `onboarding@resend.dev`, que é o domínio de
teste do Resend — e ele **só entrega para o e-mail dono da conta**. Para o
aviso chegar de verdade em `chatcleanatendimento@gmail.com`:

1. no Resend, *Domains → Add Domain*, `chatclean.com.br`;
2. publique os registros DNS que ele pedir (SPF, DKIM e o de retorno);
3. ponha `RESEND_REMETENTE` como `ChatClean <lead@chatclean.com.br>`.

Enquanto o domínio não estiver verificado, o teste possível é abrir a conta do
Resend com o próprio `chatcleanatendimento@gmail.com`: aí o domínio de teste
entrega nele.

## A segurança do endpoint

O formulário é público por natureza: qualquer um posta nele sem nunca abrir a
página. Estas são as camadas, e o que cada uma realmente cobre.

| Camada | Contra o quê | Onde |
|---|---|---|
| Validação no servidor | corpo malformado, campo fora do vocabulário | `_regras-do-lead.js` |
| RLS sem política e `revoke` | leitura ou escrita por `anon`/`authenticated` | migração |
| Chave de serviço só no servidor | qualquer acesso direto ao banco | `_banco-de-leads.js` |
| Restrições da tabela | valor inválido que passasse pela validação | migração |
| Teto de envios por IP | enchente automática | `lead-landing.js` |
| Campo-isca | robô que preenche formulário por nome de campo | os dois HTML |
| Teto de corpo | payload grande gastando memória | `lead-landing.js` |

### O que CORS não fazia

A versão anterior tinha `LANDINGS_ORIGENS_PERMITIDAS`, descrita como defesa. Não
era. **CORS é imposto pelo navegador, não pelo servidor**: medido, um POST sem
cabeçalho `Origin` gravava normalmente, e com `Origin` de qualquer site também.
A lista só decidia se o navegador deixava a página LER a resposta. Removida
junto com a necessidade dela, agora que tudo é mesma origem.

### O teto de envios

Seis por IP a cada dez minutos, em `LIMITE_DE_ENVIOS`. Folgado para gente de
verdade, inclusive um escritório inteiro atrás do mesmo IP de saída; apertado
para um laço, que faz seis em dois segundos. Estourou, responde `429` com
`Retry-After` e uma frase que não revela qual é o número.

Duas decisões que parecem frouxas e são deliberadas:

- **Falha aberta.** Se a contagem não responde, o lead passa. Banco lento
  derrubando a captação troca um problema de lixo por um problema de receita.
- **Sem IP, sem teto.** Em ambiente sem proxy o cabeçalho não vem, e barrar
  todo mundo nesse caso seria pior que não barrar ninguém.

O teto contém enchente; ele não é o portão. Quem precisar de mais que isso: o
Firewall da Vercel faz limite de taxa na borda, antes de a função rodar.

### O campo-isca

Um `<input name="site">` fora da tela, fora da ordem de tabulação e
`aria-hidden`. Ninguém que use a página com olho, mouse ou leitor de tela chega
nele; robô que preenche por nome de campo preenche.

Quando vem preenchido, o servidor responde **201, como se tivesse dado certo**,
e não grava. Recusar ensinaria o robô a tentar de novo sem o campo. A conferência
acontece depois da validação, também de propósito: assim o tempo de resposta não
denuncia a armadilha.

**Não troque o CSS dele por `display: none`.** Parte dos robôs pula campo
escondido assim, e a isca deixa de pescar.

## As duas na mesma tabela, separadas por uma coluna

Tudo vai para `leads_das_landings`, e a coluna `landing` diz de onde veio:
`'crm'` ou `'api-oficial'`. Há índice em `(landing, criado_em desc)`, então
filtrar por uma delas é barato.

```sql
-- o que cada página trouxe
select landing,
       count(*)                                 as leads,
       count(*) filter (where estado = 'novo')  as ainda_novos,
       count(*) filter (where bloqueio = 'sim') as ja_foram_bloqueados
from public.leads_das_landings
group by landing
order by landing;
```

As diferenças de cada formulário sobrevivem na mesma tabela: `bloqueio` só vem
preenchido pela página de API Oficial, e é `null` na de CRM. A restrição do
banco permite `null`, mas a validação do servidor **exige** a resposta quando a
landing é `api-oficial` — o campo é opcional para o schema e obrigatório para o
formulário que o mostra.

## Uma decisão que vale revisão

**Não há tabela de preços na página de CRM.** Os valores em
`src/domain/assinatura/planos.js` estão marcados no próprio arquivo como
mockup, e o playbook comercial manda abrir preço só depois de qualificar a dor.
A seção "Quanto custa" explica a régua (usuários × canais) e promete a conta
aberta na proposta. Havendo tabela real, vira uma seção de planos.

## Mobile tem a mesma experiência, não uma versão reduzida

Duas peças precisaram de solução própria em vez de simplesmente encolher:

- **O quadro do funil (CRM).** Três colunas não cabem em 390px, e a que importa
  (a do destino, com a vaga pontilhada) ficava fora da tela, então o cartão em
  trânsito estava escondido no celular. Abaixo de 640px a **primeira** coluna
  some: as duas que contam a história cabem inteiras e a cena volta.
- **A tabela comparativa (API).** Rolar de lado escondia justamente a coluna da
  ChatClean: quem abria no celular via só os "não" do aplicativo comum. Abaixo
  de 760px cada linha vira um cartão com o critério em cima e as duas respostas
  rotuladas embaixo. Os rótulos saem do CSS, do cabeçalho que some, então não há
  texto duplicado no HTML.

Conferido em 360, 390, 768, 1024 e 1440px: sem estouro horizontal em nenhuma das
três páginas.

## Antes de publicar

- **`SUPABASE_URL` e `SUPABASE_CHAVE_DE_SERVICO` precisam estar no projeto da
  Vercel**, nos três ambientes. Sem elas as páginas sobem bonitas e o
  formulário responde erro no envio, que é o jeito mais caro de descobrir.
- **`RESEND_API_KEY` também**, senão o lead é gravado e ninguém fica sabendo.
  Essa falha é silenciosa para quem preencheu: só aparece no log da Vercel.
- Mande um lead de teste depois de publicar e confira as duas pontas: a linha
  na tabela `leads_das_landings` e o e-mail na caixa do atendimento.
- As duas páginas estão com `noindex, nofollow`: são páginas de anúncio e não
  devem competir com o site no orgânico. Tirar só se a intenção mudar.
- Os números dentro das ilustrações (funil, contagens do número bloqueado) são
  exemplo.
- Os depoimentos e os logotipos de cliente são os mesmos já publicados no site.
