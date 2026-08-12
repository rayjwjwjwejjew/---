import { memo, type ComponentProps } from "react";
import type { SaveSlot, Settings } from "./vnCore";
import { AssetsPanel, BgmPanel, DebugPanel, SavePanel, SettingsPanel } from "./vnPanels";

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

export default memo(function PlayingPanelsView(props: PlayingPanelsViewProps) {
  const {
    activePanel, isEditorMode, settings, currentIndex, currentScene, currentBgmName, currentEffect,
    onSettingsChange, onSettingsReset, assetsPanelProps, selectedSaveSlot, onSelectedSaveSlotChange,
    onSaveCurrentSlot, onUpdateContinue, saveSlots, getSavePreview, onSelectSlot, onSaveSlot, onLoadSlot,
    onDeleteSlot, getSavedAtLabel, debugMarkers, onJumpStart, onJumpRandom, onTriggerCg, onSwitchBg,
    onSwitchEmotion, onFlashWhite, onGoToMarker, debugPage, debugPageCount, debugCount, onDebugPageChange,
    bgmPlaying, bgmMuted, currentBgmLabel, currentBgmId, bgmList, onToggleBgm, onStopBgm, onToggleMute,
    onLoadAndPlayBgm,
  } = props;
  return (
    <>
      {isEditorMode && activePanel === "assets" && <div className="panel show"><AssetsPanel {...assetsPanelProps} /></div>}
      {activePanel === "save" && (
        <div className="panel show"><SavePanel
          selectedSaveSlot={selectedSaveSlot} onSelectedSaveSlotChange={onSelectedSaveSlotChange}
          onSaveCurrentSlot={onSaveCurrentSlot} onUpdateContinue={onUpdateContinue} saveSlots={saveSlots}
          getSavePreview={getSavePreview} onSelectSlot={onSelectSlot} onSaveSlot={onSaveSlot}
          onLoadSlot={onLoadSlot} onDeleteSlot={onDeleteSlot} getSavedAtLabel={getSavedAtLabel}
        /></div>
      )}
      {isEditorMode && activePanel === "debug" && (
        <div className="panel show"><DebugPanel
          debugMarkers={debugMarkers} onJumpStart={onJumpStart} onJumpRandom={onJumpRandom}
          onTriggerCg={onTriggerCg} onSwitchBg={onSwitchBg} onSwitchEmotion={onSwitchEmotion}
          onFlashWhite={onFlashWhite} onGoToMarker={onGoToMarker} debugPage={debugPage}
          debugPageCount={debugPageCount} debugCount={debugCount} onDebugPageChange={onDebugPageChange}
        /></div>
      )}
      {activePanel === "settings" && (
        <div className="panel show">
          <SettingsPanel settings={settings} onChange={onSettingsChange} onReset={onSettingsReset} />
          <div className="card">
            <div className="row"><span className="label">场景信息</span><span className="tiny mono">#{currentIndex} · {currentScene || "无场景标记"}</span></div>
            {currentBgmName && <div className="row"><span className="label">当前BGM</span><span className="tiny mono">{currentBgmName}</span></div>}
            {currentEffect && <div className="row"><span className="label">当前特效</span><span className="tiny mono">{currentEffect}</span></div>}
          </div>
        </div>
      )}
      {activePanel === "bgm" && (
        <div className="panel show"><BgmPanel
          bgmPlaying={bgmPlaying} bgmMuted={bgmMuted} currentBgmLabel={currentBgmLabel}
          currentBgmId={currentBgmId} bgmList={bgmList} bgmVol={settings.bgmVol} sfxVol={settings.sfxVol}
          onToggleBgm={onToggleBgm} onStopBgm={onStopBgm} onToggleMute={onToggleMute}
          onLoadAndPlayBgm={onLoadAndPlayBgm} onSettingsChange={onSettingsChange}
        /></div>
      )}
    </>
  );
});
