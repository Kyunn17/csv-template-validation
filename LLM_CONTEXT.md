# LLM Project Context: CSV & Parquet Validator for Databricks

> **File Purpose:** This document provides comprehensive context, architectural patterns, file maps, and engineering conventions for LLMs and AI assistants working on this repository.

---

## 1. Executive Summary & Purpose

**CSV & Parquet Template Validation & Ingestion Web App**
- **Core Goal:** Provide a self-service web platform to define custom schema templates, strictly validate user-uploaded CSV and Parquet files against those templates in memory, and automatically upload valid data directly into **Databricks Unity Catalog Volumes** via REST API.
- **Key Tenet:** Zero data corruption in Databricks. Any invalid CSV row or column schema mismatch halts the pipeline with detailed error reporting (row, column, invalid value, expected constraint).

---

## 2. Tech Stack & Dependencies

| Layer | Technology | Key Details |
|---|---|---|
| **Framework** | Next.js 16.4.2 (App Router) | Turbopack enabled, React 19 (`19.3.0`), Node.js >= 24 |
| **Language** | TypeScript 5 (Strict mode) | Type-safe throughout (`@/lib/validation/types.ts`) |
| **Styling** | Tailwind CSS v4 | Clean white base (`#ffffff`, `#f8fafc`), royal blue accent (`#2563eb`), Geist font |
| **Database** | Neon Serverless PostgreSQL | `@neondatabase/serverless` using SQL template tags |
| **Storage Target** | Databricks Unity Catalog | Interacts via Databricks REST API (`/api/2.0/fs/files/...`) |
| **File Parsing** | `csv-parse` & `hyparquet` | Streaming CSV parser and pure JS Parquet reader |
| **Interactivity** | `@dnd-kit/core`, `@dnd-kit/sortable` | Drag-and-drop column reordering in template editor |
| **Validation** | Zod + Custom Engine | `lib/validation/engine.ts` |

---

## 3. Directory & File Map

```
csv-template-validation/
├── app/
│   ├── api/
│   │   ├── health/route.ts                # Healthcheck endpoint (DB connectivity check)
│   │   ├── parquet/route.ts               # POST: Validates & uploads .parquet to Databricks
│   │   ├── recent/route.ts                # GET: Lists recent uploads across Databricks volumes
│   │   ├── template-config/route.ts       # POST: Creates new template in Neon DB & Databricks Volume
│   │   ├── template-config/[id]/route.ts  # GET, PUT, DELETE: Single template CRUD & volume sync
│   │   ├── templates/[id]/route.ts        # GET: Downloads empty sample CSV for given template
│   │   └── upload/route.ts                # POST: Validates uploaded CSV & uploads to Databricks
│   ├── parquet/
│   │   └── page.tsx                       # Parquet Upload UI page
│   ├── templates/
│   │   ├── [id]/edit/page.tsx             # Edit template page (renders TemplateForm mode="edit")
│   │   ├── new/page.tsx                   # Create template page (renders TemplateForm mode="create")
│   │   └── page.tsx                       # Template list page (renders TemplateList)
│   ├── globals.css                        # Design tokens, theme variables, base styles (white + blue)
│   ├── layout.tsx                         # RootLayout with Geist font, AppHeader/Navbar, Suspense
│   └── page.tsx                           # Home page: CSV Upload & Recent Uploads
├── components/
│   ├── Navbar.tsx                         # Top navigation bar with active route pills and logo
│   ├── ParquetUploadForm.tsx              # Parquet file upload, schema preview & PySpark snippet
│   ├── RecentsUpload.tsx                  # Recent uploads data table with refresh capability
│   ├── TemplateForm.tsx                   # Template builder with @dnd-kit drag-and-drop sortable columns
│   ├── TemplateList.tsx                   # Grid/list of templates with search, stats, and delete modal
│   └── UploadForm.tsx                     # Main CSV dropzone, schema rules accordion, validation alerts
├── db/
│   └── schema.sql                         # PostgreSQL DDL for Neon templates table
├── lib/
│   ├── databricks.ts                      # Databricks REST API client (upload, list files, ensure volume)
│   ├── db.ts                              # Neon database client pool initialization
│   ├── volume.ts                          # Volume path and name slugification utilities
│   ├── templates/
│   │   ├── http.ts                        # HTTP response helpers for template APIs
│   │   ├── index.ts                       # Template CRUD, Neon queries, volume creation orchestration
│   │   └── sample.ts                      # Generates blank CSV template with example row
│   └── validation/
│       ├── describe.ts                    # Generates human-readable descriptions of column rules
│       ├── engine.ts                      # Core CSV validation engine (headers, delimiters, row rules)
│       ├── types.ts                       # TypeScript schemas and Zod definitions for column configs
│       └── validators.ts                  # Atomic validator functions (int, digits, decimal, enum, string)
├── scripts/
│   └── db-setup.ts                        # CLI script to execute schema.sql against Neon DB
├── Dockerfile                             # Multi-stage production container build
├── compose.yaml                           # Docker Compose orchestration
└── package.json                           # Dependencies and scripts
```

