import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssetDB } from "./db";
import { DEFAULT_BG, SCRIPT, getCgImage, getSceneCharacters, getScenePresentation } from "./engine";
import type { StageCharacter } from "./engine";
import { ensureImageReady, queueImagePreload } from "./vnMedia";
import { createPlaybackTextRuntime } from "./vnPlaybackText";
import { CORNER_IMG_URL, TITLE_SCREEN_BG } from "./vnContent";
import { findBestAssetMatch, getBgmMoodClass, getCurrentBgmLabel } from "./vnDerived";
import {
  STORAGE_KEYS,
  normalizeManifest,
  readJson,
  readSaveSlots,
  readSceneBgOverrides,
  type SaveSlot,
  type Manifest,
  type SceneBgOverride,
  type Settings,
  writeSaveSlots,
  writeSceneBgOverrides,
} from "./vnCore";

type AudioItem = { id: string; label: string };

type UseAudioRuntimeArgs = {
  settings: Settings;
  bgmList: AudioItem[];
};

type ScriptLine = (typeof SCRIPT.lines)[number];

const SAVE_SLOT_COUNT = 8;

type WorkspaceMode = "player" | "editor";

type UseWorkspaceRuntimeArgs = {
  initialAssetFilter?: keyof Manifest | "all";
  initialAssetQuery?: string;
  initialDebugPage?: number;
  initialOpenQaIndex?: number | null;
  initialResourcePage?: number;
  initialSceneQuery?: string;
  initialSelectedSaveSlot?: number;
  initialShowLog?: boolean;
  initialShowQaPanel?: boolean;
  initialWorkspaceMode?: WorkspaceMode;
  initialActivePanel?: string | null;
};

type UseSaveRuntimeArgs = {
  buildSnapshot: () => SaveSlot;
  bgmList: AudioItem[];
  selectedSaveSlot: number;
  onRestoreSession: (session: { index: number; log: { who: string; text: string }[]; act: string; bgmName: string }) => void;
  onStopBgm: () => void;
  onLoadBgmById: (assetId: string) => Promise<void>;
  onResetPresentationState: () => void;
  pulseUi: (_layer?: string) => void;
};

type UsePlaybackRuntimeArgs = {
  index: number;
  line?: ScriptLine;
  phase: string;
  activePanel: string | null;
  showLog: boolean;
  showQaPanel: boolean;
  cgVisible: boolean;
  settings: Settings;
  closeCg: (advance?: boolean) => void;
  pulseUi: (_layer?: string) => void;
  onAdvance: () => void;
  onBacktrack: (nextIndex: number) => void;
  onJump: (nextIndex: number) => void;
  onEnterCredits: () => void;
  onAppendLog: (item: { who: string; text: string }) => void;
  onQuickSave: () => void;
  onToggleLog: () => void;
  onCloseOverlays: () => void;
};

type ExportSourceFile = {
  path: string;
  content: string;
  language: string;
};

type UseCodeExportRuntimeArgs = {
  enabled: boolean;
  loadFiles: () => Promise<ExportSourceFile[]>;
};

type UseLibraryRuntimeArgs = {
  initialManifest: Manifest;
  onManifestChange?: (manifest: Manifest) => void;
};

type UseFlowRuntimeArgs = {
  phase: string;
  lowPerfMode: boolean;
  startTransitioning: boolean;
  isEditorMode: boolean;
  activePanel: string | null;
  showQaPanel: boolean;
  pulseUi: (_layer?: string) => void;
  onSetPhase: (phase: string) => void;
  onSetIndex: (index: number) => void;
  onClearLog: () => void;
  onClearLastBackground: () => void;
  onClosePanels: () => void;
  onResetPresentationState: () => void;
  onStopBgm: () => void;
  onSetScreenFlashVisible: (visible: boolean) => void;
  onSetStartTransitioning: (visible: boolean) => void;
  onTriggerOpeningPrelude: (text: string) => void;
  onSetOpeningPreludeVisible: (visible: boolean) => void;
  onSetHudAwake: (visible: boolean) => void;
  onToggleWorkspaceMode: () => void;
  onSetShowQaPanel: (visible: boolean) => void;
  onSetOpenQaIndex: (value: number | null) => void;
  onSetActivePanel: (value: string | null | ((prev: string | null) => string | null)) => void;
};

type UseShellRuntimeArgs = {
  settings: Settings;
  isEditorMode: boolean;
  activePanel: string | null;
  onCloseRestrictedPanel: () => void;
};

