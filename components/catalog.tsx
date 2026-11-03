import { ProductCard } from "@/components/product-card";
import { listProducts } from "@/lib/catalog";

export async function Catalog() {
  const products = await listProducts();

  if (products.length === 0) {
    return <p className="border border-line bg-panel/85 px-6 py-16 text-center">Nenhum lead no catálogo.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
