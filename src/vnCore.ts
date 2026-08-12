import { VN_SCHEMA_VERSION, createEmptyRouteState, type RouteState } from "./vnState";

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
  particlesEnabled: false,
  voiceVol: 85,
  voiceMuted: false,
  bgmDuck: 35,
  skipUnseen: false,
  skipUnseenConfirmed: false,
  textScale: 100,
  lineHeight: 180,
  highContrast: false,
  reducedMotion: false,
  transitionLevel: "key" as "all" | "key" | "off",
  readableFont: false,
  ttsEnabled: false,
  ttsRate: 100,
  ttsPitch: 100,
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
  voice?: AssetEntry[];
};

export type SaveSlot = {
  schemaVersion?: number;
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
  lineId?: string;
  chapterId?: string;
  routeState?: RouteState;
};

export type SceneBgOverride = { source: "asset" | "url"; value: string; label: string };

export const STORAGE_KEYS = {
  settings: "vn_settings_v3",
  manifest: "vn_manifest_v3",
  save: "vn_save_v3",
  saveSlots: "vn_save_slots_v3",
  sceneBgOverrides: "vn_scene_bg_overrides_v3",
  progress: "vn_progress_v3",
  voiceBindings: "vn_voice_bindings_v3",
  chapterCheckpoints: "vn_chapter_checkpoints_v3",
};

const LEGACY_STORAGE_KEYS = {
  settings: ["vn_settings_v2", "vn_settings_v1"],
  manifest: ["vn_manifest_v2", "vn_manifest_v1"],
  save: ["vn_save_v2", "vn_save_v1"],
  saveSlots: ["vn_save_slots_v2", "vn_save_slots_v1"],
  sceneBgOverrides: ["vn_scene_bg_overrides_v2", "vn_scene_bg_overrides_v1"],
  progress: ["vn_progress_v2", "vn_progress_v1"],
};

export const LEGACY_PROGRESS_KEYS = LEGACY_STORAGE_KEYS.progress;

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

function readFirstLegacy<T>(keys: string[], fallback: T): T {
  for (const key of keys) {
    const value = safeParse<T | null>(localStorage.getItem(key), null);
    if (value !== null) return value;
  }
  return fallback;
}

export function readSettings(): Settings {
  const current = safeParse<Partial<Settings> | null>(localStorage.getItem(STORAGE_KEYS.settings), null);
  const source = current || readFirstLegacy<Partial<Settings>>(LEGACY_STORAGE_KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...source };
}

export function readManifest(): Manifest {
  const current = safeParse<Manifest | null>(localStorage.getItem(STORAGE_KEYS.manifest), null);
  return normalizeManifest(current || readFirstLegacy<Manifest>(LEGACY_STORAGE_KEYS.manifest, {}));
}

export function normalizeSaveSlot(slot: SaveSlot | null): SaveSlot | null {
  if (!slot) return null;
  return {
    ...slot,
    schemaVersion: VN_SCHEMA_VERSION,
    routeState: slot.routeState || createEmptyRouteState(),
  };
}

export function readContinueSave(): SaveSlot | null {
  const current = safeParse<SaveSlot | null>(localStorage.getItem(STORAGE_KEYS.save), null);
  return normalizeSaveSlot(current || readFirstLegacy<SaveSlot | null>(LEGACY_STORAGE_KEYS.save, null));
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
    return Array.from({ length: slotCount }, (_, idx) => normalizeSaveSlot(modern[idx] || null));
  }
  const legacy = readFirstLegacy<Array<SaveSlot | null>>(LEGACY_STORAGE_KEYS.saveSlots, []);
  return Array.from({ length: slotCount }, (_, idx) => normalizeSaveSlot(legacy[idx] || null));
}

export function writeSaveSlots(slots: Array<SaveSlot | null>, slotCount: number) {
  localStorage.setItem(STORAGE_KEYS.saveSlots, JSON.stringify(slots.slice(0, slotCount)));
}

export function readSceneBgOverrides(): Record<string, SceneBgOverride> {
  const modern = safeParse<Record<string, SceneBgOverride>>(localStorage.getItem(STORAGE_KEYS.sceneBgOverrides), {});
  if (Object.keys(modern).length > 0) return modern;
  return readFirstLegacy<Record<string, SceneBgOverride>>(LEGACY_STORAGE_KEYS.sceneBgOverrides, {});
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
  routeState: RouteState = createEmptyRouteState(),
): SaveSlot {
  return {
    schemaVersion: VN_SCHEMA_VERSION,
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
    lineId: "lineId" in (currentLine || {}) ? String((currentLine as { lineId?: string }).lineId || "") : "",
    chapterId: "chapterId" in (currentLine || {}) ? String((currentLine as { chapterId?: string }).chapterId || "") : "",
    routeState: structuredClone(routeState),
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
