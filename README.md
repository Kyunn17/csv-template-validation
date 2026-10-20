# CSV Data Upload

Web App internal untuk tim Sales dan Marketing. User mengunduh template CSV, mengisinya, lalu mengupload. Aplikasi memvalidasi file terlebih dahulu. **Hanya file yang lolos semua validasi** yang dikirim ke Databricks Volume.

```
User -> Web App -> Validasi (file, separator, kolom, cell) -> Valid? -> Databricks Volume
                                                           -> Invalid? -> tampilkan error, file TIDAK dikirim
```

Validasi dilakukan sepenuhnya di Web App. Aplikasi ini tidak memproses data di Databricks.

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- `csv-parse` untuk membaca CSV
- Databricks Files API (REST) untuk upload ke Unity Catalog Volume

## Prasyarat

- **Node.js 24 atau lebih baru.** Cek dengan `node -v`.
- Akses ke Databricks: host, token (atau Service Principal), dan path Volume tujuan.

## Quick Start (lokal)

```bash
git clone <URL-REPO-INI>
cd <NAMA-FOLDER>
npm install
cp .env.example .env.local
```

Buka `.env.local` lalu isi nilainya (lihat bagian *Environment variables*). Setelah itu:

```bash
npm run dev
```

Buka http://localhost:3000.

> Setelah mengubah `.env.local`, **restart** `npm run dev`. Env hanya dibaca saat server start.

## Environment variables

| Variabel | Contoh | Keterangan |
|---|---|---|
| `DATABRICKS_HOST` | `https://xxxx.cloud.databricks.com` | Tanpa garis miring di akhir |
| `DATABRICKS_TOKEN` | `dapi...` | Token dengan izin tulis ke Volume |
| `DATABRICKS_VOLUME_PATH` | `/Volumes/catalog/schema/nama_volume` | Diawali `/Volumes/`, tanpa garis miring di akhir |

Semua variabel ini **hanya dipakai di server** (tidak dikirim ke browser). Jangan beri awalan `NEXT_PUBLIC_`, dan **jangan commit `.env.local`** ke Git.

## Production (tanpa Docker)

```bash
npm install
npm run build
npm start
```

Aplikasi berjalan di port 3000. Pastikan env sudah di-set di server.

## Deploy dengan Docker (disarankan untuk VPS)

Prasyarat di server: Docker dan Docker Compose.

```bash
git clone <URL-REPO-INI>
cd <NAMA-FOLDER>
cp .env.example .env.local     # isi nilainya
docker compose up -d --build
```

Aplikasi berjalan di port 3000. Perintah yang sering dipakai:

```bash
docker compose logs -f         # lihat log
docker compose restart         # restart (mis. setelah ubah .env.local)
docker compose down            # matikan

# Update setelah ada perubahan kode
git pull
docker compose up -d --build
```

Tanpa Compose:

```bash
docker build -t csv-upload-app .
docker run -d -p 3000:3000 --env-file .env.local --name csv-upload-app csv-upload-app
```

Untuk akses lewat domain dan HTTPS, taruh reverse proxy (Nginx atau Caddy) di depan port 3000.

> Prasyarat Docker: `next.config.ts` harus memiliki `output: "standalone"` (lihat bagian *Troubleshooting*).

## Deploy ke Vercel

1. Push repo ke GitHub, lalu **Import Project** di Vercel.
2. Di **Settings > Environment Variables**, isi tiga variabel Databricks di atas.
3. Deploy. Tidak perlu mengubah build command.

**Perhatian:** Vercel membatasi ukuran request body ke serverless function sekitar **4,5 MB**. File yang lebih besar akan ditolak sebelum sampai ke aplikasi. Template Target BD yang berisi puluhan ribu baris sekitar 2 MB, jadi masih aman, tapi file yang lebih besar tidak akan bisa diupload di Vercel. Kalau ini jadi masalah, deploy dengan Docker di VPS.

## Template yang tersedia

| Jenis data | ID | File template |
|---|---|---|
| Target Brand Distribution | `target-bd` | `public/templates/target-bd.csv` |
| Hari Besar | `hari-besar` | `public/templates/hari-besar.csv` |

## Aturan validasi

Validasi berjalan berurutan dan **berhenti di tahap pertama yang gagal**:

1. **File**: harus berekstensi `.csv`, tidak kosong, maksimal 20 MB.
2. **Separator**: harus sama dengan template (saat ini `;`).
3. **Kolom**: jumlah dan nama kolom harus sama dengan template. Kolom kurang atau berlebih ditolak.
4. **Cell**: isi tiap kolom diperiksa sesuai rule template. Error menampilkan nomor baris, nama kolom, nilai, dan yang diharapkan (maksimal 100 error ditampilkan).

Contoh rule Target BD: `material_group_code` harus 9 digit, `tgt_year` harus 4 digit, `tgt_pct_raw` angka dengan koma desimal.

## Menambah template baru

1. Taruh file template di `public/templates/<id>.csv`. Nama file harus sama dengan `id`.
2. Buat `lib/templates/<id>.ts`:

   ```ts
   import type { TemplateConfig } from "../validation/types";

   export const contohBaru: TemplateConfig = {
     id: "contoh-baru",
     label: "Contoh Baru",
     delimiter: ";",
     columnOrderMatters: false,
     columns: {
       kode: { type: "digits", length: 6 },
       nama: { type: "string" },
       catatan: { type: "string", required: false },
     },
   };
   ```

3. Daftarkan di `lib/templates/index.ts`.

Tipe rule yang tersedia: `string`, `int` (min/max), `digits` (length), `decimal` (separator). Tipe baru ditambahkan di `lib/validation/validators.ts`.

## Struktur project

```
app/
  page.tsx                  halaman utama
  api/upload/route.ts       validasi + kirim ke Databricks
components/UploadForm.tsx   form upload dan tampilan hasil
lib/
  validation/               engine, validator tiap tipe cell, types
  templates/                konfigurasi tiap template
  databricks.ts             upload ke Volume
public/templates/           file template yang diunduh user
scripts/test-validate.ts    tes validasi lewat terminal
```

Tes validasi tanpa UI:

```bash
npx tsx scripts/test-validate.ts target-bd public/templates/target-bd.csv
```

## Troubleshooting

| Masalah | Penyebab dan solusi |
|---|---|
| Error `Environment variable ... belum diisi` | `.env.local` belum dibuat/diisi, atau server belum direstart |
| Upload gagal HTTP 401 | Token salah atau kedaluwarsa. Buat token baru |
| Upload gagal HTTP 403 | Token tidak punya izin `WRITE VOLUME` di Volume tersebut |
| Upload gagal HTTP 404 | Path Volume salah. Cek catalog, schema, dan nama volume |
| Kolom pertama dibilang tidak ada padahal sudah benar | File memakai BOM. Engine sudah menanganinya, pastikan kode engine versi terbaru |
| Docker: `server.js` tidak ditemukan | Tambahkan `output: "standalone"` di `next.config.ts`, lalu build ulang |
| Build gagal soal `runtime` | Jangan pakai `export const runtime` di route handler (project ini memakai `cacheComponents`) |
| Perubahan env tidak terbaca | Restart server atau container |

## Catatan keamanan

- Aplikasi ini belum memiliki login. Batasi akses lewat jaringan internal atau tambahkan autentikasi sebelum dibuka ke publik.
- Gunakan Service Principal untuk produksi, bukan token pribadi.