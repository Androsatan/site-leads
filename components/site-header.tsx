import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { CartLink } from "@/components/cart-link";
import { listMenuNiches } from "@/lib/menu-niches";
import { site } from "@/lib/site";

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="8" fill="none" stroke="#00e887" strokeWidth="1.4" />
      <circle cx="11" cy="3.2" r="1.35" fill="#00e887" />
      <circle cx="17.4" cy="15.2" r="1.05" fill="#4c8dff" />
    </svg>
  );
}

const links = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#faq", label: "Dúvidas" },
];

export async function SiteHeader() {
  noStore();
  const niches = await listMenuNiches();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[13px] font-medium tracking-[0.16em]">{site.name.toUpperCase()}</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-mute md:flex">
          <div className="group relative flex h-16 items-center">
            <Link href="/listas" className="transition-colors hover:text-paper group-hover:text-paper">
              Leads
            </Link>
            {niches.length > 0 ? (
              <div className="pointer-events-none absolute left-1/2 top-full z-30 w-max min-w-28 -translate-x-1/2 border border-line bg-panel py-1 opacity-0 shadow-2xl transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                {niches.map((niche) => (
                  <Link
                    key={niche.slug}
                    href={`/nichos/${niche.slug}`}
                    className="block px-3 py-1.5 text-center text-[13px] text-paper transition-colors hover:bg-white/5 hover:text-neon"
                  >
                    {niche.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-paper">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <CartLink />
          <Link href="/listas" className="bg-neon px-4 py-2 text-sm font-semibold text-ink">
            Ver Leads
          </Link>
        </div>
      </div>
    </header>
  );
}
