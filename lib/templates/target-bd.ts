import type { TemplateConfig } from "../validation/types";

export const targetBd: TemplateConfig = {
  id: "target-bd",
  label: "Target Brand Distribution",
  delimiter: ";",
  columnOrderMatters: false,
  columns: {
    material_group_code: { type: "digits", length: 9 },
    tgt_year: { type: "digits", length: 4 },
    tgt_quarter: { type: "int", min: 1, max: 4 },
    regional_code: { type: "int" },
    area_short: { type: "string" },
    rayon_code: { type: "int" },
    rayon_name: { type: "string" },
    tgt_pct_raw: { type: "decimal", separator: "," },
    brand_name: { type: "string" },
  },
};