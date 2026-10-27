import { readFileSync } from "node:fs";
import path from "node:path";
import { query } from "../lib/db";

async function main() {
  const file = path.join(process.cwd(), "db", "schema.sql");
  const schemaSql = readFileSync(file, "utf-8");
  
  // 1. Buat tabel jika belum ada
  await query(schemaSql);

  // 2. Migrasi idempoten untuk database yang sudah ada:
  // - Tambah kolom schema_name jika belum ada
  await query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS schema_name TEXT;`);

  // - Backfill template legacy: isi 'default' jika NULL agar path lama tetap valid
  await query(`UPDATE templates SET schema_name = 'default' WHERE schema_name IS NULL;`);

  // - Set NOT NULL pada schema_name
  await query(`ALTER TABLE templates ALTER COLUMN schema_name SET NOT NULL;`);

  // - Hapus unique constraint lama pada volume_name (templates_volume_name_key) jika ada
  await query(`ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_volume_name_key;`);

  // - Tambah composite unique constraint (schema_name, volume_name) jika belum ada
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'templates_schema_volume_key'
      ) THEN
        ALTER TABLE templates ADD CONSTRAINT templates_schema_volume_key UNIQUE (schema_name, volume_name);
      END IF;
    END $$;
  `);

  const cols = await query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_name = 'templates'
      ORDER BY ordinal_position`
  );
  console.log("✅ Tabel 'templates' siap. Kolom:");
  for (const c of cols) console.log(`  - ${c.column_name} (${c.data_type})`);

  const constraints = await query<{ conname: string; def: string }>(
    `SELECT conname, pg_get_constraintdef(oid) as def
       FROM pg_constraint
      WHERE conrelid = 'templates'::regclass`
  );
  console.log("\n✅ Constraints pada 'templates':");
  for (const c of constraints) console.log(`  - ${c.conname}: ${c.def}`);
}

main().catch((e) => {
  console.error("❌ Setup gagal:", e.message);
  process.exit(1);
});