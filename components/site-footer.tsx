import { site } from "@/lib/site";

export function SiteFooter() {
  const support = process.env.SUPPORT_EMAIL?.trim();

  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-5 py-8 text-sm text-mute md:flex-row md:items-center md:justify-between">
        <p>
          © {new Date().getFullYear()} {site.name}
          {support ? (
            <>
              {" "}
              · <a className="text-paper hover:text-neon" href={`mailto:${support}`}>{support}</a>
            </>
          ) : null}
        </p>
        <p className="max-w-md md:text-right">
          Leads comerciais qualificados. Use de acordo com a LGPD e ofereça opt-out nas campanhas.
        </p>
      </div>
    </footer>
  );
}
