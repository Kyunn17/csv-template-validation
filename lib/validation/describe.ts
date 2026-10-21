import type { ColumnRule } from "./types";

export function describeRule(c: ColumnRule): string {
  switch (c.type) {
    case "string":
      return "Teks bebas";
    case "digits":
      return `${c.length} digit angka`;
    case "int": {
      if (c.min !== undefined && c.max !== undefined)
        return `Bilangan bulat ${c.min} sampai ${c.max}`;
      if (c.min !== undefined) return `Bilangan bulat, minimal ${c.min}`;
      if (c.max !== undefined) return `Bilangan bulat, maksimal ${c.max}`;
      return "Bilangan bulat";
    }
    case "decimal": {
      const sep = c.separator ?? ",";
      return `Angka desimal, pemisah "${sep}" (contoh 5${sep}25)`;
    }
  }
}