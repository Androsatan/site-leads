const steps = [
  {
    number: "01",
    title: "Escolha os Leads Qualificados",
    text: "Leads separados pelas 9 regiões de BH.",
  },
  {
    number: "02",
    title: "Pague no checkout",
    text: "A liberação sai assim que o pagamento aprova.",
  },
  {
    number: "03",
    title: "Download Automático",
    text: "Receba o CSV higienizado diretamente no seu e-mail.",
  },
];

export function Process() {
  return (
    <section id="como-funciona" className="border-y border-line">
      <div className="mx-auto max-w-[1120px] px-5 py-20 md:py-28">
        <p className="text-[11px] font-medium tracking-[0.22em] text-neon">COMO FUNCIONA</p>
        <h2 className="mt-3 max-w-xl text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
          Do pagamento ao CSV na mesma hora.
        </h2>
        <ol className="mt-12 grid gap-px bg-line md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.number} className="bg-ink p-6 md:p-8">
              <p className="text-3xl font-semibold tabular-nums tracking-[-0.04em] text-neon">{step.number}</p>
              <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em]">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-mute">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
