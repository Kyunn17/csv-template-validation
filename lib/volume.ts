export const DEFAULT_CATALOG_NAME = "workspace";
export const DEFAULT_VOLUME_NAME = "uploads";

export function catalogName(): string {
  return process.env.DATABRICKS_CATALOG?.trim() || DEFAULT_CATALOG_NAME;
}

/**
 * Slugify nama/id template:
 * - Huruf kecil
 * - Hanya a-z, 0-9, _
 * - Spasi dan tanda hubung diubah menjadi _
 * - Karakter lain dibuang
 * - Hindari __ berulang dan tanda hubung
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]+/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .replace(/_+$/g, "");
}

/**
 * Helper toSchemaName:
 * - schema_name = "db_" + slug(nama/id template)
 * - Panjang maksimal 255 karakter Databricks
 * - Tidak boleh ada tanda hubung
 */
export function toSchemaName(input: string): string {
  const base = input.startsWith("db_") ? input.slice(3) : input;
  const s = slugify(base);
  if (!s) {
    throw new Error("Nama template tidak bisa dijadikan nama schema");
  }
  const schemaName = `db_${s}`;
  if (schemaName.length > 255) {
    throw new Error(`Nama schema "${schemaName}" melebihi batas maksimal 255 karakter Databricks`);
  }
  return schemaName;
}

/**
 * Kompatibilitas legacy: menghasilkan volume name dari ID
 */
export function volumeNameFromId(id: string): string {
  const base = slugify(id);
  return /^\d/.test(base) ? `v_${base}` : base;
}

/**
 * Pembentuk path volume:
 * /Volumes/<catalog>/<schemaName>/<volumeName>
 */
export function volumePathFor(
  schemaName: string,
  volumeName: string = DEFAULT_VOLUME_NAME
): string {
  return `/Volumes/${catalogName()}/${schemaName}/${volumeName}`;
}

/**
 * Pembentuk path file:
 * /Volumes/<catalog>/<schemaName>/<volumeName>/<filename>
 */
export function filePathFor(
  schemaName: string,
  volumeName: string,
  filename: string
): string {
  return `${volumePathFor(schemaName, volumeName)}/${filename}`;
}