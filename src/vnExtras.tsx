import { getCgImage } from "./engine";
import type { CgEntry, ChapterEntry } from "./vnProgress";
import type { ChoiceRecord } from "./vnState";

type ExtrasPanelProps = {
  chapters: ChapterEntry[];
  cgs: CgEntry[];
  unlockedChapterIds: string[];
  unlockedCgIds: string[];
  choices: ChoiceRecord[];
  editorMode: boolean;
  onStartChapter: (entry: ChapterEntry) => void;
  onOpenCg: (entry: CgEntry) => void;
};

export default function ExtrasPanel({
  chapters,
  cgs,
  unlockedChapterIds,
  unlockedCgIds,
  choices,
  editorMode,
  onStartChapter,
  onOpenCg,
}: ExtrasPanelProps) {
  const chapterUnlocks = new Set(unlockedChapterIds);
  const cgUnlocks = new Set(unlockedCgIds);
  return (
    <div className="extras-grid">
      <section className="card extras-section">
        <div className="panel-title">章节选择</div>
        <div className="tiny">正常游玩会逐章解锁；回放不会覆盖主线存档。</div>
        <div className="extras-list">
          {chapters.map((chapter, index) => {
            const unlocked = editorMode || chapterUnlocks.has(chapter.chapterId);
            return (
              <button className="extras-item" key={chapter.chapterId} disabled={!unlocked} onClick={() => onStartChapter(chapter)}>
                <span className="mono">{String(index + 1).padStart(2, "0")}</span>
                <span>{unlocked ? chapter.title : "尚未解锁"}</span>
                <span className="tiny">{unlocked ? chapter.scene : "LOCKED"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card extras-section">
        <div className="panel-title">CG 图鉴</div>
        <div className="cg-gallery-grid">
          {cgs.map((cg) => {
            const unlocked = editorMode || cgUnlocks.has(cg.cgId);
            const image = unlocked ? getCgImage(cg.label, cg.scene) : "";
            return (
              <button className="cg-gallery-item" key={cg.cgId} disabled={!unlocked} onClick={() => onOpenCg(cg)}>
                <span className="cg-gallery-art" style={image ? { backgroundImage: `url("${image}")` } : undefined} />
                <span>{unlocked ? cg.label : "未解锁 CG"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card extras-section">
        <div className="panel-title">路线回忆</div>
        {choices.length === 0 && <div className="tiny">当前游玩还没有产生选择记录。</div>}
        <div className="extras-list">
          {choices.slice().reverse().map((choice) => (
            <div className="extras-choice" key={`${choice.choiceId}_${choice.at}`}>
              <span>{choice.text}</span>
              <span className="tiny mono">{new Date(choice.at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
