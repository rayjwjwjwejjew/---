import type { Manifest } from "./vnCore";

export type ResourceLike = { kind: keyof Manifest | "all"; id: string; label: string };
type ScriptLineLike = { kind: string; text?: string; name?: string; speaker?: string; cg?: string; scene?: string };
type DialogueLineLike = { kind?: string; text?: string; speaker?: string; scene?: string; cg?: string };

export type DialogueTone = "dialogue" | "narration" | "system" | "choice";
export type ChoiceTone = "normal" | "key" | "hesitant" | "danger";

export function findBestAssetMatch<T extends { id: string; label: string }>(items: T[] | undefined, queries: string[]) {
  if (!items || items.length === 0) return undefined;
  const loweredQueries = queries.map((query) => query.toLowerCase()).filter(Boolean);
  return (
    items.find((item) => loweredQueries.some((query) => item.label.toLowerCase().includes(query) || item.id.toLowerCase().includes(query))) ||
    items[0]
  );
}

export function buildResourceEntries(manifest: Manifest): ResourceLike[] {
  return Object.entries(manifest).flatMap(([kind, items]) =>
    (items || []).map((item) => ({
      ...item,
      kind: kind as ResourceLike["kind"],
    })),
  );
}

export function filterResourceEntries(
  entries: ResourceLike[],
  query: string,
  filter: string,
) {
  const q = query.trim().toLowerCase();
  return entries.filter((item) => {
    const matchesKind = filter === "all" || filter === item.kind;
    const matchesQuery = !q || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
    return matchesKind && matchesQuery;
  });
}

export function buildDebugMarkers(lines: ScriptLineLike[]) {
  return lines
    .map((line, idx) => ({ line, idx }))
    .filter(({ line }) => line.kind === "title" || line.kind === "label" || line.cg)
    .slice(0, 48);
}

export function filterSceneNames(sceneNames: string[], query: string) {
  const q = query.trim().toLowerCase();
  return sceneNames.filter((scene) => !q || scene.toLowerCase().includes(q));
}

export function collectScriptScenes(lines: ScriptLineLike[]) {
  return Array.from(
    new Set(
      lines
        .map((line) => line.scene?.trim())
        .filter((scene): scene is string => Boolean(scene)),
    ),
  );
}

export function getSceneProgress(index: number, total: number) {
  return `${Math.min(index + 1, total)}/${total}`;
}

export function getCurrentBgmLabel(
  bgmList: { id: string; label: string }[],
  currentBgmId: string,
  currentBgmName: string,
) {
  return bgmList.find((item) => item.id === currentBgmId)?.label || currentBgmName || "";
}

export function getBgmMoodClass(name: string): string {
  if (!name) return "bgm-neutral";
  if (/(悬疑|压抑|紧张|高潮|审判|恐怖)/.test(name)) return "bgm-tense";
  if (/(告别|钢琴|日常|治愈|安静|忧郁|悲伤)/.test(name)) return "bgm-soft";
  return "bgm-neutral";
}

export function getDialogueTone(line?: DialogueLineLike | null): DialogueTone {
  if (!line) return "dialogue";
  if (line.kind === "choice") return "choice";
  if (line.speaker === "SYSTEM") return "system";
  if (!line.speaker || line.speaker === "旁白") return "narration";
  return "dialogue";
}

export function getDialogueKicker(tone: DialogueTone) {
  if (tone === "system") return "SYSTEM LOG";
  if (tone === "narration") return "NARRATION";
  if (tone === "choice") return "DECISION NODE";
  return "DIALOGUE";
}

export function isEmphasisLine(text: string | undefined) {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length <= 18) return true;
  if (/[……？！]/.test(trimmed)) return true;
  if (/(终于|不能|不会|为什么|现在|这一次|别走|不要|真相|秘密|记住)/.test(trimmed)) return true;
  return false;
}

export function getChoiceTone(text: string): ChoiceTone {
  if (/(真相|代价|危险|黑|血|坠|地下室|拆穿|承认|追上|继续查|报警|打开|闯进去)/.test(text)) {
    return "danger";
  }
  if (/(决定|相信|接受|拒绝|回答|选择|约定|留下|转身|面对)/.test(text)) {
    return "key";
  }
  if (/(等等|沉默|再想|算了|先离开|以后再说|装作|回避|不说|犹豫)/.test(text)) {
    return "hesitant";
  }
  return "normal";
}

export function getChoiceToneLabel(tone: ChoiceTone) {
  if (tone === "danger") return "危险抉择";
  if (tone === "key") return "关键节点";
  if (tone === "hesitant") return "迟疑分支";
  return "普通选项";
}

export function getCgCaption(
  act: string,
  line?: DialogueLineLike | null,
) {
  if (!line?.cg) return null;
  const label = line.scene || act || "CG";
  const copySource = line.text?.trim() || line.speaker || act;
  const copy = copySource.length > 28 ? `${copySource.slice(0, 28)}…` : copySource;
  return {
    label,
    copy,
  };
}
