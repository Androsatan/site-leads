# LeadSfera — arquitetura

Loja Next.js de leads B2B de Belo Horizonte. O visitante escolhe um CSV, paga com Pix e recebe o arquivo por e-mail. Interface em português, preços em reais inteiros, tema escuro.

Este arquivo é o contexto para um chat novo. Não contém segredos. Os valores reais ficam só no `.env`, que não vai para o git.

## Como rodar

- Node `>= 20`. Na prática o ambiente local está no Node 26.
- `npm run dev` sobe em `http://localhost:3000` (rede local também).
- `npm run build` / `npm start` / `npm run lint`.
- O Next só lê o `.env` quando o processo inicia. Depois de editar o `.env`, reinicie o `npm run dev`.
- Não há `.env.example`. O modelo das variáveis está na seção Ambiente, abaixo.
- Não faça commit a menos que seja pedido. Não commite `.env`, `private/orders/` nem listas reais de clientes.

## Regras de produto

- O site público fala em Pix. Não cita o nome do gateway (PagHiper) na interface do visitante. Comentários, `.env` e erros de configuração podem citar.
- Vocabulário da vitrine: "leads", "qualificados". Não usar "listas", "premium" nem "telefone fixo".
- O título do catálogo é só "Leads Qualificados". A rota continua `/listas`.
- Todo card tem quantidade de 1 a 20, "Comprar agora" e "Adicionar ao carrinho".
- O preço cobrado é sempre o do catálogo no servidor, vezes a quantidade. O navegador não envia preço.
- Os CSV em `private/products/` são amostras fictícias. Listas reais não entram no git.
- Admin (`/admin`) serve para o servidor local. O disco da Vercel não persiste arquivo novo.

## Stack

- Next.js 15.5 App Router, React 19, TypeScript, Tailwind CSS v4, fonte Inter.
- Única dependência de serviço: `resend`.
- `next.config.ts`: `poweredByHeader: false` e `experimental.serverActions.bodySizeLimit: "8mb"` (o CSV do admin cabe nesse limite; a validação da action corta em 5 MB).
- Páginas que leem o catálogo usam `export const dynamic = "force-dynamic"`.

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
  carrinho/page.tsx        revisão do carrinho
  checkout/page.tsx        pedido, total e dados do pagador
  sucesso|pendente|falha/  telas antigas; o Pix atual não redireciona para elas
  admin/                   login e painel (adicionar / remover produto)
  api/checkout/route.ts    cria a cobrança Pix
  api/checkout/status/     a tela consulta se o Pix já foi pago
  api/webhook/route.ts     confirma o pagamento e envia o CSV
  api/download/route.ts    baixa o CSV com link assinado
