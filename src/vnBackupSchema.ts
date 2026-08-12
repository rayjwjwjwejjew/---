export const BACKUP_FORMAT = "soul-returns-vn-backup" as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringRecord(value: unknown) {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isRouteState(value: unknown) {
  if (!isRecord(value) || !isRecord(value.flags) || !Array.isArray(value.choices)) return false;
  return Object.values(value.flags).every((item) => ["string", "number", "boolean"].includes(typeof item)) && value.choices.every((choice) => (
    isRecord(choice) && ["choiceId", "optionId", "text", "chapterId", "lineId", "at"].every((key) => typeof choice[key] === "string")
  ));
}

function isSaveSlot(value: unknown) {
  if (value === null) return true;
  if (!isRecord(value) || !Number.isInteger(value.index) || Number(value.index) < 0 || !Array.isArray(value.log)) return false;
  if (!value.log.every((item) => isRecord(item) && typeof item.who === "string" && typeof item.text === "string")) return false;
  return value.routeState === undefined || isRouteState(value.routeState);
}

function isManifest(value: unknown) {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entries) => entries === undefined || (Array.isArray(entries) && entries.every((entry) => (
    isRecord(entry) && typeof entry.id === "string" && typeof entry.label === "string"
  ))));
}

function isSettings(value: unknown) {
  if (!isRecord(value)) return false;
  const numericKeys = ["typeMs", "autoMs", "dim", "spriteW", "spriteOpacity", "bgScale", "bgOpacity", "spriteY", "spriteX", "bgmVol", "sfxVol", "uiAlpha", "voiceVol", "bgmDuck", "textScale", "lineHeight", "ttsRate", "ttsPitch"];
  const booleanKeys = ["particlesEnabled", "voiceMuted", "skipUnseen", "skipUnseenConfirmed", "highContrast", "reducedMotion", "readableFont", "ttsEnabled"];
  return numericKeys.every((key) => value[key] === undefined || (typeof value[key] === "number" && Number.isFinite(value[key])))
    && booleanKeys.every((key) => value[key] === undefined || typeof value[key] === "boolean")
    && (value.uiSfxId === undefined || typeof value.uiSfxId === "string")
    && (value.transitionLevel === undefined || ["all", "key", "off"].includes(String(value.transitionLevel)));
}

function isProgress(value: unknown) {
  if (!isRecord(value)) return false;
  return ["seenLineIds", "readLineIds", "seenLines", "unlockedChapterIds", "chapterIds", "unlockedChapters", "unlockedCgIds", "cgIds", "unlockedCgs", "completedEndingIds", "endingIds", "completedEndings"]
    .every((key) => value[key] === undefined || (Array.isArray(value[key]) && value[key].every((item) => typeof item === "string")));
}

function isSceneOverrides(value: unknown) {
  return isRecord(value) && Object.values(value).every((entry) => (
    isRecord(entry) && ["asset", "url"].includes(String(entry.source)) && typeof entry.value === "string" && typeof entry.label === "string"
  ));
}

export function assertBackupHeader(value: unknown, maxSchemaVersion: number) {
  if (!value || typeof value !== "object") throw new Error("备份内容不是有效对象");
  const source = value as Record<string, unknown>;
  if (source.format !== BACKUP_FORMAT) throw new Error("不是本项目的备份文件");
  if (typeof source.schemaVersion !== "number" || source.schemaVersion > maxSchemaVersion) throw new Error("备份版本高于当前游戏，暂时无法导入");
  if (!Array.isArray(source.saveSlots)) throw new Error("备份缺少存档槽");
  if (!source.saveSlots.every(isSaveSlot) || (source.continueSave !== undefined && !isSaveSlot(source.continueSave))) throw new Error("备份中的存档结构损坏");
  if (source.settings !== undefined && !isSettings(source.settings)) throw new Error("备份中的设置结构损坏");
  if (source.progress !== undefined && !isProgress(source.progress)) throw new Error("备份中的永久进度结构损坏");
  if (source.manifest !== undefined && !isManifest(source.manifest)) throw new Error("备份中的资源清单损坏");
  for (const key of ["voiceBindings", "assetChecksums", "assetTypes"] as const) {
    if (source[key] !== undefined && !isStringRecord(source[key])) throw new Error(`备份中的 ${key} 结构损坏`);
  }
  if (source.sceneBgOverrides !== undefined && !isSceneOverrides(source.sceneBgOverrides)) throw new Error("备份中的背景绑定结构损坏");
  if (source.chapterCheckpoints !== undefined && (!isRecord(source.chapterCheckpoints) || !Object.values(source.chapterCheckpoints).every(isRouteState))) {
    throw new Error("备份中的章节检查点损坏");
  }
  return source;
}
