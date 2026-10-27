# LLM Project Context: CSV & Parquet Validator for Databricks

> **File Purpose:** This document provides comprehensive context, architectural patterns, file maps, database schemas, deployment pipelines, and engineering conventions for LLMs and AI assistants working on this repository.

---

## 1. Executive Summary & Purpose

**CSV & Parquet Template Validation & Ingestion Web App**
- **Core Goal:** Provide a self-service web platform to define custom schema templates, strictly validate user-uploaded CSV and Parquet files against those templates in memory, and automatically upload valid data directly into **Databricks Unity Catalog Volumes** via REST API.
- **Key Tenet:** Zero data corruption in Databricks. Any invalid CSV row or column schema mismatch halts the pipeline with detailed error reporting (row, column, invalid value, expected constraint).
- **Storage Topology ("1 Schema per Template"):**
  - Data is organized into dedicated Unity Catalog schemas:
    `/Volumes/<catalog>/<schema_name>/<volume_name>/<file>`
    Example: `/Volumes/workspace/db_customer_sales/uploads/customer_sales_20261027_101500.csv`
  - `schema_name`: `db_` + `slug(template_name)` (lowercase, underscores only, no hyphens, max 255 characters).
  - `volume_name`: `uploads` (constant `DEFAULT_VOLUME_NAME`).
  - `catalog`: configurable via `DATABRICKS_CATALOG` (default `workspace`).
  - Legacy templates (`schema_name = 'default'`) remain 100% supported at `/Volumes/workspace/default/<volume_name>/<file>`.
- **Deployment Agnostic:** Supports multi-target hosting:
  1. Traditional VPS / On-Premise via Docker container & Nginx (`output: "standalone"`).
  2. Edge / Serverless via **Cloudflare Workers** using `@opennextjs/cloudflare`.
  3. Serverless Container via **AWS Lambda** using AWS Lambda Web Adapter (`Dockerfile.lambda` + AWS SAM `template.yaml`).
  Driven centrally by a single deployment configuration layer (`deploy.config.json` + `scripts/deploy.ts`).

---

## 2. Tech Stack & Dependencies

| Layer | Technology | Key Details |
|---|---|---|
| **Framework** | Next.js 16.4.2 (App Router) | Turbopack enabled, React 19 (`19.3.0`), Node.js >= 24, `output: "standalone"` |
| **Language** | TypeScript 5 (Strict mode) | Type-safe throughout (`@/lib/validation/types.ts`) |
| **Styling** | Tailwind CSS v4 | `@tailwindcss/turbopack`, clean white base (`#ffffff`, `#f8fafc`), royal blue accent (`#2563eb`), Geist font |
| **Database** | Neon Serverless PostgreSQL | `@neondatabase/serverless` using HTTP query client (`neon(url)`) for edge & serverless compatibility |
| **Storage Target** | Databricks Unity Catalog | Interacts via Databricks REST API (`/api/2.1/unity-catalog/schemas`, `/api/2.1/unity-catalog/volumes`, `/api/2.0/fs/...`) |
| **File Parsing** | `csv-parse` & `hyparquet` | Streaming CSV parser (`csv-parse/sync`) and pure JS Parquet reader (`hyparquet`) |
| **Interactivity** | `@dnd-kit/core`, `@dnd-kit/sortable` | Drag-and-drop column reordering in template editor |
| **Validation** | Zod (`^4.6.7`) + Custom Engine | `lib/validation/engine.ts` with atomic type checks (`string`, `int`, `digits`, `decimal`, `enum`) |
| **Serverless Adapters** | `@opennextjs/cloudflare`, `wrangler` | OpenNext build for Cloudflare Workers with `nodejs_compat` |
| **Deployment Layer** | TypeScript CLI (`scripts/deploy.ts`) | Zero-drift multi-target generator (`deploy.config.json` -> `wrangler.jsonc`, `template.yaml`, `Dockerfile.lambda`) |

---

## 3. Directory & File Map