---

## 4. Database Schema (Neon PostgreSQL)

File: `db/schema.sql`

```sql
CREATE TABLE IF NOT EXISTS templates (
  id                   TEXT PRIMARY KEY,
  label                TEXT NOT NULL,
  description          TEXT,
  delimiter            TEXT NOT NULL CHECK (delimiter IN (';', ',', E'\t', '|')),
  column_order_matters BOOLEAN NOT NULL DEFAULT FALSE,
  volume_name          TEXT NOT NULL UNIQUE,
  columns              JSONB NOT NULL
    CHECK (jsonb_typeof(columns) = 'array' AND jsonb_array_length(columns) > 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### JSONB Structure of `columns`:
```ts
type ColumnConfig = {
  name: string;             // Exact CSV header name
  type: "string" | "int" | "digits" | "decimal" | "enum";
  description?: string;     // Column purpose notes
  example: string;          // Example value
  required?: boolean;       // Defaults to true. If false, empty cells are valid
  length?: number;          // For 'digits': exact number of digits (e.g. 9)
  min?: number;             // For 'int': minimum allowed integer
  max?: number;             // For 'int': maximum allowed integer
  separator?: "," | ".";    // For 'decimal': decimal separator symbol
  values?: string[];        // For 'enum': allowed string values (case-sensitive)
};
```

---

## 5. Core Architectural Flows

### Flow A: Template Creation & Databricks Volume Provisioning
1. User defines a template at `/templates/new` (e.g. "Customer Sales", Delimiter `;`, columns list).
2. `POST /api/template-config` receives payload.
3. System slugifies label to generate unique `volume_name` (e.g. `customer_sales`).
4. Generates standard path: `/Volumes/workspace/default/<volume_name>`.
5. Calls Databricks REST API: `ensureVolume(volumeName)` to create the Unity Catalog volume if missing.
6. Stores the template config in Neon DB `templates` table.
7. Note: Renaming a template does **not** rename the Databricks volume (maintains path stability).

### Flow B: CSV File Validation & Ingestion
1. User selects template and drops `.csv` file at `/`.
2. `POST /api/upload` streams file buffer to `validateCsv(buffer, templateConfig)`.
3. **Validation Engine checks:**
   - Detects delimiter and checks for correct column count.
   - Header validation: All template column names must exist. If `columnOrderMatters: true`, header order must match template 1:1.
   - Row-by-row cell validation:
     - Null / NaN values rejected.
     - Empty values rejected if `required === true`.
     - `int`: parsed as integer within `min`/`max` bounds.
     - `digits`: exact length of numeric digits (`/^\d{N}$/`).
     - `decimal`: validates decimal representation with configured `,` or `.` separator.
     - `enum`: must match one of the defined values exactly.
4. **If Errors Exist:**
   - Returns `{ valid: false, errors: [...], rowCount: N }` capped at 100 first errors for performance.
5. **If Valid:**
   - Appends timestamped filename: `<slug>_YYYYMMDD_HHmmss.csv`.
   - Streams buffer to Databricks Volume via `uploadToVolume(volumeName, filename, buffer)`.
   - Returns `{ valid: true, uploaded: true, path: "/Volumes/..." }`.

### Flow C: Parquet File Ingestion
1. User specifies dataset name and uploads `.parquet` file at `/parquet`.
2. `POST /api/parquet` reads parquet metadata using `hyparquet`.
3. Validates file header and extracts column names + physical types.
4. Uploads file to `PARQUET_VOLUME_PATH/dataset_name/filename.parquet`.
5. Returns PySpark code snippet for querying in Databricks notebook.

---

## 6. UI & Design System Conventions

- **Aesthetic:** Clean, high-trust, modern SaaS enterprise tool (Anti-AI-slop).
- **Base Surface:** Crisp White (`#ffffff`), Canvas background `slate-50` (`#f8fafc`).
- **Secondary / Accent:** Royal Blue (`#2563eb`, hover `#1d4ed8`, tint `#eff6ff`, border `#bfdbfe`).
- **Status Colors:**
  - Success: Emerald (`#16a34a`, bg `#f0fdf4`, border `#bbf7d0`)
  - Error: Red (`#dc2626`, bg `#fef2f2`, border `#fecaca`)
  - Warning: Amber (`#d97706`, bg `#fffbeb`, border `#fde68a`)
