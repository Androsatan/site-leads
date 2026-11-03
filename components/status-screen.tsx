import Link from "next/link";
import type { ReactNode } from "react";

export function StatusScreen({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[760px] flex-col justify-center px-5 py-24">
      <p className="text-[11px] font-medium tracking-[0.22em] text-neon">{kicker}</p>
      <h1 className="mt-4 text-5xl font-semibold tracking-[-0.045em] text-balance md:text-6xl">{title}</h1>
      <div className="mt-6 max-w-xl text-base leading-7 text-mute">{children}</div>
      <Link
        href="/listas"
        className="mt-10 inline-flex w-fit bg-paper px-5 py-3 text-sm font-semibold text-ink"
      >
        Ver leads
      </Link>
    </main>
  );
}
