import type { TemplateConfig } from "../validation/types";
import { targetBd } from "./target-bd";
import { hariBesar } from "./hari-besar";

export const templates: Record<string, TemplateConfig> = {
  [targetBd.id]: targetBd,
  [hariBesar.id]: hariBesar,
};