# LeadSfera — arquitetura

Loja Next.js de leads B2B de Belo Horizonte. O visitante escolhe um lead, paga com Pix e recebe uma amostra do CSV por e-mail. Interface em português, preços em reais inteiros, tema escuro.

Este arquivo é o contexto para um chat novo. Não contém segredos. Os valores reais ficam só no `.env`, que não vai para o git.

## Como rodar

- Node `>= 20`.
- `npm run dev` sobe na porta padrão do Next (`http://localhost:3000`). Se essa porta estiver ocupada, use `npm run dev -- -p 3001`.
- `npm run build` / `npm start` / `npm run lint`.
- O Next só lê o `.env` quando o processo inicia. Depois de editar o `.env`, reinicie o servidor.
- Não há `.env.example`. O modelo das variáveis está na seção Ambiente, abaixo.
- Não faça commit a menos que seja pedido. Não commite `.env`, `private/orders/`, `private/purchases.json` nem listas reais de clientes.

## Regras de produto

- O site público fala em Pix. Não cita o nome do gateway na interface nem nas mensagens de erro do visitante. Comentários, logs e `.env` podem citar.
- A vitrine separa os leads pelas 9 regiões administrativas de Belo Horizonte (Barreiro, Centro-Sul, Leste, Nordeste, Noroeste, Norte, Oeste, Pampulha e Venda Nova). A região gravada no lead é o campo `city`.
- Vocabulário da vitrine: "leads", "qualificados". Não usar "listas", "premium" nem "telefone fixo".
- O título do catálogo é só "Leads Qualificados". A rota continua `/listas`.
- Todo card tem quantidade de 1 a 999, "Comprar agora" e "Adicionar ao carrinho".
- O preço cobrado é sempre o do catálogo no servidor, vezes a quantidade. O navegador não envia preço.
- Os CSV em `private/products/` podem ser amostras. Listas reais não entram no git.
- A loja pública ordena os leads do maior preço para o menor. Empate de preço usa o nome.
- Erros mostrados ao visitante não citam variável de ambiente, arquivo `.env` nem o nome do gateway.

## Stack

- Next.js 15.5 App Router, React 19, TypeScript, Tailwind CSS v4, fonte Inter.
- Serviços: `resend` (e-mail) e `@vercel/blob` (histórico de compras no site publicado).
- `next.config.ts`: `poweredByHeader: false` e `experimental.serverActions.bodySizeLimit: "8mb"` (o CSV do admin cabe nesse limite; a validação da action corta em 5 MB).
- Páginas que leem o catálogo usam `export const dynamic = "force-dynamic"`.
- `middleware.ts` protege `/admin`, exceto `/admin/login`.

## Visual

Definido em `app/globals.css` (`@theme`):

| Token | Valor | Uso |
| --- | --- | --- |
| `ink` | `#07080c` | fundo |
| `panel` | `#101218` | cards |
| `paper` | `#f4f1ea` | texto |
| `mute` | `#b7b2a8` | texto secundário |
| `neon` | `#00e887` | ação principal |
| `electric` | `#4c8dff` | destaque / erro |
| `line` | branco 10% | borda |

Classes: `text-neon`, `bg-neon`, `text-electric`, `border-line`, `bg-panel`, `text-mute`, `text-ink`, `text-paper`. Largura das páginas: `max-w-[1120px]`.

## Mapa de pastas

```
app/
  page.tsx                 home: hero, destaques, como funciona, FAQ
  listas/page.tsx          catálogo completo
  listas/[id]/page.tsx     página do lead
  nichos/[slug]/page.tsx   leads de um submenu, agrupados por região
  carrinho/page.tsx        revisão do carrinho
  checkout/page.tsx        pedido, total e dados do pagador
  sucesso|pendente|falha/  telas antigas; o Pix atual não redireciona para elas
  admin/                   login e painel
  api/checkout/route.ts    cria a cobrança Pix
  api/checkout/status/     a tela consulta se o Pix já foi pago
  api/webhook/route.ts     confirma o pagamento e envia o CSV
  api/download/route.ts    baixa a mesma amostra do e-mail, com link assinado
components/                UI. Catálogo e checkout não importam fs no cliente
lib/                       regras de servidor e tipos compartilhados
middleware.ts              sessão do admin
private/
  catalog.json             produtos
  niches.json              submenus do header
  products/*.csv           arquivos de origem
  orders/*.json            pedido pendente (fallback local); gitignored
  purchases.json           histórico local; gitignored. No site publicado o histórico vai para o Blob
```

