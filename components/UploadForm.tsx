"use client";

import { useEffect, useRef, useState } from "react";

type Option = { id: string; label: string; delimiter: string };

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

type Preview = { id: string; columns: string[]; row: string[] };

// Parser 1 baris CSV sederhana (menangani tanda kutip) khusus untuk preview
function parseLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadForm({ options }: { options: Option[] }) {
  const [templateId, setTemplateId] = useState(options[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === templateId) ?? options[0];

  // Ambil header + 1 baris contoh dari file template
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    fetch(`/templates/${selected.id}.csv`)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => {
        const lines = text
          .replace(/^\uFEFF/, "")
          .split(/\r?\n/)
          .filter((l) => l.trim() !== "");
        if (cancelled || lines.length === 0) return;
        setPreview({
          id: selected.id,
          columns: parseLine(lines[0], selected.delimiter),
          row: lines[1] ? parseLine(lines[1], selected.delimiter) : [],
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const activePreview = preview && preview.id === templateId ? preview : null;

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
      setResult(await res.json());
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

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-md sm:p-8">
        <h1 className="mb-6 text-center text-xl font-bold">CSV Data Upload</h1>

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
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Judul + download template */}
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Upload a CSV</h2>
            <p className="mt-2 text-xs text-gray-500">
              Upload file .csv dengan format kolom seperti contoh di bawah.
            </p>
            <p className="text-xs text-gray-500">
              Pemisah kolom: <code className="font-mono">{selected?.delimiter}</code>
            </p>
          </div>
          <a
            href={`/templates/${templateId}.csv`}
            download
            className="inline-flex items-center gap-1 text-sm font-bold text-[#e8873f] underline hover:text-[#cf6f27]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
            </svg>
            Download Template
          </a>
        </div>

        {/* Preview template */}
        <div className="mb-6 overflow-x-auto pb-2">
          {activePreview ? (
            <table className="min-w-full border-separate border-spacing-x-1 text-left text-sm">
              <thead>
                <tr>
                  {activePreview.columns.map((c, i) => (
                    <th key={i} className="whitespace-nowrap bg-sky-100 px-3 py-2 font-normal">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activePreview.row.length > 0 && (
                  <tr>
                    {activePreview.columns.map((_, i) => (
                      <td key={i} className="whitespace-nowrap px-3 py-2">
                        {activePreview.row[i] ?? ""}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-gray-400">Memuat contoh template...</p>
          )}
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
            dragging
              ? "border-[#e8873f] bg-orange-50"
              : "border-slate-500 bg-slate-100"
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
    </main>
  );
}