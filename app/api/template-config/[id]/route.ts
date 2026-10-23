import { connection, NextResponse } from "next/server";
import { deleteTemplate, getTemplate, updateTemplate } from "@/lib/templates";
import { errorResponse } from "@/lib/templates/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  await connection();
  try {
    const { id } = await params;
    const template = await getTemplate(id);
    if (!template) {
      return NextResponse.json({ error: "Template tidak ditemukan", issues: [] }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json();
    return NextResponse.json({ template: await updateTemplate(id, body) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}