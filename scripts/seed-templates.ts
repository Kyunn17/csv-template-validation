import fs from "node:fs";
import path from "node:path";
import { query } from "../lib/db";
import { ensureSchema, ensureVolume } from "../lib/databricks";
import { templateSchema } from "../lib/validation/types";
import { toSchemaName, DEFAULT_VOLUME_NAME } from "../lib/volume";

async function main() {
  const dir = path.join(process.cwd(), "config", "templates");
  if (!fs.existsSync(dir)) {
    console.log("Folder config/templates tidak ditemukan, lewati seeding.");
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

  for (const file of files) {
    const text = fs.readFileSync(path.join(dir, file), "utf-8").replace(/^\uFEFF/, "");
    const parsed = templateSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      console.error(`✗ ${file}: tidak valid -> ${detail}`);
      continue;
    }

    const t = parsed.data;
    const schemaName = toSchemaName(t.id);
    const volumeName = DEFAULT_VOLUME_NAME;
    const rows = await query(
      `INSERT INTO templates
         (id, label, description, delimiter, column_order_matters, schema_name, volume_name, columns)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        t.id,
        t.label,
        t.description ?? null,
        t.delimiter,
        t.columnOrderMatters,
        schemaName,
        volumeName,
        JSON.stringify(t.columns),
      ]
    );
    console.log(rows.length ? `✓ ${t.id}: dimasukkan` : `- ${t.id}: sudah ada, dilewati`);

    try {
      await ensureSchema(schemaName);
      await ensureVolume(schemaName, volumeName);
      console.log(`    schema ${schemaName} / volume ${volumeName}: siap di Databricks`);
    } catch (e) {
      console.warn(`    schema ${schemaName}: ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error("❌ Seed gagal:", e.message);
  process.exit(1);
});