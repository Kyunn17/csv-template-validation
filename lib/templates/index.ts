import fs from "node:fs";
import path from "node:path";
import { templateSchema, type TemplateConfig } from "../validation/types";
import { checkCell } from "../validation/validators";
import { describeRule } from "../validation/describe";

// Bisa diarahkan ke folder lain (mis. folder yang di-mount Docker) lewat env
export const TEMPLATES_DIR = process.env.TEMPLATES_DIR
  ? path.resolve(process.env.TEMPLATES_DIR)
  : path.join(process.cwd(), "config", "templates");

const ID_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

export class TemplateError extends Error {
  status: number;
  issues: string[];
  constructor(message: string, status = 400, issues: string[] = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

export type TemplateProblem = { file: string; message: string };

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

function parseConfig(raw: unknown): TemplateConfig {
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

  return { ...t, volumePath: t.volumePath.replace(/\/$/, "") };
}

// ---------- baca ----------

export function loadAll(): { templates: TemplateConfig[]; problems: TemplateProblem[] } {
  const templates: TemplateConfig[] = [];
  const problems: TemplateProblem[] = [];
  if (!fs.existsSync(TEMPLATES_DIR)) return { templates, problems };

  const files = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const volumes = new Map<string, string>();

  for (const file of files) {
    try {
      const text = fs.readFileSync(path.join(TEMPLATES_DIR, file), "utf-8").replace(/^\uFEFF/, "");
      const t = parseConfig(JSON.parse(text));
      if (file !== `${t.id}.json`) throw new Error(`nama file harus ${t.id}.json`);
      const clash = volumes.get(t.volumePath);
      if (clash) throw new Error(`volumePath sama dengan template "${clash}"`);
      volumes.set(t.volumePath, t.id);
      templates.push(t);
    } catch (e) {
      const message =
        e instanceof TemplateError
          ? `${e.message} (${e.issues.join("; ")})`
          : e instanceof SyntaxError
            ? "bukan JSON yang valid"
            : (e as Error).message;
      problems.push({ file, message });
      console.error(`Template ${file} dilewati: ${message}`);
    }
  }
  return { templates, problems };
}

export function getTemplates(): TemplateConfig[] {
  return loadAll().templates;
}

export function getTemplate(id: string): TemplateConfig | undefined {
  return getTemplates().find((t) => t.id === id);
}

// ---------- tulis ----------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

function fileFor(id: string): string {
  if (!ID_RE.test(id)) throw new TemplateError("ID template tidak valid", 400);
  return path.join(TEMPLATES_DIR, `${id}.json`);
}

function writeJson(id: string, t: TemplateConfig) {
  try {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
    const target = fileFor(id);
    const tmp = `${target}.${process.pid}.tmp`; // tidak berakhiran .json, jadi tidak ikut terbaca
    fs.writeFileSync(tmp, JSON.stringify(t, null, 2) + "\n", "utf-8");
    fs.renameSync(tmp, target);
  } catch (e) {
    if (e instanceof TemplateError) throw e;
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      throw new TemplateError(
        "Server tidak bisa menulis ke folder template (read-only atau tanpa izin). " +
          "Jalankan di lokal/Docker dengan folder yang bisa ditulis.",
        500
      );
    }
    throw e;
  }
}

function assertVolumeFree(templates: TemplateConfig[], volumePath: string, ownId?: string) {
  const clash = templates.find((x) => x.volumePath === volumePath && x.id !== ownId);
  if (clash) {
    throw new TemplateError("Volume tujuan sudah dipakai template lain", 409, [
      `Volume "${volumePath}" dipakai oleh "${clash.label}". Setiap template harus punya volume sendiri.`,
    ]);
  }
}

export function createTemplate(raw: unknown): TemplateConfig {
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

  if (fs.existsSync(fileFor(id))) {
    throw new TemplateError("Template dengan nama serupa sudah ada", 409, [
      `ID "${id}" sudah dipakai. Gunakan nama lain atau edit template yang ada.`,
    ]);
  }
  assertVolumeFree(loadAll().templates, t.volumePath);

  writeJson(id, t);
  return t;
}

export function updateTemplate(id: string, raw: unknown): TemplateConfig {
  const file = fileFor(id);
  if (!fs.existsSync(file)) throw new TemplateError("Template tidak ditemukan", 404);

  const draft: Record<string, unknown> =
    raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  draft.id = id; // id tidak pernah berubah

  const t = parseConfig(draft);
  assertVolumeFree(loadAll().templates, t.volumePath, id);

  writeJson(id, t);
  return t;
}

export function deleteTemplate(id: string): void {
  const file = fileFor(id);
  if (!fs.existsSync(file)) throw new TemplateError("Template tidak ditemukan", 404);
  fs.unlinkSync(file);
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