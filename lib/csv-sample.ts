import crypto from "crypto";
import { requireEnv } from "@/lib/env";
import { readProductFile } from "@/lib/product-file";

export type LeadSample = {
  csv: Buffer;
  requested: number;
  available: number;
  sent: number;
};

/** Contatos do produto vezes a quantidade comprada. */
export function sampleSize(leads: number, quantity: number) {
  if (!Number.isInteger(leads) || leads < 1 || !Number.isInteger(quantity) || quantity < 1) return null;
  const count = leads * quantity;
  if (!Number.isSafeInteger(count)) return null;
  return count;
}

/** Separa registros de CSV respeitando aspas. A primeira linha continua sendo o cabeçalho. */
export function splitCsvRecords(text: string) {
  const source = text.replace(/^\uFEFF/, "");
  const records: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      quoted = !quoted;
      current += char;
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      records.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.length > 0) records.push(current);
  return records;
}

function randomIndex(seed: Buffer, turn: number, limit: number) {
  const next = crypto.createHmac("sha256", seed).update(String(turn)).digest();
  const value = next.readUInt32BE(0);
  return { index: value % limit, seed: next };
}

/**
 * Sorteia sem repetir. O mesmo `seedKey` no mesmo arquivo devolve as mesmas linhas,
 * para o anexo e o link de download coincidirem.
 */
export function sampleCsvText(text: string, requested: number, seedKey: string) {
  const records = splitCsvRecords(text);
  const header = records[0] ?? "";
  const rows = records.slice(1).filter((row) => row.trim().length > 0);
  const available = rows.length;
  const sent = Math.min(requested, available);

  if (!header.trim() || sent < 1) {
    return { csv: "", requested, available, sent: 0 };
  }

  let seed = crypto.createHmac("sha256", requireEnv("DOWNLOAD_TOKEN_SECRET")).update(seedKey).digest();
  const pool = rows.slice();
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const drawn = randomIndex(seed, index, index + 1);
    seed = drawn.seed;
    const swap = pool[index];
    pool[index] = pool[drawn.index];
    pool[drawn.index] = swap;
  }

  const csv = [header, ...pool.slice(0, sent)].join("\n") + "\n";
  return { csv, requested, available, sent };
}

export async function buildLeadSample(input: {
  fileName: string;
  requested: number;
  seedKey: string;
}): Promise<LeadSample> {
  const file = await readProductFile(input.fileName);
  const sample = sampleCsvText(file.toString("utf8"), input.requested, input.seedKey);

  if (sample.sent < 1) {
    throw new Error(`O CSV ${input.fileName} não tem contatos para enviar.`);
  }
  if (sample.sent < sample.requested) {
    console.error("[csv] arquivo com menos contatos do que o pedido", {
      fileName: input.fileName,
      requested: sample.requested,
      available: sample.available,
      sent: sample.sent,
    });
  } else {
    console.info("[csv] amostra sorteada", {
      fileName: input.fileName,
      requested: sample.requested,
      available: sample.available,
      sent: sample.sent,
    });
  }

  return { ...sample, csv: Buffer.from(sample.csv, "utf8") };
}
