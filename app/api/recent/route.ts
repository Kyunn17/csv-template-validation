import { connection, NextResponse } from "next/server";
import { templates } from "@/lib/templates";
import { listRecentUploads } from "@/lib/databricks";

export async function GET() {
  // Beri tahu Next.js 16 bahwa route ini dinamis (jangan di-cache saat build)
  await connection();

  try {
    const files = await listRecentUploads(Object.keys(templates), 10);
    return NextResponse.json({
      files: files.map((f) => ({
        ...f,
        templateLabel: templates[f.templateId]?.label ?? f.templateId,
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