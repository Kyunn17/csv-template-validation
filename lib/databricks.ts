type UploadParams = {
  buffer: Buffer;
  volumePath: string; // contoh: /Volumes/catalog/schema/volume
  originalName: string;
  folder?: string; // subfolder opsional di dalam volumePath
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

class DatabricksHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Environment variable ${name} belum diisi`);
  return v;
}

function parseVolumePath(volumePath: string) {
  const m = volumePath.match(/^\/Volumes\/([^/]+)\/([^/]+)\/([^/]+)/);
  if (!m) throw new Error("volumePath harus berbentuk /Volumes/catalog/schema/volume");
  return { catalog: m[1], schema: m[2], volume: m[3] };
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
  volumePath,
  originalName,
  folder,
}: UploadParams): Promise<{ path: string }> {
  const host = requireEnv("DATABRICKS_HOST").replace(/\/$/, "");
  const token = requireEnv("DATABRICKS_TOKEN");

  const root = volumePath.replace(/\/$/, "");
  const dir = folder ? `${root}/${folder}` : root;
  const fileName = `${timestamp()}_${safeFileName(originalName)}`;
  const filePath = `${dir}/${fileName}`;

  try {
    await putFile(host, token, dir, filePath, buffer);
  } catch (e) {
    // 404 = volume belum ada: buat, lalu coba sekali lagi.
    // Hapus blok ini kalau tidak mau upload membuat volume otomatis.
    if (e instanceof DatabricksHttpError && e.status === 404) {
      await ensureVolume(root);
      await putFile(host, token, dir, filePath, buffer);
    } else {
      throw e;
    }
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
  templates: { id: string; volumePath: string }[],
  limit = 10
): Promise<UploadedFile[]> {
  const host = requireEnv("DATABRICKS_HOST").replace(/\/$/, "");
  const token = requireEnv("DATABRICKS_TOKEN");

  const perTemplate = await Promise.all(
    templates.map(async (t) => {
      try {
        const entries = await listDirectory(host, token, t.volumePath.replace(/\/$/, ""));
        return entries
          .filter((e) => !e.is_directory)
          .map((e): UploadedFile => {
            const { fileName, uploadedAt } = parseStoredName(e.name, e.last_modified);
            return { templateId: t.id, fileName, uploadedAt, size: e.file_size ?? null };
          });
      } catch (e) {
        console.error(`Gagal membaca volume template ${t.id}:`, e);
        return [];
      }
    })
  );

  return perTemplate
    .flat()
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""))
    .slice(0, limit);
}

export async function ensureVolume(volumePath: string): Promise<{ created: boolean }> {
  const host = requireEnv("DATABRICKS_HOST").replace(/\/$/, "");
  const token = requireEnv("DATABRICKS_TOKEN");
  const { catalog, schema, volume } = parseVolumePath(volumePath);
  const fullName = `${catalog}.${schema}.${volume}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const get = await fetch(
    `${host}/api/2.1/unity-catalog/volumes/${encodeURIComponent(fullName)}`,
    { headers, cache: "no-store" }
  );
  if (get.ok) return { created: false };
  if (get.status !== 404 && get.status !== 403) {
    throw new Error(`Gagal memeriksa volume ${fullName} (HTTP ${get.status})`);
  }

  const post = await fetch(`${host}/api/2.1/unity-catalog/volumes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      catalog_name: catalog,
      schema_name: schema,
      name: volume,
      volume_type: "MANAGED",
    }),
  });
  if (post.ok) return { created: true };

  const detail = await post.text().catch(() => "");
  console.error("Databricks create volume gagal:", post.status, detail);

  if (post.status === 409 || /already exists/i.test(detail)) return { created: false };
  if (post.status === 403) {
    throw new Error(
      `Token tidak punya izin membuat volume. Butuh izin CREATE VOLUME pada schema ${catalog}.${schema}.`
    );
  }
  if (post.status === 404) {
    throw new Error(
      `Catalog "${catalog}" atau schema "${schema}" tidak ditemukan. Hanya volume yang dibuat otomatis.`
    );
  }
  throw new Error(`Gagal membuat volume ${fullName} (HTTP ${post.status})`);
}

async function putFile(
  host: string,
  token: string,
  dir: string,
  filePath: string,
  buffer: Buffer
) {
  const headers = { Authorization: `Bearer ${token}` };

  // Folder di dalam volume dibuat kalau belum ada (root volume dilewati)
  if (dir.split("/").filter(Boolean).length > 4) {
    const dirRes = await fetch(`${host}/api/2.0/fs/directories${encodePath(dir)}`, {
      method: "PUT",
      headers,
    });
    if (!dirRes.ok) {
      throw new DatabricksHttpError(
        `Gagal menyiapkan folder di Databricks (HTTP ${dirRes.status})`,
        dirRes.status
      );
    }
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
    throw new DatabricksHttpError(`Upload ke Databricks gagal (HTTP ${res.status})`, res.status);
  }
}