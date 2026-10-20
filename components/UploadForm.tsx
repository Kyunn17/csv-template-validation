"use client";

import { useState } from "react";

type Option = { id: string; label: string };

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
};

export default function UploadForm({ options }: { options: Option[] }) {
  const [templateId, setTemplateId] = useState(options[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

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

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">CSV Data Upload</h1>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Jenis Data</label>
        <select
          className="w-full rounded border p-2"
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
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

      <div className="space-y-2">
        <label className="block text-sm font-medium">Template</label>
        <a
          href={`/templates/${templateId}.csv`}
          download
          className="inline-block rounded border px-4 py-2 text-sm hover:bg-gray-100"
        >
          Download Template
        </a>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Upload CSV</label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
          }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!file || loading}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Memvalidasi..." : "Validate & Upload"}
      </button>

      {result && (
        <div
          className={`rounded border p-4 ${
            result.valid ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
          }`}
        >
          {result.valid ? (
            <p className="font-medium">
              ✅ File valid ({result.rowCount.toLocaleString("id-ID")} baris). All validation passed.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="font-medium">❌ File tidak valid</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-1">Row</th>
                      <th className="p-1">Column</th>
                      <th className="p-1">Value</th>
                      <th className="p-1">Expected</th>
                      <th className="p-1">Pesan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-1">{e.row ?? "-"}</td>
                        <td className="p-1">{e.column ?? "-"}</td>
                        <td className="p-1">{e.value ?? "-"}</td>
                        <td className="p-1">{e.expected ?? "-"}</td>
                        <td className="p-1">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.truncated && (
                <p className="text-sm">
                  Hanya 100 error pertama yang ditampilkan. Perbaiki dulu, lalu upload ulang.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}