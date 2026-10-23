import { NextResponse } from "next/server";
import { getTemplate } from "@/lib/templates";
import { buildTemplateCsv } from "@/lib/templates/sample";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) {
    return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
  }

  return new NextResponse(buildTemplateCsv(template), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="template-${template.id}.csv"`,
    },
  });
}