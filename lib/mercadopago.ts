import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { requireEnv } from "@/lib/env";

export function mercadoPago() {
  const accessToken = requireEnv("MP_ACCESS_TOKEN");
  const client = new MercadoPagoConfig({ accessToken });

  return {
    accessToken,
    preference: new Preference(client),
    payment: new Payment(client),
  };
}

export function checkoutUrl(
  accessToken: string,
  links: { init_point?: string; sandbox_init_point?: string },
) {
  const url = accessToken.startsWith("TEST-")
    ? links.sandbox_init_point
    : links.init_point;
  return url ?? links.init_point ?? links.sandbox_init_point;
}
