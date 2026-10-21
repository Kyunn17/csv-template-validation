import { getTemplate, getTemplates } from "../lib/templates";

const [templateId, filePath] = process.argv.slice(2);
const template = getTemplate(templateId ?? "");

if (!template || !filePath) {
  console.log("Pakai: npx tsx scripts/test-validate.ts <template-id> <path-csv>");
  console.log("Template tersedia:", getTemplates().map((t) => t.id).join(", "));
  process.exit(1);
}