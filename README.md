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
DATABRICKS_CATALOG=workspace
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
## Deployment

Ada tiga jalur. Pilih salah satu.

### A. VPS (Docker + Nginx)

Aplikasi jalan di Docker (`compose.yaml`, port hanya `127.0.0.1:3000`), Nginx di depannya
untuk HTTPS dan basic auth.

```bash
git clone <url-repo> && cd <nama-folder>
cp .env.example .env.local && nano .env.local
docker compose up -d --build
```

Update: `git pull && docker compose up -d --build`

Catatan Nginx: `client_max_body_size` harus lebih besar dari batas upload aplikasi.

### B. Cloudflare Workers (via OpenNext)

```bash
npx wrangler login
npm run deploy
npm run deploy:secrets      # kirim env var sebagai secret Worker
```

Preview lokal di runtime Workers: `npm run preview` (nilai env dibaca dari `.dev.vars`).
Di Windows, OpenNext tidak dijamin penuh; jika build bermasalah, gunakan WSL2.

Batas paket gratis: 10 ms CPU per request, jadi file besar bisa gagal divalidasi.

### C. AWS Lambda (konfigurasi saja, belum diuji)

```bash
npm run deploy:gen:aws
```

Menghasilkan `template.yaml` (SAM) dan `Dockerfile.lambda` (Lambda Web Adapter). Deploy
otomatis ke AWS belum diaktifkan. Setelah akses AWS ada:

```bash
sam build
sam deploy --stack-name <stack> --region <region> --resolve-image-repos --resolve-s3 \
  --capabilities CAPABILITY_IAM --parameter-overrides ...
```

## Deploy layer (`deploy.config.json`)

Satu file config menentukan target. `scripts/deploy.ts` memvalidasi config, menghasilkan
file konfigurasi platform, dan (untuk Cloudflare) menjalankan deploy.

| Perintah | Fungsi |
|---|---|
| `npm run deploy:dry` | Tampilkan rencana tanpa menulis atau menjalankan apa pun |
| `npm run deploy:gen` | Hasilkan file untuk target di config |
| `npm run deploy:gen:aws` | Hasilkan file AWS |
| `npm run deploy` | Hasilkan file + deploy (Cloudflare) |
| `npm run deploy:secrets` | Kirim env var ke Cloudflare sebagai secret |

File hasil generate (`wrangler.jsonc`, `template.yaml`, `Dockerfile.lambda`) jangan diedit
manual; ubah `deploy.config.json` lalu generate ulang.

Menambah target baru: tambah nilai di `TargetSchema`, buat satu fungsi generator, dan satu
cabang di `main()` pada `scripts/deploy.ts`.

## Menambah template baru

Buat lewat halaman `/templates` di aplikasi (tidak perlu mengubah kode) ⚠.

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Upload gagal 401 | Token Databricks salah atau kedaluwarsa |
| Upload gagal 403 | Token tidak punya izin tulis/buat Volume |
| Upload gagal 404 | Path Volume salah |
| 413 saat upload di VPS | Naikkan `client_max_body_size` di Nginx |
| 502 di VPS | Container mati: `docker compose logs --tail 50` |
| Env tidak terbaca di Docker | Hapus tanda kutip di `.env.local`, lalu `docker compose up -d --force-recreate` |
| Error koneksi database | Cek `DATABASE_URL`; Neon gratis bisa lambat saat bangun dari tidur |
| Build Cloudflare error di Windows | Gunakan WSL2 |

## Keamanan dan keterbatasan

- Belum ada login per user. Di VPS, akses dibatasi basic auth Nginx. Alamat `workers.dev`
  dan Function URL AWS bersifat publik.
- Endpoint pengelolaan template dan pembuatan Volume memakai token Databricks, jadi
  lindungi akses ke aplikasi dan cabut token yang tidak dipakai.
- CSV dibaca penuh ke memori; atur batas ukuran file sesuai platform.
- Status Processing/Processed di Recent Uploads belum ada (menunggu penanda dari sisi Databricks).
- Jalur AWS Lambda belum diuji di akun AWS sungguhan.

## Halaman

| Halaman | Fungsi |
|---|---|
| `/` | Upload CSV (pilih jenis data, download template, validasi, kirim ke Databricks) |
| `/templates` | Kelola template: buat, edit, hapus |
| `/parquet` | Upload file Parquet |

## Template dan Volume

- Template dibuat lewat halaman `/templates`. Tidak perlu mengubah kode.
- Volume tujuan otomatis: `/Volumes/<catalog>/db_<nama_template>/uploads`.
- Schema (`db_<nama_template>`) dan volume (`uploads`) dibuat otomatis di Databricks saat template dibuat. Mengganti nama template tidak memindahkan schema atau volume.
- Menghapus template tidak menghapus schema, volume, atau file di Databricks.

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