type UseStageEffectsRuntimeArgs = {
  line?: ScriptLine;
  phase: string;
  particlesEnabled: boolean;
  lowPerfMode: boolean;
  bgmList: AudioItem[];
  sfxList: AudioItem[];
  currentBgmName: string;
  crossfadeBgm: (assetId: string, name: string) => Promise<void>;
  playSfx: (assetId: string) => Promise<void>;
  setCurrentBgmName: (name: string) => void;
};

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function buildEffectClasses(effectActive: string, sceneBlur: boolean) {
  return [
    effectActive === "shake" ? "fx-shake" : "",
    effectActive === "flash-white" ? "fx-flash-white" : "",
    effectActive === "flash-red" ? "fx-flash-red" : "",
    effectActive === "darken" ? "fx-darken" : "",
    effectActive === "brighten" ? "fx-brighten" : "",
    sceneBlur ? "fx-scene-blur" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function useShellRuntime({
  settings,
  isEditorMode,
  activePanel,
  onCloseRestrictedPanel,
}: UseShellRuntimeArgs) {
  const [lowPerfMode, setLowPerfMode] = useState(false);

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const applyPerformanceMode = () => {
      const lowCoreCount = (navigator.hardwareConcurrency || 8) <= 4;
      const compactViewport = window.innerWidth < 900;
      setLowPerfMode(reducedMotionQuery.matches || lowCoreCount || (coarsePointerQuery.matches && compactViewport));
    };

    applyPerformanceMode();
    reducedMotionQuery.addEventListener("change", applyPerformanceMode);
    coarsePointerQuery.addEventListener("change", applyPerformanceMode);
    window.addEventListener("resize", applyPerformanceMode);
    return () => {
      reducedMotionQuery.removeEventListener("change", applyPerformanceMode);
      coarsePointerQuery.removeEventListener("change", applyPerformanceMode);
      window.removeEventListener("resize", applyPerformanceMode);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--dim", `${settings.dim / 100}`);
    root.setProperty("--sprite-w", `${settings.spriteW}px`);
    root.setProperty("--sprite-h", `${Math.round(settings.spriteW * 1.73)}px`);
    root.setProperty("--sprite-opacity", `${settings.spriteOpacity / 100}`);
    root.setProperty("--bg-scale", `${settings.bgScale / 100}`);
    root.setProperty("--bg-opacity", `${settings.bgOpacity / 100}`);
    root.setProperty("--sprite-y", `${settings.spriteY}px`);
    root.setProperty("--sprite-x", `${settings.spriteX}px`);
    root.setProperty("--ui-alpha", `${0.05 + settings.uiAlpha / 420}`);
    root.setProperty("--title-bg-url", `url("${TITLE_SCREEN_BG}")`);
  }, [settings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    if (!isEditorMode && (activePanel === "assets" || activePanel === "debug")) {
      onCloseRestrictedPanel();
    }
  }, [activePanel, isEditorMode, onCloseRestrictedPanel]);

  useEffect(() => {
    queueImagePreload(TITLE_SCREEN_BG);
    queueImagePreload(CORNER_IMG_URL);
  }, []);

  return {
    lowPerfMode,
  };
}

export function useStageEffectsRuntime({
  line,
  phase,
  particlesEnabled,
  lowPerfMode,
  bgmList,
  sfxList,
  currentBgmName,
  crossfadeBgm,
  playSfx,
  setCurrentBgmName,
}: UseStageEffectsRuntimeArgs) {
  const [currentAct, setCurrentAct] = useState("");
  const [effectActive, setEffectActive] = useState("");
  const [showRain, setShowRain] = useState(false);
  const [sceneBlur, setSceneBlur] = useState(false);

  const triggerEffect = useCallback((effectName: string) => {
    if (!effectName || effectName === "none") return;
    setEffectActive(effectName);
    const timer = window.setTimeout(() => {
      setEffectActive("");
    }, effectName === "shake" ? 500 : 800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "playing" || !line) return;
    setShowRain(particlesEnabled && Boolean(line.scene?.includes("雨") || line.effect === "rain"));
    setSceneBlur(!lowPerfMode && Boolean(line.scene?.includes("梦境") || line.scene?.includes("回忆") || line.effect === "blur"));
    if (line.effect && !["rain", "blur", "none"].includes(line.effect)) {
      return triggerEffect(line.effect);
    }
    return undefined;
  }, [line, lowPerfMode, particlesEnabled, phase, triggerEffect]);

  useEffect(() => {
    if (phase !== "playing" || !line?.bgm) return;
    if (line.bgm === currentBgmName) return;
    const match = bgmList.find((item) => item.label.includes(line.bgm || ""));
    if (match) {
      void crossfadeBgm(match.id, match.label);
    } else {
      setCurrentBgmName(line.bgm);
    }
  }, [bgmList, crossfadeBgm, currentBgmName, line, phase, setCurrentBgmName]);

  useEffect(() => {
    if (phase !== "playing" || !line?.sfx) return;
    const match = sfxList.find((item) => item.label.includes(line.sfx || ""));
    if (match) {
      void playSfx(match.id);
    }
  }, [line, phase, playSfx, sfxList]);

  useEffect(() => {
    if (phase !== "playing" || !line) return;
    setCurrentAct(line.act);
  }, [line, phase]);

  return {
    currentAct,
    showRain,
    effectClasses: buildEffectClasses(effectActive, sceneBlur),
    triggerEffect,
  };
}

export function useCodeExportRuntime({ enabled, loadFiles }: UseCodeExportRuntimeArgs) {
  const [codeTxtUrl, setCodeTxtUrl] = useState("");
  const codeTxtUrlRef = useRef("");

  const exportAllCodeTxt = useCallback(async () => {
    if (!enabled) return;
    const files = await loadFiles();
    if (!files.length) return;
    const header = [
      "VN Studio - 完整源码导出",
      `导出时间: ${new Date().toLocaleString()}`,
      `文件数: ${files.length}`,
      "",
      "说明：以下内容按原始文件路径逐个导出，每个文件使用独立代码块包裹，便于校验与还原。",
      "",
      "========================================",
      "",
    ].join("\n");

    const body = files
      .map((file) =>
        [
          `FILE: ${file.path}`,
          `LANG: ${file.language}`,
          "----------------------------------------",
          `\`\`\`${file.language}`,
          file.content.replace(/\s+$/u, ""),
          "```",
          "",
          "========================================",
          "",
        ].join("\n"),
      )
      .join("");

    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    if (codeTxtUrlRef.current) URL.revokeObjectURL(codeTxtUrlRef.current);
    const url = URL.createObjectURL(blob);
    codeTxtUrlRef.current = url;
    setCodeTxtUrl(url);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "VN_全部代码.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [enabled, loadFiles]);

  useEffect(() => {
    return () => {
      if (codeTxtUrlRef.current) URL.revokeObjectURL(codeTxtUrlRef.current);
    };
  }, []);

  return {
    canExportCode: enabled,
    codeTxtUrl,
    exportAllCodeTxt,
  };
}

export function useLibraryRuntime({ initialManifest, onManifestChange }: UseLibraryRuntimeArgs) {
  const [manifestState, setManifestState] = useState<Manifest>(() => normalizeManifest(initialManifest));
  const [bgmList, setBgmList] = useState<{ id: string; label: string }[]>(() => normalizeManifest(initialManifest).bgm || []);
  const [sfxList, setSfxList] = useState<{ id: string; label: string }[]>(() => normalizeManifest(initialManifest).sfx || []);

  const refreshLibrary = useCallback(() => {
    try {
      const manifest = normalizeManifest(readJson<Manifest>(STORAGE_KEYS.manifest, {}));
      setManifestState(manifest);
      setBgmList(manifest.bgm || []);
      setSfxList(manifest.sfx || []);
      onManifestChange?.(manifest);
    } catch {
      setManifestState({});
      setBgmList([]);
      setSfxList([]);
      onManifestChange?.({});
    }
  }, [onManifestChange]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const uploadAsset = useCallback(
    async (kind: "bg" | "sprite" | "video" | "bgm" | "sfx") => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = kind === "bgm" || kind === "sfx" ? "audio/*" : kind === "video" ? "video/*" : "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const label = prompt("资源名称", file.name) || file.name;
        const id = `${kind}_${crypto.randomUUID()}`;
        await AssetDB.put(AssetDB.STORE_ASSETS, id, file);
        try {
          const manifest = normalizeManifest(readJson<Manifest>(STORAGE_KEYS.manifest, {}));
          const key = kind === "bg" ? "backgrounds" : kind;
          manifest[key] = [{ id, label }, ...((manifest[key] || []) as { id: string; label: string }[])];
          localStorage.setItem(STORAGE_KEYS.manifest, JSON.stringify(manifest));
          refreshLibrary();
        } catch {
          // ignore
        }
        alert("上传成功");
      };
      input.click();
    },
    [refreshLibrary],
  );

  const batchRenameResources = useCallback(() => {
    const next = prompt("批量重命名：输入前缀");
    if (!next) return;
    const updated: Manifest = { ...manifestState };
    (["backgrounds", "sprite", "video", "bgm", "sfx"] as const).forEach((kind) => {
      updated[kind] = (updated[kind] || []).map((item, idx) => ({ ...item, label: `${next}-${idx + 1}` }));
    });
    localStorage.setItem(STORAGE_KEYS.manifest, JSON.stringify(updated));
    setManifestState(updated);
    setBgmList(updated.bgm || []);
    setSfxList(updated.sfx || []);
    onManifestChange?.(updated);
  }, [manifestState, onManifestChange]);

  return {
    manifestState,
    setManifestState,
    bgmList,
    sfxList,
    refreshLibrary,
    uploadAsset,
    batchRenameResources,
  };
}

export function useFlowRuntime({
  phase,
  lowPerfMode,
  startTransitioning,
  isEditorMode,
  activePanel,
  showQaPanel,
  pulseUi,
  onSetPhase,
  onSetIndex,
  onClearLog,
  onClearLastBackground,
  onClosePanels,
  onResetPresentationState,
  onStopBgm,
  onSetScreenFlashVisible,
  onSetStartTransitioning,
  onTriggerOpeningPrelude,
  onSetOpeningPreludeVisible,
  onSetHudAwake,
  onToggleWorkspaceMode,
  onSetShowQaPanel,
  onSetOpenQaIndex,
  onSetActivePanel,
}: UseFlowRuntimeArgs) {
  const [titleReady, setTitleReady] = useState(false);

  useEffect(() => {
    if (phase === "title") {
      const timer = window.setTimeout(() => setTitleReady(true), 120);
      return () => window.clearTimeout(timer);
    }
    setTitleReady(false);
    return undefined;
  }, [phase]);

  const startNewGame = useCallback(() => {
    if (startTransitioning) return;
    onSetStartTransitioning(true);
    onSetScreenFlashVisible(true);
    onTriggerOpeningPrelude("第一幕 · 章节开启");
    onSetIndex(0);
    onClearLog();
    onClearLastBackground();
    onClosePanels();
    onResetPresentationState();
    onSetOpeningPreludeVisible(true);
    onStopBgm();
    window.setTimeout(() => {
      onSetPhase("playing");
      onSetHudAwake(true);
    }, lowPerfMode ? 180 : 260);
    window.setTimeout(() => {
      onSetScreenFlashVisible(false);
      onSetStartTransitioning(false);
    }, lowPerfMode ? 620 : 720);
  }, [
    lowPerfMode,
    onClearLastBackground,
    onClearLog,
    onClosePanels,
    onResetPresentationState,
    onSetHudAwake,
    onSetIndex,
    onSetOpeningPreludeVisible,
    onSetPhase,
    onSetScreenFlashVisible,
    onSetStartTransitioning,
    onStopBgm,
    onTriggerOpeningPrelude,
    startTransitioning,
  ]);

  const togglePanel = useCallback(
    (name: string) => {
      if (!isEditorMode && (name === "assets" || name === "debug")) return;
      pulseUi("ui");
      onSetActivePanel((prev) => (prev === name ? null : name));
    },
    [isEditorMode, onSetActivePanel, pulseUi],
  );

  const returnToTitle = useCallback(() => {
    onSetPhase("title");
  }, [onSetPhase]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (phase === "warning") return;
      if (phase === "title") {
        if (event.key === "Escape") {
          onSetActivePanel(null);
          onSetShowQaPanel(false);
          onSetOpenQaIndex(null);
          return;
        }
        if ((event.key === " " || event.key === "Enter") && !activePanel && !showQaPanel) {
          event.preventDefault();
          startNewGame();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [activePanel, onSetActivePanel, onSetOpenQaIndex, onSetShowQaPanel, phase, showQaPanel, startNewGame]);

  return {
    titleReady,
    startNewGame,
    togglePanel,
    returnToTitle,
    toggleWorkspaceMode: onToggleWorkspaceMode,
  };
}

export function useWorkspaceRuntime({
  initialAssetFilter = "all",
  initialAssetQuery = "",
  initialDebugPage = 0,
  initialOpenQaIndex = null,
  initialResourcePage = 0,
  initialSceneQuery = "",
  initialSelectedSaveSlot = 0,
  initialShowLog = false,
  initialShowQaPanel = false,
  initialWorkspaceMode = "player",
  initialActivePanel = null,
}: UseWorkspaceRuntimeArgs = {}) {
  const [workspace, setWorkspace] = useState({
    showLog: initialShowLog,
    activePanel: initialActivePanel as string | null,
    showQaPanel: initialShowQaPanel,
    openQaIndex: initialOpenQaIndex as number | null,
    workspaceMode: initialWorkspaceMode as WorkspaceMode,
    selectedSaveSlot: initialSelectedSaveSlot,
    assetQuery: initialAssetQuery,
    assetFilter: initialAssetFilter as keyof Manifest | "all",
    resourcePage: initialResourcePage,
    debugPage: initialDebugPage,
    sceneQuery: initialSceneQuery,
  });

  const setShowLog = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setWorkspace((prev) => ({
      ...prev,
      showLog: typeof value === "function" ? value(prev.showLog) : value,
    }));
  }, []);

  const setActivePanel = useCallback((value: string | null | ((prev: string | null) => string | null)) => {
    setWorkspace((prev) => ({
      ...prev,
      activePanel: typeof value === "function" ? value(prev.activePanel) : value,
    }));
  }, []);

  const setShowQaPanel = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setWorkspace((prev) => ({
      ...prev,
      showQaPanel: typeof value === "function" ? value(prev.showQaPanel) : value,
    }));
  }, []);

  const setOpenQaIndex = useCallback((value: number | null | ((prev: number | null) => number | null)) => {
    setWorkspace((prev) => ({
      ...prev,
      openQaIndex: typeof value === "function" ? value(prev.openQaIndex) : value,
    }));
  }, []);

  const setWorkspaceMode = useCallback((value: WorkspaceMode | ((prev: WorkspaceMode) => WorkspaceMode)) => {
    setWorkspace((prev) => ({
      ...prev,
      workspaceMode: typeof value === "function" ? value(prev.workspaceMode) : value,
    }));
  }, []);

  const setSelectedSaveSlot = useCallback((value: number | ((prev: number) => number)) => {
    setWorkspace((prev) => ({
      ...prev,
      selectedSaveSlot: typeof value === "function" ? value(prev.selectedSaveSlot) : value,
    }));
  }, []);

  const setAssetQuery = useCallback((value: string | ((prev: string) => string)) => {
    setWorkspace((prev) => ({
      ...prev,
      assetQuery: typeof value === "function" ? value(prev.assetQuery) : value,
    }));
  }, []);

  const setAssetFilter = useCallback((value: keyof Manifest | "all" | ((prev: keyof Manifest | "all") => keyof Manifest | "all")) => {
    setWorkspace((prev) => ({
      ...prev,
      assetFilter: typeof value === "function" ? value(prev.assetFilter) : value,
    }));
  }, []);

  const setResourcePage = useCallback((value: number | ((prev: number) => number)) => {
    setWorkspace((prev) => ({
      ...prev,
      resourcePage: typeof value === "function" ? value(prev.resourcePage) : value,
    }));
  }, []);

  const setDebugPage = useCallback((value: number | ((prev: number) => number)) => {
    setWorkspace((prev) => ({
      ...prev,
      debugPage: typeof value === "function" ? value(prev.debugPage) : value,
    }));
  }, []);

  const setSceneQuery = useCallback((value: string | ((prev: string) => string)) => {
    setWorkspace((prev) => ({
      ...prev,
      sceneQuery: typeof value === "function" ? value(prev.sceneQuery) : value,
    }));
  }, []);

  return {
    workspace,
    showLog: workspace.showLog,
    activePanel: workspace.activePanel,
    showQaPanel: workspace.showQaPanel,
    openQaIndex: workspace.openQaIndex,
    workspaceMode: workspace.workspaceMode,
    selectedSaveSlot: workspace.selectedSaveSlot,
    assetQuery: workspace.assetQuery,
    assetFilter: workspace.assetFilter,
    resourcePage: workspace.resourcePage,
    debugPage: workspace.debugPage,
    sceneQuery: workspace.sceneQuery,
    setShowLog,
    setActivePanel,
    setShowQaPanel,
    setOpenQaIndex,
    setWorkspaceMode,
    setSelectedSaveSlot,
    setAssetQuery,
    setAssetFilter,
    setResourcePage,
    setDebugPage,
    setSceneQuery,
  };
}

