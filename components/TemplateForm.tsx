"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TemplateConfig } from "@/lib/validation/types";
import { slugify, toSchemaName, volumePathFor, DEFAULT_VOLUME_NAME } from "@/lib/volume";

type ColType = "string" | "int" | "digits" | "decimal" | "enum";

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
  values: string;
};

const TYPE_LABEL: Record<ColType, string> = {
  string: "Teks Bebas (string)",
  int: "Bilangan Bulat (int)",
  digits: "Angka N-Digit (mis. kode 9 digit)",
  decimal: "Angka Desimal (decimal)",
  enum: "Pilihan Nilai Tertentu (enum)",
};

const DELIMITERS = [
  { value: ";", label: "Titik Koma ( ; )" },
  { value: ",", label: "Koma ( , )" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipa ( | )" },
];

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
    values: "",
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
    values: c.type === "enum" ? c.values.join("\n") : "",
  };
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ─── Drag handle icon (6-dot grip) ─── */
function GripIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="3.5" r="1.3" />
      <circle cx="11" cy="3.5" r="1.3" />
      <circle cx="5" cy="8" r="1.3" />
      <circle cx="11" cy="8" r="1.3" />
      <circle cx="5" cy="12.5" r="1.3" />
      <circle cx="11" cy="12.5" r="1.3" />
    </svg>
  );
}

