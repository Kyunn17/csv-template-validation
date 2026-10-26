"use client";

import { useEffect, useState } from "react";

type Item = {
  templateId: string;
  templateLabel: string;
  fileName: string;
  uploadedAt: string | null;
  size: number | null;
};

type LoadState = { key: string; items: Item[]; error: string | null };

function formatSize(bytes: number | null): string {
  if (bytes === null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function RecentUploads({ refreshKey }: { refreshKey: number }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LoadState | null>(null);

  const requestKey = `${refreshKey}-${reloadKey}`;

  useEffect(() => {
    let cancelled = false;

    fetch("/api/recent", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setState({
          key: requestKey,
          items: data.files ?? [],
          error: data.error ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          key: requestKey,
          items: [],
          error: "Riwayat upload tidak bisa dimuat saat ini.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const loading = state === null || state.key !== requestKey;
  const items = state?.items ?? null;
  const error = state?.error ?? null;

  return (
    <div className="card p-6 sm:p-7 bg-white shadow-xs animate-in">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Recent Uploads
            </h2>
            <p className="text-[11px] text-slate-500">
              Daftar file CSV yang berhasil divalidasi dan terkirim ke Databricks.
            </p>
          </div>
        </div>

        <button
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <span className="spinner text-blue-600" style={{ width: 12, height: 12 }} />
              <span>Memuat...</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>Refresh</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {items === null ? (
        <div className="flex items-center justify-center gap-2.5 py-10 text-slate-500">
          <span className="spinner text-blue-600" />
          <span className="text-xs font-medium">Mengambil riwayat upload...</span>
        </div>
      ) : items.length === 0 ? (
        !error && (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
            </div>
            <p className="text-xs font-medium text-slate-600">Belum ada riwayat file yang diunggah.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">File yang berhasil divalidasi akan muncul di sini secara realtime.</p>
          </div>
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama File</th>
                <th>Template</th>
                <th>Waktu Upload</th>
                <th>Ukuran</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={`${it.templateId}-${it.fileName}-${i}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="font-mono text-xs font-semibold text-slate-800 break-all">
                    {it.fileName}
                  </td>
                  <td>
                    <span className="badge badge-accent">
                      {it.templateLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-xs text-slate-500">
                    {formatDate(it.uploadedAt)}
                  </td>
                  <td className="whitespace-nowrap text-xs text-slate-500 font-mono">
                    {formatSize(it.size)}
                  </td>
                  <td>
                    <span className="badge badge-success">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Terkirim
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}