export function useSaveRuntime({
  buildSnapshot,
  bgmList,
  selectedSaveSlot,
  onRestoreSession,
  onStopBgm,
  onLoadBgmById,
  onResetPresentationState,
  pulseUi,
}: UseSaveRuntimeArgs) {
  const [saveSlots, setSaveSlots] = useState<Array<SaveSlot | null>>(() => readSaveSlots(SAVE_SLOT_COUNT));
  const [hasContinueSave, setHasContinueSave] = useState(() => Boolean(safeParseJson<SaveSlot | null>(localStorage.getItem(STORAGE_KEYS.save), null)));
  const restoreSessionRef = useRef(onRestoreSession);

  useEffect(() => {
    restoreSessionRef.current = onRestoreSession;
  }, [onRestoreSession]);

  const commitSaveSlot = useCallback(
    (slotIndex: number) => {
      const data = {
        ...buildSnapshot(),
        slot: slotIndex,
      };
      const nextSlots = readSaveSlots(SAVE_SLOT_COUNT);
      nextSlots[slotIndex] = data;
      writeSaveSlots(nextSlots, SAVE_SLOT_COUNT);
      setSaveSlots(nextSlots);
      localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(data));
      setHasContinueSave(true);
      return data;
    },
    [buildSnapshot],
  );

  const saveGame = useCallback(
    (slotIndex = selectedSaveSlot, persistSlot = true) => {
      if (persistSlot) {
        commitSaveSlot(slotIndex);
      } else {
        const data = buildSnapshot();
        localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(data));
        setHasContinueSave(true);
      }
      pulseUi("ui");
    },
    [buildSnapshot, commitSaveSlot, pulseUi, selectedSaveSlot],
  );

  const restoreSave = useCallback(
    async (slot: SaveSlot) => {
      restoreSessionRef.current({
        index: Math.min(SCRIPT.lines.length - 1, slot.index),
        log: slot.log || [],
        act: slot.act || "",
        bgmName: slot.bgmName || "",
      });
      onResetPresentationState();
      onStopBgm();
      const match = bgmList.find((item) => item.label === slot.bgmName || item.label.includes(slot.bgmName || ""));
      if (match) {
        await onLoadBgmById(match.id);
      }
      pulseUi("scene");
    },
    [bgmList, onLoadBgmById, onResetPresentationState, onStopBgm, pulseUi],
  );

  const loadSaveSlot = useCallback(
    (slotIndex: number) => {
      const slot = saveSlots[slotIndex];
      if (!slot) return;
      void restoreSave(slot);
    },
    [restoreSave, saveSlots],
  );

  const continueLastGame = useCallback(() => {
    const lastSave = safeParseJson<SaveSlot | null>(localStorage.getItem(STORAGE_KEYS.save), null);
    if (!lastSave) return;
    void restoreSave(lastSave);
  }, [restoreSave]);

  const deleteSaveSlot = useCallback(
    (slotIndex: number) => {
      const nextSlots = readSaveSlots(SAVE_SLOT_COUNT);
      nextSlots[slotIndex] = null;
      writeSaveSlots(nextSlots, SAVE_SLOT_COUNT);
      setSaveSlots(nextSlots);
      pulseUi("ui");
    },
    [pulseUi],
  );

  useEffect(() => {
    const onStorage = () => {
      setHasContinueSave(Boolean(safeParseJson<SaveSlot | null>(localStorage.getItem(STORAGE_KEYS.save), null)));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    saveSlots,
    hasContinueSave,
    saveGame,
    loadSaveSlot,
    continueLastGame,
    deleteSaveSlot,
  };
}

export function usePlaybackRuntime({
  index,
  line,
  phase,
  activePanel,
  showLog,
  showQaPanel,
  cgVisible,
  settings,
  closeCg,
  pulseUi,
  onAdvance,
  onBacktrack,
  onJump,
  onEnterCredits,
  onAppendLog,
  onQuickSave,
  onToggleLog,
  onCloseOverlays,
}: UsePlaybackRuntimeArgs) {
  const [typing, setTyping] = useState(false);
  const [auto, setAuto] = useState(false);
  const [skip, setSkip] = useState(false);
  const [textVisible, setTextVisible] = useState(true);
  const [hudAwake, setHudAwake] = useState(false);

  const autoTimeoutRef = useRef<number | null>(null);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const hudSleepRef = useRef<number | null>(null);
  const textRuntimeRef = useRef(createPlaybackTextRuntime());
  const textRuntime = textRuntimeRef.current;

  const wakeHud = useCallback(() => {
    setHudAwake(true);
    if (hudSleepRef.current) window.clearTimeout(hudSleepRef.current);
    hudSleepRef.current = window.setTimeout(() => setHudAwake(false), 2200);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    if (!line) {
      onEnterCredits();
      return;
    }
    if (line.speaker === "SYSTEM" && line.text?.startsWith("JUMP:")) {
      const label = line.text.slice(5).trim();
      const target = SCRIPT.labelMap.get(label);
      onJump(typeof target === "number" ? target : Math.min(SCRIPT.lines.length, index + 1));
      return;
    }

    setTextVisible(false);
    if (line.kind !== "choice") {
      pulseUi(line.effect && line.effect !== "none" ? "emotion" : "story");
    }
    textRuntime.play({
      text: line.kind === "choice" ? "请选择：" : line.text || "",
      typeMs: settings.typeMs,
      instant: skip,
      onStart: () => setTyping(true),
      onReveal: () => setTextVisible(true),
      onComplete: () => setTyping(false),
    });

    return () => {
      textRuntime.cancel();
    };
  }, [index, line, onEnterCredits, onJump, phase, pulseUi, settings.typeMs, skip, textRuntime]);

  const handleNext = useCallback(() => {
    if (phase !== "playing" || !line) return;
    if (cgVisible) {
      closeCg(true);
      return;
    }
    if (textRuntime.complete()) return;
    if (line.kind === "choice") return;
    if (line.kind === "label") {
      onAdvance();
      return;
    }
    if (line.speaker && line.text) {
      onAppendLog({ who: line.speaker || "旁白", text: line.text || "" });
    }
    if (line.cg) {
      pulseUi("cg");
    }
    onAdvance();
  }, [cgVisible, closeCg, line, onAdvance, onAppendLog, phase, pulseUi, textRuntime]);

  const handlePrev = useCallback(() => {
    if (phase !== "playing") return;
    setAuto(false);
    setSkip(false);
    textRuntime.cancel();
    setTyping(false);
    if (index <= 0) return;
    let nextIndex = index - 1;
    while (nextIndex > 0) {
      const previousLine = SCRIPT.lines[nextIndex];
      if (previousLine.kind === "label" || previousLine.kind === "choice") {
        nextIndex -= 1;
      } else {
        break;
      }
    }
    onBacktrack(nextIndex);
  }, [index, onBacktrack, phase, textRuntime]);

  const handleChoice = useCallback(
    (cmd: string) => {
      if (cmd.startsWith("@jump")) {
        const label = cmd.replace("@jump", "").trim();
        const target = SCRIPT.labelMap.get(label);
        onJump(typeof target === "number" ? target : index + 1);
        return;
      }
      onAdvance();
    },
    [index, onAdvance, onJump],
  );

  useEffect(() => {
    if (autoTimeoutRef.current) {
      window.clearTimeout(autoTimeoutRef.current);
    }
    if (phase !== "playing" || (!auto && !skip) || typing || line?.kind === "choice" || !line) return;
    const delay = skip ? 50 : Math.max(180, settings.autoMs);
    autoTimeoutRef.current = window.setTimeout(handleNext, delay);
    return () => {
      if (autoTimeoutRef.current) {
        window.clearTimeout(autoTimeoutRef.current);
      }
    };
  }, [auto, handleNext, line, phase, settings.autoMs, skip, typing]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (phase === "playing") {
        wakeHud();
      }
      if (phase !== "playing") return;
      if (cgVisible && (event.key === " " || event.key === "Enter" || event.key === "Escape")) {
        event.preventDefault();
        closeCg(true);
        return;
      }
      if ((event.key === " " || event.key === "Enter") && !activePanel && !showLog) {
        event.preventDefault();
        handleNext();
      }
      if (event.key === "Backspace" && !activePanel && !showLog) {
        event.preventDefault();
        handlePrev();
      }
      if (event.key.toLowerCase() === "l") onToggleLog();
      if (event.key.toLowerCase() === "s") onQuickSave();
      if (event.key === "Escape") {
        onCloseOverlays();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [activePanel, cgVisible, closeCg, handleNext, handlePrev, onCloseOverlays, onQuickSave, onToggleLog, phase, showLog, wakeHud]);

  useEffect(() => {
    if (phase !== "playing") {
      setHudAwake(false);
      if (hudSleepRef.current) window.clearTimeout(hudSleepRef.current);
      return;
    }
    const onMove = (event: MouseEvent) => {
      if (event.clientY <= 112 || event.clientX <= 112) wakeHud();
    };

    if (activePanel || showLog || cgVisible || showQaPanel) setHudAwake(true);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (hudSleepRef.current) window.clearTimeout(hudSleepRef.current);
    };
  }, [activePanel, cgVisible, phase, showLog, showQaPanel, wakeHud]);

  useEffect(() => {
    if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current);
    if (phase !== "playing" || index <= 0) return;

    // Local storage writes can hitch auto/skip playback, so save after the reader pauses.
    autosaveTimeoutRef.current = window.setTimeout(onQuickSave, 700);
    return () => {
      if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current);
    };
  }, [index, onQuickSave, phase]);

  useEffect(() => {
    return () => {
      if (autoTimeoutRef.current) window.clearTimeout(autoTimeoutRef.current);
      textRuntime.cancel();
      if (hudSleepRef.current) window.clearTimeout(hudSleepRef.current);
      if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current);
    };
  }, [textRuntime]);

  return {
    typing,
    textStore: textRuntime,
    auto,
    skip,
    textVisible,
    hudAwake,
    setAuto,
    setSkip,
    setHudAwake,
    handleNext,
    handlePrev,
    handleChoice,
  };
}