- **Drag-and-Drop:** Implemented using `@dnd-kit/core` and `@dnd-kit/sortable` inside `components/TemplateForm.tsx`. Do NOT replace with HTML5 native drag-drop or up/down buttons without explicit user request.
- **Next.js Prerendering:** Any client component utilizing `usePathname()` or URL search params must be wrapped inside a `<Suspense>` boundary to prevent build prerender errors.

---

## 7. Environment Variables (`.env.local`)

```bash
DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
DATABRICKS_HOST=https://xxxx.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
PARQUET_VOLUME_PATH=/Volumes/workspace/default/nama_volume_parquet
PARQUET_MAX_MB=4
```

---

## 8. Development & Verification Commands

```bash
# Start local dev server (Turbopack)
npm run dev

# TypeScript typechecking (Strict verification)
npx tsc --noEmit

# Production build verification
npx next build

# Database initialization script
npx tsx --env-file=.env.local scripts/db-setup.ts
```

---

## 9. Critical Rules for Modifying this Codebase

1. **Never alter business logic when redesigning UI:** Keep all state variables, form handlers, API routes, and return types identical unless explicitly asked to modify logic.
2. **Databricks Volume Safety:** Volume names must remain lowercase alphanumeric with underscores. Never change a template's `volume_name` on edit.
3. **Preserve Validation Error Reporting Format:** The frontend expects `{ level, message, row, column, value, expected }` for each error item.
4. **Retain Next.js Feedback Rules:** When executing Next.js upgrades or debugging, respect the instructions in `AGENTS.md`.

---

## 10. Project Evolution & History of Changes (Sebelum vs Sesudah)

> **Context for LLMs:** This section explains what the project looked like previously, what has been modified, and why these changes were introduced.

### 10.1. Kondisi Awal / Keadaan Sebelumnya (Original State)
Sebelum pembaruan dilakukan, kondisi project adalah sebagai berikut:
- **Tema & Tampilan:**
  - Bertema **Dark Mode** pekat (`--bg: #111113`, surface `#18181b`, border `#27272a`) dengan warna aksen kuning/amber (`--accent: #e0a548`).
  - Styling gelap ini menyulitkan keterbacaan data tabel bagi beberapa pengguna dan terasa seperti prototipe mentah (*minimum viable product*).
- **Pengaturan Urutan Kolom Template:**
  - Sebelumnya menggunakan tombol manual panah atas dan bawah (`↑` / `↓`) untuk menaik-turunkan posisi kolom di formulir template. Mekanisme ini kaku, lambat untuk form dengan puluhan kolom, dan kurang ramah pengguna.
- **Navigasi & Tata Letak (Layout):**
  - Tidak memiliki navigasi global (*navbar*) terpadu di bagian atas. Perpindahan antar halaman hanya mengandalkan tautan teks "Kembali" yang tersebar secara manual di setiap halaman.
  - Halaman Upload CSV berupa layout kartu tunggal yang memanjang ke bawah tanpa pemisahan visual antara pemilihan template, aturan validasi, dan dropzone upload.
  - Halaman Daftar Template (`/templates`) hanya berupa daftar statis tanpa fitur pencarian (*search filter*).
  - Tampilan hasil error validasi dan riwayat upload masih menggunakan styling tabel gelap polos.

---

### 10.2. Rincian Perubahan yang Telah Dilakukan (What Was Changed)

