import { AssetDB } from "./db";
import { ALL_CONTENT_IMAGES, SCRIPT, getCgImage, getSceneBg } from "./engine";
import { STORAGE_KEYS, type Manifest } from "./vnCore";
import { CORNER_IMG_URL, TITLE_SCREEN_BG } from "./vnContent";
import { parseRouteCommand } from "./vnState";

export type ValidationIssue = {
  severity: "P0" | "P1" | "P2";
  code: string;
  message: string;
  location?: string;
};

export async function validateVnProject(manifest: Manifest): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const lineIds = new Set<string>();
  const labels = new Set<string>();
  const references: Array<{ label: string; location: string }> = [];
  SCRIPT.lines.forEach((line, index) => {
    if (lineIds.has(line.lineId)) issues.push({ severity: "P0", code: "DUPLICATE_LINE_ID", message: `重复行 ID：${line.lineId}`, location: `#${index}` });
    lineIds.add(line.lineId);
    if (line.kind === "label" && line.name) {
      if (labels.has(line.name)) issues.push({ severity: "P0", code: "DUPLICATE_LABEL", message: `重复标签：${line.name}`, location: `#${index}` });
      labels.add(line.name);
    }
    const commands = [line.text?.startsWith("COMMAND:") ? line.text.slice(8) : "", ...(line.options || []).flatMap((option) => option.cmd.split(";"))];
    commands.map(parseRouteCommand).filter(Boolean).forEach((command) => {
      if (command?.kind === "jump" || command?.kind === "if") references.push({ label: command.label, location: `#${index}` });
    });
    if (line.cg && !line.cgId) issues.push({ severity: "P0", code: "CG_WITHOUT_ID", message: `CG 缺少稳定 ID：${line.cg}`, location: `#${index}` });
  });
  references.forEach((reference) => {
    if (!labels.has(reference.label)) issues.push({ severity: "P0", code: "MISSING_LABEL", message: `跳转标签不存在：${reference.label}`, location: reference.location });
  });

  const scenes = new Set(SCRIPT.lines.map((line) => line.scene).filter((scene): scene is string => Boolean(scene)));
  scenes.forEach((scene) => {
    if (!getSceneBg(scene)) issues.push({ severity: "P1", code: "MISSING_SCENE_BACKGROUND", message: `场景没有背景映射：${scene}`, location: scene });
  });

  const builtInUrls = new Set([TITLE_SCREEN_BG, CORNER_IMG_URL, ...ALL_CONTENT_IMAGES]);
  SCRIPT.lines.forEach((line) => {
    const cgUrl = getCgImage(line.cg, line.scene);
    if (line.cg && !cgUrl) issues.push({ severity: "P1", code: "MISSING_CG", message: `CG 没有可用画面：${line.cg}`, location: line.lineId });
    if (cgUrl) builtInUrls.add(cgUrl);
  });
  for (const url of builtInUrls) {
    const response = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) issues.push({ severity: "P1", code: "MISSING_BUILTIN_ASSET", message: `内置素材无法读取：${url}`, location: url });
  }

  const manifestIds = new Set<string>();
  for (const [kind, entries] of Object.entries(manifest)) {
    for (const entry of entries || []) {
      if (manifestIds.has(entry.id)) issues.push({ severity: "P1", code: "DUPLICATE_ASSET_ID", message: `资源 ID 重复：${entry.id}`, location: kind });
      manifestIds.add(entry.id);
      const blob = await AssetDB.get<Blob>(AssetDB.STORE_ASSETS, entry.id).catch(() => null);
      if (!blob) {
        issues.push({ severity: "P1", code: "MISSING_ASSET_BLOB", message: `资源记录存在但文件缺失：${entry.label}`, location: kind });
        continue;
      }
      const expectedPrefix = kind === "video" ? "video/" : ["bgm", "sfx", "voice"].includes(kind) ? "audio/" : "image/";
      if (blob.size === 0) issues.push({ severity: "P1", code: "EMPTY_ASSET_BLOB", message: `资源文件为空：${entry.label}`, location: kind });
      if (!blob.type.startsWith(expectedPrefix)) issues.push({ severity: "P2", code: "MIME_MISMATCH", message: `资源类型与分组不一致：${entry.label}`, location: blob.type || "empty MIME" });
    }
  }
  const storedAssets = await AssetDB.entries<Blob>(AssetDB.STORE_ASSETS).catch(() => []);
  storedAssets.forEach((asset) => {
    if (!manifestIds.has(asset.key)) issues.push({ severity: "P2", code: "ORPHAN_ASSET", message: `未被资源清单引用：${asset.key}` });
  });
  let voiceBindings: Record<string, string> = {};
  try {
    voiceBindings = JSON.parse(localStorage.getItem(STORAGE_KEYS.voiceBindings) || "{}") as Record<string, string>;
  } catch {
    issues.push({ severity: "P1", code: "INVALID_VOICE_BINDINGS", message: "语音绑定数据损坏" });
  }
  const voiceIds = new Set((manifest.voice || []).map((entry) => entry.id));
  Object.entries(voiceBindings).forEach(([lineId, assetId]) => {
    if (!lineIds.has(lineId)) issues.push({ severity: "P2", code: "ORPHAN_VOICE_BINDING", message: `语音绑定指向不存在的文本：${lineId}` });
    if (!voiceIds.has(assetId)) issues.push({ severity: "P1", code: "MISSING_BOUND_VOICE", message: `语音绑定缺少资源：${assetId}`, location: lineId });
  });
  return issues;
}
