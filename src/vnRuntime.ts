import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssetDB } from "./db";
import { SCRIPT, getSceneCharacters } from "./engine";
import type { StageCharacter } from "./engine";
import { ensureImageReady, queueImagePreload } from "./vnMedia";
import { getBgmMoodClass, getCurrentBgmLabel } from "./vnDerived";
import type { Settings } from "./vnCore";

type AudioItem = { id: string; label: string };

type UseAudioRuntimeArgs = {
  settings: Settings;
  bgmList: AudioItem[];
};

type ScriptLine = (typeof SCRIPT.lines)[number];

type UseSceneRuntimeArgs = {
  index: number;
  line?: ScriptLine;
  phase: string;
  resolveSceneBackground: (scene: string | undefined) => string;
  debugExpressionOverride: "calm" | "panic" | null;
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

        if (bgmRef.current.src && bgmPlaying) {
          const oldAudio = bgmRef.current;
          const fadeOut = window.setInterval(() => {
            if (oldAudio.volume > 0.05) {
              oldAudio.volume = Math.max(0, oldAudio.volume - 0.05);
            } else {
              oldAudio.pause();
              window.clearInterval(fadeOut);
            }
          }, 50);
        }

        if (bgmUrlRef.current) URL.revokeObjectURL(bgmUrlRef.current);
        const url = URL.createObjectURL(blob);
        bgmUrlRef.current = url;

        bgmFadeRef.current.src = url;
        bgmFadeRef.current.volume = 0;
        bgmFadeRef.current.muted = bgmMuted;
        await bgmFadeRef.current.play().catch(() => undefined);

        const targetVol = settings.bgmVol / 100;
        const fadeIn = window.setInterval(() => {
          if (bgmFadeRef.current.volume < targetVol - 0.05) {
            bgmFadeRef.current.volume = Math.min(targetVol, bgmFadeRef.current.volume + 0.05);
          } else {
            bgmFadeRef.current.volume = targetVol;
            window.clearInterval(fadeIn);
          }
        }, 50);

        const temp = bgmRef.current;
        bgmRef.current = bgmFadeRef.current;
        bgmFadeRef.current = temp;
        setBgmPlaying(true);
        setCurrentBgmId(assetId);
        setCurrentBgmName(name);
      } catch {
        // ignore autoplay and blob issues
      }
    },
    [bgmMuted, bgmPlaying, settings.bgmVol],
  );

  const stopBgm = useCallback(() => {
    bgmRef.current.pause();
    bgmRef.current.currentTime = 0;
    if (bgmUrlRef.current) {
      URL.revokeObjectURL(bgmUrlRef.current);
      bgmUrlRef.current = "";
    }
    bgmRef.current.removeAttribute("src");
    setBgmPlaying(false);
    setCurrentBgmId("");
    setCurrentBgmName("");
  }, []);

  const loadAndPlayBgm = useCallback(
    async (assetId: string) => {
      if (!assetId) {
        stopBgm();
        return;
      }
      try {
        const blob = await AssetDB.get<Blob>(AssetDB.STORE_ASSETS, assetId);
        if (!blob) return;
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
    [bgmList, bgmMuted, settings.bgmVol, stopBgm],
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
    };
  }, []);

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
