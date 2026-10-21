import { NextResponse } from "next/server";
import { parquetMetadata } from "hyparquet";
import { uploadToVolume } from "@/lib/databricks";

const MAX_BYTES = Number(process.env.PARQUET_MAX_MB ?? 4) * 1024 * 1024;
const DATASET_RE = /^[a-z0-9][a-z0-9_-]{0,49}$/;

type SchemaEl = { name: string; type?: string; converted_type?: string };

function bad(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { valid: false, errors: [{ level: "file", message, ...extra }] },
    { status }
  );
}

export async function POST(req: Request) {
  const form = await req.formData();
  const dataset = String(form.get("dataset") ?? "").trim();
  const file = form.get("file");

  if (!DATASET_RE.test(dataset)) {
    return bad(
      "Nama dataset hanya boleh huruf kecil, angka, _ dan - (maksimal 50 karakter, diawali huruf/angka)"
    );
  }
  if (!(file instanceof File)) return bad("File belum dipilih");
  if (!file.name.toLowerCase().endsWith(".parquet")) {
    return bad("File harus berekstensi .parquet", 400, { value: file.name });
  }
  if (file.size > MAX_BYTES) {
    return bad(`Ukuran file maksimal ${Math.round(MAX_BYTES / 1024 / 1024)} MB`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // File Parquet selalu diawali dan diakhiri teks "PAR1"
  const head = buffer.subarray(0, 4).toString("latin1");
  const tail = buffer.subarray(buffer.length - 4).toString("latin1");
  if (buffer.length < 12 || head !== "PAR1" || tail !== "PAR1") {
    return bad("Bukan file Parquet yang valid (penanda PAR1 tidak ditemukan)", 422);
  }

  // Baca metadata (schema + jumlah baris)
  let numRows = 0;
  let columns: { name: string; type: string }[] = [];
  try {
    const ab = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    const meta = parquetMetadata(ab);
    numRows = Number(meta.num_rows); // bisa bigint, JSON tidak bisa membawa bigint
    const schema = meta.schema as unknown as SchemaEl[];
    columns = schema
      .slice(1) // elemen pertama adalah root
      .filter((s) => s.type !== undefined) // hanya kolom daun
      .map((s) => ({ name: s.name, type: s.converted_type ?? String(s.type) }));
  } catch (e) {
    console.error("Parquet metadata gagal dibaca:", e);
    return bad("File Parquet rusak atau tidak bisa dibaca", 422);
  }

  try {
    const { path } = await uploadToVolume({
      buffer,
      folder: `parquet/${dataset}`,
      originalName: file.name,
    });
    return NextResponse.json({ valid: true, errors: [], numRows, columns, uploaded: true, path });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        valid: true,
        numRows,
        columns,
        uploaded: false,
        errors: [
          {
            level: "file",
            message: "File valid, tapi gagal dikirim ke Databricks. Coba lagi atau hubungi admin.",
          },
        ],
      },
      { status: 502 }
    );
  }
}