type UseSceneRuntimeArgs = {
  index: number;
  line?: ScriptLine;
  phase: string;
  resolveSceneBackground: (scene: string | undefined) => string;
  debugExpressionOverride: "calm" | "panic" | null;
};

type UseBackgroundRuntimeArgs = {
  manifestState: Manifest;
  index: number;
  line?: ScriptLine;
  phase: string;
  lowPerfMode: boolean;
  pulseUi: (_layer?: string) => void;
};

type UsePresentationRuntimeArgs = {
  index: number;
  line?: ScriptLine;
  phase: string;
  bgUrl: string;
  videoManifest?: { id: string; label: string }[];
  resolveSceneBackground: (scene: string | undefined) => string;
  lowPerfMode: boolean;
  pulseUi: (_layer?: string) => void;
  onAdvance: () => void;
};

export function isKeySceneTransition(line?: ScriptLine) {
  if (!line) return false;
  if (line.kind === "title" || line.cg) return true;
  if (line.transition && !["none", "cut"].includes(line.transition)) return true;
  if (line.effect && !["none", "rain", "blur"].includes(line.effect)) return true;
  if (line.scene && /(梦境|回忆|地下室|暴雨|黎明|医院|审判|终章|尾声)/.test(line.scene)) return true;
  return false;
}

