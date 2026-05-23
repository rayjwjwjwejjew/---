import type { ReactNode } from "react";

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
