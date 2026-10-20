import { readFileSync } from "fs";
import { validateCsv } from "../lib/validation/engine";
import { templates } from "../lib/templates";

const [templateId, filePath] = process.argv.slice(2);
const template = templates[templateId];

if (!template || !filePath) {
  console.log("Pakai: npx tsx scripts/test-validate.ts <template-id> <path-csv>");
  console.log("Template tersedia:", Object.keys(templates).join(", "));
  process.exit(1);
}

const result = validateCsv(readFileSync(filePath), template);
console.log(result.valid ? "✅ VALID" : "❌ INVALID", `(${result.rowCount} baris)`);
console.log(result.errors.slice(0, 10));
if (result.truncated) console.log("... error dipotong di 100 pertama");