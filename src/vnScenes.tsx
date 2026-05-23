import type { ComponentProps, ReactNode } from "react";
import type { ChoiceTone } from "./vnDerived";
import type { SaveSlot, Settings } from "./vnCore";
import { AssetsPanel, BgmPanel, DebugPanel, SavePanel, SettingsPanel } from "./vnPanels";
import { DustCanvas } from "./vnVisuals";

type SceneShellProps = {
  id: string;
  className?: string;
  children: ReactNode;
};

export function SceneShell({ id, className, children }: SceneShellProps) {
  return (
    <div id={id} className={className}>
      {children}
    </div>
  );
}

type WarningSceneProps = {
  onContinue: () => void;
};

export function WarningScene({ onContinue }: WarningSceneProps) {
  return (
    <div id="warning-screen" onClick={onContinue}>
      <div id="warning-content" onClick={(event) => event.stopPropagation()}>
        <div className="warning-badge">启动前提示</div>
        <div className="warning-title">请先确认内容提醒</div>
        <div id="warning-text">
          <p>本游戏包含悬疑、暴力暗示与心理惊悚内容，建议成年或有监护同意的玩家体验。</p>
          <p>故事涉及校园命案、创伤记忆与灵异叙事，请根据自己的接受程度决定是否继续。</p>
          <p>如果你已经了解这些内容，可以进入标题界面。</p>
        </div>
        <button id="warning-btn" onClick={onContinue}>
          我已了解并继续
        </button>
      </div>
    </div>
  );
}

type TitleSceneProps = {
  ready: boolean;
  children: ReactNode;
};

export function TitleScene({ ready, children }: TitleSceneProps) {
  return (
    <SceneShell id="title-screen" className={ready ? "ready" : ""}>
      {children}
    </SceneShell>
  );
}

type TitleLandingViewProps = {
  titleBackgroundUrl: string;
  particlesEnabled: boolean;
  lowPerfMode: boolean;
  hasContinueSave: boolean;
  workspaceMode: "player" | "editor";
  cornerImageUrl: string;
  onStartNewGame: () => void;
  onContinueLastGame: () => void;
  onOpenSettings: () => void;
  onOpenAssets: () => void;
  onToggleWorkspaceMode: () => void;
  onOpenQa: () => void;
};