```
csv-template-validation/
├── .dev.vars                              # Local preview env variables for Cloudflare Workers runtime
├── .env.example                           # Example environment variable template
├── .env.local                             # Local dev environment configuration
├── app/
│   ├── api/
│   │   ├── health/route.ts                # Healthcheck endpoint (DB connectivity check)
│   │   ├── parquet/route.ts               # POST: Validates & uploads .parquet to Databricks
│   │   ├── ping/route.ts                  # GET: Connection & timestamp latency probe (next/server connection())
│   │   ├── recent/route.ts                # GET: Lists recent uploads across Databricks schemas & volumes
│   │   ├── template-config/route.ts       # POST: Creates new template in Neon DB, Databricks Schema & Volume
│   │   ├── template-config/[id]/route.ts  # GET, PUT, DELETE: Single template CRUD
│   │   ├── templates/route.ts             # GET: Returns all templates and load diagnostic problems
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
│   ├── databricks.ts                      # Databricks REST API client (ensureSchema, ensureVolume, uploadToVolume, listRecentUploads)
│   ├── db.ts                              # Neon database HTTP client (serverless & edge safe)
│   ├── volume.ts                          # Schema slugification (toSchemaName), DEFAULT_VOLUME_NAME, volumePathFor, filePathFor
│   ├── templates/
│   │   ├── http.ts                        # HTTP response helpers for template APIs
│   │   ├── index.ts                       # Template CRUD, Neon queries, Databricks schema & volume orchestration
│   │   └── sample.ts                      # Generates blank CSV template with example row
│   └── validation/
│       ├── describe.ts                    # Generates human-readable descriptions of column rules
│       ├── engine.ts                      # Core CSV validation engine (headers, delimiters, row rules)
│       ├── types.ts                       # TypeScript schemas and Zod definitions (including enum & schemaName)
│       └── validators.ts                  # Atomic validator functions (int, digits, decimal, enum, string)
├── scripts/
│   ├── db-setup.ts                        # Idempotent DDL & migration script for Neon DB
│   ├── deploy.ts                          # Unified deployment generator & runner (Cloudflare / AWS)
│   └── seed-templates.ts                  # CLI seed script for template configurations
├── deploy.config.json                     # Master deployment target configuration file
├── wrangler.jsonc                         # GENERATED: Cloudflare Workers configuration
├── open-next.config.ts                    # OpenNext configuration for Cloudflare Workers
├── template.yaml                          # GENERATED: AWS SAM template for AWS Lambda deployment
├── Dockerfile                             # Multi-stage production container build (VPS / Docker)
├── Dockerfile.lambda                      # GENERATED: Container build with AWS Lambda Web Adapter
├── compose.yaml                           # Docker Compose orchestration for local / VPS
└── package.json                           # Dependencies and scripts
```

---

## 4. Database Schema & Data Models

### Database Schema (Neon PostgreSQL)
File: `db/schema.sql`

```sql
CREATE TABLE IF NOT EXISTS templates (
  id                   TEXT PRIMARY KEY,
  label                TEXT NOT NULL,
  description          TEXT,
  delimiter            TEXT NOT NULL CHECK (delimiter IN (';', ',', E'\t', '|')),
  column_order_matters BOOLEAN NOT NULL DEFAULT FALSE,
  schema_name          TEXT NOT NULL,
  volume_name          TEXT NOT NULL,
  columns              JSONB NOT NULL
    CHECK (jsonb_typeof(columns) = 'array' AND jsonb_array_length(columns) > 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT templates_schema_volume_key UNIQUE (schema_name, volume_name)
);
```

### Serverless DB Client (`lib/db.ts`)
Instead of maintaining persistent TCP connection pools (which fail or exhaust connections in serverless/edge environments like Cloudflare Workers or AWS Lambda), `lib/db.ts` uses Neon's HTTP query client:
```ts
import { neon } from "@neondatabase/serverless";

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Environment variable DATABASE_URL belum diisi");
  return neon(url);
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const rows = await getClient().query(text, params);
  return rows as unknown as T[];
}
```

### JSONB Structure of `columns` & TypeScript Schemas
File: `lib/validation/types.ts`

```ts
export type TemplateConfig = TemplateInput & {
  schemaName: string;
  volumeName: string;
  volumePath: string;
};
```

---

## 5. Core Architectural Flows

### Flow A: Template Creation & Databricks Provisioning ("1 Schema per Template")
1. User defines a template at `/templates/new` (e.g. "Customer Sales", Delimiter `;`, columns list with types `string`, `int`, `digits`, `decimal`, or `enum`).
2. `POST /api/template-config` receives payload and validates via Zod `templateSchema`.
3. System slugifies label/ID to generate unique schema name:
   `const schemaName = toSchemaName(id);` -> e.g. `db_customer_sales`
   `const volumeName = DEFAULT_VOLUME_NAME;` -> `uploads`
   `const volumePath = volumePathFor(schemaName, volumeName);` -> `/Volumes/workspace/db_customer_sales/uploads`