## Rotas

| Rota | O que faz |
| --- | --- |
| `/` | Hero, destaques, processo, FAQ |
| `/listas` | Todos os cards, do mais caro ao mais barato |
| `/listas/[id]` | Página do lead. O `id` acompanha o nome atual |
| `/nichos/[slug]` | Leads daquele submenu, agrupados por `city` |
| `/carrinho` | Itens do `localStorage`, quantidades, total |
| `/checkout?pedido=id:qtd,id:qtd` | Resumo + formulário Pix. `origem=carrinho` faz "Voltar" ir para `/carrinho` |
| `/admin/login` | Senha `ADMIN_PASSWORD`. A tela não cita a variável |
| `/admin` | Lista e edita leads. `/admin/novo` cria um. `/admin/[id]` edita |
| `/admin/compras` | Histórico: aguardando, pago, cliente, itens, valor e envio do CSV |
| `POST /api/checkout` | Gera Pix. A resposta inclui `transaction_id` para a tela consultar |
| `GET /api/checkout/status?transaction=` | `paid` se o gateway estiver em `paid` ou `completed`. Não envia o CSV |
| `POST /api/webhook` | Aviso do gateway, form-urlencoded |
| `GET /api/download?token=` | Amostra do CSV se o HMAC, `n` e a expiração forem válidos |

Header (`components/site-header.tsx`): Leads (dropdown com os submenus de `private/niches.json`), Como funciona (`/#como-funciona`), Dúvidas (`/#faq`), carrinho com badge, "Ver Leads". O dropdown só aparece no desktop.

"Comprar agora" não abre formulário no card. Vai para `/checkout` com a quantidade escolhida, sem mexer no carrinho. "Ir para o pagamento" manda o carrinho inteiro para a mesma página. O helper é `checkoutPath()` em `lib/order.ts`.

## Catálogo

Tipo `Product` em `lib/products.ts`. Preço é inteiro em reais. `productSku()` devolve `LS-{state}-{leads}` e é só rótulo visual.

Campos opcionais: `featured`, `highlight`, `whatsappVerified` (selo "WhatsApp Validado") e `qualified` (selo "Qualificado" ao lado). Os dois selos só aparecem quando marcados no admin.

`lib/catalog.ts` lê e grava `private/catalog.json` com fila e escrita atômica. Se o arquivo não existe, grava `lib/catalog-seed.ts`. `listProducts()` devolve do maior preço ao menor.