export function TitleLandingView({
  titleBackgroundUrl,
  particlesEnabled,
  lowPerfMode,
  hasContinueSave,
  workspaceMode,
  cornerImageUrl,
  onStartNewGame,
  onContinueLastGame,
  onOpenSettings,
  onOpenAssets,
  onToggleWorkspaceMode,
  onOpenQa,
}: TitleLandingViewProps) {
  return (
    <>
      <div
        className="title-bg"
        style={{
          backgroundImage: `url("${titleBackgroundUrl}")`,
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
          <button className="title-btn" onClick={onStartNewGame}>
            <span className="title-btn-icon">▶</span>
            <span>开始游戏</span>
          </button>
          <button className="title-btn" onClick={onContinueLastGame} disabled={!hasContinueSave}>
            <span className="title-btn-icon">↻</span>
            <span>继续上次</span>
          </button>
          <button className="title-btn" onClick={onOpenSettings}>
            <span className="title-btn-icon">⚙</span>
            <span>设置</span>
          </button>
          {workspaceMode === "editor" && (
            <button className="title-btn" onClick={onOpenAssets}>
              <span className="title-btn-icon">♫</span>
              <span>资源管理</span>
            </button>
          )}
          <button className="title-btn" onClick={onToggleWorkspaceMode}>
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
        onClick={onOpenQa}
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
          src={cornerImageUrl}
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
    </>
  );
}

type PlayingSceneProps = {
  className?: string;
  children: ReactNode;
};

export function PlayingScene({ className, children }: PlayingSceneProps) {
  return (
    <SceneShell id="app-playing-scene" className={className}>
      {children}
    </SceneShell>
  );
}

type CreditsSceneProps = {
  children: ReactNode;
};

export function CreditsScene({ children }: CreditsSceneProps) {
  return <SceneShell id="credits-screen" className="show">{children}</SceneShell>;
}

type QaItem = {
  q: string;
  a: string;
};

type TitleQaPanelProps = {
  items: QaItem[];
  openIndex: number | null;
  visible: boolean;
  onToggle: (index: number) => void;
  onClose: () => void;
};

export function TitleQaPanel({ items, openIndex, visible, onToggle, onClose }: TitleQaPanelProps) {
  if (!visible) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(560px, 92vw)",
          maxHeight: "80vh",
          overflowY: "auto",
          borderRadius: "24px",
          padding: "22px",
          background: "rgba(12,16,28,0.88)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "14px",
          }}
        >
          <div>
            <div style={{ fontSize: "12px", opacity: 0.7, letterSpacing: "0.12em" }}>Q&A</div>
            <div style={{ fontSize: "24px", fontWeight: 700 }}>制作问答</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              borderRadius: "12px",
              padding: "8px 12px",
              cursor: "pointer",
              background: "rgba(255,255,255,0.10)",
              color: "#fff",
            }}
          >
            关闭
          </button>
        </div>

        <div style={{ display: "grid", gap: "12px" }}>
          {items.map((item, idx) => {
            const opened = openIndex === idx;
            return (
              <div
                key={item.q}
                style={{
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggle(idx)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    color: "#fff",
                    padding: "16px 18px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: 600,
                  }}
                >
                  {item.q}
                </button>

                {opened && (
                  <div
                    style={{
                      padding: "0 18px 18px",
                      color: "rgba(255,255,255,0.86)",
                      lineHeight: 1.8,
                      fontSize: "15px",
                    }}
                  >
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type TitleSystemPanelProps = {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function TitleSystemPanel({ title, visible, onClose, children }: TitleSystemPanelProps) {
  if (!visible) return null;
  return (
    <div className="title-panel-overlay" onClick={onClose}>
      <div className="title-panel-shell" onClick={(event) => event.stopPropagation()}>
        <div className="title-panel-head">
          <div>
            <div className="title-panel-kicker">系统菜单</div>
            <div className="title-panel-title">{title}</div>
          </div>
          <button className="title-panel-close" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="title-panel-body">{children}</div>
      </div>
    </div>
  );
}

type CreditBlock = {
  role: string;
  names: string;
};

type CreditsRollViewProps = {
  creditsRollReady: boolean;
  titleBackgroundUrl: string;
  blocks: CreditBlock[];
  onReturn: () => void;
};

export function CreditsRollView({ creditsRollReady, titleBackgroundUrl, blocks, onReturn }: CreditsRollViewProps) {
  return (
    <>
      <div
        className="credits-bg"
        style={{
          backgroundImage: `url("${titleBackgroundUrl}")`,
          filter: "blur(4px)",
          transform: "scale(1.08)",
          opacity: 0.92,
        }}
      />
      <div
        className="credits-overlay"
        style={{
          background:
            "linear-gradient(180deg, rgba(4,8,18,0.30) 0%, rgba(4,8,18,0.54) 52%, rgba(4,8,18,0.72) 100%)",
        }}
      />
      <div className="credits-vignette" />
      <div className={`credits-fixed ${creditsRollReady ? "show" : ""}`}>
        <div className="credits-fixed-kicker">终幕</div>
        <div className="credits-fixed-title">盛开在谎言之上</div>
        <div className="credits-fixed-sub">——带你去极光尽头</div>
      </div>
      <div className={`credits-prelude ${creditsRollReady ? "fade" : ""}`}>
        <div className="credits-prelude-kicker">ENDING</div>
        <div className="credits-prelude-title">凡盛放者，皆有所葬</div>
        <div className="credits-prelude-copy">暮色落下之前，仍有人在谎言之上等待归途。</div>
      </div>
      <button className="btn credits-return" onClick={onReturn}>
        返回标题
      </button>
      <div id="credits-content" className={creditsRollReady ? "roll" : ""}>
        <div className="credit-kicker">END ROLL</div>
        <div className="credit-title">制作团队</div>
        <div className="credit-subtitle">一个关于真相、记忆与归途的故事。</div>
        {blocks.map((block) => (
          <div key={block.role} className="credit-card">
            <div className="credit-role">{block.role}</div>
            <div className="credit-name">{block.names}</div>
          </div>
        ))}
        <div className="credit-quote">
          “有些东西被挖出来，是为了继续被记住；
          <br />
          有些东西被埋回去，则是为了终于可以放下。”
        </div>
        <div className="credit-thanks">感谢游玩</div>
        <div className="credit-ending-copy">愿每一个在暮色中等待的人，最终都能回家。</div>
      </div>
    </>
  );
}

type PlaybackControlBarProps = {
  hudAwake: boolean;
  activePanel: string | null;
  showLog: boolean;
  auto: boolean;
  skip: boolean;
  bgmPlaying: boolean;
  bgmMuted: boolean;
  isEditorMode: boolean;
  codeTxtUrl: string;
  onPrev: () => void;
  onNext: () => void;
  onToggleAuto: () => void;
  onToggleSkip: () => void;
  onOpenLog: () => void;
  onTogglePanel: (name: string) => void;
  onToggleWorkspaceMode: () => void;
  onReturnTitle: () => void;
  onExportCode: () => void;
};

export function PlaybackControlBar({
  hudAwake,
  activePanel,
  showLog,
  auto,
  skip,
  bgmPlaying,
  bgmMuted,
  isEditorMode,
  codeTxtUrl,
  onPrev,
  onNext,
  onToggleAuto,
  onToggleSkip,
  onOpenLog,
  onTogglePanel,
  onToggleWorkspaceMode,
  onReturnTitle,
  onExportCode,
}: PlaybackControlBarProps) {
  return (
    <div id="panelBar" className={`${hudAwake || activePanel || showLog ? "awake" : ""} ${activePanel ? "panel-open" : ""}`.trim()}>
      <button className="pbtn" onClick={onPrev}>◀</button>
      <button className="pbtn" onClick={onNext}>▶</button>
      <button className="pbtn" aria-pressed={auto} onClick={onToggleAuto}>自动</button>
      <button className="pbtn" aria-pressed={skip} onClick={onToggleSkip}>跳过</button>
      <button className="pbtn" onClick={onOpenLog}>历史</button>
      <button className="pbtn" onClick={() => onTogglePanel("assets")}>资源</button>
      <button className="pbtn" onClick={() => onTogglePanel("settings")}>设置</button>
      <button className="pbtn" aria-pressed={activePanel === "bgm"} onClick={() => onTogglePanel("bgm")}>
        {bgmPlaying && !bgmMuted ? "♫" : "BGM"}
      </button>
      <button className="pbtn" onClick={() => onTogglePanel("save")}>存档槽</button>
      {isEditorMode && (
        <button className="pbtn" onClick={() => onTogglePanel("debug")}>调试</button>
      )}
      <button className="pbtn" onClick={onToggleWorkspaceMode}>
        {isEditorMode ? "玩家模式" : "编辑器"}
      </button>
      <button className="pbtn" onClick={onReturnTitle}>标题</button>
      <button className="pbtn" onClick={onExportCode}>代码</button>
      {codeTxtUrl && (
        <a className="pbtn" href={codeTxtUrl} download="VN_全部代码.txt" style={{ textDecoration: "none" }}>
          ⬇TXT
        </a>
      )}
    </div>
  );
}

type ChoiceOption = {
  text: string;
  cmd: string;
};

type DialogueHudViewProps = {
  visible: boolean;
  canAdvance: boolean;
  isChoiceMode: boolean;
  dialogueTone: string;
  emphasisLine: boolean;
  showName: boolean;
  speaker: string | undefined;
  speakerColor: string;
  textVisible: boolean;
  displayedText: string;
  sceneProgress: string;
  options?: ChoiceOption[];
  getChoiceTone: (text: string) => ChoiceTone;
  getChoiceToneLabel: (tone: ChoiceTone) => string;
  onNext: () => void;
  onChoice: (cmd: string) => void;
};

export function DialogueHudView({
  visible,
  canAdvance,
  isChoiceMode,
  dialogueTone,
  emphasisLine,
  showName,
  speaker,
  speakerColor,
  textVisible,
  displayedText,
  sceneProgress,
  options,
  getChoiceTone,
  getChoiceToneLabel,
  onNext,
  onChoice,
}: DialogueHudViewProps) {
  return (
    <div id="hud" style={{ display: visible ? "block" : "none" }}>
      <div
        id="box"
        className={`${canAdvance ? "can-advance" : ""} ${isChoiceMode ? "choice-mode" : ""} tone-${dialogueTone} ${emphasisLine ? "emphasis-line" : ""}`.trim()}
        onClick={() => {
          if (!options?.length) onNext();
        }}
      >
        <div id="name" style={{ display: showName ? "flex" : "none" }}>
          <span className="name-line-left" style={{ background: `linear-gradient(to right, transparent 0%, ${speakerColor} 100%)` }} />
          <span className="name-text-inner" style={{ color: speakerColor, borderColor: speakerColor.replace("0.95", "0.32") }}>
            <span>{speaker}</span>
          </span>
          <span className="name-line-right" style={{ background: `linear-gradient(to left, transparent 0%, ${speakerColor} 100%)` }} />
        </div>

        <div id="text" className={`${textVisible ? "show" : "text-exit"} tone-${dialogueTone} ${emphasisLine ? "emphasis-line" : ""}`.trim()}>
          {displayedText}
        </div>

        <div id="choices" className={isChoiceMode ? "show" : ""}>
          {isChoiceMode && <div className="choices-kicker">命运分歧</div>}
          {isChoiceMode &&
            options?.map((opt, idx) => {
              const choiceTone = getChoiceTone(opt.text);
              return (
                <button
                  key={`${opt.text}_${idx}`}
                  className={`choice choice-${choiceTone}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChoice(opt.cmd);
                  }}
                >
                  <span className="choice-tone-label">{getChoiceToneLabel(choiceTone)}</span>
                  <span>{opt.text}</span>
                </button>
              );
            })}
        </div>

        <div id="subline">
          <div className="right">
            <span className="story-meta-value">{sceneProgress}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type BacklogViewProps = {
  visible: boolean;
  log: { who: string; text: string }[];
  onClose: () => void;
};

export function BacklogView({ visible, log, onClose }: BacklogViewProps) {
  return (
    <div id="backlog" className={visible ? "show" : ""}>
      <div className="wrap">
        <div className="top">
          <div className="t">历史记录</div>
          <button className="btn" onClick={onClose}>关闭</button>
        </div>
        <div className="list">
          {log
            .slice()
            .reverse()
            .map((item, idx) => (
              <div key={`${item.who}_${idx}`} className="logItem">
                <div className="who">{item.who}</div>
                <div className="say">{item.text}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

type PresentationOverlaysProps = {
  screenFlashVisible: boolean;
  openingPreludeVisible: boolean;
  openingPreludeText: string;
  playingPhase: boolean;
};

export function PresentationOverlays({
  screenFlashVisible,
  openingPreludeVisible,
  openingPreludeText,
  playingPhase,
}: PresentationOverlaysProps) {
  return (
    <>
      <div className={`screen-flash ${screenFlashVisible ? "show start-flash" : ""}`}>
        <div className="screen-flash-title">盛开在谎言之上</div>
      </div>

      {openingPreludeVisible && playingPhase && (
        <div className="opening-prelude">
          <div className="opening-prelude-backdrop" />
          <div className="opening-prelude-inner">
            <div className="opening-prelude-kicker">OPENING</div>
            <div className="opening-prelude-title">{openingPreludeText}</div>
            <div className="opening-prelude-copy">黑场、字幕、环境音和轻微推进，正在把这一幕正式拉开。</div>
          </div>
        </div>
      )}
    </>
  );
}

type DebugMarker = {
  line: { kind: string; text?: string; name?: string; speaker?: string };
  idx: number;
};

type PlayingPanelsViewProps = {
  activePanel: string | null;
  isEditorMode: boolean;
  settings: Settings;
  currentIndex: number;
  currentScene?: string;
  currentBgmName: string;
  currentEffect?: string;
  onSettingsChange: (updater: (value: Settings) => Settings) => void;
  onSettingsReset: () => void;
  assetsPanelProps: ComponentProps<typeof AssetsPanel>;
  selectedSaveSlot: number;
  onSelectedSaveSlotChange: (value: number) => void;
  onSaveCurrentSlot: () => void;
  onUpdateContinue: () => void;
  saveSlots: Array<SaveSlot | null>;
  getSavePreview: (slot: SaveSlot | null, index: number) => { imageUrl: string; location: string; excerpt: string } | null;
  onSelectSlot: (value: number) => void;
  onSaveSlot: (value: number) => void;
  onLoadSlot: (value: number) => void;
  onDeleteSlot: (value: number) => void;
  getSavedAtLabel: (savedAt: string) => string;
  debugMarkers: DebugMarker[];
  onJumpStart: () => void;
  onJumpRandom: () => void;
  onTriggerCg: () => void;
  onSwitchBg: () => void;
  onSwitchEmotion: () => void;
  onFlashWhite: () => void;
  onGoToMarker: (idx: number) => void;
  debugPage: number;
  debugPageCount: number;
  debugCount: number;
  onDebugPageChange: (value: number) => void;
  bgmPlaying: boolean;
  bgmMuted: boolean;
  currentBgmLabel: string;
  currentBgmId: string;
  bgmList: { id: string; label: string }[];
  onToggleBgm: () => void;
  onStopBgm: () => void;
  onToggleMute: () => void;
  onLoadAndPlayBgm: (id: string) => void;
};

export function PlayingPanelsView({
  activePanel,
  isEditorMode,
  settings,
  currentIndex,
  currentScene,
  currentBgmName,
  currentEffect,
  onSettingsChange,
  onSettingsReset,
  assetsPanelProps,
  selectedSaveSlot,
  onSelectedSaveSlotChange,
  onSaveCurrentSlot,
  onUpdateContinue,
  saveSlots,
  getSavePreview,
  onSelectSlot,
  onSaveSlot,
  onLoadSlot,
  onDeleteSlot,
  getSavedAtLabel,
  debugMarkers,
  onJumpStart,
  onJumpRandom,
  onTriggerCg,
  onSwitchBg,
  onSwitchEmotion,
  onFlashWhite,
  onGoToMarker,
  debugPage,
  debugPageCount,
  debugCount,
  onDebugPageChange,
  bgmPlaying,
  bgmMuted,
  currentBgmLabel,
  currentBgmId,
  bgmList,
  onToggleBgm,
  onStopBgm,
  onToggleMute,
  onLoadAndPlayBgm,
}: PlayingPanelsViewProps) {
  return (
    <>
      {isEditorMode && activePanel === "assets" && (
        <div className="panel show">
          <AssetsPanel {...assetsPanelProps} />
        </div>
      )}

      {activePanel === "save" && (
        <div className="panel show">
          <SavePanel
            selectedSaveSlot={selectedSaveSlot}
            onSelectedSaveSlotChange={onSelectedSaveSlotChange}
            onSaveCurrentSlot={onSaveCurrentSlot}
            onUpdateContinue={onUpdateContinue}
            saveSlots={saveSlots}
            getSavePreview={getSavePreview}
            onSelectSlot={onSelectSlot}
            onSaveSlot={onSaveSlot}
            onLoadSlot={onLoadSlot}
            onDeleteSlot={onDeleteSlot}
            getSavedAtLabel={getSavedAtLabel}
          />
        </div>
      )}

      {isEditorMode && activePanel === "debug" && (
        <div className="panel show">
          <DebugPanel
            debugMarkers={debugMarkers}
            onJumpStart={onJumpStart}
            onJumpRandom={onJumpRandom}
            onTriggerCg={onTriggerCg}
            onSwitchBg={onSwitchBg}
            onSwitchEmotion={onSwitchEmotion}
            onFlashWhite={onFlashWhite}
            onGoToMarker={onGoToMarker}
            debugPage={debugPage}
            debugPageCount={debugPageCount}
            debugCount={debugCount}
            onDebugPageChange={onDebugPageChange}
          />
        </div>
      )}

      {activePanel === "settings" && (
        <div className="panel show">
          <SettingsPanel settings={settings} onChange={onSettingsChange} onReset={onSettingsReset} />
          <div className="card">
            <div className="row">
              <span className="label">场景信息</span>
              <span className="tiny mono">
                #{currentIndex} · {currentScene || "无场景标记"}
              </span>
            </div>
            {currentBgmName && (
              <div className="row">
                <span className="label">当前BGM</span>
                <span className="tiny mono">{currentBgmName}</span>
              </div>
            )}
            {currentEffect && (
              <div className="row">
                <span className="label">当前特效</span>
                <span className="tiny mono">{currentEffect}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {activePanel === "bgm" && (
        <div className="panel show">
          <BgmPanel
            bgmPlaying={bgmPlaying}
            bgmMuted={bgmMuted}
            currentBgmLabel={currentBgmLabel}
            currentBgmId={currentBgmId}
            bgmList={bgmList}
            bgmVol={settings.bgmVol}
            sfxVol={settings.sfxVol}
            onToggleBgm={onToggleBgm}
            onStopBgm={onStopBgm}
            onToggleMute={onToggleMute}
            onLoadAndPlayBgm={onLoadAndPlayBgm}
            onSettingsChange={onSettingsChange}
          />
        </div>
      )}
    </>
  );
}
