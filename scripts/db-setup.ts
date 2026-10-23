import { readFileSync } from "node:fs";
import path from "node:path";
import { query } from "../lib/db";

async function main() {
  const file = path.join(process.cwd(), "db", "schema.sql");
  await query(readFileSync(file, "utf-8"));

  const cols = await query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_name = 'templates'
      ORDER BY ordinal_position`
  );
  console.log("✅ Tabel 'templates' siap. Kolom:");
  for (const c of cols) console.log(`  - ${c.column_name} (${c.data_type})`);
}

main().catch((e) => {
  console.error("❌ Setup gagal:", e.message);
  process.exit(1);
});