components/                UI. Catálogo e checkout não importam fs no cliente
lib/                       regras de servidor e tipos compartilhados
private/
  catalog.json             produtos (criado a partir do seed se não existir)
  products/*.csv           arquivos vendidos
  orders/*.json            pedido pendente (fallback local); gitignored
```

## Rotas

| Rota | O que faz |
| --- | --- |
| `/` | Hero, 3 leads em destaque, processo, FAQ |
| `/listas` | Todos os cards |
| `/carrinho` | Itens do `localStorage`, quantidades, total |
| `/checkout?pedido=id:qtd,id:qtd` | Resumo + formulário Pix. `origem=carrinho` faz "Voltar" ir para `/carrinho` |
| `/admin/login` | Senha `ADMIN_PASSWORD` |
| `/admin` | Lista produtos. `/admin/novo` cria um |
| `POST /api/checkout` | Gera Pix. A resposta inclui `transaction_id` para a tela consultar |
| `GET /api/checkout/status?transaction=` | `paid` se o gateway estiver em `paid` ou `completed`. Não envia o CSV |
| `POST /api/webhook` | Aviso do gateway, form-urlencoded |
| `GET /api/download?token=` | CSV se o HMAC e a expiração forem válidos |

Header (`components/site-header.tsx`): Leads, Como funciona (`/#como-funciona`), Dúvidas (`/#faq`), carrinho com badge, "Ver Leads".

"Comprar agora" não abre formulário no card. Vai para `/checkout` com a quantidade escolhida, sem mexer no carrinho. "Ir para o pagamento" manda o carrinho inteiro para a mesma página. O helper é `checkoutPath()` em `lib/order.ts`.

## Catálogo

Tipo `Product` em `lib/products.ts`. Preço é inteiro em reais. `productSku()` devolve `LS-{state}-{leads}` e é só rótulo visual.

`lib/catalog.ts` lê e grava `private/catalog.json` com fila e escrita atômica. Se o arquivo não existe, grava `lib/catalog-seed.ts` (seis leads de BH; o destaque é `padarias-centro-savassi`).

`lib/product-file.ts` lê e grava CSV em `private/products/`, recusando `..`, `/` e `\`.

`getProduct`, `listProducts` e o destaque são funções de servidor. O cliente recebe os produtos por props (`CartView`, `CheckoutView`). Não importe `lib/catalog.ts` num componente `"use client"`.

Admin (`app/admin/actions.ts`):

- CSV até 5 MB, extensão `.csv`, sem byte nulo.
- Preço inteiro de 1 a 100000.
- O id vira slug. `leads` é a quantidade de linhas do CSV.
- Marcar destaque desmarca os outros.
- Remover apaga o CSV se nenhum outro produto usa o mesmo arquivo.

## Carrinho

`components/cart-provider.tsx`, chave `localStorage` `leadsfera-cart`. Guarda só `{ productId, quantity }`. Quantidade máxima 20 por produto (`MAX_QUANTITY` em `lib/order.ts`). Soma acima de 20 é recusada.

O pedido na URL e na cobrança usa `encodeOrder`: `id:qtd,id:qtd`, no máximo 256 caracteres. Ids são kebab-case. `decodeOrder` também aceita um id solto (quantidade 1) por causa de referências antigas.

## Pagamento Pix

Gateway: PagHiper. Código em `lib/paghiper.ts`.

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
6. Resposta ao frontend: `{ pix_code, qrcode_image_url, transaction_id }`. O QR é uma URL `https://pix.paghiper.com/...` ou, se ela não vier, um `data:image/png;base64,...` do `qrcode_base64`. A tela consulta `GET /api/checkout/status` a cada 4 segundos e, quando o Pix está pago, troca o QR por "Pagamento confirmado!".

`components/pix-checkout.tsx` mostra o formulário e, depois, o QR e o copia e cola. O cliente está em `lib/checkout-client.ts`.

Erros: variável ausente → 503 citando o nome da variável. Falha do gateway → 502, sem stack.

## Webhook e entrega

`POST /api/webhook` recebe `application/x-www-form-urlencoded`: `notification_id` e `transaction_id` (também aceita `idTransacao` e `id_transacao`).

A `apiKey` e o token que chegam nesse POST não autenticam a entrega. Se a apiKey vier e for diferente da do `.env`, a rota responde 401. A confirmação é feita com as credenciais do servidor:

1. `POST https://pix.paghiper.com/invoice/notification/` com `transaction_id` e `notification_id`. É essa chamada que devolve pedido, pagador, valor e status. O endpoint `invoice/status/` não consulta por `notification_id`.
2. `POST https://pix.paghiper.com/invoice/status/` com `transaction_id`.

O CSV só sai se as duas respostas concordarem em `paid` ou `completed`, no `transaction_id` e no valor. A referência dos itens sai do `order_id`. Se o pedido local existir, o valor e o e-mail têm de bater com o que foi salvo (cobranças antigas, só com UUID, continuam dependendo desse arquivo). Sem o arquivo, o total é recalculado pelo catálogo e o e-mail é o que a API do gateway confirmou.

`lib/fulfillment.ts` → `fulfillPaidOrder({ paymentId, email, buyerName, reference })` → `lib/email.ts`.

- Remetente fixo: `LeadSfera <onboarding@resend.dev>`. Sem domínio verificado, o Resend só entrega no e-mail da conta.
- Chave de idempotência: `leadsfera-payment-{transactionId}`.
- O e-mail leva o CSV em anexo e um link `/api/download` assinado por 14 dias (HMAC-SHA256 com `DOWNLOAD_TOKEN_SECRET`).
- `replyTo` usa `SUPPORT_EMAIL` se existir.

Status ainda não pago responde 200 para o gateway não ficar retentando. Pedido local ausente ou falha de envio respondem 500 para haver nova tentativa. Produto inexistente ou e-mail vazio respondem 200: retentar não corrige.

O localhost não recebe o POST do gateway. O CSV automático só acontece quando `NEXT_PUBLIC_APP_URL` é HTTPS público. Gerar o QR em local funciona.

`private/orders` é disco local e só serve de fallback. Na Vercel a entrega usa a referência que foi no `order_id`. Não há banco. Não adicionar um sem pedido.

## Admin

Cookie `leadsfera_admin`, httpOnly, `sameSite=lax`, `secure` em produção, 7 dias. O valor é `{ exp }` assinado com HMAC-SHA256 usando `DOWNLOAD_TOKEN_SECRET`. A senha é comparada por SHA-256 + `timingSafeEqual`. Senha ausente: mensagem pedindo para configurar. Senha errada: "Senha incorreta."

## Ambiente

Só nomes. Não colar valores no chat.

| Variável | Função |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Origem do site, sem barra no final. Entra no webhook e nos links de download |
| `DOWNLOAD_TOKEN_SECRET` | Assina download e cookie de admin |
| `ADMIN_PASSWORD` | Senha de `/admin` |
| `RESEND_API_KEY` | Envio do CSV |
| `SUPPORT_EMAIL` | Opcional. Reply-to do e-mail |
| `PAGHIPER_API_KEY` | Credencial do Pix |
| `PAGHIPER_TOKEN` | Credencial do Pix |

Credenciais do Pix: painel do PagHiper, em credenciais. Sem as duas, o checkout responde 503 e não chama o gateway.

## O que não fazer

- Não reintroduzir Mercado Pago, Asaas nem outro gateway.
- Não cobrar preço vindo do browser.
- Não logar Pix, token, senha ou chave de API.
- Não usar o token recebido no webhook como credencial.
- Não citar o gateway na copy do visitante.
- Não tratar `invoice/status/` como se aceitasse `notification_id`.
