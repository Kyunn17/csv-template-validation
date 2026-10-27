import { NextResponse } from "next/server";
import { loadAll } from "@/lib/templates";
import { errorResponse } from "@/lib/templates/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { templates, problems } = await loadAll();
    return NextResponse.json({ templates, problems });
  } catch (e) {
    return errorResponse(e);
  }
}
