import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SCRIPT, type IdentifiedScriptLine } from "./engine";
import { LEGACY_PROGRESS_KEYS, STORAGE_KEYS } from "./vnCore";
import {
  RollbackStack,
  VN_SCHEMA_VERSION,
  applyRouteCommand,
  createEmptyRouteState,
  markProgress,
  migrateProgress,
  parseRouteCommand,
  stableId,
  type ChoiceRecord,
  type PersistentProgressV3,
  type RollbackSnapshot,
  type RouteState,
} from "./vnState";

export type ChapterEntry = {
  chapterId: string;
  title: string;
  index: number;
  scene: string;
};

export type CgEntry = {
  cgId: string;
  label: string;
  chapterId: string;
  index: number;
  scene: string;
};

export const CHAPTERS: ChapterEntry[] = SCRIPT.lines
  .map((line, index) => ({ line, index }))
  .filter(({ line }) => line.kind === "title")
  .map(({ line, index }) => ({
    chapterId: line.chapterId,
    title: line.text || line.act,
    index,
    scene: line.scene || "章节开场",
  }));

export const CG_ENTRIES: CgEntry[] = SCRIPT.lines
  .map((line, index) => ({ line, index }))
  .filter(({ line }) => Boolean(line.cg && line.cgId))
  .map(({ line, index }) => ({
    cgId: line.cgId!,
    label: line.cg!,
    chapterId: line.chapterId,
    index,
    scene: line.scene || line.act,
  }));

function readProgress(): PersistentProgressV3 {
  let value: unknown = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.progress) || LEGACY_PROGRESS_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) || "null";
    value = JSON.parse(raw);
  } catch {
    value = null;
  }
  return migrateProgress(value, CHAPTERS[0]?.chapterId || "");
}

type UseStoryStateRuntimeArgs = {
  index: number;
  line?: IdentifiedScriptLine;
  logLength: number;
  currentAct: string;
  currentBgmName: string;
  phase: string;
  persistProgress?: boolean;
};

