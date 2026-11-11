import Link from "next/link";
import { ProductActions } from "@/components/product-actions";
import { formatBRL, formatLeads } from "@/lib/format";
import { productSku, type Product } from "@/lib/products";

function Seal({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neon/30 bg-neon/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-neon">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M3.4 6.1 5.1 7.8 8.7 4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </span>
  );
}

export function LeadBadges({ product }: { product: Product }) {
  if (!product.whatsappVerified && !product.qualified) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {product.whatsappVerified ? <Seal>WhatsApp Validado</Seal> : null}
      {product.qualified ? <Seal>Qualificado</Seal> : null}
    </div>
  );
}

export function ProductCard({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const featured = !compact && Boolean(product.featured);

  return (
    <article
      className={`group flex flex-col border border-line bg-panel/85 p-6 transition-colors hover:border-neon/40 ${
        featured ? "md:col-span-2 md:flex-row md:gap-10 md:p-8 xl:col-span-2" : ""
      }`}
    >
      <Link href={`/listas/${product.id}`} className={`block ${featured ? "md:flex-1" : "flex-1"}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium tracking-[0.18em] text-electric">
            {product.city.toUpperCase()} · {product.state}
          </p>
          {product.highlight ? (
            <span className="bg-neon px-2 py-1 text-[11px] font-semibold text-ink">{product.highlight}</span>
          ) : (
            <span className="font-mono text-[11px] tracking-[0.12em] text-mute">{productSku(product)}</span>
          )}
        </div>
        <h3 className="mt-4 text-[1.7rem] font-semibold leading-tight tracking-[-0.03em] transition-colors group-hover:text-neon">
          {product.name}
        </h3>
        {product.whatsappVerified || product.qualified ? (
          <div className="mt-4">
            <LeadBadges product={product} />
          </div>
        ) : null}
        <p className="mt-3 max-w-xl text-sm leading-6 text-mute">{product.description}</p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {product.fields.map((field) => (
            <li key={field} className="border border-line px-2.5 py-1 text-xs">
              {field}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm font-semibold text-neon">Ler mais</p>
      </Link>
      <div
        className={`mt-8 flex flex-col justify-end ${
          featured ? "md:mt-0 md:w-72 md:border-l md:border-line md:pl-8" : ""
        }`}
      >
        <p className="text-sm text-mute">{formatLeads(product.leads)} contatos</p>
        <p className="mt-1 text-5xl font-semibold tabular-nums leading-none tracking-[-0.04em]">
          {formatBRL(product.price)}
        </p>
        <p className="mt-2 text-xs tracking-wide text-mute">pagamento único</p>
        <ProductActions productId={product.id} unitPrice={product.price} className="mt-6" />
      </div>
    </article>
  );
}
