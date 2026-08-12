import { AssetDB } from "./db";
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  normalizeManifest,
  readContinueSave,
  readManifest,
  readSaveSlots,
  readSceneBgOverrides,
  readSettings,
  type Manifest,
  type SaveSlot,
  type SceneBgOverride,
  type Settings,
} from "./vnCore";
import { VN_SCHEMA_VERSION, mergeProgress, migrateProgress, type PersistentProgressV3 } from "./vnState";
import { assertBackupHeader, BACKUP_FORMAT } from "./vnBackupSchema";

export type BackupEnvelope = {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof VN_SCHEMA_VERSION;
  exportedAt: string;
  settings: Settings;
  progress: PersistentProgressV3;
  continueSave: SaveSlot | null;
  saveSlots: Array<SaveSlot | null>;
  manifest: Manifest;
  sceneBgOverrides: Record<string, SceneBgOverride>;
  voiceBindings: Record<string, string>;
  assetChecksums?: Record<string, string>;
  assetTypes?: Record<string, string>;
  chapterCheckpoints?: Record<string, import("./vnState").RouteState>;
};

function readStoredProgress() {
  try {
    return migrateProgress(JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || "null"));
  } catch {
    return migrateProgress(null);
  }
}

function readVoiceBindings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.voiceBindings) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function readChapterCheckpoints() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.chapterCheckpoints) || "{}") as Record<string, import("./vnState").RouteState>;
  } catch {
    return {};
  }
}

export function buildBackupEnvelope(): BackupEnvelope {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: VN_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: readSettings(),
    progress: readStoredProgress(),
    continueSave: readContinueSave(),
    saveSlots: readSaveSlots(8),
    manifest: readManifest(),
    sceneBgOverrides: readSceneBgOverrides(),
    voiceBindings: readVoiceBindings(),
    chapterCheckpoints: readChapterCheckpoints(),
  };
}

export function parseBackupEnvelope(value: unknown): BackupEnvelope {
  assertBackupHeader(value, VN_SCHEMA_VERSION);
  const source = value as Partial<BackupEnvelope>;
  return {
    format: BACKUP_FORMAT,
    schemaVersion: VN_SCHEMA_VERSION,
    exportedAt: source.exportedAt || new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS, ...(source.settings || {}) },
    progress: migrateProgress(source.progress),
    continueSave: source.continueSave || null,
    saveSlots: Array.from({ length: 8 }, (_, index) => source.saveSlots?.[index] || null),
    manifest: normalizeManifest(source.manifest || {}),
    sceneBgOverrides: source.sceneBgOverrides || {},
    voiceBindings: source.voiceBindings || {},
    assetChecksums: source.assetChecksums || {},
    assetTypes: source.assetTypes || {},
    chapterCheckpoints: source.chapterCheckpoints || {},
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadJsonBackup() {
  const envelope = buildBackupEnvelope();
  downloadBlob(new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" }), `soul-returns-backup-${Date.now()}.json`);
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function downloadFullBackup() {
  const { zip, strToU8 } = await import("fflate");
  const envelope = buildBackupEnvelope();
  const files: Record<string, Uint8Array> = {};
  const checksums: Record<string, string> = {};
  const assetTypes: Record<string, string> = {};
  const assets = await AssetDB.entries<Blob>(AssetDB.STORE_ASSETS);
  const totalBytes = assets.reduce((sum, asset) => sum + (asset.value instanceof Blob ? asset.value.size : 0), 0);
  if (totalBytes > 250 * 1024 * 1024 && !window.confirm(`本地素材约 ${Math.round(totalBytes / 1024 / 1024)}MB，打包会占用较多内存。仍要继续吗？`)) return;
  for (const asset of assets) {
    if (!(asset.value instanceof Blob)) continue;
    const bytes = new Uint8Array(await asset.value.arrayBuffer());
    files[`assets/${encodeURIComponent(asset.key)}`] = bytes;
    checksums[asset.key] = await sha256(bytes);
    assetTypes[asset.key] = asset.value.type;
  }
  envelope.assetChecksums = checksums;
  envelope.assetTypes = assetTypes;
  files["backup.json"] = strToU8(JSON.stringify(envelope, null, 2));
  const archive = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 1 }, (error, data) => error ? reject(error) : resolve(data));
  });
  downloadBlob(new Blob([Uint8Array.from(archive).buffer], { type: "application/zip" }), `soul-returns-full-${Date.now()}.zip`);
}

