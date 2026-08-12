import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./index.css";
import {
  CHARACTER_COLORS,
  SCRIPT,
  DEFAULT_BG,
} from "./engine";
import {
  DEFAULT_SETTINGS,
  buildSaveSnapshot,
  getSavedAtLabel,
  readManifest,
  readSettings,
  type SaveSlot,
  type Settings,
} from "./vnCore";
import { CORNER_IMG_URL, CREDITS_BLOCKS, QA_ITEMS, TITLE_SCREEN_BG } from "./vnContent";
import { RainCanvas, StageSprites } from "./vnVisuals";
import {
  useAudioRuntime,
  useBackgroundRuntime,
  useCodeExportRuntime,
  useFlowRuntime,
  useLibraryRuntime,
  usePlaybackRuntime,
  usePresentationRuntime,
  useSaveRuntime,
  useSceneRuntime,
  useShellRuntime,
  useStageEffectsRuntime,
  useWorkspaceRuntime,
} from "./vnRuntime";
import {
  BacklogView,
  CreditsRollView,
  CreditsScene,
  DialogueHudView,
  PlaybackControlBar,
  PlayingScene,
  PresentationOverlays,
  TitleQaPanel,
  TitleLandingView,
  TitleScene,
  TitleSystemPanel,
  WarningScene,
} from "./vnScenes";
import {
  buildDebugMarkers,
  collectScriptScenes,
  buildResourceEntries,
  filterResourceEntries,
  filterSceneNames,
  getChoiceTone,
  getChoiceToneLabel,
  getDialogueTone,
  getSceneProgress,
  isEmphasisLine,
} from "./vnDerived";
import { CG_ENTRIES, CHAPTERS, useStoryStateRuntime, restoreRollbackLog, type CgEntry, type ChapterEntry } from "./vnProgress";
import type { RouteState } from "./vnState";
import { useVoiceRuntime } from "./vnVoice";
type GamePhase = "warning" | "title" | "playing" | "credits";
type LogItem = { who: string; text: string };

const ExtrasPanel = lazy(() => import("./vnExtras"));
const PlayingPanelsView = lazy(() => import("./vnPlayingPanels"));
const SettingsPanel = lazy(() => import("./vnPanels").then((module) => ({ default: module.SettingsPanel })));
const AssetsPanel = lazy(() => import("./vnPanels").then((module) => ({ default: module.AssetsPanel })));

const SCRIPT_SCENES = collectScriptScenes(SCRIPT.lines);

