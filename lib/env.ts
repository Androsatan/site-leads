export class MissingEnvError extends Error {
  readonly envName: string;

  constructor(envName: string) {
    super(`Variável de ambiente ausente: ${envName}`);
    this.name = "MissingEnvError";
    this.envName = envName;
  }
}

export function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new MissingEnvError(name);
  }
  return value;
}

export function appUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return value.replace(/\/$/, "");
}

export function isHttpsApp() {
  return appUrl().startsWith("https://");
}
