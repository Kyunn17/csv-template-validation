import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | null = null;

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Environment variable DATABASE_URL belum diisi");
  if (!client) client = neon(url);
  return client;
}

// Jalankan query berparameter: query("SELECT * FROM x WHERE id = $1", [id])
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const rows = await getClient().query(text, params);
  return rows as unknown as T[];
}