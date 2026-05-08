import type { AssetEntry, Manifest, SaveSlot, Settings } from "./vnCore";

export type ResourceEntry = { kind: keyof Manifest | "all"; id: string; label: string };

type SettingsPanelProps = {
  settings: Settings;
  onChange: (updater: (value: Settings) => Settings) => void;
  onReset: () => void;
};

type AssetsPanelProps = {
  onUploadAsset: (kind: "bg" | "sprite" | "video" | "bgm" | "sfx") => void;
  sceneQuery: string;
  onSceneQueryChange: (value: string) => void;
  selectedSceneName: string;
  onSelectedSceneNameChange: (value: string) => void;
  filteredScenes: string[];
  selectedBackgroundAssetId: string;
  onSelectedBackgroundAssetIdChange: (value: string) => void;
  backgroundAssetEntries: AssetEntry[];
  customSceneBgUrl: string;
  onCustomSceneBgUrlChange: (value: string) => void;
  onPreviewSceneBackground: (scene: string) => void;
  onApplySceneBackground: (scene: string, assetId: string | null) => void;
  onBindSceneUrl: (scene: string, url: string) => void;
  onClearSceneBinding: (scene: string) => void;
  currentBindingText: string;
  assetQuery: string;
  onAssetQueryChange: (value: string) => void;
  assetFilter: keyof Manifest | "all";
  onAssetFilterChange: (value: keyof Manifest | "all") => void;
  onBatchRename: () => void;
  bgmCount: number;
  sfxCount: number;
  resourceEntries: ResourceEntry[];
  filteredResources: ResourceEntry[];
  onCopyResourceName: (value: string) => void;
};

type SavePanelProps = {
  selectedSaveSlot: number;
  onSelectedSaveSlotChange: (value: number) => void;
  onSaveCurrentSlot: () => void;
  onUpdateContinue: () => void;
  saveSlots: Array<SaveSlot | null>;
  onSelectSlot: (value: number) => void;
  onSaveSlot: (value: number) => void;
  onLoadSlot: (value: number) => void;
  onDeleteSlot: (value: number) => void;
  getSavedAtLabel: (savedAt: string) => string;
};

export function SettingsPanel({ settings, onChange, onReset }: SettingsPanelProps) {
  return (
    <div className="card">
      <div className="row">
        <span className="label">文字速度</span>
        <input type="range" min="0" max="60" value={settings.typeMs} onChange={(e) => onChange((s) => ({ ...s, typeMs: Number(e.target.value) }))} />
        <span className="tiny mono">{settings.typeMs}ms</span>
      </div>
      <div className="row">
        <span className="label">自动间隔</span>
        <input type="range" min="180" max="2200" step="20" value={settings.autoMs} onChange={(e) => onChange((s) => ({ ...s, autoMs: Number(e.target.value) }))} />
        <span className="tiny mono">{settings.autoMs}ms</span>
      </div>
      <div className="row">
        <span className="label">屏幕暗度</span>
        <input type="range" min="0" max="40" value={settings.dim} onChange={(e) => onChange((s) => ({ ...s, dim: Number(e.target.value) }))} />
        <span className="tiny mono">{settings.dim}%</span>
      </div>
      <div className="row">
        <span className="label">立绘尺寸</span>
        <input type="range" min="140" max="420" step="10" value={settings.spriteW} onChange={(e) => onChange((s) => ({ ...s, spriteW: Number(e.target.value) }))} />
        <span className="tiny mono">{settings.spriteW}px</span>
      </div>
      <div className="row">
        <span className="label">立绘透明度</span>
        <input type="range" min="0" max="100" value={settings.spriteOpacity} onChange={(e) => onChange((s) => ({ ...s, spriteOpacity: Number(e.target.value) }))} />
        <span className="tiny mono">{settings.spriteOpacity}%</span>
      </div>
      <div className="row">
        <span className="label">背景缩放</span>
        <input type="range" min="100" max="150" value={settings.bgScale} onChange={(e) => onChange((s) => ({ ...s, bgScale: Number(e.target.value) }))} />
        <span className="tiny mono">{settings.bgScale}%</span>
      </div>
      <div className="row">
        <span className="label">对话层透明</span>
        <input type="range" min="0" max="100" value={settings.uiAlpha} onChange={(e) => onChange((s) => ({ ...s, uiAlpha: Number(e.target.value) }))} />
        <span className="tiny mono">{settings.uiAlpha}%</span>
      </div>
      <div className="row">
        <button className="btn" onClick={onReset}>
          恢复默认
        </button>
        <span className="tiny">标题页只预览配置，开始游戏后仍可在左上角继续调整。</span>
      </div>
    </div>
  );
}

