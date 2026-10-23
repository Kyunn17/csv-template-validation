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
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-md sm:p-8">
        <h1 className="mb-2 text-center text-xl font-bold">Template Management</h1>
        <p className="mb-6 text-center text-xs">
          <Link href="/" className="text-[#e8873f] underline">
            ← Kembali ke upload CSV
          </Link>
        </p>

        <div className="mb-4 flex justify-end">
          <Link
            href="/templates/new"
            className="rounded bg-[#e8873f] px-5 py-2 text-sm font-bold text-white hover:bg-[#d97a33]"
          >
            + Create Template
          </Link>
        </div>

        {error && (
          <p className="mb-4 rounded border border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {problems.length > 0 && (
          <div className="mb-4 rounded border border-yellow-500 bg-yellow-50 p-3 text-sm">
                        <p className="font-semibold">⚠️ Ada template di database yang tidak bisa dibaca dan dilewati:</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {problems.map((p) => (
                <li key={p.id}>
                  <code className="font-mono">{p.id}</code>: {p.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {templates.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Belum ada template.</p>
        ) : (
          <ul className="space-y-3">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{t.label}</p>
                  <p className="text-xs text-gray-500">
                    id: <code className="font-mono">{t.id}</code> · {t.columns.length} kolom · separator{" "}
                    <code className="font-mono">{t.delimiter === "\t" ? "Tab" : t.delimiter}</code>
                  </p>
                  <p className="text-xs break-all text-gray-500">Volume: {t.volumeName}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/templates/${t.id}/edit`}
                    className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-100"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(t)}
                    disabled={busyId === t.id}
                    className="rounded border border-red-400 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {busyId === t.id ? "Menghapus..." : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}