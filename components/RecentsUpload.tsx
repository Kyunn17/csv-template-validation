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

  // Setiap kali upload sukses (refreshKey) atau tombol Refresh ditekan (reloadKey),
  // requestKey berubah dan effect mengambil data lagi.
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

  // Loading dihitung dari data, bukan disimpan sebagai state sendiri
  const loading = state === null || state.key !== requestKey;
  const items = state?.items ?? null;
  const error = state?.error ?? null;

  return (
    <div className="mx-auto mt-6 max-w-4xl rounded-lg bg-white p-6 shadow-md sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">Recent Uploads</h2>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
          className="text-sm font-bold text-[#e8873f] underline disabled:opacity-50"
        >
          {loading ? "Memuat..." : "Refresh"}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {items === null ? (
        <p className="text-sm text-gray-400">Memuat...</p>
      ) : items.length === 0 ? (
        !error && (
          <p className="text-sm text-gray-500">Belum ada file yang diupload.</p>
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-sky-100">
                <th className="p-2 font-normal">File</th>
                <th className="p-2 font-normal">Template</th>
                <th className="p-2 font-normal">Uploaded At</th>
                <th className="p-2 font-normal">Size</th>
                <th className="p-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={`${it.templateId}-${it.fileName}-${i}`} className="border-b">
                  <td className="p-2 break-all">{it.fileName}</td>
                  <td className="p-2">{it.templateLabel}</td>
                  <td className="p-2 whitespace-nowrap">{formatDate(it.uploadedAt)}</td>
                  <td className="p-2 whitespace-nowrap">{formatSize(it.size)}</td>
                  <td className="p-2">
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                      Uploaded
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