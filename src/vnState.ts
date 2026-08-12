export const VN_SCHEMA_VERSION = 3 as const;

export type ChoiceRecord = {
  choiceId: string;
  optionId: string;
  text: string;
  chapterId: string;
  lineId: string;
  at: string;
};

export type RouteValue = string | number | boolean;

export type RouteState = {
  flags: Record<string, RouteValue>;
  choices: ChoiceRecord[];
  checkpoint?: string;
};

export type PersistentProgressV3 = {
  schemaVersion: typeof VN_SCHEMA_VERSION;
  seenLineIds: string[];
  unlockedChapterIds: string[];
  unlockedCgIds: string[];
  completedEndingIds: string[];
};

export type IdentifiedLine = {
  lineId: string;
  chapterId: string;
  choiceId?: string;
  cgId?: string;
};

type IdentityLine = {
  kind: string;
  chapterId?: string;
  lineId?: string;
  choiceId?: string;
  cgId?: string;
  act?: string;
  speaker?: string;
  text?: string;
  name?: string;
  scene?: string;
  cg?: string;
  options?: { text: string; cmd: string }[];
};

export type RollbackSnapshot = {
  index: number;
  logLength: number;
  act: string;
  bgmName: string;
  routeState: RouteState;
};

export type RouteCommand =
  | { kind: "jump"; label: string }
  | { kind: "set"; key: string; value: RouteValue }
  | { kind: "inc"; key: string; amount: number }
  | { kind: "if"; key: string; value: RouteValue; label: string };

function normalize(value: string | undefined) {
  return (value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function stableId(prefix: string, value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

export function attachStableIds<T extends IdentityLine>(lines: T[]): Array<T & IdentifiedLine> {
  const duplicateCounts = new Map<string, number>();
  return lines.map((line) => {
    const chapterId = line.chapterId || stableId("chapter", normalize(line.act) || "opening");
    const optionText = line.options?.map((option) => normalize(option.text)).join("|") || "";
    const fingerprint = [chapterId, line.kind, normalize(line.speaker), normalize(line.text), normalize(line.name), normalize(line.scene), optionText].join("|");
    const ordinal = duplicateCounts.get(fingerprint) || 0;
    duplicateCounts.set(fingerprint, ordinal + 1);
    return {
      ...line,
      chapterId,
      lineId: line.lineId || stableId("line", `${fingerprint}|${ordinal}`),
      choiceId: line.kind === "choice" ? line.choiceId || stableId("choice", `${chapterId}|${optionText}|${ordinal}`) : undefined,
      cgId: line.cg ? line.cgId || stableId("cg", normalize(line.cg)) : undefined,
    };
  });
}

export function createDefaultProgress(firstChapterId = ""): PersistentProgressV3 {
  return {
    schemaVersion: VN_SCHEMA_VERSION,
    seenLineIds: [],
    unlockedChapterIds: firstChapterId ? [firstChapterId] : [],
    unlockedCgIds: [],
    completedEndingIds: [],
  };
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0)));
}

export function migrateProgress(value: unknown, firstChapterId = ""): PersistentProgressV3 {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const fallback = createDefaultProgress(firstChapterId);
  const unlockedChapterIds = uniqueStrings(source.unlockedChapterIds || source.chapterIds || source.unlockedChapters);
  if (firstChapterId && !unlockedChapterIds.includes(firstChapterId)) unlockedChapterIds.unshift(firstChapterId);
  return {
    schemaVersion: VN_SCHEMA_VERSION,
    seenLineIds: uniqueStrings(source.seenLineIds || source.readLineIds || source.seenLines),
    unlockedChapterIds: unlockedChapterIds.length > 0 ? unlockedChapterIds : fallback.unlockedChapterIds,
    unlockedCgIds: uniqueStrings(source.unlockedCgIds || source.cgIds || source.unlockedCgs),
    completedEndingIds: uniqueStrings(source.completedEndingIds || source.endingIds || source.completedEndings),
  };
}

