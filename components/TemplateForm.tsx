"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { TemplateConfig } from "@/lib/validation/types";

type ColType = "string" | "int" | "digits" | "decimal";

type ColumnDraft = {
  key: number;
  name: string;
  type: ColType;
  length: string;
  min: string;
  max: string;
  separator: "," | ".";
  required: boolean;
  description: string;
  example: string;
};

const TYPE_LABEL: Record<ColType, string> = {
  string: "Teks bebas",
  int: "Bilangan bulat",
  digits: "Angka N digit (mis. kode 9 digit)",
  decimal: "Angka desimal",
};

const DELIMITERS = [
  { value: ";", label: "Titik koma ( ; )" },
  { value: ",", label: "Koma ( , )" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipa ( | )" },
];

const inputCls =
  "w-full rounded border border-gray-300 bg-white p-2 text-sm focus:border-[#e8873f] focus:outline-none";

let keyCounter = 0;

function blankColumn(): ColumnDraft {
  return {
    key: keyCounter++,
    name: "",
    type: "string",
    length: "",
    min: "",
    max: "",
    separator: ",",
    required: true,
    description: "",
    example: "",
  };
}

function fromConfig(c: TemplateConfig["columns"][number]): ColumnDraft {
  return {
    key: keyCounter++,
    name: c.name,
    type: c.type,
    length: c.type === "digits" ? String(c.length) : "",
    min: c.type === "int" && c.min !== undefined ? String(c.min) : "",
    max: c.type === "int" && c.max !== undefined ? String(c.max) : "",
    separator: c.type === "decimal" ? (c.separator ?? ",") : ",",
    required: c.required !== false,
    description: c.description ?? "",
    example: c.example,
  };
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

function parseVolume(p: string) {
  const m = p.trim().match(/^\/Volumes\/([^/]+)\/([^/]+)\/([^/]+)/);
  return m ? { catalog: m[1], schema: m[2], volume: m[3] } : null;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold">{label}</span>
      {children}
    </label>
  );
}

export default function TemplateForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: TemplateConfig;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [delimiter, setDelimiter] = useState<string>(initial?.delimiter ?? ";");
  const [orderMatters, setOrderMatters] = useState(initial?.columnOrderMatters ?? false);
  const [volumePath, setVolumePath] = useState(initial?.volumePath ?? "");
  const [cols, setCols] = useState<ColumnDraft[]>(() =>
    initial ? initial.columns.map(fromConfig) : [blankColumn()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; issues: string[] } | null>(null);
  const [ensureVolume, setEnsureVolume] = useState(true);
  const parsedVol = parseVolume(volumePath);

  function updateCol(key: number, patch: Partial<ColumnDraft>) {
    setCols((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function moveCol(index: number, dir: -1 | 1) {
    setCols((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeCol(key: number) {
    setCols((prev) => (prev.length > 1 ? prev.filter((c) => c.key !== key) : prev));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const payload = {
      label: label.trim(),
      description: description.trim() || undefined,
      delimiter,
      columnOrderMatters: orderMatters,
      volumePath: volumePath.trim(),
      columns: cols.map((c) => ({
        name: c.name.trim(),
        type: c.type,
        description: c.description.trim() || undefined,
        example: c.example.trim(),
        required: c.required ? undefined : false,
        length: c.type === "digits" ? num(c.length) : undefined,
        min: c.type === "int" ? num(c.min) : undefined,
        max: c.type === "int" ? num(c.max) : undefined,
        separator: c.type === "decimal" ? c.separator : undefined,
        ensureVolume,
      })),
    };

    try {
      const url =
        mode === "create" ? "/api/template-config" : `/api/template-config/${initial?.id}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError({ message: data.error ?? "Gagal menyimpan template", issues: data.issues ?? [] });
        return;
      }
      router.push("/templates");
      router.refresh();
    } catch {
      setError({ message: "Gagal menghubungi server", issues: [] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-md sm:p-8">
        <h1 className="mb-2 text-center text-xl font-bold">
          {mode === "create" ? "Create Template" : "Edit Template"}
        </h1>
        <p className="mb-6 text-center text-xs">
          <Link href="/templates" className="text-[#e8873f] underline">
            ← Kembali ke daftar template
          </Link>
        </p>

        {mode === "edit" && initial && (
          <p className="mb-4 text-xs text-gray-500">
            ID template: <code className="font-mono">{initial.id}</code> (tetap sama walau nama diubah)
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama template">
            <input
              className={inputCls}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="contoh: Hari Raya"
            />
          </Field>
          <Field label="Separator">
            <select className={inputCls} value={delimiter} onChange={(e) => setDelimiter(e.target.value)}>
              {DELIMITERS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Databricks Volume tujuan">
              <input
                className={`${inputCls} font-mono`}
                value={volumePath}
                onChange={(e) => setVolumePath(e.target.value)}
                placeholder="/Volumes/catalog/schema/volume"
              />
            </Field>
            <p className="mt-1 text-xs text-gray-500">
              Format <code className="font-mono">/Volumes/catalog/schema/volume</code>, boleh ditambah
              subfolder. Setiap template harus punya volume/folder sendiri.
            </p>
                        {parsedVol && (
              <p className="mt-1 text-xs text-gray-700">
                Catalog <b>{parsedVol.catalog}</b> · Schema <b>{parsedVol.schema}</b> · Volume{" "}
                <b>{parsedVol.volume}</b>
              </p>
            )}
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ensureVolume}
                onChange={(e) => setEnsureVolume(e.target.checked)}
              />
              Buat volume otomatis di Databricks kalau belum ada
            </label>
            <p className="text-xs text-gray-500">
              Catalog dan schema harus sudah ada, hanya volume yang dibuat. Cek ejaan di atas,
              karena salah ketik akan membuat volume baru.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Field label="Deskripsi (opsional)">
              <input
                className={inputCls}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={orderMatters}
              onChange={(e) => setOrderMatters(e.target.checked)}
            />
            Urutan kolom di file harus sama dengan template
          </label>
        </div>

        <h2 className="mt-8 mb-3 text-base font-bold">Columns</h2>
        <div className="space-y-4">
          {cols.map((c, i) => (
            <div key={c.key} className="rounded border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Kolom {i + 1}</span>
                <div className="flex gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => moveCol(i, -1)}
                    disabled={i === 0}
                    className="disabled:opacity-30"
                    aria-label="Naikkan kolom"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCol(i, 1)}
                    disabled={i === cols.length - 1}
                    className="disabled:opacity-30"
                    aria-label="Turunkan kolom"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCol(c.key)}
                    disabled={cols.length === 1}
                    className="text-red-600 disabled:opacity-30"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Column Name">
                  <input
                    className={`${inputCls} font-mono`}
                    value={c.name}
                    onChange={(e) => updateCol(c.key, { name: e.target.value })}
                    placeholder="material_group_code"
                  />
                </Field>
                <Field label="Type">
                  <select
                    className={inputCls}
                    value={c.type}
                    onChange={(e) => updateCol(c.key, { type: e.target.value as ColType })}
                  >
                    {(Object.keys(TYPE_LABEL) as ColType[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </Field>

                {c.type === "digits" && (
                  <Field label="Length (jumlah digit)">
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={c.length}
                      onChange={(e) => updateCol(c.key, { length: e.target.value })}
                      placeholder="9"
                    />
                  </Field>
                )}
                {c.type === "int" && (
                  <>
                    <Field label="Min (opsional)">
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        value={c.min}
                        onChange={(e) => updateCol(c.key, { min: e.target.value })}
                      />
                    </Field>
                    <Field label="Max (opsional)">
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        value={c.max}
                        onChange={(e) => updateCol(c.key, { max: e.target.value })}
                      />
                    </Field>
                  </>
                )}
                {c.type === "decimal" && (
                  <Field label="Pemisah desimal">
                    <select
                      className={inputCls}
                      value={c.separator}
                      onChange={(e) =>
                        updateCol(c.key, { separator: e.target.value as "," | "." })
                      }
                    >
                      <option value=",">Koma ( , )</option>
                      <option value=".">Titik ( . )</option>
                    </select>
                  </Field>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Keterangan (opsional)">
                  <input
                    className={inputCls}
                    value={c.description}
                    onChange={(e) => updateCol(c.key, { description: e.target.value })}
                  />
                </Field>
                <Field label="Contoh nilai">
                  <input
                    className={inputCls}
                    value={c.example}
                    onChange={(e) => updateCol(c.key, { example: e.target.value })}
                    placeholder="kosongkan = otomatis"
                  />
                </Field>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={c.required}
                    onChange={(e) => updateCol(c.key, { required: e.target.checked })}
                  />
                  Wajib diisi
                </label>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCols((prev) => [...prev, blankColumn()])}
          className="mt-4 rounded border border-dashed border-[#e8873f] px-4 py-2 text-sm font-bold text-[#e8873f] hover:bg-orange-50"
        >
          + Add Column
        </button>

        {error && (
          <div className="mt-6 rounded border border-red-500 bg-red-50 p-4 text-sm">
            <p className="font-semibold">❌ {error.message}</p>
            {error.issues.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {error.issues.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-8 flex justify-end gap-3">
          <Link
            href="/templates"
            className="rounded border border-gray-300 px-6 py-3 text-sm hover:bg-gray-100"
          >
            Batal
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-[#e8873f] px-10 py-3 text-sm font-bold tracking-wide text-white uppercase hover:bg-[#d97a33] disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Save"}
          </button>
        </div>
      </div>
    </main>
  );
}