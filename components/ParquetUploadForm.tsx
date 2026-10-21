"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type VError = { level: string; message: string; value?: string };
type Result = {
  valid: boolean;
  errors: VError[];
  numRows?: number;
  columns?: { name: string; type: string }[];
  uploaded?: boolean;
  path?: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ParquetUploadForm() {
  const [dataset, setDataset] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    setResult(null);
    setFileError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".parquet")) {
      setFile(null);
      setFileError("File harus berekstensi .parquet");
      return;
    }
    setFile(f);
  }

  async function handleSubmit() {
    if (!file || !dataset) return;
    setLoading(true);
    setResult(null);

    const body = new FormData();
    body.append("dataset", dataset);
    body.append("file", file);

    try {
      const res = await fetch("/api/parquet", { method: "POST", body });
      setResult(await res.json());
    } catch {
      setResult({
        valid: false,
        errors: [{ level: "file", message: "Gagal menghubungi server" }],
      });
    } finally {
      setLoading(false);
    }
  }

  const success = result?.valid && result?.uploaded;
  const folder = result?.path ? result.path.substring(0, result.path.lastIndexOf("/")) : "";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-md sm:p-8">
        <h1 className="mb-2 text-center text-xl font-bold">Parquet Upload</h1>
        <p className="mb-6 text-center text-xs">
          <Link href="/" className="text-[#e8873f] underline">
            ← Kembali ke upload CSV
          </Link>
        </p>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-semibold">Nama Dataset</label>
          <input
            value={dataset}
            onChange={(e) => {
              setDataset(
                e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "")
              );
              setResult(null);
            }}
            maxLength={50}
            placeholder="contoh: sales_2026"
            className="w-full rounded border border-gray-300 p-2 text-sm focus:border-[#e8873f] focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            File disimpan di folder <code className="font-mono">parquet/{dataset || "nama_dataset"}/</code>.
            Gunakan nama yang sama hanya untuk file dengan kolom yang sama.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`flex min-h-48 flex-col items-center justify-center rounded border border-dashed px-4 py-8 text-center transition-colors ${
            dragging ? "border-[#e8873f] bg-orange-50" : "border-slate-500 bg-slate-100"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".parquet"
            className="hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#3b4b5c" aria-hidden="true">
            <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
          </svg>

          {file ? (
            <div className="mt-3 text-sm">
              <p className="font-semibold break-all">{file.name}</p>
              <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
                className="mt-2 text-xs text-gray-600 underline"
              >
                Hapus file
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              Drag &amp; drop file Parquet di sini atau{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-bold text-gray-800 underline"
              >
                browse
              </button>
            </p>
          )}
        </div>

        {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!file || !dataset || loading}
            className="rounded bg-[#e8873f] px-10 py-3 text-sm font-bold tracking-wide text-white uppercase hover:bg-[#d97a33] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Membaca & mengirim..." : "Submit"}
          </button>
        </div>

        {result && (
          <div
            className={`mt-6 rounded border p-4 ${
              success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
            }`}
          >
            {success ? (
              <div className="space-y-3">
                <p className="font-semibold">
                  ✅ File Parquet terbaca ({result.numRows?.toLocaleString("id-ID")} baris,{" "}
                  {result.columns?.length} kolom) dan berhasil dikirim ke Databricks.
                </p>
                <p className="text-sm break-all text-gray-600">Lokasi: {result.path}</p>

                <div className="max-h-60 overflow-auto rounded bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-sky-100">
                      <tr>
                        <th className="p-2 font-normal">Kolom</th>
                        <th className="p-2 font-normal">Tipe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.columns?.map((c, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{c.name}</td>
                          <td className="p-2">{c.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold">Baca di notebook PySpark:</p>
                  <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
{`df = spark.read.parquet("${folder}/")
df.printSchema()
display(df)`}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-semibold">
                  ❌ {result.valid ? "File terbaca, tapi pengiriman gagal" : "File tidak valid"}
                </p>
                <ul className="list-disc pl-5 text-sm">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      {e.message}
                      {e.value ? ` (${e.value})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}