`lib/product-file.ts` lê e grava CSV em `private/products/`, recusando `..`, `/` e `\`.

`getProduct`, `listProducts` e o destaque são funções de servidor. O cliente recebe os produtos por props (`CartView`, `CheckoutView`). Não importe `lib/catalog.ts` num componente `"use client"`.

O `id` público nasce do nome (`slugify`). Ao editar, se o nome mudar, o `id` é recalculado. O `fileName` do CSV não muda junto.

Admin (`app/admin/actions.ts`):

- CSV até 5 MB, extensão `.csv`, sem byte nulo.
- Preço inteiro de 1 a 100000.
- `leads` é o número do card. Se o admin não informar na criação, conta as linhas do CSV menos o cabeçalho.
- O lead precisa de um submenu que exista em `private/niches.json`. O nome gravado é o nome canônico desse submenu.
- Destaque, WhatsApp verificado e qualificado são independentes. Marcar um não desmarca os outros.
- Remover um submenu não apaga os leads. Remover um lead apaga o CSV se nenhum outro produto usa o mesmo arquivo.
- Há no máximo 24 submenus.

## Carrinho

`components/cart-provider.tsx`, chave `localStorage` `leadsfera-cart`. Guarda só `{ productId, quantity }`. Quantidade máxima 999 por produto (`MAX_QUANTITY` em `lib/order.ts`).

O pedido na URL e na cobrança usa `encodeOrder`: `id:qtd,id:qtd`, no máximo 256 caracteres. Ids são kebab-case. `decodeOrder` também aceita um id solto (quantidade 1) por causa de referências antigas. O checkout aceita no máximo 20 linhas distintas.

## Pagamento Pix

Gateway: PagHiper. Código em `lib/paghiper.ts`. Não mostrar esse nome ao visitante.

`POST /api/checkout` recebe JSON:

```json
{ "items": [{ "productId": "...", "quantity": 1 }], "payerName": "", "payerEmail": "", "payerCpfCnpj": "" }
```

Também aceita `productId` + `quantity` avulsos. Valida nome (3–255), e-mail e CPF/CNPJ com 11 ou 14 dígitos, sem dígito verificador, para o CPF de teste do gateway funcionar.

Fluxo:

1. Monta os itens com o preço do catálogo. `price_cents` é string de `reais * 100`.
2. Recusa total abaixo de R$ 3,00 (300 centavos). É o mínimo do Pix nesse gateway.
3. `order_id` (máx. 64) carrega a referência `id:qtd,id:qtd`, com um sufixo `|` + 6 hex quando cabe, para cobranças iguais não colidirem. Se o texto não cabe, os ids vão compactados (`~` + prefixo de SHA-256, reversível pelo catálogo). Se nem assim couber, o checkout responde 400. Uma cópia segue em `private/orders/` onde o disco permite; na Vercel o webhook não depende desse arquivo.
4. `POST https://pix.paghiper.com/invoice/create/` com `apiKey`, `token`, pagador, `notification_url` (`NEXT_PUBLIC_APP_URL` + `/api/webhook`), `days_due_date: 1` e os itens.
5. Só devolve o Pix se o HTTP for ok, `result === "success"`, o EMV começar com `000201` e o valor em centavos bater com o catálogo.
6. Grava a compra como aguardando no histórico.
7. Resposta ao frontend: `{ pix_code, qrcode_image_url, transaction_id }`. O QR é uma URL do gateway ou, se ela não vier, um `data:image/png;base64,...`. A tela consulta `GET /api/checkout/status` a cada 4 segundos e, quando o Pix está pago, troca o QR por "Pagamento confirmado!".

`components/pix-checkout.tsx` mostra o formulário e, depois, o QR e o copia e cola. O cliente está em `lib/checkout-client.ts`.

Erros ao visitante: mensagem genérica de Pix, sem nome de variável e sem nome do gateway. O log do servidor pode citar a variável ausente. Falha do gateway → 502, sem stack.

## Webhook e entrega

`POST /api/webhook` recebe `application/x-www-form-urlencoded`: `notification_id` e `transaction_id` (também aceita `idTransacao` e `id_transacao`).

A `apiKey` e o token que chegam nesse POST não autenticam a entrega. Se a apiKey vier e for diferente da do `.env`, a rota responde 401. A confirmação é feita com as credenciais do servidor:

1. `POST https://pix.paghiper.com/invoice/notification/` com `transaction_id` e `notification_id`. É essa chamada que devolve pedido, pagador, valor e status. O endpoint `invoice/status/` não consulta por `notification_id`.
2. `POST https://pix.paghiper.com/invoice/status/` com `transaction_id`.

O CSV só sai se as duas respostas concordarem em `paid` ou `completed`, no `transaction_id` e no valor. A referência dos itens sai do `order_id`. Se o pedido local existir, o valor e o e-mail têm de bater com o que foi salvo (cobranças antigas, só com UUID, continuam dependendo desse arquivo). Sem o arquivo, o total é recalculado pelo catálogo e o e-mail é o que a API do gateway confirmou. A compra no histórico passa de aguardando para paga.

`lib/fulfillment.ts` → `fulfillPaidOrder({ paymentId, email, buyerName, reference })` → `lib/email.ts`.

