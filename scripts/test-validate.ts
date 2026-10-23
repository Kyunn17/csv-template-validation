import { readFileSync } from "fs";
import { validateCsv } from "../lib/validation/engine";
import { getTemplate, getTemplates } from "../lib/templates";

async function main() {
  const [templateId, filePath] = process.argv.slice(2);
  const template = await getTemplate(templateId ?? "");

  if (!template || !filePath) {
    const all = await getTemplates();
    console.log("Pakai: npx tsx --env-file=.env.local scripts/test-validate.ts <template-id> <path-csv>");
    console.log("Template tersedia:", all.map((t) => t.id).join(", "));
    process.exit(1);
  }

  const result = validateCsv(readFileSync(filePath), template);
  console.log(result.valid ? "✅ VALID" : "❌ INVALID", `(${result.rowCount} baris)`);
  console.log(result.errors.slice(0, 10));
  if (result.truncated) console.log("... error dipotong di 100 pertama");
}

main();