#### A. Integrasi `@dnd-kit` untuk Drag & Drop Column Reordering
- Menghapus tombol panah atas/bawah manual di `components/TemplateForm.tsx`.
- Mengimplementasikan `@dnd-kit/core` dan `@dnd-kit/sortable` dengan sensor `PointerSensor` (activation constraint 5px) dan `KeyboardSensor` (`sortableKeyboardCoordinates`).
- Menambahkan kartu kolom sortable (`SortableColumnCard`) yang dilengkapi:
  - *Grip handle* 6-titik (drag handle) di sebelah kiri kartu.
  - Badge nomor urut kolom otomatis (`1, 2, 3...`) berlatar biru muda yang reaktif saat kartu dipindahkan.
  - Animasi transisi halus saat kartu dilepas (`handleDragEnd` menggunakan `arrayMove`).
  - Menjaga 100% integritas fungsi penyimpanan dan skema form.

#### B. Redesign UI Impeccable: Base Putih Bersih & Aksen Biru
- **Design Tokens Baru (`app/globals.css`):**
  - Kanvas dasar diubah menjadi Slate-50 (`#f8fafc`).
  - Permukaan kartu utama menggunakan Putih Bersih (`#ffffff`) dengan border Slate-200 (`#e2e8f0`) dan bayangan lembut (*soft elevation shadows*).
  - Warna aksen dan sekunder diubah menjadi **Royal Blue** (`#2563eb`, hover `#1d4ed8`, tint `#eff6ff`, border `#bfdbfe`).
  - Tipografi dioptimalkan: Slate-900 untuk judul tebal, Slate-600 untuk teks isi, dan font monospace untuk header data.

#### C. Navigasi Global Terpadu (`components/Navbar.tsx` & `app/layout.tsx`)
- Dibuat komponen `Navbar.tsx` yang disematkan ke dalam `RootLayout` (`app/layout.tsx`).
- Menampilkan logo brand CSV Validator dengan ikon database biru, navigasi tab aktif untuk **CSV Upload (`/`)**, **Parquet Upload (`/parquet`)**, dan **Templates (`/templates`)**, serta tombol CTA cepat **"+ New Template"**.
- Dibungkus dengan boundary `<Suspense>` untuk mendukung partial prerendering Next.js 16 tanpa error dynamic client hook (`usePathname`).

#### D. Peningkatan Komponen CSV Upload (`components/UploadForm.tsx`)
- **Bar Konfigurasi Template:** Dropdown pemilihan template dengan badge indikator delimiter (`Tab`, `;`, `,`), jumlah kolom, dan tombol langsung *Download Template CSV*.
- **Modern Dropzone:** Area drag & drop responsif dengan dashed border, ikon upload cloud biru, dan chip file saat file dipilih (menampilkan ekstensi `.csv`, ukuran file terformat, dan tombol ganti file).
- **Accordion Aturan Validasi:** Accordion interaktif yang menampilkan *sample header preview* dan tabel spesifikasi tipe data lengkap.
- **Banner Hasil Validasi:** Tampilan sukses hijau zamrud (*emerald*) lengkap dengan path Databricks Volume, serta tabel pelaporan error yang terstruktur rapi.

#### E. Peningkatan Komponen Riwayat Upload (`components/RecentsUpload.tsx`)
- Tampilan kartu putih bersih dengan tombol *Refresh* animasi realtime, badge template biru, dan pill status upload berindikator titik hijau.

#### F. Peningkatan Komponen Daftar Template (`components/TemplateList.tsx`)
- Ditambahkan fitur **Live Search / Filter** untuk menyaring template secara instan berdasarkan nama template, ID, atau target volume.
- Kartu template modern dengan badge metadata lengkap dan tombol aksi Edit & Hapus yang rapi.

#### G. Peningkatan Komponen Parquet Upload (`components/ParquetUploadForm.tsx`)
- Visualisasi langsung target folder Databricks saat pengguna mengetik nama dataset.
- Tabel deteksi skema Parquet otomatis dan blok kode PySpark siap salin untuk Databricks notebook.

---

### 10.3. Hal-Hal yang Tetap Dipertahankan (Strict Invariants)
Penting dicatat bahwa perubahan di atas **hanya merombak 100% tata letak dan estetika antarmuka (UI/UX)** tanpa menyentuh atau merusak logika inti:
1. Engine validasi CSV (`lib/validation/engine.ts`) dan aturan tipe kolom tetap bekerja 100% sama.
2. Endpoint API (`/api/upload`, `/api/recent`, `/api/parquet`, `/api/template-config`) tidak mengalami perubahan kontrak payload maupun response.
3. Struktur tabel database Neon (`db/schema.sql`) tetap identik.
4. Logika upload ke Databricks Unity Catalog Volumes (`lib/databricks.ts`) tetap sama persis.

