import { z } from "zod";

const base = {
  name: z.string().min(1),
  description: z.string().optional(),
  example: z.string(),
  required: z.boolean().optional(),
};

export const columnSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("string") }),
  z.object({
    ...base,
    type: z.literal("int"),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("digits"),
    length: z.number().int().positive(),
  }),
  z.object({
    ...base,
    type: z.literal("decimal"),
    separator: z.enum([",", "."]).optional(),
  }),
]);

export const templateSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "id hanya huruf kecil, angka, dan -"),
    label: z.string().min(1),
    description: z.string().optional(),
    delimiter: z.enum([";", ",", "\t", "|"]),
    columnOrderMatters: z.boolean().default(false),
    columns: z.array(columnSchema).min(1),
  })
  .superRefine((t, ctx) => {
    const seen = new Set<string>();
    for (const c of t.columns) {
      if (seen.has(c.name)) {
        ctx.addIssue({
          code: "custom",
          message: `nama kolom ganda: ${c.name}`,
          path: ["columns"],
        });
      }
      seen.add(c.name);
    }
  });

export type ColumnRule = z.infer<typeof columnSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
// Template lengkap = isi template + volume tujuan (dihitung dari nama volume, bukan diisi user)
export type TemplateConfig = TemplateInput & { volumeName: string; volumePath: string };

export type ValidationError = {
  level: "file" | "separator" | "column" | "cell";
  message: string;
  row?: number;
  column?: string;
  value?: string;
  expected?: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  rowCount: number;
  truncated: boolean;
};