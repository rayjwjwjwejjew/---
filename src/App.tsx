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
import { queueImagePreload } from "./vnMedia";
import { CORNER_IMG_URL, CREDITS_BLOCKS, QA_ITEMS, TITLE_SCREEN_BG } from "./vnContent";
import { AssetsPanel, SettingsPanel } from "./vnPanels";
import { buildExportSourceFiles } from "./vnSourceBundle";
import { DustCanvas, RainCanvas, StageSprites } from "./vnVisuals";
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
  TitleScene,
  TitleSystemPanel,
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
  const [currentAct, setCurrentAct] = useState("");
  const [effectActive, setEffectActive] = useState("");
  const [showRain, setShowRain] = useState(false);
  const [sceneBlur, setSceneBlur] = useState(false);
  const [debugExpressionOverride, setDebugExpressionOverride] = useState<"calm" | "panic" | null>(null);
  const [lowPerfMode, setLowPerfMode] = useState(false);
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
    onAdvance: () => setIndex((value) => Math.min(SCRIPT.lines.length, value + 1)),
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
    onRestoreSession: ({ index: nextIndex, log: nextLog, act, bgmName }) => {
      setPhase("playing");
      setIndex(nextIndex);
      setLog(nextLog);
      setCurrentAct(act);
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
    onAdvance: () => setIndex((value) => Math.min(SCRIPT.lines.length, value + 1)),
    onBacktrack: (nextIndex) => setIndex(nextIndex),
    onJump: (nextIndex) => setIndex(nextIndex),
    onEnterCredits: () => setPhase("credits"),
    onAppendLog: (item) => setLog((prev) => [...prev, item].slice(-100)),
    onQuickSave: () => saveGame(selectedSaveSlot, false),
    onToggleLog: () => setShowLog((value) => !value),
    onCloseOverlays: () => {
      setActivePanel(null);
      setShowLog(false);
    },
  });
  const exportFiles = useMemo(() => buildExportSourceFiles(), []);
  const { codeTxtUrl, exportAllCodeTxt } = useCodeExportRuntime({ files: exportFiles });

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
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!isEditorMode && (activePanel === "assets" || activePanel === "debug")) {
      setActivePanel(null);
    }
  }, [activePanel, isEditorMode]);

  useEffect(() => {
    queueImagePreload(TITLE_SCREEN_BG);
    queueImagePreload(CORNER_IMG_URL);
  }, []);

  const triggerEffect = useCallback((effectName: string) => {
    if (!effectName || effectName === "none") return;
    setEffectActive(effectName);
    const timer = window.setTimeout(() => {
      setEffectActive("");
    }, effectName === "shake" ? 500 : 800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "playing" || !curLine) return;
    setShowRain(particlesEnabled && Boolean(curLine.scene?.includes("雨") || curLine.effect === "rain"));
    setSceneBlur(!lowPerfMode && Boolean(curLine.scene?.includes("梦境") || curLine.scene?.includes("回忆") || curLine.effect === "blur"));
    if (curLine.effect && !["rain", "blur", "none"].includes(curLine.effect)) {
      return triggerEffect(curLine.effect);
    }
    return undefined;
  }, [curLine, lowPerfMode, particlesEnabled, phase, triggerEffect]);

  useEffect(() => {
    if (phase !== "playing" || !curLine?.bgm) return;
    if (curLine.bgm === currentBgmName) return;
    const match = bgmList.find((item) => item.label.includes(curLine.bgm || ""));
    if (match) {
      void crossfadeBgm(match.id, match.label);
    } else {
      setCurrentBgmName(curLine.bgm);
    }
  }, [bgmList, crossfadeBgm, curLine, currentBgmName, phase]);

  useEffect(() => {
    if (phase !== "playing" || !curLine?.sfx) return;
    const match = sfxList.find((item) => item.label.includes(curLine.sfx || ""));
    if (match) {
      void playSfx(match.id);
    }
  }, [curLine, phase, playSfx, sfxList]);

  useEffect(() => {
    if (phase !== "playing" || !curLine) return;
    setCurrentAct(curLine.act);
  }, [curLine, phase]);

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
    onSetPhase: (nextPhase) => setPhase(nextPhase as GamePhase),
    onSetIndex: setIndex,
    onClearLog: () => setLog([]),
    onClearLastBackground: clearLastBackground,
    onClosePanels: () => {
      setActivePanel(null);
      setShowLog(false);
      setShowQaPanel(false);
      setOpenQaIndex(null);
    },
    onResetPresentationState: resetPresentationState,
    onStopBgm: stopBgm,
    onSetScreenFlashVisible: setScreenFlashVisible,
    onSetStartTransitioning: setStartTransitioning,
    onTriggerOpeningPrelude: triggerOpeningPrelude,
    onSetOpeningPreludeVisible: setOpeningPreludeVisible,
    onSetHudAwake: setHudAwake,
    onToggleWorkspaceMode: () => setWorkspaceMode((value) => (value === "editor" ? "player" : "editor")),
    onSetShowQaPanel: setShowQaPanel,
    onSetOpenQaIndex: setOpenQaIndex,
    onSetActivePanel: setActivePanel,
  });

  const effectClasses = [
    effectActive === "shake" ? "fx-shake" : "",
    effectActive === "flash-white" ? "fx-flash-white" : "",
    effectActive === "flash-red" ? "fx-flash-red" : "",
    effectActive === "darken" ? "fx-darken" : "",
    effectActive === "brighten" ? "fx-brighten" : "",
    sceneBlur ? "fx-scene-blur" : "",
  ]
    .filter(Boolean)
    .join(" ");

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

  return (
    <div id="app-root" className={lowPerfMode ? "low-perf" : ""}>
      {phase === "warning" && (
        <div id="warning-screen" onClick={() => setPhase("title")}>
          <div id="warning-content" onClick={(event) => event.stopPropagation()}>
            <div className="warning-badge">启动前提示</div>
            <div className="warning-title">请先确认内容提醒</div>
            <div id="warning-text">
              <p>本游戏包含悬疑、暴力暗示与心理惊悚内容，建议成年或有监护同意的玩家体验。</p>
              <p>故事涉及校园命案、创伤记忆与灵异叙事，请根据自己的接受程度决定是否继续。</p>
              <p>如果你已经了解这些内容，可以进入标题界面。</p>
            </div>
            <button id="warning-btn" onClick={() => setPhase("title")}>
              我已了解并继续
            </button>
          </div>
        </div>
      )}

      {phase === "title" && (
        <TitleScene ready={titleReady}>
          <div
            className="title-bg"
            style={{
              backgroundImage: `url("${TITLE_SCREEN_BG}")`,
              filter: "blur(4px)",
              transform: "scale(1.08)",
              opacity: 0.92,
            }}
          />
          <div
            className="title-overlay"
            style={{
              background:
                "linear-gradient(180deg, rgba(4,8,18,0.30) 0%, rgba(4,8,18,0.54) 52%, rgba(4,8,18,0.72) 100%)",
            }}
          />
          <div className="title-film title-film-top" />
          <div className="title-film title-film-bottom" />
          <div className="title-grid" />
          <div className="title-glow title-glow-left" />
          <div className="title-glow title-glow-right" />
          <div className="title-sweep" />
          <DustCanvas active={particlesEnabled} lowPerfMode={lowPerfMode} />

          <div className="title-content">
            <div className="title-kicker">悬疑视觉小说</div>
            <div className="title-logo">
              <div className="title-logo-core">
                <div className="title-main-glow">盛开在谎言之上</div>
                <div className="title-main">盛开在谎言之上</div>
                <div className="title-divider">
                  <span />
                </div>
                <div className="title-sub">——带你去极光尽头</div>
                <div className="title-copy">凡盛放者，皆有所葬</div>
              </div>
            </div>
            <div className="title-omen"></div>
            <div className="title-menu">
              <button className="title-btn" onClick={startNewGame}>
                <span className="title-btn-icon">▶</span>
                <span>开始游戏</span>
              </button>
              <button className="title-btn" onClick={continueLastGame} disabled={!hasContinueSave}>
                <span className="title-btn-icon">↻</span>
                <span>继续上次</span>
              </button>
              <button className="title-btn" onClick={() => setActivePanel("settings")}>
                <span className="title-btn-icon">⚙</span>
                <span>设置</span>
              </button>
              {workspaceMode === "editor" && (
                <button className="title-btn" onClick={() => setActivePanel("assets")}>
                  <span className="title-btn-icon">♫</span>
                  <span>资源管理</span>
                </button>
              )}
              <button className="title-btn" onClick={toggleWorkspaceMode}>
                <span className="title-btn-icon">{workspaceMode === "editor" ? "✦" : "✎"}</span>
                <span>{workspaceMode === "editor" ? "玩家模式" : "编辑器模式"}</span>
              </button>
            </div>
            <div className="title-footer">
              <span className="title-footer-line" />
              <span>按空格开始</span>
              <span className="title-footer-line" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowQaPanel(true);
              setOpenQaIndex(null);
            }}
            style={{
              position: "absolute",
              right: "220px",
              bottom: "120px",
              width: "240px",
              height: "240px",
              border: "none",
              padding: 0,
              background: "transparent",
              cursor: "pointer",
              zIndex: 30,
            }}
            aria-label="打开问答"
          >
            <img
              src={CORNER_IMG_URL}
              alt="问答入口"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.35))",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          </button>

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
              <AssetsPanel
                onUploadAsset={uploadAsset}
                sceneQuery={sceneQuery}
                onSceneQueryChange={setSceneQuery}
                selectedSceneName={selectedSceneName}
                onSelectedSceneNameChange={setSelectedSceneName}
                filteredScenes={filteredScenes}
                selectedBackgroundAssetId={selectedBackgroundAssetId}
                onSelectedBackgroundAssetIdChange={setSelectedBackgroundAssetId}
                backgroundAssetEntries={backgroundAssetEntries}
                customSceneBgUrl={customSceneBgUrl}
                onCustomSceneBgUrlChange={setCustomSceneBgUrl}
                onPreviewSceneBackground={previewSceneBackground}
                onApplySceneBackground={applySceneBackground}
                onBindSceneUrl={bindSceneUrl}
                onClearSceneBinding={clearSceneBinding}
                currentBindingText={
                  selectedSceneName && sceneBgOverrides[selectedSceneName]
                    ? `${sceneBgOverrides[selectedSceneName].source === "asset" ? "资源" : "URL"} · ${sceneBgOverrides[selectedSceneName].label}`
                    : "未绑定"
                }
                assetQuery={assetQuery}
                onAssetQueryChange={setAssetQuery}
                assetFilter={assetFilter}
                onAssetFilterChange={setAssetFilter}
                onBatchRename={batchRenameResources}
                bgmCount={bgmList.length}
                sfxCount={sfxList.length}
                resourceEntries={resourceEntries}
                filteredResources={filteredResources}
                onCopyResourceName={(value) => {
                  navigator.clipboard?.writeText(value).catch(() => undefined);
                  setAssetQuery(value);
                }}
                resourcePage={resourcePage}
                resourcePageCount={resourcePageCount}
                resourceCount={filteredResources.length}
                onResourcePageChange={setResourcePage}
              />
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
            codeTxtUrl={codeTxtUrl}
            onPrev={handlePrev}
            onNext={handleNext}
            onToggleAuto={() => {
              setAuto(!auto);
              setSkip(false);
            }}
            onToggleSkip={() => {
              setSkip(!skip);
              setAuto(false);
            }}
            onOpenLog={() => setShowLog(true)}
            onTogglePanel={togglePanel}
            onToggleWorkspaceMode={toggleWorkspaceMode}
            onReturnTitle={() => {
              returnToTitle();
              setAuto(false);
              setSkip(false);
            }}
            onExportCode={exportAllCodeTxt}
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
            onSettingsReset={() => setSettings(DEFAULT_SETTINGS)}
            onUploadAsset={uploadAsset}
            sceneQuery={sceneQuery}
            onSceneQueryChange={setSceneQuery}
            selectedSceneName={selectedSceneName}
            onSelectedSceneNameChange={setSelectedSceneName}
            filteredScenes={filteredScenes}
            selectedBackgroundAssetId={selectedBackgroundAssetId}
            onSelectedBackgroundAssetIdChange={setSelectedBackgroundAssetId}
            backgroundAssetEntries={backgroundAssetEntries}
            customSceneBgUrl={customSceneBgUrl}
            onCustomSceneBgUrlChange={setCustomSceneBgUrl}
            onPreviewSceneBackground={previewSceneBackground}
            onApplySceneBackground={applySceneBackground}
            onBindSceneUrl={bindSceneUrl}
            onClearSceneBinding={clearSceneBinding}
            currentBindingText={
              selectedSceneName && sceneBgOverrides[selectedSceneName]
                ? `${sceneBgOverrides[selectedSceneName].source === "asset" ? "资源" : "URL"} · ${sceneBgOverrides[selectedSceneName].label}`
                : "未绑定"
            }
            assetQuery={assetQuery}
            onAssetQueryChange={setAssetQuery}
            assetFilter={assetFilter}
            onAssetFilterChange={setAssetFilter}
            onBatchRename={batchRenameResources}
            bgmCount={bgmList.length}
            sfxCount={sfxList.length}
            resourceEntries={resourceEntries}
            filteredResources={filteredResources}
            onCopyResourceName={(value) => {
              navigator.clipboard?.writeText(value).catch(() => undefined);
              setAssetQuery(value);
            }}
            resourcePage={resourcePage}
            resourcePageCount={resourcePageCount}
            resourceCount={filteredResources.length}
            onResourcePageChange={setResourcePage}
            selectedSaveSlot={selectedSaveSlot}
            onSelectedSaveSlotChange={setSelectedSaveSlot}
            onSaveCurrentSlot={() => saveGame(selectedSaveSlot, true)}
            onUpdateContinue={() => saveGame(selectedSaveSlot, false)}
            saveSlots={saveSlots}
            getSavePreview={getSavePreview}
            onSelectSlot={setSelectedSaveSlot}
            onSaveSlot={(slotIndex) => saveGame(slotIndex, true)}
            onLoadSlot={loadSaveSlot}
            onDeleteSlot={deleteSaveSlot}
            getSavedAtLabel={getSavedAtLabel}
            debugMarkers={debugMarkers}
            onJumpStart={() => {
              setIndex(0);
              setPhase("playing");
              setActivePanel(null);
              pulseUi("scene");
            }}
            onJumpRandom={() => {
              const jump = debugMarkers[Math.floor(Math.random() * Math.max(1, debugMarkers.length))];
              if (jump) {
                setIndex(jump.idx);
                setPhase("playing");
                pulseUi("scene");
              }
            }}
            onTriggerCg={() => {
              if (!curLine) return;
              setCgImageUrl(bgUrl || DEFAULT_BG);
              setCgVisible(true);
              pulseUi("cg");
            }}
            onSwitchBg={() => {
              const nextBg = bgUrl === TITLE_SCREEN_BG ? resolveSceneBackground(curLine?.scene) : TITLE_SCREEN_BG;
              showImmediateBackground(nextBg);
              pulseUi("scene");
            }}
            onSwitchEmotion={() => {
              setDebugExpressionOverride((value) => (value === "panic" ? "calm" : "panic"));
              pulseUi("emotion");
            }}
            onFlashWhite={() => {
              triggerEffect("flash-white");
              pulseUi("ui");
            }}
            onGoToMarker={(idx) => {
              setIndex(idx);
              setPhase("playing");
              setActivePanel(null);
              pulseUi("scene");
            }}
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
            onLoadAndPlayBgm={(id) => void loadAndPlayBgm(id)}
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

          <BacklogView visible={showLog} log={log} onClose={() => setShowLog(false)} />
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
