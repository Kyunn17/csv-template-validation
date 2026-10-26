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
  const [rulesOpen, setRulesOpen] = useState(false);
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
      <main className="loading-screen flex-col gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600">
          Belum ada template yang terdaftar.{" "}
          <Link href="/templates/new" className="font-semibold text-blue-600 hover:text-blue-700 underline">
            Buat template pertama →
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* ─── Hero / Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge badge-accent">CSV Ingestion</span>
              <span className="text-xs text-slate-400 font-medium">Databricks Ready</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1 sm:text-3xl">
              Upload & Validasi CSV
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Validasi integritas skema data otomatis sebelum dikirim ke Databricks Catalog.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/templates/${selected.id}`}
              download
              className="btn-secondary text-xs"
              title="Download contoh template CSV kosong"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Template CSV
            </a>
          </div>
        </div>

        {/* ─── Main Action Card ─── */}
        <div className="card p-6 sm:p-7 animate-in space-y-6 bg-white">
          {/* Top Configuration Bar: Template Selector */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-12 sm:items-center">
              <div className="sm:col-span-7">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pilih Template Validasi
                </label>
                <div className="relative">
                  <select
                    className="input-field bg-white font-medium text-slate-900"
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
                        {t.label} ({t.columns.length} kolom)
                      </option>
                    ))}
                  </select>
                </div>
                {selected.description && (
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                    {selected.description}
                  </p>
                )}
              </div>

              {/* Template Specs Quick Badges */}
              <div className="sm:col-span-5 flex flex-wrap sm:justify-end gap-2 text-xs">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <span className="text-slate-400 font-medium">Delimiter:</span>
                  <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    {delimiterLabel}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <span className="text-slate-400 font-medium">Kolom:</span>
                  <span className="font-semibold text-slate-800">
                    {selected.columns.length}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-2xs">
                  <span className="text-slate-400 font-medium">Urutan:</span>
                  <span className="font-semibold text-slate-700">
                    {selected.columnOrderMatters ? "Ketat" : "Bebas"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Dropzone Area ─── */}
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
              accept=".csv"
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
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Tarik dan lepas file CSV di sini
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  atau <span className="font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer">pilih file dari perangkat</span>
                </p>
                <span className="mt-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Mendukung .CSV berpemisah ({delimiterLabel})
                </span>
              </div>
            ) : (
              <div className="w-full max-w-md rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-center">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs">
                      CSV
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

          {/* Action Row: Submit button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
            <button
              type="button"
              onClick={() => setRulesOpen((prev) => !prev)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform duration-200 ${rulesOpen ? "rotate-90" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {rulesOpen ? "Sembunyikan Aturan Validasi" : "Lihat Aturan Validasi Kolom"}
              <span className="badge badge-neutral ml-1">
                {selected.columns.length} Kolom
              </span>
            </button>

            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              className="btn-primary w-full sm:w-auto px-7 py-2.5 text-sm"
            >
              {loading && <span className="spinner" />}
              {loading ? "Memvalidasi Data..." : "Validasi & Kirim ke Databricks"}
            </button>
          </div>

          {/* ─── Collapsible Schema & Rules ─── */}
          {rulesOpen && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4 animate-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Spesifikasi Skema Kolom ({selected.label})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pastikan susunan header CSV sesuai dengan tabel spesifikasi di bawah.
                  </p>
                </div>
              </div>

              {/* Sample Header & Value Row Preview */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="preview-table">
                  <thead>
                    <tr>
                      {selected.columns.map((c) => (
                        <th key={c.name} className="whitespace-nowrap">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {selected.columns.map((c) => (
                        <td key={c.name} className="whitespace-nowrap text-slate-500">
                          {c.example || "-"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Detailed Columns Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama Kolom</th>
                      <th>Aturan Validasi</th>
                      <th>Wajib Diisi</th>
                      <th>Contoh Nilai</th>
                      <th>Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.columns.map((c) => (
                      <tr key={c.name}>
                        <td className="font-mono text-xs font-semibold text-blue-700">
                          {c.name}
                        </td>
                        <td>
                          <span className="badge badge-neutral font-medium">
                            {c.rule}
                          </span>
                        </td>
                        <td>
                          {c.required ? (
                            <span className="badge badge-accent">Wajib</span>
                          ) : (
                            <span className="badge badge-neutral">Opsional</span>
                          )}
                        </td>
                        <td className="font-mono text-xs text-slate-600 whitespace-nowrap">
                          {c.example || "-"}
                        </td>
                        <td className="text-xs text-slate-500">
                          {c.description ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── Validation Result Banner / Table ─── */}
          {result && (
            <div className={`alert animate-in ${success ? "alert-success" : "alert-error"} mt-4`}>
              {success ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-sm shadow-xs">
                      ✓
                    </div>
                    <div>
                      <p className="font-bold text-emerald-950 text-sm">
                        Validasi Berhasil & Tersimpan di Databricks
                      </p>
                      <p className="text-xs text-emerald-800 mt-0.5 font-medium">
                        {result.rowCount.toLocaleString("id-ID")} baris data berhasil divalidasi dan diunggah.
                      </p>
                    </div>
                  </div>

                  {result.path && (
                    <div className="rounded-lg bg-emerald-100/60 border border-emerald-300 px-3 py-1.5 text-xs font-mono text-emerald-900 break-all">
                      Path: {result.path}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-white font-bold text-xs shadow-xs">
                        ✕
                      </div>
                      <div>
                        <p className="font-bold text-red-950 text-sm">
                          {result.valid ? "Validasi Lolos, Pengiriman Gagal" : "Validasi Gagal — Ditemukan Kesalahan"}
                        </p>
                        <p className="text-xs text-red-800">
                          Perbaiki kesalahan di bawah ini sebelum mengunggah kembali.
                        </p>
                      </div>
                    </div>
                    <span className="badge badge-error">
                      {result.errors.length}{result.truncated ? "+" : ""} Kesalahan
                    </span>
                  </div>

                  <div className="max-h-80 overflow-auto rounded-lg border border-red-200 bg-white">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Baris</th>
                          <th>Kolom</th>
                          <th>Nilai di File</th>
                          <th>Nilai yang Diharapkan</th>
                          <th>Pesan Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((e, i) => (
                          <tr key={i}>
                            <td className="font-mono text-xs font-semibold text-slate-700">
                              {e.row ?? "-"}
                            </td>
                            <td className="font-mono text-xs font-semibold text-red-600">
                              {e.column ?? "-"}
                            </td>
                            <td className="font-mono text-xs text-slate-700 break-all bg-red-50/50">
                              {e.value ?? "-"}
                            </td>
                            <td className="font-mono text-xs text-slate-600">
                              {e.expected ?? "-"}
                            </td>
                            <td className="text-xs text-slate-800 font-medium">
                              {e.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {result.truncated && (
                    <p className="text-xs text-slate-500 font-medium italic">
                      * Menampilkan 100 error pertama. Selesaikan error di atas dan lakukan pengujian ulang.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Recent Uploads Section ─── */}
        <RecentUploads refreshKey={refreshKey} />
      </div>
    </main>
  );
}