function applyEnvelope(envelope: BackupEnvelope) {
  const mergedProgress = mergeProgress(readStoredProgress(), envelope.progress);
  const updates: Array<[string, string | null]> = [
    [STORAGE_KEYS.settings, JSON.stringify(envelope.settings)],
    [STORAGE_KEYS.progress, JSON.stringify(mergedProgress)],
    [STORAGE_KEYS.saveSlots, JSON.stringify(envelope.saveSlots)],
    [STORAGE_KEYS.manifest, JSON.stringify(envelope.manifest)],
    [STORAGE_KEYS.sceneBgOverrides, JSON.stringify(envelope.sceneBgOverrides)],
    [STORAGE_KEYS.voiceBindings, JSON.stringify(envelope.voiceBindings)],
    [STORAGE_KEYS.chapterCheckpoints, JSON.stringify(envelope.chapterCheckpoints || {})],
    [STORAGE_KEYS.save, envelope.continueSave ? JSON.stringify(envelope.continueSave) : null],
  ];
  const previous = updates.map(([key]) => [key, localStorage.getItem(key)] as const);
  try {
    updates.forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
  } catch (error) {
    previous.forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
    throw error;
  }
}

const MAX_ZIP_BYTES = 512 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 300;

function assertZipLimits(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_ZIP_BYTES) throw new Error("ZIP 文件超过 512MB 限制");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = Math.max(0, bytes.byteLength - 65_557); offset <= bytes.byteLength - 22; offset += 1) {
    if (view.getUint32(offset, true) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0) throw new Error("ZIP 目录损坏");
  const entries = view.getUint16(eocd + 10, true);
  if (entries > MAX_ZIP_ENTRIES) throw new Error(`ZIP 条目过多：${entries}`);
  let offset = view.getUint32(eocd + 16, true);
  let uncompressedTotal = 0;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error("ZIP 中央目录损坏");
    const uncompressed = view.getUint32(offset + 24, true);
    if (uncompressed > 256 * 1024 * 1024) throw new Error("ZIP 中包含超过 256MB 的单个文件");
    uncompressedTotal += uncompressed;
    if (uncompressedTotal > MAX_ZIP_BYTES) throw new Error("ZIP 解压后超过 512MB 限制");
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
}

async function readSafeZip(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  assertZipLimits(bytes);
  const { unzip } = await import("fflate");
  return new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, (error, data) => error ? reject(error) : resolve(data));
  });
}

export async function importBackup(file: File) {
  if (file.name.toLowerCase().endsWith(".json")) {
    const envelope = parseBackupEnvelope(JSON.parse(await file.text()));
    applyEnvelope(envelope);
    return { assets: 0, exportedAt: envelope.exportedAt };
  }
  const { strFromU8 } = await import("fflate");
  const files = await readSafeZip(file);
  const backupFile = files["backup.json"];
  if (!backupFile) throw new Error("ZIP 缺少 backup.json");
  const envelope = parseBackupEnvelope(JSON.parse(strFromU8(backupFile)));
  const verifiedAssets: Array<{ id: string; blob: Blob }> = [];
  const archivedAssetIds = new Set(Object.keys(files).filter((path) => path.startsWith("assets/")).map((path) => decodeURIComponent(path.slice(7))));
  const assetEntryCount = Object.keys(files).filter((path) => path.startsWith("assets/")).length;
  if (archivedAssetIds.size !== assetEntryCount) throw new Error("ZIP 包含重复资源 ID");
  for (const id of Object.keys(envelope.assetChecksums || {})) {
    if (!archivedAssetIds.has(id)) throw new Error(`ZIP 缺少资源：${id}`);
  }
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.startsWith("assets/")) continue;
    const id = decodeURIComponent(path.slice(7));
    const expected = envelope.assetChecksums?.[id];
    if (!expected || await sha256(bytes) !== expected) throw new Error(`资源校验失败：${id}`);
    verifiedAssets.push({ id, blob: new Blob([Uint8Array.from(bytes).buffer], { type: envelope.assetTypes?.[id] || "" }) });
  }
  for (const asset of verifiedAssets) await AssetDB.put(AssetDB.STORE_ASSETS, asset.id, asset.blob);
  applyEnvelope(envelope);
  return { assets: verifiedAssets.length, exportedAt: envelope.exportedAt };
}

export async function inspectBackup(file: File) {
  if (file.name.toLowerCase().endsWith(".json")) {
    const envelope = parseBackupEnvelope(JSON.parse(await file.text()));
    return { envelope, assetCount: 0 };
  }
  const { strFromU8 } = await import("fflate");
  const files = await readSafeZip(file);
  const backupFile = files["backup.json"];
  if (!backupFile) throw new Error("ZIP 缺少 backup.json");
  return {
    envelope: parseBackupEnvelope(JSON.parse(strFromU8(backupFile))),
    assetCount: Object.keys(files).filter((path) => path.startsWith("assets/")).length,
  };
}
