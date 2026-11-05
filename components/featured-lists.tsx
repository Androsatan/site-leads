import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { listProducts } from "@/lib/catalog";

export async function FeaturedLists() {
  const products = await listProducts();
  const marked = products.filter((product) => product.featured);
  const preview = marked.length > 0 ? marked : products.slice(0, 3);
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-16 md:py-20">
      <p className="text-[11px] font-medium tracking-[0.22em] text-neon">EM DESTAQUE</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">
        {marked.length > 0
          ? "Leads em destaque prontos para campanha."
          : "Três leads qualificados prontos para campanha."}
      </h2>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {preview.map((product) => (
          <ProductCard key={product.id} product={product} compact />
        ))}
      </div>
      <p className="mt-10 text-center">
        <Link
          href="/listas"
          className="inline-flex items-center gap-2 text-lg font-semibold text-neon underline decoration-neon/50 underline-offset-8 transition-colors hover:text-white hover:decoration-white"
        >
          Ver todos leads
          <span aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}
