import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssetDB } from "./db";
import { DEFAULT_BG, SCRIPT, getSceneBg, getSceneCharacters, getSpecialBg } from "./engine";
import type { StageCharacter } from "./engine";
import { ensureImageReady, queueImagePreload } from "./vnMedia";
import { findBestAssetMatch, getBgmMoodClass, getCurrentBgmLabel } from "./vnDerived";
import {
  readSceneBgOverrides,
  type Manifest,
  type SceneBgOverride,
  type Settings,
  writeSceneBgOverrides,
} from "./vnCore";

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

type UseBackgroundRuntimeArgs = {
  manifestState: Manifest;
  index: number;
  line?: ScriptLine;
  phase: string;
  lowPerfMode: boolean;
  pulseUi: (_layer?: string) => void;
};

type UsePresentationRuntimeArgs = {
  index: number;
  line?: ScriptLine;
  phase: string;
  bgUrl: string;
  videoManifest?: { id: string; label: string }[];
  resolveSceneBackground: (scene: string | undefined) => string;
  lowPerfMode: boolean;
  pulseUi: (_layer?: string) => void;
  onAdvance: () => void;
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

export function useBackgroundRuntime({
  manifestState,
  index,
  line,
  phase,
  lowPerfMode,
  pulseUi,
}: UseBackgroundRuntimeArgs) {
  const [bgUrl, setBgUrl] = useState<string>(DEFAULT_BG);
  const [prevBgUrl, setPrevBgUrl] = useState<string>("");
  const [transitionActive, setTransitionActive] = useState(false);
  const [transitionType, setTransitionType] = useState("fade-black");
  const [sceneBgOverrides, setSceneBgOverrides] = useState<Record<string, SceneBgOverride>>(() => readSceneBgOverrides());
  const [selectedSceneName, setSelectedSceneName] = useState("");
  const [selectedBackgroundAssetId, setSelectedBackgroundAssetId] = useState("");
  const [customSceneBgUrl, setCustomSceneBgUrl] = useState("");

  const lastBgRef = useRef("");
  const bgAssetUrlCacheRef = useRef<Record<string, string>>({});

  const ensureBackgroundAssetUrl = useCallback(async (assetId: string) => {
    const cached = bgAssetUrlCacheRef.current[assetId];
    if (cached) return cached;
    const blob = await AssetDB.get<Blob>(AssetDB.STORE_ASSETS, assetId);
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    bgAssetUrlCacheRef.current[assetId] = url;
    return url;
  }, []);

  const getBackgroundAssetLabel = useCallback(
    (assetId: string) => {
      return (
        manifestState.backgrounds?.find((item) => item.id === assetId)?.label ||
        manifestState.bg?.find((item) => item.id === assetId)?.label ||
        assetId
      );
    },
    [manifestState.backgrounds, manifestState.bg],
  );

  const resolveSceneBackground = useCallback(
    (scene: string | undefined) => {
      if (!scene) return DEFAULT_BG;
      const override = sceneBgOverrides[scene];
      if (override?.source === "url" && override.value) return override.value;
      if (override?.source === "asset" && bgAssetUrlCacheRef.current[override.value]) {
        return bgAssetUrlCacheRef.current[override.value];
      }
      return getSceneBg(scene) || DEFAULT_BG;
    },
    [sceneBgOverrides],
  );

  const applySceneBackground = useCallback(
    async (scene: string, assetId: string | null) => {
      const nextOverrides = { ...sceneBgOverrides };
      if (!assetId) {
        delete nextOverrides[scene];
        setSceneBgOverrides(nextOverrides);
        writeSceneBgOverrides(nextOverrides);
        return;
      }
      nextOverrides[scene] = { source: "asset", value: assetId, label: getBackgroundAssetLabel(assetId) };
      setSceneBgOverrides(nextOverrides);
      writeSceneBgOverrides(nextOverrides);
      if (scene === line?.scene) {
        const url = await ensureBackgroundAssetUrl(assetId);
        if (url) {
          setBgUrl(url);
          lastBgRef.current = url;
          pulseUi("scene");
        }
      }
    },
    [ensureBackgroundAssetUrl, getBackgroundAssetLabel, line?.scene, pulseUi, sceneBgOverrides],
  );

  const previewSceneBackground = useCallback(
    async (scene: string, assetId?: string | null) => {
      const override = sceneBgOverrides[scene];
      if (assetId) {
        const url = await ensureBackgroundAssetUrl(assetId);
        if (url) {
          setBgUrl(url);
          lastBgRef.current = url;
          pulseUi("scene");
        }
        return;
      }
      if (override?.source === "asset") {
        const url = await ensureBackgroundAssetUrl(override.value);
        if (url) {
          setBgUrl(url);
          lastBgRef.current = url;
          pulseUi("scene");
        }
        return;
      }
      const builtIn = getSceneBg(scene) || DEFAULT_BG;
      setBgUrl(builtIn);
      lastBgRef.current = builtIn;
      pulseUi("scene");
    },
    [ensureBackgroundAssetUrl, pulseUi, sceneBgOverrides],
  );

  const bindSceneUrl = useCallback(
    (scene: string, url: string) => {
      const nextOverrides: Record<string, SceneBgOverride> = {
        ...sceneBgOverrides,
        [scene]: { source: "url", value: url, label: url },
      };
      setSceneBgOverrides(nextOverrides);
      writeSceneBgOverrides(nextOverrides);
      setBgUrl(url);
      lastBgRef.current = url;
      pulseUi("scene");
    },
    [pulseUi, sceneBgOverrides],
  );

  const clearSceneBinding = useCallback(
    (scene: string) => {
      void applySceneBackground(scene, null);
      if (selectedSceneName === scene) {
        setCustomSceneBgUrl("");
        setSelectedBackgroundAssetId("");
      }
    },
    [applySceneBackground, selectedSceneName],
  );

  useEffect(() => {
    if (!selectedSceneName) {
      const initialScene = line?.scene || SCRIPT.lines[0]?.scene || "";
      setSelectedSceneName(initialScene);
      const initialOverride = sceneBgOverrides[initialScene];
      setCustomSceneBgUrl(initialOverride?.source === "url" ? initialOverride.value : "");
      setSelectedBackgroundAssetId(initialOverride?.source === "asset" ? initialOverride.value : "");
    }
  }, [line?.scene, sceneBgOverrides, selectedSceneName]);

  useEffect(() => {
    if (!selectedSceneName) return;
    const override = sceneBgOverrides[selectedSceneName];
    setCustomSceneBgUrl(override?.source === "url" ? override.value : "");
    setSelectedBackgroundAssetId(override?.source === "asset" ? override.value : "");
  }, [sceneBgOverrides, selectedSceneName]);

  useEffect(() => {
    if (phase !== "playing" || !line) return;
    let nextBg = resolveSceneBackground(line.scene);
    const special = getSpecialBg(index);
    if (special) {
      nextBg = special;
    }

    const override = line.scene ? sceneBgOverrides[line.scene] : undefined;
    const loadAssetBg = async () => {
      if (override?.source !== "asset") return nextBg;
      const url = await ensureBackgroundAssetUrl(override.value);
      return url || nextBg;
    };

    if (nextBg !== lastBgRef.current) {
      let cancelled = false;
      let clearTimer: number | null = null;
      const nextTransition = isKeySceneTransition(line) ? line.transition || "dissolve" : "cut";
      const currentBg = bgUrl || lastBgRef.current || DEFAULT_BG;
      const shouldAnimateTransition = !lowPerfMode && nextTransition !== "cut";

      if (shouldAnimateTransition) {
        setPrevBgUrl(currentBg);
        setTransitionType(nextTransition);
        setTransitionActive(true);
      } else {
        setPrevBgUrl("");
        setTransitionActive(false);
      }
      pulseUi("scene");

      void loadAssetBg()
        .then((resolvedBg) => ensureImageReady(resolvedBg).then(() => resolvedBg))
        .catch(() => nextBg)
        .then((resolvedBg) => {
          if (cancelled) return;
          setBgUrl(resolvedBg);
          lastBgRef.current = resolvedBg;
          if (!shouldAnimateTransition) return;
          clearTimer = window.setTimeout(() => {
            if (!cancelled) {
              setTransitionActive(false);
            }
          }, nextTransition === "dissolve" ? 620 : 820);
        });

      return () => {
        cancelled = true;
        if (clearTimer) window.clearTimeout(clearTimer);
      };
    }
    return undefined;
  }, [bgUrl, ensureBackgroundAssetUrl, index, line, lowPerfMode, phase, pulseUi, resolveSceneBackground, sceneBgOverrides]);

  useEffect(() => {
    return () => {
      Object.values(bgAssetUrlCacheRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const clearLastBackground = useCallback(() => {
    lastBgRef.current = "";
  }, []);

  const showImmediateBackground = useCallback((url: string) => {
    setBgUrl(url);
    lastBgRef.current = url;
  }, []);

  return {
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
  };
}

export function usePresentationRuntime({
  index,
  line,
  phase,
  bgUrl,
  videoManifest,
  resolveSceneBackground,
  lowPerfMode,
  pulseUi,
  onAdvance,
}: UsePresentationRuntimeArgs) {
  const [cgVisible, setCgVisible] = useState(false);
  const [cgClosing, setCgClosing] = useState(false);
  const [cgMediaKind, setCgMediaKind] = useState<"image" | "video">("image");
  const [cgImageUrl, setCgImageUrl] = useState("");
  const [cgVideoUrl, setCgVideoUrl] = useState("");
  const [startTransitioning, setStartTransitioning] = useState(false);
  const [screenFlashVisible, setScreenFlashVisible] = useState(false);
  const [creditsRollReady, setCreditsRollReady] = useState(false);
  const [openingPreludeVisible, setOpeningPreludeVisible] = useState(false);
  const [openingPreludeText, setOpeningPreludeText] = useState("第一幕 · 正在展开");

  const cgVideoUrlRef = useRef("");
  const cgVideoRef = useRef<HTMLVideoElement>(null);
  const cgCloseTimerRef = useRef<number | null>(null);
  const preludeTimerRef = useRef<number | null>(null);
  const cgSeenRef = useRef("");

  useEffect(() => {
    if (phase !== "credits") {
      setCreditsRollReady(false);
      return;
    }
    setCreditsRollReady(false);
    const timer = window.setTimeout(() => setCreditsRollReady(true), lowPerfMode ? 900 : 1600);
    return () => window.clearTimeout(timer);
  }, [lowPerfMode, phase]);

  useEffect(() => {
    if (cgCloseTimerRef.current) {
      window.clearTimeout(cgCloseTimerRef.current);
      cgCloseTimerRef.current = null;
    }
    if (phase !== "playing" || !line?.cg || cgVisible) return;
    const cgKey = `${index}:${line.cg}`;
    if (cgSeenRef.current === cgKey) return;
    let cancelled = false;
    const posterUrl = resolveSceneBackground(line.scene) || bgUrl || DEFAULT_BG;
    pulseUi("cg");

    const openCgWithPoster = () => {
      void ensureImageReady(posterUrl).then(() => {
        if (cancelled) return;
        if (cgVideoUrlRef.current) {
          URL.revokeObjectURL(cgVideoUrlRef.current);
          cgVideoUrlRef.current = "";
        }
        setCgMediaKind("image");
        setCgVideoUrl("");
        setCgImageUrl(posterUrl);
        setCgClosing(false);
        setCgVisible(true);
        cgSeenRef.current = cgKey;
        setOpeningPreludeVisible(false);
      });
    };

    const videoMatch = findBestAssetMatch(videoManifest, [line.cg, line.scene || "", "cg", "视频"]);
    if (videoMatch) {
      void AssetDB.get<Blob>(AssetDB.STORE_ASSETS, videoMatch.id)
        .then((blob) => {
          if (!blob || cancelled) return null;
          const url = URL.createObjectURL(blob);
          if (cgVideoUrlRef.current) {
            URL.revokeObjectURL(cgVideoUrlRef.current);
          }
          cgVideoUrlRef.current = url;
          return url;
        })
        .then((url) => {
          if (!url || cancelled) {
            openCgWithPoster();
            return;
          }
          void ensureImageReady(posterUrl).then(() => {
            if (cancelled) return;
            setCgMediaKind("video");
            setCgVideoUrl(url);
            setCgImageUrl(posterUrl);
            setCgClosing(false);
            setCgVisible(true);
            cgSeenRef.current = cgKey;
            setOpeningPreludeVisible(false);
          });
        })
        .catch(() => {
          openCgWithPoster();
        });
      return () => {
        cancelled = true;
      };
    }

    openCgWithPoster();
    return () => {
      cancelled = true;
    };
  }, [bgUrl, cgVisible, index, line, phase, pulseUi, resolveSceneBackground, videoManifest]);

  useEffect(() => {
    if (!cgVisible || cgMediaKind !== "video") return;
    const video = cgVideoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => undefined);
  }, [cgMediaKind, cgVisible, cgVideoUrl]);

  const closeCg = useCallback((advance = false) => {
    if (!cgVisible) return;
    cgSeenRef.current = `${index}:${line?.cg || ""}`;
    setCgClosing(true);
    pulseUi("cg");
    if (cgCloseTimerRef.current) window.clearTimeout(cgCloseTimerRef.current);
    cgCloseTimerRef.current = window.setTimeout(() => {
      if (cgVideoUrlRef.current) {
        URL.revokeObjectURL(cgVideoUrlRef.current);
        cgVideoUrlRef.current = "";
      }
      setCgVisible(false);
      setCgClosing(false);
      setCgMediaKind("image");
      setCgVideoUrl("");
      if (advance && phase === "playing") {
        onAdvance();
      }
      cgCloseTimerRef.current = null;
    }, 240);
  }, [cgVisible, index, line?.cg, onAdvance, phase, pulseUi]);

  const triggerOpeningPrelude = useCallback((text: string) => {
    if (preludeTimerRef.current) window.clearTimeout(preludeTimerRef.current);
    setOpeningPreludeText(text);
    setOpeningPreludeVisible(true);
    preludeTimerRef.current = window.setTimeout(() => {
      setOpeningPreludeVisible(false);
      preludeTimerRef.current = null;
    }, 1500);
  }, []);

  const resetPresentationState = useCallback(() => {
    setOpeningPreludeVisible(false);
    setCgClosing(false);
    setCgMediaKind("image");
    setCgVideoUrl("");
    cgSeenRef.current = "";
  }, []);

  useEffect(() => {
    return () => {
      if (cgVideoUrlRef.current) URL.revokeObjectURL(cgVideoUrlRef.current);
      if (cgCloseTimerRef.current) window.clearTimeout(cgCloseTimerRef.current);
      if (preludeTimerRef.current) window.clearTimeout(preludeTimerRef.current);
    };
  }, []);

  return {
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
    setCgClosing,
    setCgMediaKind,
    setCgImageUrl,
    setCgVideoUrl,
    setStartTransitioning,
    setScreenFlashVisible,
    setOpeningPreludeVisible,
    closeCg,
    triggerOpeningPrelude,
    resetPresentationState,
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
