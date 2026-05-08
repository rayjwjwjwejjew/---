export const DEFAULT_SETTINGS = {
  typeMs: 18,
  autoMs: 820,
  dim: 18,
  spriteW: 250,
  spriteOpacity: 100,
  bgScale: 104,
  bgOpacity: 100,
  spriteY: 0,
  spriteX: 0,
  bgmVol: 70,
  sfxVol: 70,
  uiSfxId: "",
  uiAlpha: 60,
};

export type Settings = typeof DEFAULT_SETTINGS;

export type AssetEntry = { id: string; label: string };
export type Manifest = {
  backgrounds?: AssetEntry[];
  bg?: AssetEntry[];
  sprite?: AssetEntry[];
  video?: AssetEntry[];
  bgm?: AssetEntry[];
  sfx?: AssetEntry[];
};

export type SaveSlot = {
  slot: number;
  index: number;
  log: { who: string; text: string }[];
  act: string;
  scene: string;
  speaker: string;
  text: string;
  bgmName: string;
  savedAt: string;
  progress: string;
};

export type SceneBgOverride = { source: "asset" | "url"; value: string; label: string };

export const STORAGE_KEYS = {
  settings: "vn_settings_v2",
  manifest: "vn_manifest_v2",
  save: "vn_save_v2",
  saveSlots: "vn_save_slots_v2",
  sceneBgOverrides: "vn_scene_bg_overrides_v2",
};

const LEGACY_STORAGE_KEYS = {
  settings: "vn_settings_v1",
  manifest: "vn_manifest_v1",
  save: "vn_save_v1",
  saveSlots: "vn_save_slots_v1",
  sceneBgOverrides: "vn_scene_bg_overrides_v1",
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readJson<T extends Record<string, unknown>>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function normalizeManifest(manifest: Manifest): Manifest {
  const backgrounds = [...(manifest.backgrounds || []), ...(manifest.bg || [])];
  const dedupedBackgrounds = Array.from(new Map(backgrounds.map((item) => [item.id, item])).values());
  const { bg: _legacyBg, ...rest } = manifest;
  return {
    ...rest,
    backgrounds: dedupedBackgrounds,
  };
}

export function readSaveSlots(slotCount: number): Array<SaveSlot | null> {
  const modern = safeParse<Array<SaveSlot | null>>(localStorage.getItem(STORAGE_KEYS.saveSlots), []);
  if (modern.length > 0) {
    return Array.from({ length: slotCount }, (_, idx) => modern[idx] || null);
  }
  const legacy = safeParse<Array<SaveSlot | null>>(localStorage.getItem(LEGACY_STORAGE_KEYS.saveSlots), []);
  return Array.from({ length: slotCount }, (_, idx) => legacy[idx] || null);
}

export function writeSaveSlots(slots: Array<SaveSlot | null>, slotCount: number) {
  localStorage.setItem(STORAGE_KEYS.saveSlots, JSON.stringify(slots.slice(0, slotCount)));
}

export function readSceneBgOverrides(): Record<string, SceneBgOverride> {
  const modern = safeParse<Record<string, SceneBgOverride>>(localStorage.getItem(STORAGE_KEYS.sceneBgOverrides), {});
  if (Object.keys(modern).length > 0) return modern;
  return safeParse<Record<string, SceneBgOverride>>(localStorage.getItem(LEGACY_STORAGE_KEYS.sceneBgOverrides), {});
}

export function writeSceneBgOverrides(overrides: Record<string, SceneBgOverride>) {
  localStorage.setItem(STORAGE_KEYS.sceneBgOverrides, JSON.stringify(overrides));
}

export function buildSaveSnapshot(
  index: number,
  log: { who: string; text: string }[],
  currentAct: string,
  currentBgmName: string,
  currentLine: { act?: string; scene?: string; speaker?: string; text?: string } | undefined,
  totalLines: number,
): SaveSlot {
  return {
    slot: 0,
    index,
    log: log.slice(-100),
    act: currentAct || currentLine?.act || "",
    scene: currentLine?.scene || "",
    speaker: currentLine?.speaker || "",
    text: currentLine?.text || "",
    bgmName: currentBgmName || "",
    savedAt: new Date().toISOString(),
    progress: `${Math.min(index + 1, totalLines)}/${totalLines}`,
  };
}

export function getSavedAtLabel(savedAt: string) {
  if (!savedAt) return "未记录";
  try {
    return new Date(savedAt).toLocaleString();
  } catch {
    return savedAt;
  }
}
