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
| `GET /api/checkout/status?transaction=` | `paid` se a order estiver `processed`/`accredited` com o valor inteiro pago. Não envia o CSV |
| `POST /api/webhook` | Aviso do gateway: JSON, com `?data.id=ORD...&type=order` |
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

Gateway: Mercado Pago, Checkout Transparente com a **API de Orders** (a API de Payments está sendo descontinuada). Código em `lib/mercadopago.ts`. Não mostrar esse nome ao visitante. Até 25/11/2026 o gateway era o PagHiper; o código dele foi removido.

`POST /api/checkout` recebe JSON:

```json
{ "items": [{ "productId": "...", "quantity": 1 }], "payerName": "", "payerEmail": "", "payerCpfCnpj": "" }
```

Também aceita `productId` + `quantity` avulsos. Valida nome (3–255), e-mail e CPF/CNPJ com 11 ou 14 dígitos, sem dígito verificador.

Fluxo:

1. Monta os itens com o preço do catálogo. Valores vão ao gateway como string com duas casas (`"13.00"`); a soma dos itens é igual ao total.
2. Recusa total abaixo de R$ 3,00 (300 centavos). O limite vinha do PagHiper; o Mercado Pago aceita R$ 1,00 (`MIN_CENTS` em `app/api/checkout/route.ts`).
3. `external_reference` (máx. 64, só `[A-Za-z0-9_-]`) carrega a referência `id:qtd,id:qtd` com um sufixo `|` + 6 hex. Como o gateway não aceita `: , | ~`, `lib/gateway-order.ts` troca um por um por maiúsculas (`:`→`Q`, `,`→`L`, `|`→`N`, `~`→`H`); ids, quantidades e hashes são sempre minúsculos. Se o texto não cabe, os ids vão compactados (`~` + prefixo de SHA-256, reversível pelo catálogo). Se nem assim couber, o checkout responde 400. Uma cópia segue em `private/orders/` onde o disco permite.
4. `POST https://api.mercadopago.com/v1/orders` com `Authorization: Bearer MERCADOPAGO_ACCESS_TOKEN`, `X-Idempotency-Key` (UUID novo), `type: "online"`, `processing_mode: "automatic"`, `expiration_time: "P1D"`, pagador (e-mail, nome, CPF/CNPJ), itens e um pagamento `{ id: "pix", type: "bank_transfer" }`. A API de Orders **não aceita `notification_url`**: o webhook é configurado no painel.
5. Só devolve o Pix se o HTTP for ok, o id for `ORD...`, o `qr_code` começar com `000201`, houver `qr_code_base64` e o `total_amount` bater com o catálogo. O `transaction_id` do site é o id da order.
6. Grava a compra como aguardando no histórico. **Se nem o histórico nem o pedido local forem gravados, responde 503 e não mostra o QR**, porque a order não devolve o e-mail do pagador e o webhook não teria para quem entregar.
7. Resposta ao frontend: `{ pix_code, qrcode_image_url, transaction_id }`. O QR é `data:image/png;base64,...`. A tela consulta `GET /api/checkout/status` a cada 4 segundos.

`components/pix-checkout.tsx` mostra o formulário e, depois, o QR e o copia e cola. O cliente está em `lib/checkout-client.ts`.

Erros ao visitante: mensagem genérica de Pix, sem nome de variável e sem nome do gateway. O log do servidor pode citar a variável ausente e o erro do gateway. Falha do gateway → 502, sem stack.

Ambiente de teste: o Access Token de teste (`APP_USR-...` da aplicação em modo Teste) gera orders `ORDTST...` com Pix de sandbox. O sandbox não paga o Pix sozinho; o caminho até `processed` ainda precisa ser validado pelo painel (Pagamentos de teste) ou em produção com valor baixo.

## Webhook e entrega

Configuração no painel do Mercado Pago (aplicação → Webhooks), separada para Teste e Produção: URL `https://SEU_DOMINIO/api/webhook`, evento **Order (Mercado Pago)**. O painel gera a assinatura secreta, que vai em `MERCADOPAGO_WEBHOOK_SECRET`.

`POST /api/webhook` recebe JSON. `data.id` e `type` vêm da query (`?data.id=ORD...&type=order`), com o corpo como reserva. Avisos com `type` diferente de `order` respondem 200 e são ignorados.

1. Com `MERCADOPAGO_WEBHOOK_SECRET`, o header `x-signature` (`ts=...,v1=...`) tem de conferir: HMAC-SHA256 de `id:{data.id};request-id:{x-request-id};ts:{ts};`. O `data.id` é aceito como veio e em minúsculas. Assinatura errada → 401. Sem o segredo, a rota só registra um aviso no log.
2. `GET https://api.mercadopago.com/v1/orders/{data.id}` com o token do servidor. É a única fonte de verdade. O corpo do aviso não autentica nada.

O CSV só sai se a order estiver `status: "processed"`, `status_detail: "accredited"` e `total_paid_amount === total_amount`. A referência dos itens sai do `external_reference`. O valor esperado vem do pedido local, senão do histórico gravado no checkout, senão do catálogo; tem de bater com `total_amount`. O e-mail e o nome vêm do pedido local ou do histórico (a order não traz o pagador). Sem nenhum dos dois, responde 500 para nova tentativa. A compra no histórico passa de aguardando para paga.

