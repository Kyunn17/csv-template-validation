import fs from "node:fs";
import path from "node:path";
import { query } from "../lib/db";
import { ensureVolume } from "../lib/databricks";
import { templateSchema } from "../lib/validation/types";
import { volumeNameFromId, volumePathFor } from "../lib/volume";

async function main() {
  const dir = path.join(process.cwd(), "config", "templates");
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
    const volumeName = volumeNameFromId(t.id);
    const rows = await query(
      `INSERT INTO templates
         (id, label, description, delimiter, column_order_matters, volume_name, columns)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        t.id,
        t.label,
        t.description ?? null,
        t.delimiter,
        t.columnOrderMatters,
        volumeName,
        JSON.stringify(t.columns),
      ]
    );
    console.log(rows.length ? `✓ ${t.id}: dimasukkan` : `- ${t.id}: sudah ada, dilewati`);

    try {
      const r = await ensureVolume(volumePathFor(volumeName));
      console.log(`    volume ${volumeName}: ${r.created ? "dibuat" : "sudah ada"}`);
    } catch (e) {
      console.warn(`    volume ${volumeName}: ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error("❌ Seed gagal:", e.message);
  process.exit(1);
});