export function useStoryStateRuntime({ index, line, logLength, currentAct, currentBgmName, phase, persistProgress = true }: UseStoryStateRuntimeArgs) {
  const [progress, setProgress] = useState(readProgress);
  const [routeState, setRouteState] = useState<RouteState>(createEmptyRouteState);
  const [chapterCheckpoints, setChapterCheckpoints] = useState<Record<string, RouteState>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.chapterCheckpoints) || "{}") as Record<string, RouteState>;
    } catch {
      return {};
    }
  });
  const routeStateRef = useRef(routeState);
  const rollbackRef = useRef(new RollbackStack(200));
  const [rollbackCount, setRollbackCount] = useState(0);

  useEffect(() => {
    routeStateRef.current = routeState;
  }, [routeState]);

  useEffect(() => {
    const save = () => localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
    const windowWithIdle = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (windowWithIdle.requestIdleCallback) {
      const id = windowWithIdle.requestIdleCallback(save, { timeout: 1000 });
      return () => windowWithIdle.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(save, 500);
    return () => window.clearTimeout(timer);
  }, [progress]);

  useEffect(() => {
    if (!persistProgress || phase !== "playing" || !line?.chapterId) return;
    setProgress((current) => markProgress(current, { chapterId: line.chapterId }));
    if (line.kind === "title" && !chapterCheckpoints[line.chapterId]) {
      const next = { ...chapterCheckpoints, [line.chapterId]: structuredClone(routeStateRef.current) };
      setChapterCheckpoints(next);
      localStorage.setItem(STORAGE_KEYS.chapterCheckpoints, JSON.stringify(next));
    }
  }, [chapterCheckpoints, line?.chapterId, line?.kind, persistProgress, phase]);

  useEffect(() => {
    if (!persistProgress || phase !== "credits") return;
    setProgress((current) => {
      if (current.completedEndingIds.includes("main-ending")) return current;
      return { ...current, completedEndingIds: [...current.completedEndingIds, "main-ending"] };
    });
  }, [persistProgress, phase]);

  const markSeen = useCallback((target: IdentifiedScriptLine | undefined) => {
    if (!persistProgress || !target?.lineId || target.kind === "label") return;
    setProgress((current) => markProgress(current, { lineId: target.lineId, chapterId: target.chapterId }));
  }, [persistProgress]);

  const unlockCg = useCallback((target: IdentifiedScriptLine | undefined) => {
    if (!persistProgress || !target?.cgId) return;
    setProgress((current) => markProgress(current, { chapterId: target.chapterId, cgId: target.cgId }));
  }, [persistProgress]);

  const seenLineIds = useMemo(() => new Set(progress.seenLineIds), [progress.seenLineIds]);
  const isSeen = useCallback((lineId: string | undefined) => Boolean(lineId && seenLineIds.has(lineId)), [seenLineIds]);

  const pushRollback = useCallback(() => {
    rollbackRef.current.push({
      index,
      logLength,
      act: currentAct,
      bgmName: currentBgmName,
      routeState: routeStateRef.current,
    });
    setRollbackCount(rollbackRef.current.size);
  }, [currentAct, currentBgmName, index, logLength]);

  const popRollback = useCallback(() => {
    const snapshot = rollbackRef.current.pop();
    setRollbackCount(rollbackRef.current.size);
    if (snapshot) {
      setRouteState(snapshot.routeState);
      routeStateRef.current = snapshot.routeState;
    }
    return snapshot;
  }, []);

  const clearSession = useCallback((nextRouteState: RouteState = createEmptyRouteState()) => {
    rollbackRef.current.clear();
    setRollbackCount(0);
    setRouteState(nextRouteState);
    routeStateRef.current = nextRouteState;
  }, []);

  const restoreRouteState = useCallback((nextRouteState: RouteState | undefined) => {
    clearSession(nextRouteState || createEmptyRouteState());
  }, [clearSession]);

  const recordChoice = useCallback((target: IdentifiedScriptLine, option: { text: string; cmd: string }) => {
    const choiceId = target.choiceId || stableId("choice", `${target.chapterId}|${target.lineId}`);
    const optionId = stableId("option", `${choiceId}|${option.text}`);
    const record: ChoiceRecord = {
      choiceId,
      optionId,
      text: option.text,
      chapterId: target.chapterId,
      lineId: target.lineId,
      at: new Date().toISOString(),
    };
    let nextState: RouteState = {
      ...routeStateRef.current,
      flags: { ...routeStateRef.current.flags, [`choice.${choiceId}`]: optionId },
      choices: [...routeStateRef.current.choices, record],
    };
    let jumpLabel: string | undefined;
    option.cmd.split(";").map((command) => parseRouteCommand(command)).filter(Boolean).forEach((command) => {
      const result = applyRouteCommand(nextState, command!);
      nextState = result.routeState;
      jumpLabel = result.jumpLabel || jumpLabel;
    });
    setRouteState(nextState);
    routeStateRef.current = nextState;
    return jumpLabel;
  }, []);

  const runCommand = useCallback((raw: string) => {
    const command = parseRouteCommand(raw);
    if (!command) return undefined;
    const result = applyRouteCommand(routeStateRef.current, command);
    setRouteState(result.routeState);
    routeStateRef.current = result.routeState;
    return result.jumpLabel;
  }, []);

  const unlockedChapterIds = useMemo(() => new Set(progress.unlockedChapterIds), [progress.unlockedChapterIds]);
  const unlockedCgIds = useMemo(() => new Set(progress.unlockedCgIds), [progress.unlockedCgIds]);

  return {
    progress,
    setProgress,
    routeState,
    chapterCheckpoints,
    rollbackCount,
    unlockedChapterIds,
    unlockedCgIds,
    isSeen,
    markSeen,
    unlockCg,
    pushRollback,
    popRollback,
    clearSession,
    restoreRouteState,
    recordChoice,
    runCommand,
  };
}

export function restoreRollbackLog<T>(log: T[], snapshot: RollbackSnapshot) {
  return log.slice(0, snapshot.logLength);
}

export const PROGRESS_EXPORT_VERSION = VN_SCHEMA_VERSION;
