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
ativos/                  logotipos e as marcas dos clientes
vercel.json              o rewrite de /api e o cabeçalho noindex
```

Uma cópia de cada arquivo compartilhado, que é a vantagem de ter voltado a um
projeto só: corrigir `base.css` ou `formulario.js` conserta as duas de uma vez.

### Por que `/api` não é uma pasta `api/`

Na Vercel, `api/` é a convenção de Serverless Functions, e arquivo dentro dela
corre o risco de ser tratado como função em vez de página. O arquivo mora na
raiz como `api-oficial.html`, e um rewrite no `vercel.json` dá o endereço
`/api` sem encostar na convenção.

**Isso não conflita com a API de verdade.** O formulário posta em
`chatclean.com.br/api/lead-landing`, que é outro domínio, o do site. O `/api`
daqui é uma página; o `/api/...` de lá é a função. Domínios diferentes, sem
colisão.

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

## O formulário: máscara, validação e para onde vai

`formulario.js` cuida dos dois. Ao enviar, ele grava em `leads_das_landings` no
Supabase e leva a pessoa para o WhatsApp com a mensagem já escrita.

O caminho inteiro:

```
formulario.js            máscara do telefone, validação por campo, envio
  └─ POST /api/lead-landing          (chatclean/api/lead-landing.js)
       └─ valida de novo             (src/domain/lead/leadDaLanding.js)
       └─ grava com a chave de serviço  (api/_nucleo/bancoDeLeads.js)
            └─ tabela leads_das_landings, RLS sem policy nenhuma
       └─ devolve { leadId, whatsappUrl }
  └─ navega para o whatsappUrl
```

**Todos os campos são obrigatórios**, inclusive as perguntas de pílula. O envio
só sai depois que todos passam.

**A validação do navegador não é a validação.** Qualquer um manda um POST direto
sem nunca abrir a página, então quem decide é o servidor. Quando ele recusa com
422, as frases dele são pintadas nos campos sem tradução: se as duas regras um
dia divergirem, quem ganha é a de lá.

**O número do WhatsApp não mora na página.** O endereço da conversa vem na
resposta do servidor, montado em `leadDaLanding.js`
(`WHATSAPP_DAS_LANDINGS`). Quem adulterar o HTML consegue, no máximo, gravar um
lead com o próprio nome errado, não desviar a conversa.

## O deploy: dois projetos ao todo

| Projeto da Vercel | Root Directory | Domínio |
|---|---|---|
| o do site (já existe) | `chatclean/` | `chatclean.com.br`, e é onde a API roda |
| novo | `chatclean landing pages/` | `lp.chatclean.com.br` |

### Os três passos

1. **Repositório.** Esta pasta não está sob controle de versão. Para a Vercel
   fazer deploy por Git, ela precisa estar num repositório: próprio, ou dentro
   do `chatclean/` com o Root Directory do projeto apontando para cá.
2. **Domínio.** `lp.chatclean.com.br` no projeto novo.
3. **CORS, no projeto do SITE** (é lá que a API roda), como variável de
   ambiente:

```
LANDINGS_ORIGENS_PERMITIDAS=https://lp.chatclean.com.br
```

Uma origem só, porque as duas páginas vivem no mesmo domínio agora. Sem essa
variável, nenhuma origem externa é liberada e o formulário falha com erro de
CORS no navegador. É o padrão seguro: endpoint que grava dado pessoal não aceita
qualquer origem só porque é mais fácil. Correspondência exata, sem curinga e sem
a barra no fim.

Mudou o domínio? Dois lugares: a variável acima e o `data-endereco` dos dois
`<form>`. O projeto em si não sabe o próprio nome.

Abrir o arquivo com duplo clique (`file://`) mostra a página e a máscara, mas o
envio falha: o navegador barra a chamada. O `/api` também só existe depois do
deploy, porque é rewrite; localmente a página é `api-oficial.html`.

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

- As duas páginas estão com `noindex, nofollow`: são páginas de anúncio e não
  devem competir com o site no orgânico. Tirar só se a intenção mudar.
- Os números dentro das ilustrações (funil, contagens do número bloqueado) são
  exemplo.
- Os depoimentos e os logotipos de cliente são os mesmos já publicados no site.