/* ─── Sortable column card ─── */
function SortableColumnCard({
  col,
  index,
  total,
  onUpdate,
  onRemove,
}: {
  col: ColumnDraft;
  index: number;
  total: number;
  onUpdate: (key: number, patch: Partial<ColumnDraft>) => void;
  onRemove: (key: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const c = col;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`column-card bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs transition-all ${
        isDragging ? "dragging shadow-lg border-blue-400 bg-blue-50/20" : "hover:border-slate-300"
      }`}
    >
      {/* Header bar of Column Card */}
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* Drag handle */}
          <div
            className="drag-handle rounded-md p-1 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            {...attributes}
            {...listeners}
            title="Klik dan geser untuk mengubah urutan kolom"
          >
            <GripIcon />
          </div>

          {/* Column number badge & title */}
          <span className="flex items-center gap-2 min-w-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 font-bold text-xs text-blue-700 font-mono">
              {index + 1}
            </span>
            <span className="text-sm font-bold text-slate-800 truncate">
              {c.name || <span className="text-slate-400 italic">Kolom belum bernama</span>}
            </span>
            {c.type && (
              <span className="badge badge-accent text-[10px]">
                {c.type}
              </span>
            )}
          </span>
        </div>

        {/* Delete Column Button */}
        <button
          type="button"
          onClick={() => onRemove(c.key)}
          disabled={total === 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30 disabled:pointer-events-none shadow-2xs"
          title="Hapus kolom ini"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* Inputs Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nama Kolom (Header)">
          <input
            className="input-field font-mono font-medium text-slate-900"
            value={c.name}
            onChange={(e) => onUpdate(c.key, { name: e.target.value })}
            placeholder="contoh: material_group_code"
          />
        </Field>

        <Field label="Tipe Data">
          <select
            className="input-field font-medium text-slate-900"
            value={c.type}
            onChange={(e) => onUpdate(c.key, { type: e.target.value as ColType })}
          >
            {(Object.keys(TYPE_LABEL) as ColType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>

        {c.type === "digits" && (
          <Field label="Panjang Karakter (Digit)">
            <input
              type="number"
              min={1}
              className="input-field font-mono"
              value={c.length}
              onChange={(e) => onUpdate(c.key, { length: e.target.value })}
              placeholder="9"
            />
          </Field>
        )}

        {c.type === "int" && (
          <>
            <Field label="Nilai Minimum (opsional)">
              <input
                type="number"
                min={0}
                className="input-field font-mono"
                value={c.min}
                onChange={(e) => onUpdate(c.key, { min: e.target.value })}
              />
            </Field>
            <Field label="Nilai Maksimum (opsional)">
              <input
                type="number"
                min={0}
                className="input-field font-mono"
                value={c.max}
                onChange={(e) => onUpdate(c.key, { max: e.target.value })}
              />
            </Field>
          </>
        )}

        {c.type === "decimal" && (
          <Field label="Pemisah Desimal">
            <select
              className="input-field"
              value={c.separator}
              onChange={(e) =>
                onUpdate(c.key, { separator: e.target.value as "," | "." })
              }
            >
              <option value=",">Koma ( , )</option>
              <option value=".">Titik ( . )</option>
            </select>
          </Field>
        )}

        {c.type === "enum" && (
          <div className="sm:col-span-3">
            <Field label="Daftar Nilai yang Sah (Satu nilai per baris)">
              <textarea
                rows={3}
                className="input-field font-mono text-xs"
                value={c.values}
                onChange={(e) => onUpdate(c.key, { values: e.target.value })}
                placeholder={"aktif\nnonaktif\npending"}
              />
            </Field>
            <p className="mt-1 text-[11px] text-slate-400">
              Pencocokan bersifat peka huruf besar/kecil (case-sensitive).
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3 pt-3 border-t border-slate-100">
        <Field label="Contoh Nilai">
          <input
            className="input-field text-slate-800"
            value={c.example}
            onChange={(e) => onUpdate(c.key, { example: e.target.value })}
            placeholder="kosongkan = otomatis"
          />
        </Field>

        <Field label="Deskripsi / Catatan (opsional)">
          <input
            className="input-field text-slate-800"
            value={c.description}
            onChange={(e) => onUpdate(c.key, { description: e.target.value })}
            placeholder="Petunjuk pengisian data"
          />
        </Field>

        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={c.required}
              onChange={(e) => onUpdate(c.key, { required: e.target.checked })}
            />
            <span>Kolom Wajib Diisi</span>
          </label>
        </div>
      </div>
    </div>
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

  const [cols, setCols] = useState<ColumnDraft[]>(() =>
    initial ? initial.columns.map(fromConfig) : [blankColumn()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; issues: string[] } | null>(null);

  const slug = slugify(label);
  const volumeDisplay =
    initial?.volumePath ??
    volumePathFor(slug ? toSchemaName(slug) : "<nama_schema>", DEFAULT_VOLUME_NAME);

  function updateCol(key: number, patch: Partial<ColumnDraft>) {
    setCols((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function removeCol(key: number) {
    setCols((prev) => (prev.length > 1 ? prev.filter((c) => c.key !== key) : prev));
  }

  /* ─── dnd-kit configuration ─── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCols((prev) => {
        const oldIndex = prev.findIndex((c) => c.key === active.id);
        const newIndex = prev.findIndex((c) => c.key === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const payload = {
      label: label.trim(),
      description: description.trim() || undefined,
      delimiter,
      columnOrderMatters: orderMatters,
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
        values:
          c.type === "enum"
            ? c.values.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
            : undefined,
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
    <main className="min-h-screen px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge badge-accent">
                {mode === "create" ? "New Configuration" : "Edit Configuration"}
              </span>
              <span className="text-xs text-slate-400 font-medium">Schema Builder</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1 sm:text-3xl">
              {mode === "create" ? "Buat Template Validasi" : `Edit Template: ${initial?.label}`}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Tentukan parameter header, tipe kolom, batasan nilai, dan struktur data CSV.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/templates"
              className="btn-secondary text-xs"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Kembali
            </Link>
          </div>
        </div>

        {/* ─── Card 1: Template Metadata ─── */}
        <div className="card p-6 sm:p-7 bg-white shadow-xs space-y-5 animate-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-xs">
                1
              </div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Informasi & Pengaturan Template
              </h2>
            </div>

            {mode === "edit" && initial && (
              <span className="badge badge-neutral font-mono text-[11px]">
                ID: {initial.id}
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Template">
              <input
                className="input-field text-slate-900 font-medium"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="contoh: Master Customer"
              />
            </Field>

            <Field label="Pemisah Kolom (Delimiter)">
              <select
                className="input-field font-medium text-slate-900"
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
              >
                {DELIMITERS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="sm:col-span-2">
              <Field label="Deskripsi Template (opsional)">
                <input
                  className="input-field text-slate-900"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan singkat mengenai dataset dan tujuan penggunaannya"
                />
              </Field>
            </div>

            {/* Target Databricks Volume Preview */}
            <div className="sm:col-span-2 rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Target Databricks Volume:
              </span>
              <code className="font-mono text-blue-700 bg-white border border-slate-200 px-2 py-1 rounded-md font-semibold">
                {volumeDisplay}
              </code>
            </div>

            {/* Order matters checkbox */}
            <div className="sm:col-span-2 pt-1">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={orderMatters}
                  onChange={(e) => setOrderMatters(e.target.checked)}
                />
                <span>Urutan kolom pada file CSV harus sama persis dengan urutan di bawah ini</span>
              </label>
            </div>
          </div>
        </div>

        {/* ─── Card 2: Columns Configuration (dnd-kit) ─── */}
        <div className="card p-6 sm:p-7 bg-white shadow-xs space-y-5 animate-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-xs">
                2
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Struktur Kolom & Aturan Validasi
                </h2>
                <p className="text-[11px] text-slate-400">
                  Tarik gagang titik di kiri kartu kolom untuk mengubah urutan (drag & drop).
                </p>
              </div>
            </div>

            <span className="badge badge-accent">
              {cols.length} Kolom Dikonfigurasi
            </span>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={cols.map((c) => c.key)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {cols.map((c, i) => (
                  <SortableColumnCard
                    key={c.key}
                    col={c}
                    index={i}
                    total={cols.length}
                    onUpdate={updateCol}
                    onRemove={removeCol}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add Column Button */}
          <button
            type="button"
            onClick={() => setCols((prev) => [...prev, blankColumn()])}
            className="w-full rounded-xl border-2 border-dashed border-slate-200 py-3.5 text-center hover:border-blue-500 hover:bg-blue-50/40 transition-all cursor-pointer group"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 group-hover:text-blue-700">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Tambah Kolom Baru
            </span>
          </button>
        </div>

        {/* Error notification if save failed */}
        {error && (
          <div className="alert alert-error text-xs animate-in">
            <p className="font-bold flex items-center gap-2 text-red-950">
              <span className="alert-icon">✕</span>
              {error.message}
            </p>
            {error.issues.length > 0 && (
              <ul className="mt-2 space-y-1 pl-5 text-red-800 list-disc font-medium">
                {error.issues.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ─── Footer Action Bar ─── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/templates"
            className="btn-secondary"
          >
            Batal
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-7 py-2.5 font-bold"
          >
            {saving && <span className="spinner" />}
            {saving ? "Menyimpan Template..." : "Simpan Template"}
          </button>
        </div>
      </div>
    </main>
  );
}