`lib/fulfillment.ts` → `fulfillPaidOrder({ paymentId, email, buyerName, reference })` → `lib/email.ts`.

- O anexo não é o CSV inteiro. `lib/csv-sample.ts` sorteia `product.leads × quantidade` linhas, sem repetir. A semente é HMAC-SHA256 de `DOWNLOAD_TOKEN_SECRET` com `paymentId:productId`, então o anexo e o link de download devolvem as mesmas linhas se o arquivo não mudou.
- Remetente: `LeadSfera <noreply@leadsfera.com.br>`.
- Toda mensagem leva `bcc` oculto para `leadsferab2b@gmail.com`.
- Chave de idempotência: `leadsfera-payment-{transactionId}` (id da order).
- O link `/api/download` vale 14 dias e exige o inteiro `n` (contatos pedidos). Token antigo sem `n` não baixa o arquivo.
- `replyTo` usa `SUPPORT_EMAIL` se existir.

Status ainda não pago responde 200 para o gateway não ficar retentando. Pagador não encontrado ou falha de envio respondem 500 para haver nova tentativa. Produto inexistente ou referência ilegível respondem 200: retentar não corrige. Falha de envio marca o histórico como CSV não enviado e não rebaixa um envio que já deu certo.

O localhost não recebe o POST do gateway. Gerar o QR em local funciona.

## Histórico de compras

`lib/purchases.ts`. Cada Pix confirmado na criação da cobrança entra como `aguardando`. O webhook marca `pago` e depois `enviado` ou `falhou`.

- Com `BLOB_READ_WRITE_TOKEN`, um arquivo privado por transação no Blob (`purchases/{transactionId}.json`). É o que o site publicado usa.
- Sem o token e fora da Vercel, `private/purchases.json`.
- Na Vercel sem o token, o histórico não é gravado **e o checkout recusa gerar o Pix** (503), porque o webhook depende dele para achar o e-mail. Na Vercel o Blob é obrigatório.

O painel em `/admin/compras` lista do mais recente ao mais antigo: nome, e-mail, itens, contatos, valor pago, Pix, data e identificador da transação. O total recebido soma só o que está pago.

## Admin

`middleware.ts` exige cookie válido em `/admin` e `/admin/:path*`, menos `/admin/login`. As actions também chamam `isAdmin()`.

Cookie `__Host-leadsfera_admin` em produção e `leadsfera_admin` no desenvolvimento. `httpOnly`, `sameSite=lax`, `secure` em produção, caminho `/`, 12 horas. O valor é `{ exp, pw, bind }` assinado com HMAC-SHA256 (`leadsfera-admin.v1` + corpo) usando `DOWNLOAD_TOKEN_SECRET`. `pw` é uma marca da senha atual; `bind` é uma marca do IP e do navegador de quem entrou. Cookie forjado, expirado, de outra senha, de outra rede ou de outro navegador não entra.

A senha é comparada por SHA-256 + `timingSafeEqual`. Senha ausente: "O acesso ainda não está disponível." Senha errada: "Senha incorreta." Oito erros no mesmo endereço, ou quarenta no total, travam o login por 15 minutos (`lib/login-limit.ts`).

## Ambiente

Só nomes. Não colar valores no chat.

| Variável | Função |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Origem do site, sem barra no final. Entra nos links de download. O webhook do Pix é configurado no painel do gateway |
| `DOWNLOAD_TOKEN_SECRET` | Assina download, amostra do CSV e cookie de admin |
| `ADMIN_PASSWORD` | Senha de `/admin` |
| `RESEND_API_KEY` | Envio do CSV |
| `SUPPORT_EMAIL` | Opcional. Reply-to do e-mail |
| `MERCADOPAGO_ACCESS_TOKEN` | Credencial do Pix (Access Token da aplicação; o de teste no ambiente de teste) |
| `MERCADOPAGO_WEBHOOK_SECRET` | Assinatura secreta do webhook. Recomendado em produção |
| `BLOB_READ_WRITE_TOKEN` | Histórico de compras no site publicado. A Vercel preenche ao conectar o Blob store |

Credenciais do Pix: painel do Mercado Pago → Suas integrações → aplicação → Credenciais (Teste ou Produção). Sem o Access Token, o checkout responde 503 e não chama o gateway. A mensagem ao visitante continua genérica.

## O que não fazer

- Não reintroduzir PagHiper, Asaas nem outro gateway. Não trocar a API de Orders pela de Payments.
- Não cobrar preço vindo do browser.
- Não logar Pix, token, senha ou chave de API.
- Não usar o token recebido no webhook como credencial.
- Não citar o gateway, variáveis de ambiente ou o arquivo `.env` na copy e nos erros do visitante.
- Não enviar `notification_url` na order (a API recusa) nem confiar no corpo do webhook sem o `GET /v1/orders/{id}`.
- Não usar `: , | ~` no `external_reference`: passar sempre por `packOrderId`.
- Não devolver o CSV inteiro no e-mail nem no download. A entrega é a amostra.
- Não apagar os leads ao remover um submenu.
