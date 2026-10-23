import { connection, NextResponse } from "next/server";
import { getTemplates } from "@/lib/templates";
import { listRecentUploads } from "@/lib/databricks";

export async function GET() {
  await connection();

  try {
    const list = await getTemplates();
    const files = await listRecentUploads(
      list.map((t) => ({ id: t.id, volumePath: t.volumePath })),
      10
    );
    return NextResponse.json({
      files: files.map((f) => ({
        ...f,
        templateLabel: list.find((t) => t.id === f.templateId)?.label ?? f.templateId,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { files: [], error: "Riwayat upload tidak bisa dimuat saat ini." },
      { status: 502 }
    );
  }
}