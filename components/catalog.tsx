import { ProductCard } from "@/components/product-card";
import { products } from "@/lib/products";

export function Catalog() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
