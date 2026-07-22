import { useCallback, useEffect, useMemo, useState } from "react";
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
  readJson,
  STORAGE_KEYS,
  type Manifest,
  type SaveSlot,
  type Settings,
} from "./vnCore";
import { CORNER_IMG_URL, CREDITS_BLOCKS, QA_ITEMS, TITLE_SCREEN_BG } from "./vnContent";
import { AssetsPanel, SettingsPanel } from "./vnPanels";
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
  PlayingPanelsView,
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
  getCgCaption,
  getChoiceTone,
  getChoiceToneLabel,
  getDialogueTone,
  getSceneProgress,
  isEmphasisLine,
} from "./vnDerived";
type GamePhase = "warning" | "title" | "playing" | "credits";
type LogItem = { who: string; text: string };

const SCRIPT_SCENES = collectScriptScenes(SCRIPT.lines);

export function useVnRuntime() {
  const [index, setIndex] = useState(0);
  const [settings, setSettings] = useState<Settings>(() => readJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS));
  const [phase, setPhase] = useState<GamePhase>("warning");
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
    initialManifest: readJson<Manifest>(STORAGE_KEYS.manifest, {}),
  });
  const particlesEnabled = settings.particlesEnabled && !lowPerfMode;

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
  });
  const buildSnapshot = useCallback(
    () => buildSaveSnapshot(index, log, currentAct, currentBgmName, curLine, SCRIPT.lines.length),
    [currentAct, currentBgmName, curLine, index, log],
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
    onRestoreSession: ({ index: nextIndex, log: nextLog, bgmName }) => {
      setPhase("playing");
      setIndex(nextIndex);
      setLog(nextLog);
      setActivePanel(null);
      setShowLog(false);
      setAuto(false);
      setSkip(false);
      setCurrentBgmId("");
      setCurrentBgmName(bgmName);
    },
    onStopBgm: stopBgm,
    onLoadBgmById: loadAndPlayBgm,
    onResetPresentationState: resetPresentationState,
    pulseUi,
  });
  const handleBacktrack = useCallback((nextIndex: number) => setIndex(nextIndex), []);
  const handleJump = useCallback((nextIndex: number) => setIndex(nextIndex), []);
  const handleEnterCredits = useCallback(() => setPhase("credits"), []);
  const handleAppendLog = useCallback(
    (item: LogItem) => setLog((previous) => [...previous, item].slice(-100)),
    [],
  );
  const handleQuickSave = useCallback(
    () => saveGame(selectedSaveSlot, false),
    [saveGame, selectedSaveSlot],
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
    displayedText,
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
  const cgCaption = getCgCaption(currentAct, curLine);
  const sceneProgress = useMemo(() => getSceneProgress(index, SCRIPT.lines.length), [index]);
  const titlePanelOpen = useMemo(
    () => phase === "title" && (activePanel === "settings" || (isEditorMode && activePanel === "assets")),
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
  const handleReturnTitle = useCallback(() => {
    returnToTitle();
    setAuto(false);
    setSkip(false);
  }, [returnToTitle, setAuto, setSkip]);
  const handleExportCode = useCallback(() => {
    void exportAllCodeTxt();
  }, [exportAllCodeTxt]);
  const handleResetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), []);
  const handleSaveCurrentSlot = useCallback(
    () => saveGame(selectedSaveSlot, true),
    [saveGame, selectedSaveSlot],
  );
  const handleUpdateContinue = useCallback(
    () => saveGame(selectedSaveSlot, false),
    [saveGame, selectedSaveSlot],
  );
  const handleSaveSlot = useCallback((slotIndex: number) => saveGame(slotIndex, true), [saveGame]);
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
    <div id="app-root" className={lowPerfMode ? "low-perf" : ""}>
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
            onStartNewGame={startNewGame}
            onContinueLastGame={continueLastGame}
            onOpenSettings={() => setActivePanel("settings")}
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
            title={activePanel === "settings" ? "设置" : "资源管理"}
            visible={titlePanelOpen}
            onClose={() => setActivePanel(null)}
          >
            {activePanel === "settings" ? (
              <SettingsPanel settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} />
            ) : (
              <AssetsPanel {...assetsPanelProps} />
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
                {cgCaption && (
                  <div className={`cg-caption ${cgMediaKind === "video" ? "video" : "image"}`}>
                    <div className="cg-caption-label">{cgCaption.label}</div>
                    <div className="cg-caption-copy">{cgCaption.copy}</div>
                  </div>
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

          <PlayingPanelsView
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
          />

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
            displayedText={curLine?.kind === "choice" ? "请选择：" : displayedText}
            sceneProgress={sceneProgress}
            options={curLine?.options}
            getChoiceTone={getChoiceTone}
            getChoiceToneLabel={getChoiceToneLabel}
            onNext={handleNext}
            onChoice={handleChoice}
          />

          <BacklogView visible={showLog} log={log} onClose={handleCloseLog} />
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
