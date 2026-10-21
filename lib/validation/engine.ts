import { parse } from "csv-parse/sync";
import type { TemplateConfig, ValidationError, ValidationResult } from "./types";
import { checkCell } from "./validators";

const MAX_ERRORS = 100;
const DELIMITER_CANDIDATES = [";", ",", "\t", "|"];

function detectDelimiter(headerLine: string): string {
  let best = "";
  let bestCount = 0;
  for (const c of DELIMITER_CANDIDATES) {
    const count = headerLine.split(c).length - 1;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

function fail(errors: ValidationError[]): ValidationResult {
  return { valid: false, errors, rowCount: 0, truncated: false };
}

export function validateCsv(
  content: string | Buffer,
  template: TemplateConfig
): ValidationResult {
  // 1. Baca teks & buang BOM (penting! file Target BD kamu pakai BOM)
  let text = typeof content === "string" ? content : content.toString("utf-8");
  text = text.replace(/^\uFEFF/, "");

  if (!text.trim()) {
    return fail([{ level: "file", message: "File kosong" }]);
  }

  // 2. Validasi separator
  const headerLine = text.split(/\r?\n/, 1)[0];
  const detected = detectDelimiter(headerLine);
  if (detected && detected !== template.delimiter) {
    return fail([
      {
        level: "separator",
        message: "Separator tidak sesuai",
        expected: JSON.stringify(template.delimiter),
        value: JSON.stringify(detected),
      },
    ]);
  }

  // 3. Parse CSV
    let records: { record: string[]; info: { lines: number } }[];
  try {
    records = parse(text, {
      delimiter: template.delimiter,
      relax_column_count: true, // jumlah kolom per baris kita cek sendiri
      skip_empty_lines: true,
      info: true,
    }) as unknown as { record: string[]; info: { lines: number } }[];
  } catch (e) {
      return fail([
      {
        level: "file",
        message: `File tidak bisa dibaca sebagai CSV: ${(e as Error).message}`,
      },
    ]);
  }

  if (records.length === 0) {
    return fail([{ level: "file", message: "File tidak berisi data" }]);
  }

  // 4. Validasi kolom (jumlah & nama)
  const header = records[0].record.map((h) => h.trim());
  const expectedCols = template.columns.map((c) => c.name);

  const missing = expectedCols.filter((c) => !header.includes(c));
  const extra = header.filter((c) => !expectedCols.includes(c));

  if (missing.length || extra.length) {
    const errors: ValidationError[] = [
      ...missing.map((c) => ({
        level: "column" as const,
        message: "Kolom tidak ada",
        column: c,
      })),
      ...extra.map((c) => ({
        level: "column" as const,
        message: "Kolom tambahan tidak diizinkan",
        column: c,
      })),
    ];
    return fail(errors);
  }

  if (
    template.columnOrderMatters &&
    header.some((h, i) => h !== expectedCols[i])
  ) {
    return fail([
      {
        level: "column",
        message: "Urutan kolom tidak sesuai template",
        expected: expectedCols.join(template.delimiter),
        value: header.join(template.delimiter),
      },
    ]);
  }

  // 5. Validasi cell
  const colIndex = new Map(header.map((h, i) => [h, i]));
  const errors: ValidationError[] = [];
  let truncated = false;
  const dataRows = records.slice(1);

  outer: for (const { record, info } of dataRows) {
    if (record.length !== header.length) {
      errors.push({
        level: "cell",
        row: info.lines,
        message: `Jumlah kolom di baris ini ${record.length}, seharusnya ${header.length}`,
      });
    } else {
        for (const rule of template.columns) {
        const value = record[colIndex.get(rule.name)!];
        const expected = checkCell(value, rule);
        if (expected) {
          errors.push({
            level: "cell",
            row: info.lines,
            column: rule.name,
            value,
            expected,
            message: "Nilai tidak valid",
          });
        }
      }
    }
    if (errors.length >= MAX_ERRORS) {
      truncated = true;
      break outer;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    rowCount: dataRows.length,
    truncated,
  };
}