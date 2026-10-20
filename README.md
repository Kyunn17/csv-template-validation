## Quick Start (lokal)

Prasyarat: Node.js 22+ (cek: `node -v`)

1. git clone <url-repo> && cd csv-upload-app
2. npm install
3. cp .env.example .env.local   # lalu isi nilainya
4. npm run dev                  # buka http://localhost:3000

## Production

1. npm ci
2. npm run build
3. npm start

## Docker

docker build -t csv-upload-app .
docker run -p 3000:3000 --env-file .env.local csv-upload-app