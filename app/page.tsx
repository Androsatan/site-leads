import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { FeaturedLists } from "@/components/featured-lists";
import { Hero } from "@/components/hero";
import { Process } from "@/components/process";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: "LeadSfera — Máquina de Vendas B2B em Belo Horizonte",
  },
  description: site.description,
};

export default function HomePage() {
  return (
    <main>
      <Hero />
      <FeaturedLists />
      <Process />
      <Faq />
    </main>
  );
}
