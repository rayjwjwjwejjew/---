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
