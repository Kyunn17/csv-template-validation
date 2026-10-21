import type { TemplateConfig } from "../validation/types";

function cell(value: string, delimiter: string): string {
  const needsQuote = value.includes(delimiter) || /["\r\n]/.test(value);
  return needsQuote ? `"${value.replace(/"/g, '""')}"` : value;
}

// Header + 1 baris contoh. BOM supaya Excel membaca UTF-8 dengan benar.
export function buildTemplateCsv(t: TemplateConfig): string {
  const d = t.delimiter;
  const header = t.columns.map((c) => cell(c.name, d)).join(d);
  const row = t.columns.map((c) => cell(c.example, d)).join(d);
  return `\uFEFF${header}\r\n${row}\r\n`;
}