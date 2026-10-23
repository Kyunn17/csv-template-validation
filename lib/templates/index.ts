import { query } from "../db";
import { ensureVolume } from "../databricks";
import { templateSchema, type TemplateConfig, type TemplateInput } from "../validation/types";
import { checkCell } from "../validation/validators";
import { describeRule } from "../validation/describe";
import { slugify, volumeNameFromId, volumePathFor } from "../volume";

const ID_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
const SELECT_COLS =
  "id, label, description, delimiter, column_order_matters, volume_name, columns";

export class TemplateError extends Error {
  status: number;
  issues: string[];
  constructor(message: string, status = 400, issues: string[] = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

export type TemplateProblem = { id: string; message: string };

type Row = {
  id: string;
  label: string;
  description: string | null;
  delimiter: string;
  column_order_matters: boolean;
  volume_name: string;
  columns: unknown;
};

// ---------- validasi & normalisasi ----------

function guessExample(col: Record<string, unknown>): string {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  switch (col.type) {
    case "digits": {
      const n = num(col.length);
      return n && n > 0 && n <= 50
        ? Array.from({ length: n }, (_, i) => String((i + 1) % 10)).join("")
        : "";
    }
    case "int": {
      const min = num(col.min);
      const max = num(col.max);
      if (min !== undefined) return String(min);
      if (max !== undefined) return String(Math.min(1, max));
      return "1";
    }
    case "decimal":
      return `1${col.separator === "." ? "." : ","}5`;
    case "string":
      return "contoh";
    default:
      return "";
        case "enum":
      return Array.isArray(col.values) && typeof col.values[0] === "string"
        ? col.values[0]
        : "";
  }
}

// Contoh kosong pada kolom wajib diisi otomatis
function fillExamples(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.columns)) return raw;

  return {
    ...obj,
    columns: obj.columns.map((c) => {
      if (!c || typeof c !== "object") return c;
      const col = c as Record<string, unknown>;
      const blank = col.example === undefined || col.example === null || col.example === "";
      if (!blank) return col;
      return { ...col, example: col.required === false ? "" : guessExample(col) };
    }),
  };
}

function formatPath(p: PropertyKey[]): string {
  const [head, idx, ...rest] = p;
  if (head === "columns" && typeof idx === "number") {
    return [`Kolom #${idx + 1}`, ...rest.map(String)].join(" › ");
  }
  return p.map(String).join(" › ");
}

function parseConfig(raw: unknown): TemplateInput {
  const parsed = templateSchema.safeParse(fillExamples(raw));
  if (!parsed.success) {
    throw new TemplateError(
      "Konfigurasi template tidak valid",
      400,
      parsed.error.issues.map((i) => `${formatPath(i.path)}: ${i.message}`)
    );
  }

  const t = parsed.data;
  const issues: string[] = [];
  for (const col of t.columns) {
    const err = checkCell(col.example, col);
    if (err) {
      issues.push(`Kolom "${col.name}": contoh "${col.example}" tidak lolos aturannya (${err})`);
    }
  }
  if (issues.length) throw new TemplateError("Contoh nilai tidak sesuai aturan", 400, issues);

  return t;
}

function assertId(id: string) {
  if (!ID_RE.test(id)) throw new TemplateError("ID template tidak valid", 400);
}

// ---------- baca ----------

function rowToTemplate(row: Row): TemplateConfig {
  const parsed = templateSchema.safeParse({
    id: row.id,
    label: row.label,
    description: row.description ?? undefined,
    delimiter: row.delimiter,
    columnOrderMatters: row.column_order_matters,
    columns: row.columns,
  });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((i) => `${formatPath(i.path)}: ${i.message}`).join("; ")
    );
  }
  return {
    ...parsed.data,
    volumeName: row.volume_name,
    volumePath: volumePathFor(row.volume_name),
  };
}

