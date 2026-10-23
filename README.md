# CSV Data Upload

Web app untuk membuat template CSV, memvalidasi file CSV, dan mengirim file yang valid ke Databricks Volume.
Template disimpan di Neon (PostgreSQL). Volume Databricks dibuat otomatis dari nama template.

## Prasyarat

- Node.js 24+ (cek dengan `node -v`)
- Database Neon (PostgreSQL) dan connection string-nya
- Akses Databricks: host dan token (izin tulis ke volume, serta CREATE VOLUME di `workspace.default`)
- Docker (opsional, untuk deployment)

## Konfigurasi

```bash
cp .env.example .env.local     # Windows: copy .env.example .env.local
```

Isi `.env.local` (tanpa tanda kutip):

```
DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
DATABRICKS_HOST=https://xxxx.cloud.databricks.com
DATABRICKS_TOKEN=...
PARQUET_VOLUME_PATH=/Volumes/workspace/default/nama_volume_parquet
PARQUET_MAX_MB=4
```

## Setup pertama kali (cukup sekali per database)

```bash
npm install
npx tsx --env-file=.env.local scripts/db-setup.ts      # membuat tabel templates

## Menjalankan secara lokal

```bash
npm run dev
```

Buka http://localhost:3000

## Production (tanpa Docker)

```bash
npm install
npm run build
npm start
```

## Production (Docker)

```bash
docker compose up -d --build
```

Update aplikasi:

```bash
git pull
docker compose up -d --build
```

Template tersimpan di database, jadi container aman dihapus dan dibuat ulang.

## Halaman

| Halaman | Fungsi |
|---|---|
| `/` | Upload CSV (pilih jenis data, download template, validasi, kirim ke Databricks) |
| `/templates` | Kelola template: buat, edit, hapus |
| `/parquet` | Upload file Parquet |

## Template dan Volume

- Template dibuat lewat halaman `/templates`. Tidak perlu mengubah kode.
- Volume tujuan otomatis: `/Volumes/workspace/default/<nama_template_dalam_huruf_kecil_dan_underscore>`.
- Volume dibuat otomatis di Databricks saat template dibuat. Mengganti nama template tidak memindahkan volume.
- Menghapus template tidak menghapus volume atau file di Databricks.

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `DATABASE_URL belum diisi` | Cek `.env.local` ada di root dan terisi |
| Error versi Node | Pakai Node 24+ |
| Upload gagal 401 | Token Databricks salah atau kedaluwarsa |
| Upload gagal 403 | Token tidak punya izin tulis ke volume |
| Gagal membuat volume | Token butuh izin CREATE VOLUME di `workspace.default` |
| Docker error "cannot connect" | Buka Docker Desktop dulu |
| `docker build` error di `COPY .../public` | Buat file `public/.gitkeep` |
| Create/Edit template gagal | Cek `docker compose logs app` |