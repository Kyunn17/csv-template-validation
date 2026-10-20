type UploadParams = {
  buffer: Buffer;
  folder: string; // contoh: "target-bd"
  originalName: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} belum diisi`);
  return v;
}

// Encode tiap segmen path, tapi pertahankan "/"
function encodePath(path: string): string {
  return path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
}

export async function uploadToVolume({
  buffer,
  folder,
  originalName,
}: UploadParams): Promise<{ path: string }> {
  const host = requireEnv("DATABRICKS_HOST").replace(/\/$/, "");
  const token = requireEnv("DATABRICKS_TOKEN");
  const base = requireEnv("DATABRICKS_VOLUME_PATH").replace(/\/$/, "");

  const dir = `${base}/${folder}`;
  // Timestamp supaya file dengan nama sama tidak saling menimpa
  const fileName = `${timestamp()}_${safeFileName(originalName)}`;
  const filePath = `${dir}/${fileName}`;

  const headers = { Authorization: `Bearer ${token}` };

  // Pastikan folder ada (aman dipanggil berulang)
  const dirRes = await fetch(`${host}/api/2.0/fs/directories${encodePath(dir)}`, {
    method: "PUT",
    headers,
  });
  if (!dirRes.ok) {
    throw new Error(`Gagal menyiapkan folder di Databricks (HTTP ${dirRes.status})`);
  }

  const res = await fetch(
    `${host}/api/2.0/fs/files${encodePath(filePath)}?overwrite=false`,
    {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/octet-stream" },
      body: new Uint8Array(buffer),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Databricks upload gagal:", res.status, detail);
    throw new Error(`Upload ke Databricks gagal (HTTP ${res.status})`);
  }

  return { path: filePath };
}