export function AssetsPanel({
  onUploadAsset,
  sceneQuery,
  onSceneQueryChange,
  selectedSceneName,
  onSelectedSceneNameChange,
  filteredScenes,
  selectedBackgroundAssetId,
  onSelectedBackgroundAssetIdChange,
  backgroundAssetEntries,
  customSceneBgUrl,
  onCustomSceneBgUrlChange,
  onPreviewSceneBackground,
  onApplySceneBackground,
  onBindSceneUrl,
  onClearSceneBinding,
  currentBindingText,
  assetQuery,
  onAssetQueryChange,
  assetFilter,
  onAssetFilterChange,
  onBatchRename,
  bgmCount,
  sfxCount,
  resourceEntries,
  filteredResources,
  onCopyResourceName,
}: AssetsPanelProps) {
  return (
    <>
      <div className="card">
        <div className="row">
          <button className="btn" onClick={() => onUploadAsset("bg")}>上传背景</button>
          <button className="btn" onClick={() => onUploadAsset("sprite")}>上传立绘</button>
          <button className="btn" onClick={() => onUploadAsset("video")}>上传视频CG</button>
          <button className="btn" onClick={() => onUploadAsset("bgm")}>上传BGM</button>
          <button className="btn" onClick={() => onUploadAsset("sfx")}>上传音效</button>
        </div>
        <div className="tiny">资源会保存在浏览器本地（IndexedDB）。</div>
        <div className="tiny" style={{ marginTop: 6 }}>TXT 导出会按原始路径完整输出源码；PDF 导出已移除。</div>
      </div>
      <div className="card">
        <div className="panel-title">场景选择器</div>
        <div className="row">
          <span className="label">场景搜索</span>
          <input value={sceneQuery} onChange={(e) => onSceneQueryChange(e.target.value)} placeholder="输入场景名" />
        </div>
        <div className="row">
          <span className="label">目标场景</span>
          <select value={selectedSceneName} onChange={(e) => onSelectedSceneNameChange(e.target.value)}>
            <option value="">-- 选择场景 --</option>
            {filteredScenes.slice(0, 80).map((scene) => (
              <option key={scene} value={scene}>{scene}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <span className="label">背景资源</span>
          <select value={selectedBackgroundAssetId} onChange={(e) => onSelectedBackgroundAssetIdChange(e.target.value)}>
            <option value="">-- 选择上传背景 --</option>
            {backgroundAssetEntries.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <span className="label">自定义 URL</span>
          <input value={customSceneBgUrl} onChange={(e) => onCustomSceneBgUrlChange(e.target.value)} placeholder="https://..." />
        </div>
        <div className="row">
          <button className="btn" disabled={!selectedSceneName} onClick={() => onPreviewSceneBackground(selectedSceneName)}>预览默认背景</button>
          <button className="btn" disabled={!selectedSceneName || !selectedBackgroundAssetId} onClick={() => onApplySceneBackground(selectedSceneName, selectedBackgroundAssetId || null)}>绑定上传背景</button>
          <button className="btn" disabled={!selectedSceneName || !customSceneBgUrl.trim()} onClick={() => onBindSceneUrl(selectedSceneName, customSceneBgUrl.trim())}>绑定 URL</button>
          <button className="btn" disabled={!selectedSceneName} onClick={() => onClearSceneBinding(selectedSceneName)}>清除绑定</button>
        </div>
        <div className="tiny">当前绑定：{currentBindingText}</div>
        <div className="tiny">选场景后，可以把上传背景或自定义 URL 绑定到对应剧情段，再一键预览。</div>
      </div>
      <div className="card">
        <div className="row">
          <span className="label">搜索资源</span>
          <input value={assetQuery} onChange={(e) => onAssetQueryChange(e.target.value)} placeholder="输入文件名或标签" />
        </div>
        <div className="row">
          {(["all", "backgrounds", "sprite", "video", "bgm", "sfx"] as const).map((kind) => (
            <button key={kind} className="btn" aria-pressed={assetFilter === kind} onClick={() => onAssetFilterChange(kind)}>
              {kind === "all" ? "全部" : kind}
            </button>
          ))}
          <button className="btn" onClick={onBatchRename}>批量改名</button>
        </div>
        <div className="tiny">过滤后仅显示符合条件的资源，方便你快速查找。</div>
      </div>
      <div className="card">
        <div className="row">
          <span className="label">已上传BGM</span>
          <span className="tiny mono">{bgmCount}</span>
        </div>
        <div className="row">
          <span className="label">已上传音效</span>
          <span className="tiny mono">{sfxCount}</span>
        </div>
        <div className="row">
          <span className="label">资源总数</span>
          <span className="tiny mono">{filteredResources.length}/{resourceEntries.length}</span>
        </div>
        <div className="tiny">建议文件名包含脚本关键词，便于自动匹配。</div>
      </div>
      <div className="card">
        <div className="panel-title">资源列表</div>
        <div className="resource-list">
          {filteredResources.length === 0 && <div className="tiny">没有符合条件的资源。</div>}
          {filteredResources.slice(0, 24).map((item) => (
            <div key={`${item.kind}_${item.id}`} className="resource-item">
              <div>
                <div className="resource-name">{item.label}</div>
                <div className="tiny mono">{item.kind} · {item.id}</div>
              </div>
              <button className="btn" onClick={() => onCopyResourceName(item.label)}>复制名</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function SavePanel({
  selectedSaveSlot,
  onSelectedSaveSlotChange,
  onSaveCurrentSlot,
  onUpdateContinue,
  saveSlots,
  onSelectSlot,
  onSaveSlot,
  onLoadSlot,
  onDeleteSlot,
  getSavedAtLabel,
}: SavePanelProps) {
  return (
    <>
      <div className="card">
        <div className="row">
          <span className="label">当前槽位</span>
          <select value={selectedSaveSlot} onChange={(e) => onSelectedSaveSlotChange(Number(e.target.value))}>
            {Array.from({ length: saveSlots.length }, (_, idx) => (
              <option key={idx} value={idx}>槽位 {idx + 1}</option>
            ))}
          </select>
          <button className="btn" onClick={onSaveCurrentSlot}>存到当前槽</button>
          <button className="btn" onClick={onUpdateContinue}>仅更新继续</button>
        </div>
        <div className="tiny">`仅更新继续` 会保留多槽存档，同时刷新标题页的“继续上次”。</div>
      </div>
      <div className="save-grid">
        {saveSlots.map((slot, idx) => (
          <div key={idx} className={`save-slot ${selectedSaveSlot === idx ? "selected" : ""}`}>
            <div className="row save-slot-top">
              <span className="label">槽位 {idx + 1}</span>
              <span className="tiny mono">{slot ? slot.progress : "空槽"}</span>
            </div>
            <div className="tiny">{slot ? slot.act || "未命名章节" : "尚未存档"}</div>
            <div className="tiny">{slot ? `${slot.speaker || "旁白"} · ${slot.text || "……"}` : "点击保存后会写入这一格"}</div>
            <div className="tiny mono">{slot ? getSavedAtLabel(slot.savedAt) : "—"}</div>
            <div className="row">
              <button className="btn" onClick={() => onSelectSlot(idx)}>选中</button>
              <button className="btn" onClick={() => onSaveSlot(idx)}>保存</button>
              <button className="btn" onClick={() => onLoadSlot(idx)} disabled={!slot}>读取</button>
              <button className="btn" onClick={() => onDeleteSlot(idx)} disabled={!slot}>删除</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
