import type { Manifest } from "./vnCore";

export type ResourceLike = { kind: keyof Manifest | "all"; id: string; label: string };
type ScriptLineLike = { kind: string; text?: string; name?: string; speaker?: string; cg?: string; scene?: string };

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
