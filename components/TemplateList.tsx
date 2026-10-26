"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TemplateConfig } from "@/lib/validation/types";

type Problem = { id: string; message: string };

export default function TemplateList({
  templates,
  problems,
}: {
  templates: TemplateConfig[];
  problems: Problem[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = templates.filter((t) =>
    t.label.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase()) ||
    t.volumeName.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(t: TemplateConfig) {
    const ok = window.confirm(
      `Hapus template "${t.label}"?\n\nFile yang sudah ada di Databricks tidak ikut terhapus.`
    );
    if (!ok) return;

    setBusyId(t.id);
    setError(null);
    try {
      const res = await fetch(`/api/template-config/${t.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Gagal menghapus template");
      } else {
        router.refresh();
      }
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge badge-accent">Template Management</span>
              <span className="text-xs text-slate-400 font-medium">Schema Rules</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1 sm:text-3xl">
              Daftar Template Validasi
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Kelola spesifikasi kolom, tipe data, pemisah, dan target folder Databricks.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/templates/new"
              className="btn-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Buat Template Baru
            </Link>
          </div>
        </div>

        {/* ─── Search & Stats Bar ─── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-in">
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Cari berdasarkan nama template, ID, atau volume..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 bg-white"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="rounded-lg bg-white border border-slate-200 px-3 py-2 shadow-2xs font-medium">
              Total: <strong className="text-slate-900">{templates.length}</strong> template
            </span>
          </div>
        </div>

        {error && (
          <div className="alert alert-error text-xs">
            <p className="flex items-center gap-2 font-medium">
              <span className="alert-icon">✕</span>
              {error}
            </p>
          </div>
        )}

        {problems.length > 0 && (
          <div className="alert alert-warning text-xs">
            <p className="font-semibold flex items-center gap-2 text-amber-900">
              <span className="alert-icon">⚠</span>
              Terdapat template di database yang tidak dapat diparsing:
            </p>
            <ul className="mt-2 space-y-1 pl-5 text-amber-800">
              {problems.map((p) => (
                <li key={p.id}>
                  <code className="font-mono font-bold">{p.id}</code>: {p.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ─── Templates List Cards ─── */}
        {filtered.length === 0 ? (
          <div className="card p-12 text-center bg-white shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <p className="text-base font-bold text-slate-800">
              {templates.length === 0 ? "Belum ada template yang dibuat" : "Tidak ada template yang cocok"}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {templates.length === 0
                ? "Mulai dengan membuat template pertama untuk mendefinisikan aturan kolom CSV dan folder tujuan Databricks."
                : "Coba kata kunci pencarian yang berbeda."}
            </p>
            {templates.length === 0 && (
              <div className="mt-5">
                <Link href="/templates/new" className="btn-primary">
                  Buat Template Baru
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="template-item bg-white border border-slate-200/90 hover:border-blue-300 p-5 rounded-xl shadow-xs transition-all"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      {t.label}
                    </h3>
                    <span className="badge badge-neutral font-mono text-[11px]">
                      {t.id}
                    </span>
                    <span className="badge badge-accent">
                      {t.columns.length} Kolom
                    </span>
                    <span className="badge badge-neutral">
                      Pemisah: <strong className="font-mono text-slate-800 ml-1">{t.delimiter === "\t" ? "Tab" : t.delimiter}</strong>
                    </span>
                  </div>

                  {t.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {t.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] bg-slate-50 border border-slate-200/80 rounded px-2 py-0.5 text-slate-600">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      {t.volumePath || `Volumes/.../${t.volumeName}`}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Urutan kolom: <strong>{t.columnOrderMatters ? "Harus Sama" : "Bebas"}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 sm:pt-0 shrink-0">
                  <Link
                    href={`/templates/${t.id}/edit`}
                    className="btn-secondary text-xs px-3.5 py-1.5"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </Link>

                  <button
                    onClick={() => handleDelete(t)}
                    disabled={busyId === t.id}
                    className="btn-danger text-xs px-3.5 py-1.5"
                  >
                    {busyId === t.id ? (
                      <>
                        <span className="spinner text-red-600" style={{ width: 12, height: 12 }} />
                        <span>Menghapus...</span>
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Hapus
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}