import { connection, NextResponse } from "next/server";
import { createTemplate, loadAll } from "@/lib/templates";
import { errorResponse } from "@/lib/templates/http";

export async function GET() {
  await connection();
  try {
    const { templates, problems } = await loadAll();
    return NextResponse.json({ templates, problems });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const template = await createTemplate(body);
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}