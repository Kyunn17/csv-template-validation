import type { ColumnRule } from "./types";
import { previewValues } from "./describe";

export function checkCell(raw: string, rule: ColumnRule): string | null {
  const value = raw.trim();

  if (value === "") {
    return rule.required === false ? null : "tidak boleh kosong";
  }

  switch (rule.type) {
    case "string":
      return null;

    case "digits":
      return new RegExp(`^\\d{${rule.length}}$`).test(value)
        ? null
        : `${rule.length} digit numeric`;

    case "int": {
      if (!/^\d+$/.test(value)) return "bilangan bulat";
      const n = Number(value);
      if (rule.min !== undefined && n < rule.min) return `angka >= ${rule.min}`;
      if (rule.max !== undefined && n > rule.max) return `angka <= ${rule.max}`;
      return null;
    }

    case "decimal": {
      const sep = rule.separator ?? ",";
      const re = new RegExp(`^\\d+(\\${sep}\\d+)?$`);
      return re.test(value)
        ? null
        : `angka desimal dengan pemisah "${sep}" (contoh: 5${sep}25)`;
    }

        case "enum":
      return rule.values.includes(value)
        ? null
        : `salah satu dari: ${previewValues(rule.values)}`;
  }
}