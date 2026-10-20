type UploadParams = {
  buffer: Buffer;
  folder: string; // contoh: "target-bd"
  originalName: string;
};

export type UploadedFile = {
  templateId: string;
  fileName: string;
  uploadedAt: string | null; // ISO string
  size: number | null;
};

type DirEntry = {
  name: string;
  is_directory?: boolean;
  file_size?: number;
  last_modified?: number;
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


// Ambil semua isi satu folder (mengikuti paginasi). Folder belum ada = kosong.
async function listDirectory(
  host: string,
  token: string,
  dir: string
): Promise<DirEntry[]> {
  const entries: DirEntry[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 20; page++) {
    const qs = pageToken ? `?page_token=${encodeURIComponent(pageToken)}` : "";
    const res = await fetch(
      `${host}/api/2.0/fs/directories${encodePath(dir)}${qs}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );

    if (res.status === 404) return entries; // folder belum pernah dipakai
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Databricks list gagal:", res.status, detail);
      throw new Error(`Gagal membaca folder Databricks (HTTP ${res.status})`);
    }

    const data = (await res.json()) as {
      contents?: DirEntry[];
      next_page_token?: string;
    };
    entries.push(...(data.contents ?? []));
    pageToken = data.next_page_token;
    if (!pageToken) break;
  }
  return entries;
}

// Pecah "20261020T101500_nama.csv" jadi waktu (UTC) + nama asli
function parseStoredName(
  name: string,
  lastModified?: number
): { fileName: string; uploadedAt: string | null } {
  const m = name.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})_(.+)$/);
  if (m) {
    const [, y, mo, d, h, mi, s, rest] = m;
    const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
    return { fileName: rest, uploadedAt: date.toISOString() };
  }
  if (typeof lastModified === "number" && lastModified > 0) {
    const ms = lastModified > 1e11 ? lastModified : lastModified * 1000;
    return { fileName: name, uploadedAt: new Date(ms).toISOString() };
  }
  return { fileName: name, uploadedAt: null };
}

export async function listRecentUploads(
  templateIds: string[],
  limit = 10
): Promise<UploadedFile[]> {
  const host = requireEnv("DATABRICKS_HOST").replace(/\/$/, "");
  const token = requireEnv("DATABRICKS_TOKEN");
  const base = requireEnv("DATABRICKS_VOLUME_PATH").replace(/\/$/, "");

  const perTemplate = await Promise.all(
    templateIds.map(async (templateId) => {
      const entries = await listDirectory(host, token, `${base}/${templateId}`);
      return entries
        .filter((e) => !e.is_directory)
        .map((e): UploadedFile => {
          const { fileName, uploadedAt } = parseStoredName(e.name, e.last_modified);
          return { templateId, fileName, uploadedAt, size: e.file_size ?? null };
        });
    })
  );

  return perTemplate
    .flat()
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""))
    .slice(0, limit);
}