4. Checks collision in database: `SELECT id FROM templates WHERE id = $1 OR schema_name = $2`. If clash, returns HTTP 409.
5. **Mandatory Execution Order:**
   - Step 1: `await ensureSchema(schemaName)` -> `POST /api/2.1/unity-catalog/schemas`
   - Step 2: `await ensureVolume(schemaName, volumeName)` -> `POST /api/2.1/unity-catalog/volumes`
   - Step 3: Insert into Neon DB `templates` table.
   *If either Databricks provisioning step fails, Neon DB insert is blocked and an HTTP 502 error is returned.*
6. Note: Editing a template (PUT) updates metadata only. `schema_name` and `volume_name` **never change**.

### Flow B: CSV File Validation & Ingestion
1. User selects template and drops `.csv` file at `/`.
2. `POST /api/upload` streams file buffer to `validateCsv(buffer, templateConfig)`.
3. **Validation Engine checks (`lib/validation/engine.ts`):**
   - Delimiter detection and column count consistency check.
   - Header validation: All template column names must exist. If `columnOrderMatters: true`, header order must match template 1:1.
   - Row-by-row cell validation (`int`, `digits`, `decimal`, `enum`, `string`).
4. **If Errors Exist:**
   - Returns `{ valid: false, errors: [...], rowCount: N }` capped at 100 first errors for performance.
5. **If Valid:**
   - Appends timestamped filename: `<slug>_YYYYMMDD_HHmmss.csv`.
   - Streams buffer to Databricks Volume via `uploadToVolume({ buffer, volumePath: template.volumePath, originalName })`.
   - Databricks target path:
     - New templates: `/Volumes/<catalog>/<schema_name>/uploads/<filename>`
     - Legacy templates: `/Volumes/<catalog>/default/<volume_name>/<filename>`
   - Returns `{ valid: true, uploaded: true, path: "/Volumes/..." }`.

### Flow C: Parquet File Ingestion
1. User specifies dataset name and uploads `.parquet` file at `/parquet`.
2. `POST /api/parquet` reads parquet metadata using `hyparquet`.
3. Validates file header and extracts column names + physical types.
4. Uploads file to `PARQUET_VOLUME_PATH/dataset_name/filename.parquet`.
5. Returns PySpark code snippet for querying in Databricks notebook.

### Flow D: Multi-Target Dynamic Deployment Layer
Controlled by `deploy.config.json` and executed via `scripts/deploy.ts`:
1. **Target 1: VPS / Docker (`Dockerfile`, `compose.yaml`)**
   - Standard Next.js standalone build (`output: "standalone"`).
   - Runs with Nginx reverse proxy providing TLS and basic auth.
2. **Target 2: Cloudflare Workers (`@opennextjs/cloudflare`, `wrangler.jsonc`)**
   - Bundled using OpenNext for Cloudflare Workers runtime.
   - Assets served from `.open-next/assets`, server logic from `.open-next/worker.js`.
   - Secrets pushed to Cloudflare via `npm run deploy:secrets`.
   - Local preview with Workers runtime using `npm run preview` (reads `.dev.vars`).
3. **Target 3: AWS Lambda (`Dockerfile.lambda`, `template.yaml`)**
   - Packaged as a container image running the AWS Lambda Web Adapter (`aws-lambda-adapter`).
   - Configured through AWS SAM (`template.yaml`) targeting multi-arch (`x86_64` or `arm64`).

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

## 7. Environment Variables Configuration

### `.env.local` (Local Development) & `.dev.vars` (Cloudflare Preview)
```bash
DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
DATABRICKS_HOST=https://xxxx.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
DATABRICKS_CATALOG=workspace
DATABRICKS_VOLUME_PATH=/Volumes/workspace/default/clean_data
PARQUET_VOLUME_PATH=/Volumes/workspace/default/nama_volume_parquet
PARQUET_MAX_MB=4
```

