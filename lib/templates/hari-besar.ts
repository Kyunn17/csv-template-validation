import type { TemplateConfig } from "../validation/types";

export const hariBesar: TemplateConfig = {
  id: "hari-besar",
  label: "Hari Besar",
  delimiter: ";",
  columnOrderMatters: false,
  columns: {
    Year: { type: "digits", length: 4 },
    Week: { type: "int", min: 1, max: 53 },
    KeteranganHariBesar: { type: "string", required: false }, // di data asli ada yang kosong
  },
};