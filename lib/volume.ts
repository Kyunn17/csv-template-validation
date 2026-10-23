export const VOLUME_CATALOG = "workspace";
export const VOLUME_SCHEMA = "default";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

// "hari-raya" -> "hari_raya"; kalau diawali angka diberi awalan v_
export function volumeNameFromId(id: string): string {
  const base = id.replace(/-/g, "_");
  return /^\d/.test(base) ? `v_${base}` : base;
}

export function volumePathFor(volumeName: string): string {
  return `/Volumes/${VOLUME_CATALOG}/${VOLUME_SCHEMA}/${volumeName}`;
}