### Deployment Configuration (`deploy.config.json`)
The single source of truth for deployment generation:
```json
{
  "appName": "csv-template-validation",
  "target": "cloudflare-workers",
  "envVars": [
    "DATABASE_URL",
    "DATABRICKS_HOST",
    "DATABRICKS_TOKEN",
    "DATABRICKS_CATALOG",
    "PARQUET_VOLUME_PATH",
    "PARQUET_MAX_MB"
  ],
  "cloudflare": {
    "compatibilityDate": "2026-10-26"
  },
  "aws": {
    "region": "ap-southeast-1",
    "stackName": "csv-template-validation",
    "memoryMb": 1024,
    "timeoutSec": 30,
    "architecture": "x86_64",
    "lambdaAdapterVersion": "1.0.0-rc1"
  }
}
```

---

## 8. Development & Deployment Commands

```bash
# --- Development ---
npm run dev                  # Start local dev server (Turbopack)
npm run preview              # Build & preview locally under Cloudflare Workers runtime (reads .dev.vars)

# --- Code Quality & Verification ---
npx tsc --noEmit             # TypeScript strict typechecking
npx next build               # Production standalone build verification
npm run lint                 # ESLint check

# --- Database ---
npx tsx --env-file=.env.local scripts/db-setup.ts   # Execute idempotent schema.sql & migrations against Neon DB

# --- Serverless Deployment Layer (scripts/deploy.ts) ---
npm run deploy:dry           # Dry run: preview generation & deployment actions without executing
npm run deploy:gen           # Generate config files for the target in deploy.config.json (wrangler.jsonc, etc.)
npm run deploy:gen:aws       # Generate AWS SAM template.yaml and Dockerfile.lambda
npm run deploy               # Generate files and deploy to configured target (e.g. Cloudflare Workers)
npm run deploy:secrets       # Sync .env.local variables to Cloudflare Workers as encrypted secrets
npm run cf-typegen           # Generate TypeScript definitions for Cloudflare environment

# --- VPS / Docker Deployment ---
docker compose up -d --build # Build and run standalone container on port 3000
```

---

## 9. Critical Rules & Guardrails for Modifying this Codebase

1. **Never alter business logic when redesigning UI:** Keep all state variables, form handlers, API routes, and return types identical unless explicitly asked to modify logic.
2. **Databricks Schema & Volume Safety & Immutability:**
   - `schema_name` and `volume_name` must **never** be changed when editing an existing template. Renaming a template only updates label, description, or column rules, maintaining path stability in Databricks.
   - `schema_name` must always follow `db_<slug>`, lowercase alphanumeric and underscores only (no hyphens), max 255 characters.
   - Never use hyphens in schema names (which would require backtick escaping in Databricks SQL).
3. **Preserve Validation Error Reporting Format:** The frontend expects `{ level, message, row, column, value, expected }` for each error item.
4. **Zero-Drift Generated Configs:** Never edit `wrangler.jsonc`, `template.yaml`, or `Dockerfile.lambda` manually. Always update `deploy.config.json` and run `npm run deploy:gen`.
5. **Serverless Compatibility Guardrails:**
   - Avoid persistent TCP connection state or non-serverless database drivers. Always use `query()` from `lib/db.ts` which uses `@neondatabase/serverless` HTTP client.
   - Do not rely on local filesystem persistence. Validate in memory using buffers.
6. **Retain Next.js Feedback Rules:** When executing Next.js upgrades or debugging, respect the instructions in `AGENTS.md`.

---

## 10. Project Evolution & History of Changes (Sebelum vs Sesudah)

> **Context for LLMs:** This section explains what the project looked like previously, what has been modified, and why these changes were introduced.

### 10.1. Kondisi Awal / Keadaan Sebelumnya (Original State)
Sebelum pembaruan dilakukan, kondisi project adalah sebagai berikut:
- **Penyimpanan Databricks (1 Volume per Template):**
  - Setiap template membuat sebuah Volume baru di schema tetap `workspace.default`:
    `/Volumes/workspace/default/<volume_name>/<file>`
  - Semua volume berkumpul di satu schema `default`.
  - Database Neon memiliki constraint `UNIQUE (volume_name)`.
- **Tema & Tampilan:**
  - Bertema **Dark Mode** pekat (`--bg: #111113`, surface `#18181b`, border `#27272a`) dengan warna aksen kuning/amber (`--accent: #e0a548`).
- **Pengaturan Urutan Kolom Template:**
  - Menggunakan tombol manual panah atas dan bawah (`↑` / `↓`).
- **Navigasi & Tata Letak (Layout):**
  - Tidak memiliki navigasi global (*navbar*) terpadu di bagian atas.
- **Deployment:**
  - Hanya mendukung deployment berbasis Docker container manual di VPS.

---

