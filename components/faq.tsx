const questions = [
  {
    q: "Como garantem que os números têm WhatsApp?",
    a: "Usamos uma API de validação em tempo real. Ela confirma o WhatsApp ativo e descarta só números inativos, para a prospecção sair com leads prontos.",
  },
  {
    q: "O que vem dentro do CSV?",
    a: "Nome do estabelecimento, WhatsApp e os campos do card — bairro, endereço, especialidade ou cozinha. Cada arquivo cobre um nicho e uma região de Belo Horizonte.",
  },
  {
    q: "Quando o arquivo chega?",
    a: "Quando o pagamento é aprovado. No Pix isso costuma ser imediato. O link do e-mail vale 14 dias.",
  },
  {
    q: "Abre no Excel?",
    a: "Sim. Também no Google Planilhas e na importação da maioria dos CRMs. A primeira linha é o cabeçalho, em UTF-8.",
  },
  {
    q: "E se eu fechar a página antes do e-mail?",
    a: "Pode fechar. O envio não depende desta tela. O CSV sai para o e-mail usado na compra.",
  },
  {
    q: "Posso usar os contatos em campanha?",
    a: "São leads comerciais para prospecção. A LGPD continua valendo: identifique a sua empresa, tenha uma base legal e ofereça um opt-out simples.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[1120px] px-5 py-20 md:py-28">
      <div className="grid gap-12 md:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-neon">DÚVIDAS</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">Antes de comprar.</h2>
        </div>
        <div className="border-t border-line">
          {questions.map((item) => (
            <details key={item.q} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-base font-medium">
                {item.q}
                <span className="text-neon transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="max-w-xl pb-5 text-sm leading-6 text-mute">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
