import { NextResponse } from "next/server";
import { TemplateError } from "./index";
import type { TemplateConfig } from "../validation/types";
import { ensureVolume } from "../databricks";

export function errorResponse(e: unknown) {
  if (e instanceof TemplateError) {
    return NextResponse.json({ error: e.message, issues: e.issues }, { status: e.status });
  }
  if (e instanceof SyntaxError) {
    return NextResponse.json({ error: "Body bukan JSON yang valid", issues: [] }, { status: 400 });
  }
  console.error(e);
  return NextResponse.json({ error: "Terjadi kesalahan di server", issues: [] }, { status: 500 });
}

// Pisahkan flag ensureVolume (bukan bagian config template) dari isi config
export function splitBody(body: unknown) {
  const { ensureVolume: flag, ...config } = (body ?? {}) as Record<string, unknown>;
  return { flag, config };
}

export function volumeHook(enabled: unknown) {
  if (enabled !== true) return undefined;
  return async (t: TemplateConfig) => {
    try {
      await ensureVolume(t.volumePath);
    } catch (e) {
      throw new TemplateError("Volume Databricks belum bisa disiapkan", 502, [
        (e as Error).message,
      ]);
    }
  };
}