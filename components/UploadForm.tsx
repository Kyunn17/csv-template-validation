"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import RecentUploads from "@/components/RecentsUpload";
import type { PublicTemplate } from "@/lib/templates";

type VError = {
  level: string;
  message: string;
  row?: number;
  column?: string;
  value?: string;
  expected?: string;
};

type Result = {
  valid: boolean;
  errors: VError[];
  rowCount: number;
  truncated?: boolean;
  uploaded?: boolean;
  path?: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadForm({ templates }: { templates: PublicTemplate[] }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = templates.find((t) => t.id === templateId) ?? templates[0];
  const delimiterLabel = selected?.delimiter === "\t" ? "Tab" : selected?.delimiter;

  function pickFile(f: File | null) {
    setResult(null);
    setFileError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setFileError("File harus berekstensi .csv");
      return;
    }
    setFile(f);
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setResult(null);

    const body = new FormData();
    body.append("templateId", templateId);
    body.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const data: Result = await res.json();
      setResult(data);
      if (data.valid && data.uploaded) setRefreshKey((k) => k + 1);
    } catch {
      setResult({
        valid: false,
        rowCount: 0,
        errors: [{ level: "file", message: "Gagal menghubungi server" }],
      });
    } finally {
      setLoading(false);
    }
  }

  const success = result?.valid && result?.uploaded;

  if (!selected) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-center text-sm text-gray-600">
      Belum ada template.{" "}
      <Link href="/templates/new" className="text-[#e8873f] underline">
        Buat template pertama
      </Link>
    </main>
  );
}

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-md sm:p-8">
        <h1 className="mb-2 text-center text-xl font-bold">CSV Data Upload</h1>
        <p className="mb-6 flex justify-center gap-4 text-xs">
  <Link href="/templates" className="text-[#e8873f] underline">
    Kelola Template
  </Link>
  <Link href="/parquet" className="text-[#e8873f] underline">
    Upload file Parquet →
  </Link>
</p>

        {/* Jenis data */}
        <div className="mb-6">
          <label className="mb-1 block text-sm font-semibold">Jenis Data</label>
          <select
            className="w-full rounded border border-gray-300 bg-white p-2 text-sm focus:border-[#e8873f] focus:outline-none"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              setFile(null);
              setFileError(null);
              setResult(null);
            }}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {selected.description && (
            <p className="mt-1 text-xs text-gray-500">{selected.description}</p>
          )}
        </div>

        {/* Judul + download template */}
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Upload a CSV</h2>
            <p className="mt-2 text-xs text-gray-500">
              Upload file .csv dengan kolom seperti contoh di bawah.
            </p>
          </div>
          <a
            href={`/api/templates/${selected.id}`}
            download
            className="inline-flex items-center gap-1 text-sm font-bold text-[#e8873f] underline hover:text-[#cf6f27]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
            </svg>
            Download Template
          </a>
        </div>

        {/* Preview: header + 1 baris contoh, dari config */}
        <div className="mb-6 overflow-x-auto pb-2">
          <table className="min-w-full border-separate border-spacing-x-1 text-left text-sm">
            <thead>
              <tr>
                {selected.columns.map((c) => (
                  <th key={c.name} className="whitespace-nowrap bg-sky-100 px-3 py-2 font-normal">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {selected.columns.map((c) => (
                  <td key={c.name} className="whitespace-nowrap px-3 py-2">
                    {c.example}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Aturan validasi, dari config */}
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-bold">Aturan Validasi</h3>
          <ul className="mb-3 list-disc pl-5 text-xs text-gray-600">
            <li>
              Pemisah kolom: <code className="font-mono">{delimiterLabel}</code>
            </li>
            <li>Jumlah dan nama kolom harus sama persis dengan template.</li>
            <li>
              {selected.columnOrderMatters
                ? "Urutan kolom harus sama dengan template."
                : "Urutan kolom boleh berbeda dari template."}
            </li>
            <li>Teks NULL / NaN tidak diterima. Kosongkan sel kalau memang tidak ada data.</li>
          </ul>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2">Kolom</th>
                  <th className="p-2">Aturan</th>
                  <th className="p-2">Wajib</th>
                  <th className="p-2">Contoh</th>
                  <th className="p-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {selected.columns.map((c) => (
                  <tr key={c.name} className="border-t">
                    <td className="p-2 font-mono text-xs">{c.name}</td>
                    <td className="p-2">{c.rule}</td>
                    <td className="p-2">{c.required ? "Ya" : "Tidak"}</td>
                    <td className="p-2 whitespace-nowrap">{c.example || "-"}</td>
                    <td className="p-2 text-gray-600">{c.description ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dropzone */}
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
            accept=".csv"
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
              Drag &amp; drop file CSV di sini atau{" "}
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

        {/* Submit */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!file || loading}
            className="rounded bg-[#e8873f] px-10 py-3 text-sm font-bold tracking-wide text-white uppercase hover:bg-[#d97a33] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Memvalidasi..." : "Submit"}
          </button>
        </div>

        {/* Hasil */}
        {result && (
          <div
            className={`mt-6 rounded border p-4 ${
              success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
            }`}
          >
            {success ? (
              <div className="space-y-1">
                <p className="font-semibold">
                  ✅ File valid ({result.rowCount.toLocaleString("id-ID")} baris) dan berhasil dikirim ke Databricks.
                </p>
                <p className="text-sm break-all text-gray-600">Lokasi: {result.path}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-semibold">
                  ❌ {result.valid ? "File valid, tapi pengiriman gagal" : "File tidak valid"}
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    ({result.errors.length}
                    {result.truncated ? "+" : ""} error)
                  </span>
                </p>
                <div className="max-h-80 overflow-auto rounded bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-100">
                      <tr>
                        <th className="p-2">Row</th>
                        <th className="p-2">Column</th>
                        <th className="p-2">Value</th>
                        <th className="p-2">Expected</th>
                        <th className="p-2">Pesan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{e.row ?? "-"}</td>
                          <td className="p-2">{e.column ?? "-"}</td>
                          <td className="p-2 break-all">{e.value ?? "-"}</td>
                          <td className="p-2">{e.expected ?? "-"}</td>
                          <td className="p-2">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.truncated && (
                  <p className="text-sm text-gray-600">
                    Hanya 100 error pertama yang ditampilkan. Perbaiki dulu, lalu upload ulang.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <RecentUploads refreshKey={refreshKey} />
    </main>
  );
}