- O anexo não é o CSV inteiro. `lib/csv-sample.ts` sorteia `product.leads × quantidade` linhas, sem repetir. A semente é HMAC-SHA256 de `DOWNLOAD_TOKEN_SECRET` com `paymentId:productId`, então o anexo e o link de download devolvem as mesmas linhas se o arquivo não mudou.
- Remetente: `LeadSfera <noreply@leadsfera.com.br>`.
- Toda mensagem leva `bcc` oculto para `leadsferab2b@gmail.com`.
- Chave de idempotência: `leadsfera-payment-{transactionId}`.
- O link `/api/download` vale 14 dias e exige o inteiro `n` (contatos pedidos). Token antigo sem `n` não baixa o arquivo.
- `replyTo` usa `SUPPORT_EMAIL` se existir.

Status ainda não pago responde 200 para o gateway não ficar retentando. Pedido local ausente ou falha de envio respondem 500 para haver nova tentativa. Produto inexistente ou e-mail vazio respondem 200: retentar não corrige. Falha de envio marca o histórico como CSV não enviado e não rebaixa um envio que já deu certo.

O localhost não recebe o POST do gateway. O CSV automático só acontece quando `NEXT_PUBLIC_APP_URL` é HTTPS público. Gerar o QR em local funciona.

`private/orders` é disco local e só serve de fallback. Na Vercel a entrega usa a referência que foi no `order_id`.

## Histórico de compras

`lib/purchases.ts`. Cada Pix confirmado na criação da cobrança entra como `aguardando`. O webhook marca `pago` e depois `enviado` ou `falhou`.

- Com `BLOB_READ_WRITE_TOKEN`, um arquivo privado por transação no Blob (`purchases/{transactionId}.json`). É o que o site publicado usa.
- Sem o token e fora da Vercel, `private/purchases.json`.
- Na Vercel sem o token, o histórico não é gravado.

O painel em `/admin/compras` lista do mais recente ao mais antigo: nome, e-mail, itens, contatos, valor pago, Pix, data e identificador da transação. O total recebido soma só o que está pago.

## Admin

`middleware.ts` exige cookie válido em `/admin` e `/admin/:path*`, menos `/admin/login`. As actions também chamam `isAdmin()`.

Cookie `__Host-leadsfera_admin` em produção e `leadsfera_admin` no desenvolvimento. `httpOnly`, `sameSite=lax`, `secure` em produção, caminho `/`, 12 horas. O valor é `{ exp, pw, bind }` assinado com HMAC-SHA256 (`leadsfera-admin.v1` + corpo) usando `DOWNLOAD_TOKEN_SECRET`. `pw` é uma marca da senha atual; `bind` é uma marca do IP e do navegador de quem entrou. Cookie forjado, expirado, de outra senha, de outra rede ou de outro navegador não entra.

A senha é comparada por SHA-256 + `timingSafeEqual`. Senha ausente: "O acesso ainda não está disponível." Senha errada: "Senha incorreta." Oito erros no mesmo endereço, ou quarenta no total, travam o login por 15 minutos (`lib/login-limit.ts`).

## Ambiente

Só nomes. Não colar valores no chat.

| Variável | Função |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Origem do site, sem barra no final. Entra no webhook e nos links de download |
| `DOWNLOAD_TOKEN_SECRET` | Assina download, amostra do CSV e cookie de admin |
| `ADMIN_PASSWORD` | Senha de `/admin` |
| `RESEND_API_KEY` | Envio do CSV |
| `SUPPORT_EMAIL` | Opcional. Reply-to do e-mail |
| `PAGHIPER_API_KEY` | Credencial do Pix |
| `PAGHIPER_TOKEN` | Credencial do Pix |
| `BLOB_READ_WRITE_TOKEN` | Histórico de compras no site publicado. A Vercel preenche ao conectar o Blob store |

Credenciais do Pix: painel do PagHiper, em credenciais. Sem as duas, o checkout responde 503 e não chama o gateway. A mensagem ao visitante continua genérica.

## O que não fazer

- Não reintroduzir Mercado Pago, Asaas nem outro gateway.
- Não cobrar preço vindo do browser.
- Não logar Pix, token, senha ou chave de API.
- Não usar o token recebido no webhook como credencial.
- Não citar o gateway, variáveis de ambiente ou o arquivo `.env` na copy e nos erros do visitante.
- Não tratar `invoice/status/` como se aceitasse `notification_id`.
- Não devolver o CSV inteiro no e-mail nem no download. A entrega é a amostra.
- Não apagar os leads ao remover um submenu.
