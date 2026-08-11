// @ts-ignore
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  // @ts-ignore
  if (typeof env === "undefined" || !env?.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable."
    );
  }

  // @ts-ignore
  return drizzle(env.DB, { schema });
}