export function findNextScenePreviewUrl(startIndex: number, resolver: (scene: string | undefined) => string) {
  const currentScene = SCRIPT.lines[startIndex]?.scene;
  for (let i = startIndex + 1; i < Math.min(SCRIPT.lines.length, startIndex + 12); i += 1) {
    const nextScene = SCRIPT.lines[i]?.scene;
    if (nextScene && nextScene !== currentScene) {
      return resolver(nextScene);
    }
  }
  return "";
}

export function useSceneRuntime({
  index,
  line,
  phase,
  resolveSceneBackground,
  debugExpressionOverride,
}: UseSceneRuntimeArgs) {
  const [spriteReadyMap, setSpriteReadyMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (phase !== "playing") return;
    const nextBgUrl = findNextScenePreviewUrl(index, resolveSceneBackground);
    if (!nextBgUrl) return;
    queueImagePreload(nextBgUrl);
    void ensureImageReady(nextBgUrl);
  }, [index, phase, resolveSceneBackground]);

  useEffect(() => {
    if (phase !== "playing" || !line) return;
    const upcoming = new Set<string>();
    getSceneCharacters(SCRIPT.lines, index, line.speaker).forEach((ch) => {
      upcoming.add(ch.spriteUrl);
    });
    const nextLine = SCRIPT.lines[index + 1];
    if (nextLine) {
      getSceneCharacters(SCRIPT.lines, index + 1, nextLine.speaker).forEach((ch) => {
        upcoming.add(ch.spriteUrl);
      });
    }
    upcoming.forEach((url) => {
      queueImagePreload(url);
      void ensureImageReady(url).then(() => {
        startTransition(() => {
          setSpriteReadyMap((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
        });
      });
    });
  }, [index, line, phase]);

  const stageChars = useMemo<StageCharacter[]>(() => {
    if (phase !== "playing" || !line) return [];
    const chars = getSceneCharacters(SCRIPT.lines, index, line.speaker);
    if (!debugExpressionOverride) return chars;
    return chars.map((ch) => ({ ...ch, expression: debugExpressionOverride }));
  }, [debugExpressionOverride, index, line, phase]);

  return {
    spriteReadyMap,
    stageChars,
  };
}

export function useBackgroundRuntime({
  manifestState,
  index,
  line,
  phase,
  lowPerfMode,
  pulseUi,
}: UseBackgroundRuntimeArgs) {
  const [bgUrl, setBgUrl] = useState<string>(DEFAULT_BG);
  const [prevBgUrl, setPrevBgUrl] = useState<string>("");
  const [transitionActive, setTransitionActive] = useState(false);
  const [transitionType, setTransitionType] = useState("fade-black");
  const [sceneBgOverrides, setSceneBgOverrides] = useState<Record<string, SceneBgOverride>>(() => readSceneBgOverrides());
  const [selectedSceneName, setSelectedSceneName] = useState("");
  const [selectedBackgroundAssetId, setSelectedBackgroundAssetId] = useState("");
  const [customSceneBgUrl, setCustomSceneBgUrl] = useState("");

  const lastBgRef = useRef("");
  const bgAssetUrlCacheRef = useRef<Record<string, string>>({});

  const ensureBackgroundAssetUrl = useCallback(async (assetId: string) => {
    const cached = bgAssetUrlCacheRef.current[assetId];
    if (cached) return cached;
    const blob = await AssetDB.get<Blob>(AssetDB.STORE_ASSETS, assetId);
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    bgAssetUrlCacheRef.current[assetId] = url;
    return url;
  }, []);

  const getBackgroundAssetLabel = useCallback(
    (assetId: string) => {
      return (
        manifestState.backgrounds?.find((item) => item.id === assetId)?.label ||
        manifestState.bg?.find((item) => item.id === assetId)?.label ||
        assetId
      );
    },
    [manifestState.backgrounds, manifestState.bg],
  );

  const resolveSceneBackground = useCallback(
    (scene: string | undefined) => {
      if (!scene) return DEFAULT_BG;
      const override = sceneBgOverrides[scene];
      if (override?.source === "url" && override.value) return override.value;
      if (override?.source === "asset" && bgAssetUrlCacheRef.current[override.value]) {
        return bgAssetUrlCacheRef.current[override.value];
      }
      return getScenePresentation(scene).background || DEFAULT_BG;
    },
    [sceneBgOverrides],
  );

  const applySceneBackground = useCallback(
    async (scene: string, assetId: string | null) => {
      const nextOverrides = { ...sceneBgOverrides };
      if (!assetId) {
        delete nextOverrides[scene];
        setSceneBgOverrides(nextOverrides);
        writeSceneBgOverrides(nextOverrides);
        return;
      }
      nextOverrides[scene] = { source: "asset", value: assetId, label: getBackgroundAssetLabel(assetId) };
      setSceneBgOverrides(nextOverrides);
      writeSceneBgOverrides(nextOverrides);
      if (scene === line?.scene) {
        const url = await ensureBackgroundAssetUrl(assetId);
        if (url) {
          setBgUrl(url);
          lastBgRef.current = url;
          pulseUi("scene");
        }
      }
    },
    [ensureBackgroundAssetUrl, getBackgroundAssetLabel, line?.scene, pulseUi, sceneBgOverrides],
  );

  const previewSceneBackground = useCallback(
    async (scene: string, assetId?: string | null) => {
      const override = sceneBgOverrides[scene];
      if (assetId) {
        const url = await ensureBackgroundAssetUrl(assetId);
        if (url) {
          setBgUrl(url);
          lastBgRef.current = url;
          pulseUi("scene");
        }
        return;
      }
      if (override?.source === "asset") {
        const url = await ensureBackgroundAssetUrl(override.value);
        if (url) {
          setBgUrl(url);
          lastBgRef.current = url;
          pulseUi("scene");
        }
        return;
      }
      const builtIn = getScenePresentation(scene).background || DEFAULT_BG;
      setBgUrl(builtIn);
      lastBgRef.current = builtIn;
      pulseUi("scene");
    },
    [ensureBackgroundAssetUrl, pulseUi, sceneBgOverrides],
  );

  const bindSceneUrl = useCallback(
    (scene: string, url: string) => {
      const nextOverrides: Record<string, SceneBgOverride> = {
        ...sceneBgOverrides,
        [scene]: { source: "url", value: url, label: url },
      };
      setSceneBgOverrides(nextOverrides);
      writeSceneBgOverrides(nextOverrides);
      setBgUrl(url);
      lastBgRef.current = url;
      pulseUi("scene");
    },
    [pulseUi, sceneBgOverrides],
  );

  const clearSceneBinding = useCallback(
    (scene: string) => {
      void applySceneBackground(scene, null);
      if (selectedSceneName === scene) {
        setCustomSceneBgUrl("");
        setSelectedBackgroundAssetId("");
      }
    },
    [applySceneBackground, selectedSceneName],
  );

  useEffect(() => {
    if (!selectedSceneName) {
      const initialScene = line?.scene || SCRIPT.lines[0]?.scene || "";
      setSelectedSceneName(initialScene);
      const initialOverride = sceneBgOverrides[initialScene];
      setCustomSceneBgUrl(initialOverride?.source === "url" ? initialOverride.value : "");
      setSelectedBackgroundAssetId(initialOverride?.source === "asset" ? initialOverride.value : "");
    }
  }, [line?.scene, sceneBgOverrides, selectedSceneName]);

  useEffect(() => {
    if (!selectedSceneName) return;
    const override = sceneBgOverrides[selectedSceneName];
    setCustomSceneBgUrl(override?.source === "url" ? override.value : "");
    setSelectedBackgroundAssetId(override?.source === "asset" ? override.value : "");
  }, [sceneBgOverrides, selectedSceneName]);

  useEffect(() => {
    if (phase !== "playing" || !line) return;
    const nextBg = resolveSceneBackground(line.scene);

    const override = line.scene ? sceneBgOverrides[line.scene] : undefined;
    const loadAssetBg = async () => {
      if (override?.source !== "asset") return nextBg;
      const url = await ensureBackgroundAssetUrl(override.value);
      return url || nextBg;
    };

    if (nextBg !== lastBgRef.current) {
      let cancelled = false;
      let clearTimer: number | null = null;
      const nextTransition = isKeySceneTransition(line) ? line.transition || "dissolve" : "cut";
      const currentBg = bgUrl || lastBgRef.current || DEFAULT_BG;
      const shouldAnimateTransition = !lowPerfMode && nextTransition !== "cut";

      if (shouldAnimateTransition) {
        setPrevBgUrl(currentBg);
        setTransitionType(nextTransition);
        setTransitionActive(true);
      } else {
        setPrevBgUrl("");
        setTransitionActive(false);
      }
      pulseUi("scene");

      void loadAssetBg()
        .then((resolvedBg) => ensureImageReady(resolvedBg).then(() => resolvedBg))
        .catch(() => nextBg)
        .then((resolvedBg) => {
          if (cancelled) return;
          setBgUrl(resolvedBg);
          lastBgRef.current = resolvedBg;
          if (!shouldAnimateTransition) return;
          clearTimer = window.setTimeout(() => {
            if (!cancelled) {
              setTransitionActive(false);
            }
          }, nextTransition === "dissolve" ? 620 : 820);
        });

      return () => {
        cancelled = true;
        if (clearTimer) window.clearTimeout(clearTimer);
      };
    }
    return undefined;
  }, [bgUrl, ensureBackgroundAssetUrl, index, line, lowPerfMode, phase, pulseUi, resolveSceneBackground, sceneBgOverrides]);

  useEffect(() => {
    return () => {
      Object.values(bgAssetUrlCacheRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const clearLastBackground = useCallback(() => {
    lastBgRef.current = "";
  }, []);

  const showImmediateBackground = useCallback((url: string) => {
    setBgUrl(url);
    lastBgRef.current = url;
  }, []);

  return {
    bgUrl,
    prevBgUrl,
    transitionActive,
    transitionType,
    sceneBgOverrides,
    selectedSceneName,
    selectedBackgroundAssetId,
    customSceneBgUrl,
    setSelectedSceneName,
    setSelectedBackgroundAssetId,
    setCustomSceneBgUrl,
    resolveSceneBackground,
    applySceneBackground,
    previewSceneBackground,
    bindSceneUrl,
    clearSceneBinding,
    clearLastBackground,
    showImmediateBackground,
  };
}

export function usePresentationRuntime({
  index,
  line,
  phase,
  bgUrl,
  videoManifest,
  resolveSceneBackground,
  lowPerfMode,
  pulseUi,
  onAdvance,
}: UsePresentationRuntimeArgs) {
  const [cgVisible, setCgVisible] = useState(false);
  const [cgClosing, setCgClosing] = useState(false);
  const [cgMediaKind, setCgMediaKind] = useState<"image" | "video">("image");
  const [cgImageUrl, setCgImageUrl] = useState("");
  const [cgVideoUrl, setCgVideoUrl] = useState("");
  const [startTransitioning, setStartTransitioning] = useState(false);
  const [screenFlashVisible, setScreenFlashVisible] = useState(false);
  const [creditsRollReady, setCreditsRollReady] = useState(false);
  const [openingPreludeVisible, setOpeningPreludeVisible] = useState(false);
  const [openingPreludeText, setOpeningPreludeText] = useState("第一幕 · 正在展开");

  const cgVideoUrlRef = useRef("");
  const cgVideoRef = useRef<HTMLVideoElement>(null);
  const cgCloseTimerRef = useRef<number | null>(null);
  const preludeTimerRef = useRef<number | null>(null);
  const cgSeenRef = useRef("");

  useEffect(() => {
    if (phase !== "credits") {
      setCreditsRollReady(false);
      return;
    }
    setCreditsRollReady(false);
    const timer = window.setTimeout(() => setCreditsRollReady(true), lowPerfMode ? 900 : 1600);
    return () => window.clearTimeout(timer);
  }, [lowPerfMode, phase]);

  useEffect(() => {
    if (cgCloseTimerRef.current) {
      window.clearTimeout(cgCloseTimerRef.current);
      cgCloseTimerRef.current = null;
    }
    if (phase !== "playing" || !line?.cg || cgVisible) return;
    const cgKey = `${index}:${line.cg}`;
    if (cgSeenRef.current === cgKey) return;
    let cancelled = false;
    const posterUrl = getCgImage(line.cg, line.scene) || resolveSceneBackground(line.scene) || bgUrl || DEFAULT_BG;
    pulseUi("cg");

    const openCgWithPoster = () => {
      void ensureImageReady(posterUrl).then(() => {
        if (cancelled) return;
        if (cgVideoUrlRef.current) {
          URL.revokeObjectURL(cgVideoUrlRef.current);
          cgVideoUrlRef.current = "";
        }
        setCgMediaKind("image");
        setCgVideoUrl("");
        setCgImageUrl(posterUrl);
        setCgClosing(false);
        setCgVisible(true);
        cgSeenRef.current = cgKey;
        setOpeningPreludeVisible(false);
      });
    };

    const videoMatch = findBestAssetMatch(videoManifest, [line.cg, line.scene || "", "cg", "视频"]);
    if (videoMatch) {
      void AssetDB.get<Blob>(AssetDB.STORE_ASSETS, videoMatch.id)
        .then((blob) => {
          if (!blob || cancelled) return null;
          const url = URL.createObjectURL(blob);
          if (cgVideoUrlRef.current) {
            URL.revokeObjectURL(cgVideoUrlRef.current);
          }
          cgVideoUrlRef.current = url;
          return url;
        })
        .then((url) => {
          if (!url || cancelled) {
            openCgWithPoster();
            return;
          }
          void ensureImageReady(posterUrl).then(() => {
            if (cancelled) return;
            setCgMediaKind("video");
            setCgVideoUrl(url);
            setCgImageUrl(posterUrl);
            setCgClosing(false);
            setCgVisible(true);
            cgSeenRef.current = cgKey;
            setOpeningPreludeVisible(false);
          });
        })
        .catch(() => {
          openCgWithPoster();
        });
      return () => {
        cancelled = true;
      };
    }

    openCgWithPoster();
    return () => {
      cancelled = true;
    };
  }, [bgUrl, cgVisible, index, line, phase, pulseUi, resolveSceneBackground, videoManifest]);

  useEffect(() => {
    if (!cgVisible || cgMediaKind !== "video") return;
    const video = cgVideoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => undefined);
  }, [cgMediaKind, cgVisible, cgVideoUrl]);

  const closeCg = useCallback((advance = false) => {
    if (!cgVisible) return;
    cgSeenRef.current = `${index}:${line?.cg || ""}`;
    setCgClosing(true);
    pulseUi("cg");
    if (cgCloseTimerRef.current) window.clearTimeout(cgCloseTimerRef.current);
    cgCloseTimerRef.current = window.setTimeout(() => {
      if (cgVideoUrlRef.current) {
        URL.revokeObjectURL(cgVideoUrlRef.current);
        cgVideoUrlRef.current = "";
      }
      setCgVisible(false);
      setCgClosing(false);
      setCgMediaKind("image");
      setCgVideoUrl("");
      if (advance && phase === "playing") {
        onAdvance();
      }
      cgCloseTimerRef.current = null;
    }, 240);
  }, [cgVisible, index, line?.cg, onAdvance, phase, pulseUi]);

  const triggerOpeningPrelude = useCallback((text: string) => {
    if (preludeTimerRef.current) window.clearTimeout(preludeTimerRef.current);
    setOpeningPreludeText(text);
    setOpeningPreludeVisible(true);
    preludeTimerRef.current = window.setTimeout(() => {
      setOpeningPreludeVisible(false);
      preludeTimerRef.current = null;
    }, 1500);
  }, []);

  const resetPresentationState = useCallback(() => {
    setOpeningPreludeVisible(false);
    setCgClosing(false);
    setCgMediaKind("image");
    setCgVideoUrl("");
    cgSeenRef.current = "";
  }, []);

  useEffect(() => {
    return () => {
      if (cgVideoUrlRef.current) URL.revokeObjectURL(cgVideoUrlRef.current);
      if (cgCloseTimerRef.current) window.clearTimeout(cgCloseTimerRef.current);
      if (preludeTimerRef.current) window.clearTimeout(preludeTimerRef.current);
    };
  }, []);

  return {
    cgVisible,
    cgClosing,
    cgMediaKind,
    cgImageUrl,
    cgVideoUrl,
    cgVideoRef,
    startTransitioning,
    screenFlashVisible,
    creditsRollReady,
    openingPreludeVisible,
    openingPreludeText,
    setCgVisible,
    setCgClosing,
    setCgMediaKind,
    setCgImageUrl,
    setCgVideoUrl,
    setStartTransitioning,
    setScreenFlashVisible,
    setOpeningPreludeVisible,
    closeCg,
    triggerOpeningPrelude,
    resetPresentationState,
  };
}

export function useAudioRuntime({ settings, bgmList }: UseAudioRuntimeArgs) {
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [bgmMuted, setBgmMuted] = useState(false);
  const [currentBgmId, setCurrentBgmId] = useState("");
  const [currentBgmName, setCurrentBgmName] = useState("");

  const bgmRef = useRef<HTMLAudioElement>(new Audio());
  const bgmFadeRef = useRef<HTMLAudioElement>(new Audio());
  const sfxRef = useRef<HTMLAudioElement>(new Audio());
  const bgmUrlRef = useRef("");
  const sfxUrlRef = useRef("");
  const uiPulseRef = useRef<number | null>(null);
  const fadeInTimerRef = useRef<number | null>(null);
  const fadeOutTimerRef = useRef<number | null>(null);
  const retiringBgmUrlRef = useRef("");

  const clearFadeTimers = useCallback(() => {
    if (fadeInTimerRef.current) window.clearInterval(fadeInTimerRef.current);
    if (fadeOutTimerRef.current) window.clearInterval(fadeOutTimerRef.current);
    fadeInTimerRef.current = null;
    fadeOutTimerRef.current = null;
    if (retiringBgmUrlRef.current) {
      URL.revokeObjectURL(retiringBgmUrlRef.current);
      retiringBgmUrlRef.current = "";
    }
  }, []);

  useEffect(() => {
    bgmRef.current.loop = true;
    bgmFadeRef.current.loop = true;
    sfxRef.current.preload = "auto";
  }, []);

  useEffect(() => {
    bgmRef.current.volume = settings.bgmVol / 100;
    bgmFadeRef.current.volume = settings.bgmVol / 100;
    sfxRef.current.volume = settings.sfxVol / 100;
  }, [settings.bgmVol, settings.sfxVol]);

  const pulseUi = useCallback((_layer = "ui") => {
    if (uiPulseRef.current) window.clearTimeout(uiPulseRef.current);
    uiPulseRef.current = window.setTimeout(() => {
      uiPulseRef.current = null;
    }, 120);
  }, []);

  const crossfadeBgm = useCallback(
    async (assetId: string, name: string) => {
      if (!assetId) return;
      try {
        const blob = await AssetDB.get<Blob>(AssetDB.STORE_ASSETS, assetId);
        if (!blob) return;
        clearFadeTimers();

        const oldAudio = bgmRef.current;
        const nextAudio = bgmFadeRef.current;
        const oldUrl = bgmUrlRef.current;
        nextAudio.pause();
        nextAudio.removeAttribute("src");

        if (oldAudio.src && bgmPlaying) {
          retiringBgmUrlRef.current = oldUrl;
          fadeOutTimerRef.current = window.setInterval(() => {
            if (oldAudio.volume > 0.05) {
              oldAudio.volume = Math.max(0, oldAudio.volume - 0.05);
            } else {
              oldAudio.pause();
              oldAudio.removeAttribute("src");
              if (retiringBgmUrlRef.current) {
                URL.revokeObjectURL(retiringBgmUrlRef.current);
                retiringBgmUrlRef.current = "";
              }
              if (fadeOutTimerRef.current) window.clearInterval(fadeOutTimerRef.current);
              fadeOutTimerRef.current = null;
            }
          }, 50);
        } else {
          oldAudio.pause();
          oldAudio.removeAttribute("src");
          if (oldUrl) URL.revokeObjectURL(oldUrl);
        }

        const url = URL.createObjectURL(blob);
        bgmUrlRef.current = url;

        nextAudio.src = url;
        nextAudio.volume = 0;
        nextAudio.muted = bgmMuted;
        await nextAudio.play().catch(() => undefined);

        const targetVol = settings.bgmVol / 100;
        fadeInTimerRef.current = window.setInterval(() => {
          if (nextAudio.volume < targetVol - 0.05) {
            nextAudio.volume = Math.min(targetVol, nextAudio.volume + 0.05);
          } else {
            nextAudio.volume = targetVol;
            if (fadeInTimerRef.current) window.clearInterval(fadeInTimerRef.current);
            fadeInTimerRef.current = null;
          }
        }, 50);

        bgmRef.current = nextAudio;
        bgmFadeRef.current = oldAudio;
        setBgmPlaying(true);
        setCurrentBgmId(assetId);
        setCurrentBgmName(name);
      } catch {
        // ignore autoplay and blob issues
      }
    },
    [bgmMuted, bgmPlaying, clearFadeTimers, settings.bgmVol],
  );

  const stopBgm = useCallback(() => {
    clearFadeTimers();
    bgmRef.current.pause();
    bgmRef.current.currentTime = 0;
    bgmFadeRef.current.pause();
    bgmFadeRef.current.currentTime = 0;
    if (bgmUrlRef.current) {
      URL.revokeObjectURL(bgmUrlRef.current);
      bgmUrlRef.current = "";
    }
    bgmRef.current.removeAttribute("src");
    bgmFadeRef.current.removeAttribute("src");
    setBgmPlaying(false);
    setCurrentBgmId("");
    setCurrentBgmName("");
  }, [clearFadeTimers]);

  const loadAndPlayBgm = useCallback(
    async (assetId: string) => {
      if (!assetId) {
        stopBgm();
        return;
      }
      try {
        const blob = await AssetDB.get<Blob>(AssetDB.STORE_ASSETS, assetId);
        if (!blob) return;
        clearFadeTimers();
        bgmFadeRef.current.pause();
        bgmFadeRef.current.removeAttribute("src");
        if (bgmUrlRef.current) URL.revokeObjectURL(bgmUrlRef.current);
        const url = URL.createObjectURL(blob);
        bgmUrlRef.current = url;
        bgmRef.current.src = url;
        bgmRef.current.volume = settings.bgmVol / 100;
        bgmRef.current.muted = bgmMuted;
        await bgmRef.current.play().catch(() => undefined);
        setBgmPlaying(true);
        setCurrentBgmId(assetId);
        const match = bgmList.find((item) => item.id === assetId);
        setCurrentBgmName(match?.label || "");
      } catch {
        // ignore
      }
    },
    [bgmList, bgmMuted, clearFadeTimers, settings.bgmVol, stopBgm],
  );

  const playSfx = useCallback(
    async (assetId: string) => {
      if (!assetId) return;
      try {
        const blob = await AssetDB.get<Blob>(AssetDB.STORE_ASSETS, assetId);
        if (!blob) return;
        if (sfxUrlRef.current) URL.revokeObjectURL(sfxUrlRef.current);
        const url = URL.createObjectURL(blob);
        sfxUrlRef.current = url;
        sfxRef.current.src = url;
        sfxRef.current.volume = settings.sfxVol / 100;
        sfxRef.current.currentTime = 0;
        await sfxRef.current.play().catch(() => undefined);
      } catch {
        // ignore
      }
    },
    [settings.sfxVol],
  );

  const toggleBgm = useCallback(() => {
    if (bgmPlaying) {
      bgmRef.current.pause();
      setBgmPlaying(false);
      return;
    }
    if (bgmRef.current.src) {
      void bgmRef.current.play().then(() => setBgmPlaying(true)).catch(() => undefined);
    }
  }, [bgmPlaying]);

  const toggleMute = useCallback(() => {
    const next = !bgmMuted;
    bgmRef.current.muted = next;
    bgmFadeRef.current.muted = next;
    setBgmMuted(next);
  }, [bgmMuted]);

  const currentBgmLabel = useMemo(
    () => getCurrentBgmLabel(bgmList, currentBgmId, currentBgmName),
    [bgmList, currentBgmId, currentBgmName],
  );
  const bgmMoodClass = useMemo(() => getBgmMoodClass(currentBgmLabel), [currentBgmLabel]);

  useEffect(() => {
    return () => {
      if (bgmUrlRef.current) URL.revokeObjectURL(bgmUrlRef.current);
      if (sfxUrlRef.current) URL.revokeObjectURL(sfxUrlRef.current);
      if (uiPulseRef.current) window.clearTimeout(uiPulseRef.current);
      clearFadeTimers();
      bgmRef.current.pause();
      bgmFadeRef.current.pause();
      sfxRef.current.pause();
    };
  }, [clearFadeTimers]);

  return {
    bgmPlaying,
    bgmMuted,
    currentBgmId,
    currentBgmName,
    currentBgmLabel,
    bgmMoodClass,
    toggleBgm,
    stopBgm,
    toggleMute,
    loadAndPlayBgm,
    crossfadeBgm,
    playSfx,
    pulseUi,
    setBgmPlaying,
    setBgmMuted,
    setCurrentBgmId,
    setCurrentBgmName,
  };
}