### 10.2. Rincian Perubahan yang Telah Dilakukan (What Was Changed)

#### A. Integrasi `@dnd-kit` untuk Drag & Drop Column Reordering
- Menghapus tombol panah manual di `components/TemplateForm.tsx`.
- Mengimplementasikan `@dnd-kit/core` dan `@dnd-kit/sortable` dengan sensor `PointerSensor` dan `KeyboardSensor`.

#### B. Redesign UI Impeccable: Base Putih Bersih & Aksen Biru
- Kanvas dasar Slate-50 (`#f8fafc`), kartu Putih Bersih (`#ffffff`), aksen Royal Blue (`#2563eb`).

#### C. Navigasi Global Terpadu (`components/Navbar.tsx` & `app/layout.tsx`)
- Navbar global dengan tab navigasi, branding, dan tombol CTA.

#### D. Peningkatan Komponen CSV Upload (`components/UploadForm.tsx`)
- Modern dropzone, accordion aturan validasi, banner hasil validasi sukses/error.

#### E. Peningkatan Komponen Riwayat Upload (`components/RecentsUpload.tsx`)
- Tampilan kartu riwayat upload multi-schema/volume yang reaktif.

#### F. Peningkatan Komponen Daftar Template (`components/TemplateList.tsx`)
- Fitur live search/filter untuk menyaring template instan.

#### G. Peningkatan Komponen Parquet Upload (`components/ParquetUploadForm.tsx`)
- Deteksi skema Parquet otomatis dan generator snippet PySpark.

#### H. Penambahan Tipe Data Kolom `enum`
- Tipe `enum` pada Zod schema dan validator (1-200 string unik).

#### I. Dynamic Multi-Target Serverless Deployment Layer (`deploy.config.json` & `scripts/deploy.ts`)
- Dukungan Cloudflare Workers (OpenNext), AWS Lambda (SAM + Web Adapter), dan VPS (Docker standalone).

#### J. Transformasi Penyimpanan Databricks: "1 Schema per Template" (`db_<slug>`)
- **Struktur Baru:** Setiap template kini memiliki schema tersendiri di Databricks Unity Catalog:
  `/Volumes/<catalog>/<schema_name>/<volume_name>/<file>`
  - `schema_name` = `"db_" + slug(nama/id template)`. Karakter hanya `a-z`, `0-9`, `_` (tanpa tanda hubung, max 255 karakter).
  - `volume_name` = konstanta `uploads` (`DEFAULT_VOLUME_NAME = "uploads"`).
  - `catalog` = env var `DATABRICKS_CATALOG` (default `workspace`).
- **Provisioning Otomatis & Idempoten:**
  - `ensureSchema(schemaName)` via `POST /api/2.1/unity-catalog/schemas`
  - `ensureVolume(schemaName, volumeName)` via `POST /api/2.1/unity-catalog/volumes`
  - Urutan create: `ensureSchema` -> `ensureVolume` -> `INSERT` ke Neon DB. Jika Databricks gagal, insert dibatalkan.
- **Database Migration & Backfill Legacy:**
  - Menambahkan kolom `schema_name TEXT NOT NULL` ke tabel `templates`.
  - Backfill template yang sudah ada dengan `schema_name = 'default'` sehingga path lama (`/Volumes/workspace/default/<volume_name>`) tetap 100% valid dan berfungsi.
  - Menghapus constraint `templates_volume_name_key` dan menggantikannya dengan composite unique constraint `templates_schema_volume_key UNIQUE (schema_name, volume_name)`.
  - Script migrasi `scripts/db-setup.ts` dirancang 100% idempoten.
- **Imutabilitas Schema & Volume:**
  - Saat template diedit (PUT), `schema_name` dan `volume_name` tetap dipertahankan dan tidak dapat berubah.

---

### 10.3. Hal-Hal yang Tetap Dipertahankan (Strict Invariants)
1. Engine validasi CSV (`lib/validation/engine.ts`) dan aturan tipe kolom tetap bekerja 100% konsisten.
2. Endpoint API (`/api/upload`, `/api/recent`, `/api/parquet`, `/api/template-config`) mempertahankan kontrak format error validasi `{ level, message, row, column, value, expected }`.
3. Template legacy lama (`schema_name = 'default'`) tetap dapat dibaca, diedit, dan menerima upload data tanpa error.
4. Parquet upload (`/api/parquet`) tetap menggunakan `PARQUET_VOLUME_PATH`.
