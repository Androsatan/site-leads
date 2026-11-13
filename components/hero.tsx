import { formatLeads } from "@/lib/format";
import { getFeaturedProduct } from "@/lib/catalog";

const previewRows = [
  ["Padaria do Mercado", "Centro-Sul", "validado"],
  ["Forno da Pampulha", "Pampulha", "validado"],
  ["Massa da Lagoa", "Noroeste", "validado"],
  ["Pão do Barreiro", "Barreiro", "validado"],
  ["Confeitaria Norte", "Norte", "validado"],
  ["Estação Venda Nova", "Venda Nova", "validado"],
];

const regions = [
  "Barreiro",
  "Centro-Sul",
  "Leste",
  "Nordeste",
  "Noroeste",
  "Norte",
  "Oeste",
  "Pampulha",
  "Venda Nova",
];

export async function Hero() {
  const featured = await getFeaturedProduct();

  return (
    <section>
      <div className="mx-auto grid max-w-[1120px] items-center gap-14 px-5 pb-16 pt-16 md:pt-24 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pb-20">
        <div>
          <div className="mx-auto max-w-xl text-center">
            <p className="text-[11px] font-medium tracking-[0.22em] text-neon">
              WHATSAPP VALIDADO · BELO HORIZONTE
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl lg:text-6xl lg:leading-[1.02]">
              Máquina de Vendas B2B em <span className="text-neon">Belo Horizonte</span>
            </h1>
            <p className="mt-6 text-base leading-7 text-mute md:text-lg">
              Não perca tempo com leads frios. Extraímos e validamos o WhatsApp de
              empresas locais em tempo real. Pague uma vez, faça o download imediato do CSV e comece a
              vender hoje.
            </p>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-6">
            <div>
              <dt className="text-[11px] tracking-[0.16em] text-mute">VALIDAÇÃO</dt>
              <dd className="mt-2 text-sm">WhatsApp ativo</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.16em] text-mute">REGIÃO</dt>
              <dd className="mt-2 text-sm">9 regiões de BH</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.16em] text-mute">ENTREGA</dt>
              <dd className="mt-2 text-sm">CSV no e-mail</dd>
            </div>
          </dl>
        </div>

        <div className="min-w-0 border border-line bg-panel/80 shadow-[0_30px_80px_rgb(0_0_0/0.35)]">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-white/20" />
              <span className="size-2 shrink-0 rounded-full bg-white/20" />
              <span className="size-2 shrink-0 rounded-full bg-neon" />
              <span className="truncate font-mono text-xs text-mute">{featured?.fileName ?? "leads.csv"}</span>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-neon">
              {formatLeads(featured?.leads ?? 0)} linhas
            </span>
          </div>
          <div className="sheet-mask px-4 py-3 font-mono text-xs">
            <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr] gap-3 border-b border-line pb-2 text-[10px] tracking-[0.14em] text-mute">
              <span>NOME</span>
              <span>REGIÃO</span>
              <span>WHATSAPP</span>
            </div>
            {previewRows.map((row) => (
              <div
                key={row[0]}
                className="grid grid-cols-[1.3fr_0.8fr_0.7fr] gap-3 border-b border-white/5 py-2.5 text-paper/90"
              >
                <span className="truncate">{row[0]}</span>
                <span className="truncate text-mute">{row[1]}</span>
                <span className="truncate text-neon">✓ {row[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden border-y border-line" aria-hidden="true">
        <div className="marquee-track flex w-max gap-8 py-4">
          {[...regions, ...regions].map((region, index) => (
            <span key={`${region}-${index}`} className="text-sm font-medium tracking-[0.18em] text-mute">
              {region.toUpperCase()}
              <span className="ml-8 text-neon">●</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