export function useVnRuntime() {
  const [index, setIndex] = useState(0);
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [phase, setPhase] = useState<GamePhase>("warning");
  const [replayMode, setReplayMode] = useState(false);
  const [replayEndIndex, setReplayEndIndex] = useState(-1);
  const replayReturnRef = useRef<{
    index: number;
    log: LogItem[];
    bgmName: string;
    routeState: RouteState;
  } | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [debugExpressionOverride, setDebugExpressionOverride] = useState<"calm" | "panic" | null>(null);
  const {
    showLog,
    activePanel,
    showQaPanel,
    openQaIndex,
    workspaceMode,
    selectedSaveSlot,
    assetQuery,
    assetFilter,
    resourcePage,
    debugPage,
    sceneQuery,
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
  } = useWorkspaceRuntime();
  const isEditorMode = workspaceMode === "editor";
  const closeActivePanel = useCallback(() => setActivePanel(null), [setActivePanel]);
  const advanceLine = useCallback(
    () => setIndex((value) => Math.min(SCRIPT.lines.length, value + 1)),
    [],
  );
  const { lowPerfMode } = useShellRuntime({
    settings,
    isEditorMode,
    activePanel,
    onCloseRestrictedPanel: closeActivePanel,
  });
  const {
    manifestState,
    bgmList,
    sfxList,
    uploadAsset,
    batchRenameResources,
  } = useLibraryRuntime({
    initialManifest: readManifest(),
  });
  const particlesEnabled = settings.particlesEnabled && !lowPerfMode && !settings.reducedMotion;

  const curLine = SCRIPT.lines[index];
  const {
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
    setVoiceDucking,
    setCurrentBgmName,
    setCurrentBgmId,
  } = useAudioRuntime({ settings, bgmList });
  const {
    currentAct,
    showRain,
    effectClasses,
    triggerEffect,
  } = useStageEffectsRuntime({
    line: curLine,
    phase,
    particlesEnabled,
    lowPerfMode,
    bgmList,
    sfxList,
    currentBgmName,
    crossfadeBgm,
    playSfx,
    setCurrentBgmName,
  });
  const storyState = useStoryStateRuntime({
    index,
    line: curLine,
    logLength: log.length,
    currentAct,
    currentBgmName,
    phase,
    persistProgress: !replayMode,
  });
  const {
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
  } = useBackgroundRuntime({
    manifestState,
    index,
    line: curLine,
    phase,
    lowPerfMode,
    transitionLevel: settings.transitionLevel,
    reducedMotion: settings.reducedMotion,
    pulseUi,
  });
  const {
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
    setCgMediaKind,
    setCgImageUrl,
    setStartTransitioning,
    setScreenFlashVisible,
    setOpeningPreludeVisible,
    closeCg,
    triggerOpeningPrelude,
    resetPresentationState,
  } = usePresentationRuntime({
    index,
    line: curLine,
    phase,
    bgUrl,
    videoManifest: manifestState.video,
    resolveSceneBackground,
    lowPerfMode,
    pulseUi,
    onAdvance: advanceLine,
    onCgShown: storyState.unlockCg,
    onBeforeAdvance: storyState.pushRollback,
  });
  const voiceRuntime = useVoiceRuntime({
    line: curLine,
    phase,
    settings,
    voiceList: manifestState.voice || [],
    onVoiceActive: setVoiceDucking,
  });
  useEffect(() => {
    if (cgVisible) voiceRuntime.stopVoice();
  }, [cgVisible, voiceRuntime.stopVoice]);
  const buildSnapshot = useCallback(
    () => buildSaveSnapshot(index, log, currentAct, currentBgmName, curLine, SCRIPT.lines.length, storyState.routeState),
    [currentAct, currentBgmName, curLine, index, log, storyState.routeState],
  );
  const {
    saveSlots,
    hasContinueSave,
    saveGame,
    loadSaveSlot,
    continueLastGame,
    deleteSaveSlot,
  } = useSaveRuntime({
    buildSnapshot,
    bgmList,
    selectedSaveSlot,
    onRestoreSession: ({ index: nextIndex, log: nextLog, bgmName, routeState }) => {
      replayReturnRef.current = null;
      setReplayMode(false);
      setPhase("playing");
      setIndex(nextIndex);
      setLog(nextLog);
      setActivePanel(null);
      setShowLog(false);
      setAuto(false);
      setSkip(false);
      setCurrentBgmId("");
      setCurrentBgmName(bgmName);
      storyState.restoreRouteState(routeState);
    },
    onStopBgm: stopBgm,
    onLoadBgmById: loadAndPlayBgm,
    onResetPresentationState: resetPresentationState,
    pulseUi,
  });
  const handleBacktrack = useCallback((nextIndex: number) => {
    const snapshot = storyState.popRollback();
    if (!snapshot) {
      setIndex(nextIndex);
      return;
    }
    setIndex(snapshot.index);
    setLog((current) => restoreRollbackLog(current, snapshot));
    setCurrentBgmName(snapshot.bgmName);
    const bgm = bgmList.find((item) => item.label === snapshot.bgmName || item.label.includes(snapshot.bgmName));
    if (bgm) void loadAndPlayBgm(bgm.id);
    else if (!snapshot.bgmName) stopBgm();
  }, [bgmList, loadAndPlayBgm, setCurrentBgmName, stopBgm, storyState.popRollback]);
  const handleJump = useCallback((nextIndex: number) => setIndex(nextIndex), []);
  const handleEnterCredits = useCallback(() => setPhase("credits"), []);
  const handleAppendLog = useCallback(
    (item: LogItem) => setLog((previous) => [...previous, item].slice(-100)),
    [],
  );
  const handleQuickSave = useCallback(
    () => { if (!replayMode) saveGame(selectedSaveSlot, false); },
    [replayMode, saveGame, selectedSaveSlot],
  );
  const handleToggleLog = useCallback(
    () => setShowLog((value) => !value),
    [setShowLog],
  );
  const handleCloseOverlays = useCallback(() => {
    setActivePanel(null);
    setShowLog(false);
  }, [setActivePanel, setShowLog]);
  const {
    typing,
    textStore,
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
  } = usePlaybackRuntime({
    index,
    line: curLine,
    phase,
    activePanel,
    showLog,
    showQaPanel,
    cgVisible,
    settings,
    closeCg,
    pulseUi,
    onAdvance: advanceLine,
    onBacktrack: handleBacktrack,
    onJump: handleJump,
    onEnterCredits: handleEnterCredits,
    onAppendLog: handleAppendLog,
    onBeforeAdvance: storyState.pushRollback,
    onLineSeen: storyState.markSeen,
    isLineSeen: storyState.isSeen,
    onRunCommand: storyState.runCommand,
    onRecordChoice: storyState.recordChoice,
    voicePlaying: voiceRuntime.voicePlaying,
    autosaveEnabled: !replayMode,
    onQuickSave: handleQuickSave,
    onToggleLog: handleToggleLog,
    onCloseOverlays: handleCloseOverlays,
  });
  const loadExportFiles = useCallback(async () => {
    if (!import.meta.env.DEV) return [];
    const { buildExportSourceFiles } = await import("./vnSourceBundle");
    return buildExportSourceFiles();
  }, []);
  const { canExportCode, codeTxtUrl, exportAllCodeTxt } = useCodeExportRuntime({
    enabled: import.meta.env.DEV && isEditorMode,
    loadFiles: loadExportFiles,
  });
  const handleSetFlowPhase = useCallback((nextPhase: string) => {
    setPhase(nextPhase as GamePhase);
  }, []);
  const handleClearLog = useCallback(() => setLog([]), []);
  const handleClosePanels = useCallback(() => {
    setActivePanel(null);
    setShowLog(false);
    setShowQaPanel(false);
    setOpenQaIndex(null);
  }, [setActivePanel, setOpenQaIndex, setShowLog, setShowQaPanel]);
  const handleToggleWorkspaceMode = useCallback(() => {
    setWorkspaceMode((value) => (value === "editor" ? "player" : "editor"));
  }, [setWorkspaceMode]);

  const {
    titleReady,
    startNewGame,
    togglePanel,
    returnToTitle,
    toggleWorkspaceMode,
  } = useFlowRuntime({
    phase,
    lowPerfMode,
    startTransitioning,
    isEditorMode,
    activePanel,
    showQaPanel,
    pulseUi,
    onSetPhase: handleSetFlowPhase,
    onSetIndex: setIndex,
    onClearLog: handleClearLog,
    onClearLastBackground: clearLastBackground,
    onClosePanels: handleClosePanels,
    onResetPresentationState: resetPresentationState,
    onStopBgm: stopBgm,
    onSetScreenFlashVisible: setScreenFlashVisible,
    onSetStartTransitioning: setStartTransitioning,
    onTriggerOpeningPrelude: triggerOpeningPrelude,
    onSetOpeningPreludeVisible: setOpeningPreludeVisible,
    onSetHudAwake: setHudAwake,
    onToggleWorkspaceMode: handleToggleWorkspaceMode,
    onSetShowQaPanel: setShowQaPanel,
    onSetOpenQaIndex: setOpenQaIndex,
    onSetActivePanel: setActivePanel,
  });

  const speaker = curLine?.speaker;
  const showName = Boolean(speaker && speaker !== "旁白" && speaker !== "SYSTEM");
  const speakerColor = speaker ? CHARACTER_COLORS[speaker] || "rgba(255,241,248,0.96)" : "rgba(255,241,248,0.96)";
  const { stageChars, spriteReadyMap } = useSceneRuntime({
    index,
    line: curLine,
    phase,
    resolveSceneBackground,
    debugExpressionOverride,
  });
  const dialogueTone = getDialogueTone(curLine);
  const emphasisLine = isEmphasisLine(curLine?.text);
  const sceneProgress = useMemo(() => getSceneProgress(index, SCRIPT.lines.length), [index]);
  const titlePanelOpen = useMemo(
    () => phase === "title" && (activePanel === "settings" || activePanel === "extras" || (isEditorMode && activePanel === "assets")),
    [activePanel, isEditorMode, phase],
  );
  const resourceEntries = useMemo(
    () => buildResourceEntries(manifestState),
    [manifestState],
  );
  const filteredResources = useMemo(
    () => filterResourceEntries(resourceEntries, assetQuery, assetFilter),
    [assetFilter, assetQuery, resourceEntries],
  );
  const currentBindingText = useMemo(
    () =>
      selectedSceneName && sceneBgOverrides[selectedSceneName]
        ? `${sceneBgOverrides[selectedSceneName].source === "asset" ? "资源" : "URL"} · ${sceneBgOverrides[selectedSceneName].label}`
        : "未绑定",
    [sceneBgOverrides, selectedSceneName],
  );
  const handleCopyResourceName = useCallback((value: string) => {
    navigator.clipboard?.writeText(value).catch(() => undefined);
    setAssetQuery(value);
  }, [setAssetQuery]);
  const getSavePreview = useCallback(
    (slot: SaveSlot | null, slotIndex: number) => {
      if (!slot) {
        return {
          imageUrl: TITLE_SCREEN_BG,
          location: `EMPTY SLOT ${String(slotIndex + 1).padStart(2, "0")}`,
          excerpt: "这一格还没有被写入。后面我们可以在关键节点留下专属回忆。",
        };
      }
      return {
        imageUrl: resolveSceneBackground(slot.scene) || TITLE_SCREEN_BG,
        location: slot.scene || slot.act || "未命名场景",
        excerpt: slot.text ? (slot.text.length > 44 ? `${slot.text.slice(0, 44)}…` : slot.text) : "……",
      };
    },
    [resolveSceneBackground],
  );
  const resourcePageCount = useMemo(
    () => Math.max(1, Math.ceil(filteredResources.length / 12)),
    [filteredResources.length],
  );
  const backgroundAssetEntries = useMemo(
    () => manifestState.backgrounds || [],
    [manifestState.backgrounds],
  );
  const debugMarkers = useMemo(
    () => buildDebugMarkers(SCRIPT.lines),
    [],
  );
  const debugPageCount = useMemo(
    () => Math.max(1, Math.ceil(debugMarkers.length / 12)),
    [debugMarkers.length],
  );
  const filteredScenes = useMemo(
    () => filterSceneNames(SCRIPT_SCENES, sceneQuery),
    [sceneQuery],
  );
  const assetsPanelProps = useMemo(
    () => ({
      onUploadAsset: uploadAsset,
      sceneQuery,
      onSceneQueryChange: setSceneQuery,
      selectedSceneName,
      onSelectedSceneNameChange: setSelectedSceneName,
      filteredScenes,
      selectedBackgroundAssetId,
      onSelectedBackgroundAssetIdChange: setSelectedBackgroundAssetId,
      backgroundAssetEntries,
      customSceneBgUrl,
      onCustomSceneBgUrlChange: setCustomSceneBgUrl,
      onPreviewSceneBackground: previewSceneBackground,
      onApplySceneBackground: applySceneBackground,
      onBindSceneUrl: bindSceneUrl,
      onClearSceneBinding: clearSceneBinding,
      currentBindingText,
      assetQuery,
      onAssetQueryChange: setAssetQuery,
      assetFilter,
      onAssetFilterChange: setAssetFilter,
      onBatchRename: batchRenameResources,
      bgmCount: bgmList.length,
      sfxCount: sfxList.length,
      voiceList: manifestState.voice || [],
      currentLineId: curLine?.lineId || "",
      currentLineLabel: curLine?.text ? `${curLine.speaker || "旁白"}：${curLine.text.slice(0, 30)}` : "",
      boundVoiceId: curLine?.lineId ? voiceRuntime.bindings[curLine.lineId] || "" : "",
      onBindVoice: voiceRuntime.bindVoice,
      resourceEntries,
      filteredResources,
      onCopyResourceName: handleCopyResourceName,
      resourcePage,
      resourcePageCount,
      resourceCount: filteredResources.length,
      onResourcePageChange: setResourcePage,
    }),
    [
      applySceneBackground,
      assetFilter,
      assetQuery,
      backgroundAssetEntries,
      batchRenameResources,
      bgmList.length,
      bindSceneUrl,
      clearSceneBinding,
      currentBindingText,
      customSceneBgUrl,
      filteredResources,
      filteredScenes,
      handleCopyResourceName,
      previewSceneBackground,
      resourceEntries,
      resourcePage,
      resourcePageCount,
      sceneQuery,
      selectedBackgroundAssetId,
      selectedSceneName,
      setAssetFilter,
      setAssetQuery,
      setCustomSceneBgUrl,
      setResourcePage,
      setSceneQuery,
      setSelectedBackgroundAssetId,
      setSelectedSceneName,
      sfxList.length,
      manifestState.voice,
      curLine,
      voiceRuntime.bindVoice,
      voiceRuntime.bindings,
      uploadAsset,
    ],
  );
  useEffect(() => {
    if (resourcePage >= resourcePageCount) {
      setResourcePage(Math.max(0, resourcePageCount - 1));
    }
  }, [resourcePage, resourcePageCount]);

  useEffect(() => {
    if (debugPage >= debugPageCount) {
      setDebugPage(Math.max(0, debugPageCount - 1));
    }
  }, [debugPage, debugPageCount]);

  useEffect(() => {
    setResourcePage(0);
  }, [assetFilter, assetQuery]);

  const handleToggleAuto = useCallback(() => {
    setAuto((value) => !value);
    setSkip(false);
  }, [setAuto, setSkip]);
  const handleToggleSkip = useCallback(() => {
    setSkip((value) => !value);
    setAuto(false);
  }, [setAuto, setSkip]);
  const handleOpenLog = useCallback(() => setShowLog(true), [setShowLog]);
  const handleCloseLog = useCallback(() => setShowLog(false), [setShowLog]);
  const restoreReplaySession = useCallback(() => {
    const returnState = replayReturnRef.current;
    replayReturnRef.current = null;
    setReplayMode(false);
    setReplayEndIndex(-1);
    if (!returnState) {
      storyState.clearSession();
      return;
    }
    setIndex(returnState.index);
    setLog(returnState.log);
    setCurrentBgmName(returnState.bgmName);
    storyState.restoreRouteState(returnState.routeState);
  }, [setCurrentBgmName, storyState.clearSession, storyState.restoreRouteState]);
  const handleReturnTitle = useCallback(() => {
    returnToTitle();
    if (replayMode) {
      restoreReplaySession();
      setActivePanel("extras");
    }
    setAuto(false);
    setSkip(false);
  }, [replayMode, restoreReplaySession, returnToTitle, setActivePanel, setAuto, setSkip]);
  const handleExportCode = useCallback(() => {
    void exportAllCodeTxt();
  }, [exportAllCodeTxt]);
  const handleResetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), []);
  const handleSaveCurrentSlot = useCallback(
    () => { if (!replayMode) saveGame(selectedSaveSlot, true); },
    [replayMode, saveGame, selectedSaveSlot],
  );
  const handleUpdateContinue = useCallback(
    () => { if (!replayMode) saveGame(selectedSaveSlot, false); },
    [replayMode, saveGame, selectedSaveSlot],
  );
  const handleSaveSlot = useCallback((slotIndex: number) => { if (!replayMode) saveGame(slotIndex, true); }, [replayMode, saveGame]);
  const handleStartNewGame = useCallback(() => {
    replayReturnRef.current = null;
    setReplayMode(false);
    setReplayEndIndex(-1);
    storyState.clearSession();
    startNewGame();
  }, [startNewGame, storyState.clearSession]);
  const rememberReplayReturn = useCallback(() => {
    replayReturnRef.current = {
      index,
      log: structuredClone(log),
      bgmName: currentBgmName,
      routeState: structuredClone(storyState.routeState),
    };
  }, [currentBgmName, index, log, storyState.routeState]);
  const handleStartChapter = useCallback((chapter: ChapterEntry) => {
    rememberReplayReturn();
    const chapterPosition = CHAPTERS.findIndex((item) => item.chapterId === chapter.chapterId);
    const nextChapter = CHAPTERS[chapterPosition + 1];
    setReplayMode(true);
    setReplayEndIndex((nextChapter?.index ?? SCRIPT.lines.length) - 1);
    storyState.clearSession(storyState.chapterCheckpoints[chapter.chapterId]);
    setLog([]);
    setIndex(chapter.index);
    setPhase("playing");
    setActivePanel(null);
    resetPresentationState();
    stopBgm();
  }, [rememberReplayReturn, resetPresentationState, setActivePanel, stopBgm, storyState.chapterCheckpoints, storyState.clearSession]);
  const handleOpenGalleryCg = useCallback((entry: CgEntry) => {
    rememberReplayReturn();
    setReplayMode(true);
    setReplayEndIndex(entry.index);
    storyState.clearSession();
    setLog([]);
    setIndex(entry.index);
    setPhase("playing");
    setActivePanel(null);
    resetPresentationState();
  }, [rememberReplayReturn, resetPresentationState, setActivePanel, storyState.clearSession]);

  useEffect(() => {
    if (!replayMode || replayEndIndex < 0 || index <= replayEndIndex) return;
    setPhase("title");
    setActivePanel("extras");
    restoreReplaySession();
    resetPresentationState();
  }, [index, replayEndIndex, replayMode, resetPresentationState, restoreReplaySession, setActivePanel]);
  const handleJumpStart = useCallback(() => {
    setIndex(0);
    setPhase("playing");
    setActivePanel(null);
    pulseUi("scene");
  }, [pulseUi, setActivePanel]);
  const handleJumpRandom = useCallback(() => {
    const jump = debugMarkers[Math.floor(Math.random() * Math.max(1, debugMarkers.length))];
    if (!jump) return;
    setIndex(jump.idx);
    setPhase("playing");
    pulseUi("scene");
  }, [debugMarkers, pulseUi]);
  const handleTriggerCg = useCallback(() => {
    if (!curLine) return;
    setCgImageUrl(bgUrl || DEFAULT_BG);
    setCgVisible(true);
    pulseUi("cg");
  }, [bgUrl, curLine, pulseUi, setCgImageUrl, setCgVisible]);
  const handleSwitchBg = useCallback(() => {
    const nextBg = bgUrl === TITLE_SCREEN_BG ? resolveSceneBackground(curLine?.scene) : TITLE_SCREEN_BG;
    showImmediateBackground(nextBg);
    pulseUi("scene");
  }, [bgUrl, curLine?.scene, pulseUi, resolveSceneBackground, showImmediateBackground]);
  const handleSwitchEmotion = useCallback(() => {
    setDebugExpressionOverride((value) => (value === "panic" ? "calm" : "panic"));
    pulseUi("emotion");
  }, [pulseUi]);
  const handleFlashWhite = useCallback(() => {
    triggerEffect("flash-white");
    pulseUi("ui");
  }, [pulseUi, triggerEffect]);
  const handleGoToMarker = useCallback((markerIndex: number) => {
    setIndex(markerIndex);
    setPhase("playing");
    setActivePanel(null);
    pulseUi("scene");
  }, [pulseUi, setActivePanel]);
  const handleLoadAndPlayBgm = useCallback((id: string) => {
    void loadAndPlayBgm(id);
  }, [loadAndPlayBgm]);

  return (
    <div id="app-root" className={[lowPerfMode ? "low-perf" : "", settings.highContrast ? "high-contrast" : "", settings.reducedMotion ? "reduced-motion" : "", settings.readableFont ? "readable-font" : ""].filter(Boolean).join(" ")}>
      {phase === "warning" && <WarningScene onContinue={() => setPhase("title")} />}

      {phase === "title" && (
        <TitleScene ready={titleReady}>
          <TitleLandingView
            titleBackgroundUrl={TITLE_SCREEN_BG}
            particlesEnabled={particlesEnabled}
            lowPerfMode={lowPerfMode}
            hasContinueSave={hasContinueSave}
            workspaceMode={workspaceMode}
            cornerImageUrl={CORNER_IMG_URL}
            onStartNewGame={handleStartNewGame}
            onContinueLastGame={continueLastGame}
            onOpenSettings={() => setActivePanel("settings")}
            onOpenExtras={() => setActivePanel("extras")}
            onOpenAssets={() => setActivePanel("assets")}
            onToggleWorkspaceMode={toggleWorkspaceMode}
            onOpenQa={() => {
              setShowQaPanel(true);
              setOpenQaIndex(null);
            }}
          />

          <TitleQaPanel
            items={QA_ITEMS}
            openIndex={openQaIndex}
            visible={showQaPanel}
            onToggle={(idx) => setOpenQaIndex((current) => (current === idx ? null : idx))}
            onClose={() => {
              setShowQaPanel(false);
              setOpenQaIndex(null);
            }}
          />

          <TitleSystemPanel
            title={activePanel === "settings" ? "设置" : activePanel === "extras" ? "鉴赏" : "资源管理"}
            visible={titlePanelOpen}
            onClose={() => setActivePanel(null)}
          >
            {activePanel === "settings" ? (
              <Suspense fallback={<div className="card">正在载入设置……</div>}><SettingsPanel settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} /></Suspense>
            ) : activePanel === "extras" ? (
              <Suspense fallback={<div className="card">正在整理回忆……</div>}>
                <ExtrasPanel
                  chapters={CHAPTERS}
                  cgs={CG_ENTRIES}
                  unlockedChapterIds={Array.from(storyState.unlockedChapterIds)}
                  unlockedCgIds={Array.from(storyState.unlockedCgIds)}
                  choices={storyState.routeState.choices}
                  editorMode={isEditorMode}
                  onStartChapter={handleStartChapter}
                  onOpenCg={handleOpenGalleryCg}
                />
              </Suspense>
            ) : (
              <Suspense fallback={<div className="card">正在载入资源库……</div>}><AssetsPanel {...assetsPanelProps} /></Suspense>
            )}
          </TitleSystemPanel>
        </TitleScene>
      )}

      {phase === "credits" && (
        <CreditsScene>
          <CreditsRollView
            creditsRollReady={creditsRollReady}
            titleBackgroundUrl={TITLE_SCREEN_BG}
            blocks={CREDITS_BLOCKS}
            onReturn={returnToTitle}
          />
        </CreditsScene>
      )}

      {phase === "playing" && (
        <PlayingScene className={`game-screen ${effectClasses} ${bgmMoodClass} ${curLine?.kind === "choice" ? "choice-active" : ""}`.trim()}>
          <div className={`bg-container ${transitionActive ? "cinematic" : ""}`}>
            {prevBgUrl && transitionActive && transitionType === "dissolve" && (
              <div className="bg-layer bg-prev bg-cinematic-prev" style={{ backgroundImage: `url("${prevBgUrl}")` }} />
            )}
            <div
              className={`bg-layer bg-current ${transitionActive && transitionType === "dissolve" ? "bg-dissolve-in bg-cinematic-next" : ""}`}
              style={{ backgroundImage: bgUrl ? `url("${bgUrl}")` : undefined }}
            />
          </div>

          <div className={`transition-overlay ${transitionActive ? `active ${transitionType}` : ""}`} />
          <div id="dim" />
          <RainCanvas active={showRain} lowPerfMode={lowPerfMode} />

          <StageSprites stageChars={stageChars} spriteReadyMap={spriteReadyMap} />

          <div id="fx" />

          {cgVisible && (
            <div className={`cg-overlay ${cgClosing ? "closing" : "showing"}`} onClick={() => closeCg(true)}>
              <div className="cg-stage">
                {cgMediaKind === "video" ? (
                  <video
                    ref={cgVideoRef}
                    className="cg-screen"
                    src={cgVideoUrl}
                    autoPlay
                    playsInline
                    controls={false}
                    muted={lowPerfMode}
                    onEnded={() => closeCg(true)}
                    onError={() => setCgMediaKind("image")}
                  />
                ) : (
                  <div className="cg-screen cg-art" style={{ backgroundImage: `url("${cgImageUrl}")` }} />
                )}
              </div>
            </div>
          )}

          <PlaybackControlBar
            hudAwake={hudAwake}
            activePanel={activePanel}
            showLog={showLog}
            auto={auto}
            skip={skip}
            bgmPlaying={bgmPlaying}
            bgmMuted={bgmMuted}
            isEditorMode={isEditorMode}
            canExportCode={canExportCode}
            codeTxtUrl={codeTxtUrl}
            onPrev={handlePrev}
            onNext={handleNext}
            onToggleAuto={handleToggleAuto}
            onToggleSkip={handleToggleSkip}
            onOpenLog={handleOpenLog}
            onTogglePanel={togglePanel}
            onToggleWorkspaceMode={toggleWorkspaceMode}
            onReturnTitle={handleReturnTitle}
            onExportCode={handleExportCode}
          />

          {activePanel && (
            <Suspense fallback={<div className="panel show"><div className="card">正在载入面板……</div></div>}><PlayingPanelsView
              activePanel={activePanel}
              isEditorMode={isEditorMode}
              settings={settings}
              currentIndex={index}
              currentScene={curLine?.scene}
              currentBgmName={currentBgmName}
              currentEffect={curLine?.effect}
              onSettingsChange={setSettings}
              onSettingsReset={handleResetSettings}
              assetsPanelProps={assetsPanelProps}
              selectedSaveSlot={selectedSaveSlot}
              onSelectedSaveSlotChange={setSelectedSaveSlot}
              onSaveCurrentSlot={handleSaveCurrentSlot}
              onUpdateContinue={handleUpdateContinue}
              saveSlots={saveSlots}
              getSavePreview={getSavePreview}
              onSelectSlot={setSelectedSaveSlot}
              onSaveSlot={handleSaveSlot}
              onLoadSlot={loadSaveSlot}
              onDeleteSlot={deleteSaveSlot}
              getSavedAtLabel={getSavedAtLabel}
              debugMarkers={debugMarkers}
              onJumpStart={handleJumpStart}
              onJumpRandom={handleJumpRandom}
              onTriggerCg={handleTriggerCg}
              onSwitchBg={handleSwitchBg}
              onSwitchEmotion={handleSwitchEmotion}
              onFlashWhite={handleFlashWhite}
              onGoToMarker={handleGoToMarker}
              debugPage={debugPage}
              debugPageCount={debugPageCount}
              debugCount={debugMarkers.length}
              onDebugPageChange={setDebugPage}
              bgmPlaying={bgmPlaying}
              bgmMuted={bgmMuted}
              currentBgmLabel={currentBgmLabel}
              currentBgmId={currentBgmId}
              bgmList={bgmList}
              onToggleBgm={toggleBgm}
              onStopBgm={stopBgm}
              onToggleMute={toggleMute}
              onLoadAndPlayBgm={handleLoadAndPlayBgm}
            /></Suspense>
          )}

          <DialogueHudView
            visible={Boolean(curLine)}
            canAdvance={!typing && curLine?.kind !== "choice"}
            isChoiceMode={curLine?.kind === "choice"}
            dialogueTone={dialogueTone}
            emphasisLine={emphasisLine}
            showName={showName}
            speaker={speaker}
            speakerColor={speakerColor}
            textVisible={textVisible}
            textStore={textStore}
            sceneProgress={sceneProgress}
            options={curLine?.options}
            getChoiceTone={getChoiceTone}
            getChoiceToneLabel={getChoiceToneLabel}
            onNext={handleNext}
            onChoice={handleChoice}
          />

          {showLog && <BacklogView visible log={log} choices={storyState.routeState.choices} onClose={handleCloseLog} />}
        </PlayingScene>
      )}

      <PresentationOverlays
        screenFlashVisible={screenFlashVisible}
        openingPreludeVisible={openingPreludeVisible}
        openingPreludeText={openingPreludeText}
        playingPhase={phase === "playing"}
      />
    </div>
  );
}

export function App() {
  return useVnRuntime();
}
