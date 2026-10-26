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
    <main className="min-h-screen px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge badge-accent">Parquet Ingestion</span>
              <span className="text-xs text-slate-400 font-medium">Columnar Storage</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1 sm:text-3xl">
              Upload File Parquet
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Inspeksi skema kolom dan kirim file Parquet langsung ke Databricks storage.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="btn-secondary text-xs"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Kembali ke CSV
            </Link>
          </div>
        </div>

        {/* ─── Main Form Card ─── */}
        <div className="card p-6 sm:p-7 bg-white shadow-xs space-y-6 animate-in">
          {/* Dataset Name Section */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Nama Dataset
            </label>
            <input
              value={dataset}
              onChange={(e) => {
                setDataset(
                  e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "")
                );
                setResult(null);
              }}
              maxLength={50}
              placeholder="contoh: sales_transaksi_2026"
              className="input-field bg-white font-medium text-slate-900"
            />
            <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span>Target folder Databricks:</span>
              <code className="font-mono text-blue-700 bg-white border border-slate-200 px-2 py-0.5 rounded font-semibold text-[11px]">
                parquet/{dataset || "nama_dataset"}/
              </code>
            </div>
          </div>

          {/* ─── Dropzone ─── */}
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
            onClick={() => !file && inputRef.current?.click()}
            className={`dropzone ${dragging ? "dragging" : ""}`}
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

            {!file ? (
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3 shadow-inner">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Tarik dan lepas file Parquet di sini
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  atau <span className="font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer">pilih file dari perangkat</span>
                </p>
                <span className="mt-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Mendukung format .parquet biner terkompresi
                </span>
              </div>
            ) : (
              <div className="w-full max-w-md rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-center">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs">
                      PARQ
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        {formatSize(file.size)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setResult(null);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors shadow-2xs"
                    title="Ganti file"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {fileError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {fileError}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end pt-1">
            <button
              onClick={handleSubmit}
              disabled={!file || !dataset || loading}
              className="btn-primary px-7 py-2.5 text-sm w-full sm:w-auto"
            >
              {loading && <span className="spinner" />}
              {loading ? "Membaca & Mengirim..." : "Submit File Parquet"}
            </button>
          </div>

          {/* Result Banner */}
          {result && (
            <div className={`alert animate-in ${success ? "alert-success" : "alert-error"} mt-4`}>
              {success ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-sm shadow-xs">
                        ✓
                      </div>
                      <div>
                        <p className="font-bold text-emerald-950 text-sm">
                          File Parquet Valid & Berhasil Dikirim
                        </p>
                        <p className="text-xs text-emerald-800 mt-0.5">
                          {result.numRows?.toLocaleString("id-ID")} baris data, {result.columns?.length} kolom terdeteksi.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-emerald-100/60 border border-emerald-300 px-3 py-1.5 text-xs font-mono text-emerald-900 break-all">
                      Path: {result.path}
                    </div>
                  </div>

                  {/* Column Schema Table */}
                  <div className="overflow-auto rounded-xl border border-emerald-200 bg-white max-h-56">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nama Kolom</th>
                          <th>Tipe Data Parquet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.columns?.map((c, i) => (
                          <tr key={i}>
                            <td className="font-mono text-xs font-semibold text-blue-700">
                              {c.name}
                            </td>
                            <td>
                              <span className="badge badge-neutral font-mono text-[11px]">
                                {c.type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* PySpark Snippet */}
                  <div className="rounded-xl border border-emerald-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-800">
                        Query di PySpark Databricks Notebook:
                      </p>
                      <span className="badge badge-accent text-[10px]">Python</span>
                    </div>
                    <pre className="code-block text-slate-800">
{`df = spark.read.parquet("${folder}/")
df.printSchema()
display(df)`}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-white font-bold text-xs shadow-xs">
                      ✕
                    </div>
                    <p className="font-bold text-red-950 text-sm">
                      {result.valid ? "File terbaca, namun pengiriman gagal" : "File Parquet tidak valid"}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-1 pl-4 text-xs text-red-800 list-disc font-medium">
                    {result.errors.map((e, i) => (
                      <li key={i}>
                        {e.message}
                        {e.value ? <span className="ml-1 text-slate-600">({e.value})</span> : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}