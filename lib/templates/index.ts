import fs from "node:fs";
import path from "node:path";
import { templateSchema, type TemplateConfig } from "../validation/types";
import { checkCell } from "../validation/validators";
import { describeRule } from "../validation/describe";

const DIR = path.join(process.cwd(), "config", "templates");

let cache: TemplateConfig[] | null = null;

function loadFromDisk(): TemplateConfig[] {
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const result: TemplateConfig[] = [];
  const ids = new Set<string>();
  const volumes = new Set<string>();

  for (const file of files) {
    let raw: unknown;
    try {
      const text = fs.readFileSync(path.join(DIR, file), "utf-8").replace(/^\uFEFF/, "");
      raw = JSON.parse(text);
    } catch {
      throw new Error(`Template ${file}: bukan JSON yang valid`);
    }

    const parsed = templateSchema.safeParse(raw);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`Template ${file} tidak valid -> ${detail}`);
    }

    const t = parsed.data;
    if (ids.has(t.id)) throw new Error(`Template ${file}: id "${t.id}" sudah dipakai`);
    const vol = t.volumePath.replace(/\/$/, "");
    if (volumes.has(vol)) {
      throw new Error(`Template ${file}: volumePath "${vol}" sudah dipakai template lain`);
    }

    // Contoh di config harus lolos aturannya sendiri (menangkap salah ketik di JSON)
    for (const col of t.columns) {
      const err = checkCell(col.example, col);
      if (err) {
        throw new Error(
          `Template ${file}: contoh kolom "${col.name}" ("${col.example}") tidak lolos aturannya (${err})`
        );
      }
    }

    ids.add(t.id);
    volumes.add(vol);
    result.push({ ...t, volumePath: vol });
  }

  if (result.length === 0) throw new Error("Tidak ada template di config/templates");
  return result;
}

export function getTemplates(): TemplateConfig[] {
  // Saat development, baca ulang tiap kali supaya edit JSON langsung terlihat
  if (process.env.NODE_ENV !== "production") return loadFromDisk();
  if (!cache) cache = loadFromDisk();
  return cache;
}

export function getTemplate(id: string): TemplateConfig | undefined {
  return getTemplates().find((t) => t.id === id);
}

// ---- Bentuk aman untuk dikirim ke browser (tanpa volumePath) ----

export type PublicColumn = {
  name: string;
  rule: string;
  required: boolean;
  example: string;
  description?: string;
};

export type PublicTemplate = {
  id: string;
  label: string;
  description?: string;
  delimiter: string;
  columnOrderMatters: boolean;
  columns: PublicColumn[];
};

export function getPublicTemplates(): PublicTemplate[] {
  return getTemplates().map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    delimiter: t.delimiter,
    columnOrderMatters: t.columnOrderMatters,
    columns: t.columns.map((c) => ({
      name: c.name,
      rule: describeRule(c),
      required: c.required !== false,
      example: c.example,
      description: c.description,
    })),
  }));
}