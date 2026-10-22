import { connection, NextResponse } from "next/server";
import { createTemplate, loadAll } from "@/lib/templates";
import { errorResponse, splitBody, volumeHook } from "@/lib/templates/http";

export async function GET() {
  await connection();
  const { templates, problems } = loadAll();
  return NextResponse.json({ templates, problems });
}

export async function POST(req: Request) {
  try {
    const { flag, config } = splitBody(await req.json());
    const template = await createTemplate(config, volumeHook(flag));
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}