export function mergeProgress(current: PersistentProgressV3, incoming: PersistentProgressV3): PersistentProgressV3 {
  const next = {
    schemaVersion: VN_SCHEMA_VERSION,
    seenLineIds: uniqueStrings([...current.seenLineIds, ...incoming.seenLineIds]),
    unlockedChapterIds: uniqueStrings([...current.unlockedChapterIds, ...incoming.unlockedChapterIds]),
    unlockedCgIds: uniqueStrings([...current.unlockedCgIds, ...incoming.unlockedCgIds]),
    completedEndingIds: uniqueStrings([...current.completedEndingIds, ...incoming.completedEndingIds]),
  };
  if (
    next.seenLineIds.length === current.seenLineIds.length &&
    next.unlockedChapterIds.length === current.unlockedChapterIds.length &&
    next.unlockedCgIds.length === current.unlockedCgIds.length &&
    next.completedEndingIds.length === current.completedEndingIds.length
  ) return current;
  return next;
}

export function canSkipLine(line: { kind: string; cg?: string }, seen: boolean, skipUnseen: boolean) {
  if (line.kind === "choice" || line.kind === "title" || Boolean(line.cg)) return false;
  return skipUnseen || seen;
}

export function markProgress(
  progress: PersistentProgressV3,
  update: Partial<Pick<IdentifiedLine, "lineId" | "chapterId" | "cgId">>,
) {
  return mergeProgress(progress, {
    schemaVersion: VN_SCHEMA_VERSION,
    seenLineIds: update.lineId ? [update.lineId] : [],
    unlockedChapterIds: update.chapterId ? [update.chapterId] : [],
    unlockedCgIds: update.cgId ? [update.cgId] : [],
    completedEndingIds: [],
  });
}

function parseValue(raw: string): RouteValue {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  const numberValue = Number(value);
  return value !== "" && Number.isFinite(numberValue) ? numberValue : value.replace(/^['"]|['"]$/g, "");
}

export function parseRouteCommand(raw: string): RouteCommand | null {
  const command = raw.trim();
  const jump = command.match(/^@jump\s+(.+)$/);
  if (jump) return { kind: "jump", label: jump[1].trim() };
  const set = command.match(/^@set\s+([\w.-]+)\s*=\s*(.+)$/);
  if (set) return { kind: "set", key: set[1], value: parseValue(set[2]) };
  const inc = command.match(/^@inc\s+([\w.-]+)\s*=\s*(-?\d+(?:\.\d+)?)$/);
  if (inc) return { kind: "inc", key: inc[1], amount: Number(inc[2]) };
  const condition = command.match(/^@if\s+([\w.-]+)\s*=\s*(.+?)\s*->\s*(.+)$/);
  if (condition) return { kind: "if", key: condition[1], value: parseValue(condition[2]), label: condition[3].trim() };
  return null;
}

export function applyRouteCommand(routeState: RouteState, command: RouteCommand): { routeState: RouteState; jumpLabel?: string } {
  if (command.kind === "jump") return { routeState, jumpLabel: command.label };
  if (command.kind === "if") {
    return { routeState, jumpLabel: routeState.flags[command.key] === command.value ? command.label : undefined };
  }
  const flags = { ...routeState.flags };
  if (command.kind === "set") flags[command.key] = command.value;
  if (command.kind === "inc") flags[command.key] = Number(flags[command.key] || 0) + command.amount;
  return { routeState: { ...routeState, flags } };
}

export function createEmptyRouteState(): RouteState {
  return { flags: {}, choices: [] };
}

export class RollbackStack {
  readonly limit: number;
  #items: RollbackSnapshot[] = [];

  constructor(limit = 200) {
    this.limit = Math.max(1, limit);
  }

  push(snapshot: RollbackSnapshot) {
    const previous = this.#items[this.#items.length - 1];
    if (previous?.index === snapshot.index && previous.logLength === snapshot.logLength) return;
    this.#items.push(structuredClone(snapshot));
    if (this.#items.length > this.limit) this.#items.splice(0, this.#items.length - this.limit);
  }

  pop() {
    const snapshot = this.#items.pop();
    return snapshot ? structuredClone(snapshot) : undefined;
  }

  clear() {
    this.#items = [];
  }

  get size() {
    return this.#items.length;
  }
}
