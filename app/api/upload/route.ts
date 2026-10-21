import { NextResponse } from "next/server";
import { uploadToVolume } from "@/lib/databricks";
import { getTemplate } from "@/lib/templates";
import { validateCsv } from "@/lib/validation/engine";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: Request) {
  const form = await req.formData();
  const templateId = String(form.get("templateId") ?? "");
  const file = form.get("file");

  const template = getTemplate(templateId);
  if (!template) {
    return NextResponse.json(
      { valid: false, errors: [{ level: "file", message: "Jenis data tidak dikenal" }] },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { valid: false, errors: [{ level: "file", message: "File belum dipilih" }] },
      { status: 400 }
    );
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json(
      { valid: false, errors: [{ level: "file", message: "File harus berekstensi .csv", value: file.name }] },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { valid: false, errors: [{ level: "file", message: "Ukuran file maksimal 20 MB" }] },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = validateCsv(buffer, template);

  if (!result.valid) {
    return NextResponse.json(result, { status: 422 });
  }

    try {
    const { path } = await uploadToVolume({
      buffer,
      volumePath: template.volumePath,
      originalName: file.name,
    });
    return NextResponse.json({ ...result, uploaded: true, path });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        ...result,
        uploaded: false,
        errors: [
          {
            level: "file",
            message:
              "File valid, tapi gagal dikirim ke Databricks. Coba lagi atau hubungi admin.",
          },
        ],
      },
      { status: 502 }
    );
  }
}