export async function loadAll(): Promise<{
  templates: TemplateConfig[];
  problems: TemplateProblem[];
}> {
  const rows = await query<Row>(
    `SELECT ${SELECT_COLS} FROM templates ORDER BY created_at, id`
  );

  const templates: TemplateConfig[] = [];
  const problems: TemplateProblem[] = [];
  for (const row of rows) {
    try {
      templates.push(rowToTemplate(row));
    } catch (e) {
      const message = (e as Error).message;
      problems.push({ id: row.id, message });
      console.error(`Template ${row.id} dilewati: ${message}`);
    }
  }
  return { templates, problems };
}

export async function getTemplates(): Promise<TemplateConfig[]> {
  return (await loadAll()).templates;
}

export async function getTemplate(id: string): Promise<TemplateConfig | undefined> {
  if (!ID_RE.test(id)) return undefined;
  const rows = await query<Row>(`SELECT ${SELECT_COLS} FROM templates WHERE id = $1`, [id]);
  if (!rows[0]) return undefined;
  try {
    return rowToTemplate(rows[0]);
  } catch (e) {
    console.error(`Template ${id} rusak:`, e);
    return undefined;
  }
}

// ---------- tulis ----------

export async function createTemplate(raw: unknown): Promise<TemplateConfig> {
  const draft: Record<string, unknown> =
    raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};

  const label = typeof draft.label === "string" ? draft.label.trim() : "";
  const id = slugify(label);
  if (!id) {
    throw new TemplateError("Nama template tidak valid", 400, [
      "Nama harus mengandung huruf atau angka",
    ]);
  }
  draft.id = id;
  draft.label = label;

  const t = parseConfig(draft);
  const volumeName = volumeNameFromId(id);
  const volumePath = volumePathFor(volumeName);

  const clash = await query<{ id: string }>(
    `SELECT id FROM templates WHERE id = $1 OR volume_name = $2`,
    [id, volumeName]
  );
  if (clash.length > 0) {
    throw new TemplateError("Template dengan nama serupa sudah ada", 409, [
      `ID "${id}" / volume "${volumeName}" sudah dipakai. Gunakan nama lain atau edit template yang ada.`,
    ]);
  }

  // Volume dibuat otomatis di Databricks sebelum template disimpan
  try {
    await ensureVolume(volumePath);
  } catch (e) {
    throw new TemplateError("Volume Databricks belum bisa disiapkan", 502, [
      (e as Error).message,
    ]);
  }

  try {
    await query(
      `INSERT INTO templates
         (id, label, description, delimiter, column_order_matters, volume_name, columns)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
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
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      throw new TemplateError("Template dengan nama serupa sudah ada", 409);
    }
    throw e;
  }

  return { ...t, volumeName, volumePath };
}

export async function updateTemplate(id: string, raw: unknown): Promise<TemplateConfig> {
  assertId(id);
  const existing = await query<Row>(`SELECT ${SELECT_COLS} FROM templates WHERE id = $1`, [id]);
  if (!existing[0]) throw new TemplateError("Template tidak ditemukan", 404);

  const draft: Record<string, unknown> =
    raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  draft.id = id; // id dan volume tidak pernah berubah

  const t = parseConfig(draft);

  await query(
    `UPDATE templates
        SET label = $2,
            description = $3,
            delimiter = $4,
            column_order_matters = $5,
            columns = $6::jsonb,
            updated_at = now()
      WHERE id = $1`,
    [
      id,
      t.label,
      t.description ?? null,
      t.delimiter,
      t.columnOrderMatters,
      JSON.stringify(t.columns),
    ]
  );

  const volumeName = existing[0].volume_name;
  return { ...t, volumeName, volumePath: volumePathFor(volumeName) };
}

export async function deleteTemplate(id: string): Promise<void> {
  assertId(id);
  const rows = await query<{ id: string }>(
    `DELETE FROM templates WHERE id = $1 RETURNING id`,
    [id]
  );
  if (rows.length === 0) throw new TemplateError("Template tidak ditemukan", 404);
}

// ---------- bentuk aman untuk browser (halaman upload) ----------

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

export async function getPublicTemplates(): Promise<PublicTemplate[]> {
  return (await getTemplates()).map((t) => ({
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