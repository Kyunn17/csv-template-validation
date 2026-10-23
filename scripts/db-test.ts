import { query } from "../lib/db";

async function main() {
  const rows = await query<{ now: string; version: string }>(
    "SELECT now() AS now, version() AS version"
  );
  console.log("✅ Terhubung ke Neon");
  console.log("Waktu server :", rows[0].now);
  console.log("Versi        :", rows[0].version);
}

main().catch((e) => {
  console.error("❌ Gagal terhubung:", e.message);
  process.exit(1);
});