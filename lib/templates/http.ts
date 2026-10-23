import { NextResponse } from "next/server";
import { TemplateError } from "./index";

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