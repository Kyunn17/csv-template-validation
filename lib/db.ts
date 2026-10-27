import { neon } from "@neondatabase/serverless";

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Environment variable DATABASE_URL belum diisi");
  return neon(url);
}

// Jalankan query berparameter: query("SELECT * FROM x WHERE id = $1", [id])
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const rows = await getClient().query(text, params);
  return rows as unknown as T[];
}