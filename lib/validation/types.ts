export type ColumnRule =
  | { type: "string"; required?: boolean }
  | { type: "int"; min?: number; max?: number; required?: boolean }
  | { type: "digits"; length: number; required?: boolean }
  | { type: "decimal"; separator?: "," | "."; required?: boolean };

export type TemplateConfig = {
  id: string;
  label: string;
  delimiter: string;
  columnOrderMatters: boolean; // belum diputuskan pembimbing, jadi dibuat flag
  columns: Record<string, ColumnRule>;
};

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
  truncated: boolean; // true kalau error lebih dari batas dan sebagian dipotong
};