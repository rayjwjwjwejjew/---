import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./index.css";
import {
  CHARACTER_COLORS,
  DEFAULT_BG,
  SCRIPT,
  getSceneBg,
  getSceneCharacters,
  getSpecialBg,
} from "./engine";
import type { StageCharacter } from "./engine";
import { AssetDB } from "./db";
import {
  DEFAULT_SETTINGS,
  buildSaveSnapshot,
  getSavedAtLabel,
  normalizeManifest,
  readJson,
  readSaveSlots,
  readSceneBgOverrides,
  STORAGE_KEYS,
  type AssetEntry,
  type Manifest,
  type SaveSlot,
  type SceneBgOverride,
  type Settings,
  writeSaveSlots,
  writeSceneBgOverrides,
} from "./vnCore";
import { ensureImageReady, queueImagePreload } from "./vnMedia";
import { AssetsPanel, BgmPanel, DebugPanel, SavePanel, SettingsPanel } from "./vnPanels";
import { CreditsScene, PlayingScene, TitleScene } from "./vnScenes";
import {
  buildDebugMarkers,
  collectScriptScenes,
  buildResourceEntries,
  filterResourceEntries,
  filterSceneNames,
  findBestAssetMatch,
  getCgCaption,
  getChoiceTone,
  getChoiceToneLabel,
  getDialogueTone,
  getBgmMoodClass,
  getCurrentBgmLabel,
  getSceneProgress,
  isEmphasisLine,
} from "./vnDerived";
import appSource from "./App.tsx?raw";
import mainSource from "./main.tsx?raw";
import engineSource from "./engine.ts?raw";
import scriptSource from "./script.ts?raw";
import dbSource from "./db.ts?raw";
import cssSource from "./index.css?raw";
import cnSource from "./utils/cn.ts?raw";
import viteEnvSource from "./vite-env.d.ts?raw";
import indexHtmlSource from "../index.html?raw";
import gitignoreSource from "../.gitignore?raw";
import workflowSource from "../.github/workflows/deploy-pages.yml?raw";
import packageLockSource from "../package-lock.json?raw";
import packageJsonSource from "../package.json?raw";
import tsconfigSource from "../tsconfig.json?raw";
import viteConfigSource from "../vite.config.ts?raw";
const SAVE_SLOT_COUNT = 8;
type GamePhase = "warning" | "title" | "playing" | "credits";
type LogItem = { who: string; text: string };

const PAUSE_CHARS: Record<string, number> = {
  "。": 6,
  "！": 5,
  "？": 5,
  "…": 4,
  "，": 2,
  "、": 2,
  "；": 3,
  "：": 3,
  ".": 4,
  "!": 4,
  "?": 4,
  ",": 2,
};

const SMART_PAUSE_WORDS = ["……", "顿了顿", "沉默", "低声", "轻声", "迟疑", "犹豫", "停了一下", "想了想"];
const EMOTION_WORDS = ["惊", "怕", "慌", "痛", "哭", "怒", "冷", "颤", "喘", "哽", "失控", "崩溃", "压抑", "紧张"];

const CREDITS_BLOCKS = [
  { role: "原作 / 编剧", names: "Ray、Justin" },
  { role: "导演 / 演出构成", names: "Ray、Justin" },
  { role: "艺术总监", names: "Ray" },
  { role: "角色设计", names: "公开素材整理 / 二次创作整合" },
  { role: "视觉设计 / UI", names: "Ray、AI" },
  { role: "程序实现", names: "AI" },
  { role: "音乐构想", names: "Ray" },
  { role: "音效设计", names: "Ray" },
  { role: "剧情测试", names: "Ray、Justin" },
];

const TITLE_SCREEN_BG = "https://i.imgur.com/FAWl3AP.png";
const CORNER_IMG_URL = "https://i.imgur.com/NVGVJiU.png";

const QA_ITEMS = [
  { q: "1、为什么做这个？", a: "m成分占比太高" },
  { q: "2、后面还会更新吗？", a: "会，后面还会出第二部或者番外补充一些角色背景吧" },
  { q: "3、这个奇怪生物是什么（重要)？", a: "后续我当做不影响剧情和体验的吐槽旁白，要在剧情点击才会进行吐槽" },
  { q: "4、这个故事有原型吗？", a: "难说" },
];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const SCRIPT_SCENES = collectScriptScenes(SCRIPT.lines);

function getLineTypingDelay(text: string, index: number, baseMs: number) {
  const char = text[index - 1] || "";
  let delay = baseMs * (PAUSE_CHARS[char] || 1);
  const segment = text.slice(Math.max(0, index - 24), index + 6);
  if (SMART_PAUSE_WORDS.some((word) => segment.includes(word))) {
    delay *= 1.4;
  }
  if (EMOTION_WORDS.some((word) => segment.includes(word))) {
    delay *= 1.18;
  }
  if (/[!?！？]/.test(char)) {
    delay *= 1.2;
  }
  if (text.length > 36) {
    delay *= 1.08;
  }
  return Math.max(10, Math.min(240, delay));
}

function getCodeFenceLanguage(path: string): string {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
  if (path.endsWith(".md")) return "md";
  if (path.endsWith(".d.ts")) return "ts";
  return "text";
}

const RainCanvas = memo(function RainCanvas({
  active,
  lowPerfMode,
}: {
  active: boolean;
  lowPerfMode: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const drops: { x: number; y: number; l: number; v: number; a: number }[] = [];
    let isPageVisible = document.visibilityState === "visible";
    let lastDraw = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    for (let i = 0; i < (lowPerfMode ? 24 : 52); i += 1) {
      drops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        l: 8 + Math.random() * 18,
        v: 6 + Math.random() * 10,
        a: 0.15 + Math.random() * 0.25,
      });
    }

    let frameId = 0;
    const frameInterval = 1000 / (lowPerfMode ? 12 : 20);
    const handleVisibility = () => {
      isPageVisible = document.visibilityState === "visible";
    };

    const tick = (now: number) => {
      if (!isPageVisible) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      if (now - lastDraw < frameInterval) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      lastDraw = now;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(180, 210, 255, 0.32)";
      for (const drop of drops) {
        drop.y += drop.v;
        drop.x -= drop.v * 0.15;
        if (drop.y > height) {
          drop.y = -drop.l;
          drop.x = Math.random() * width;
        }
        if (drop.x < -20) {
          drop.x = width + 20;
        }
        ctx.globalAlpha = drop.a;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + drop.v * 0.15, drop.y + drop.l);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      frameId = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibility);
    frameId = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      cancelAnimationFrame(frameId);
    };
  }, [active, lowPerfMode]);

  if (!active) return null;
  return <canvas className="rain-canvas" ref={canvasRef} />;
});

const DustCanvas = memo(function DustCanvas({
  active,
  lowPerfMode,
}: {
  active: boolean;
  lowPerfMode: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const points: { x: number; y: number; r: number; a: number; vx: number; vy: number }[] = [];
    let isPageVisible = document.visibilityState === "visible";
    let lastDraw = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    for (let i = 0; i < (lowPerfMode ? 10 : 18); i += 1) {
      points.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.6 + Math.random() * 1.8,
        a: 0.06 + Math.random() * 0.18,
        vx: -0.08 + Math.random() * 0.16,
        vy: -0.12 + Math.random() * 0.2,
      });
    }

    let frameId = 0;
    const frameInterval = 1000 / (lowPerfMode ? 8 : 14);
    const handleVisibility = () => {
      isPageVisible = document.visibilityState === "visible";
    };

    const tick = (now: number) => {
      if (!isPageVisible) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      if (now - lastDraw < frameInterval) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      lastDraw = now;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      for (const point of points) {
        point.x += point.vx;
        point.y += point.vy;
        if (point.x < -20) point.x = width + 20;
        if (point.x > width + 20) point.x = -20;
        if (point.y < -20) point.y = height + 20;
        if (point.y > height + 20) point.y = -20;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${point.a})`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      frameId = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibility);
    frameId = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      cancelAnimationFrame(frameId);
    };
  }, [active, lowPerfMode]);

  if (!active) return null;
  return <canvas id="dust" ref={canvasRef} />;
});

const StageSprites = memo(function StageSprites({
  stageChars,
  spriteReadyMap,
}: {
  stageChars: StageCharacter[];
  spriteReadyMap: Record<string, boolean>;
}) {
  return (
    <div id="stage">
      {stageChars.map((ch) => (
        <div
          key={ch.name}
          className={`sprite-multi show ${ch.position} expression-${ch.expression} ${spriteReadyMap[ch.spriteUrl] ? "ready" : "loading"} ${ch.isSpeaking ? "speaking" : "not-speaking"}`}
          style={{ backgroundImage: spriteReadyMap[ch.spriteUrl] ? `url("${ch.spriteUrl}")` : undefined }}
        />
      ))}
    </div>
  );
});

export function useVnRuntime() {
  const [index, setIndex] = useState(0);
  const [settings, setSettings] = useState<Settings>(() => readJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS));
  const [phase, setPhase] = useState<GamePhase>("warning");
  const [log, setLog] = useState<LogItem[]>([]);
  const [ui, setUi] = useState({
    showLog: false,
    activePanel: null as string | null,
    showQaPanel: false,
    openQaIndex: null as number | null,
    workspaceMode: "player" as "player" | "editor",
  });
  const showLog = ui.showLog;
  const showQaPanel = ui.showQaPanel;
  const openQaIndex = ui.openQaIndex;
  const [typing, setTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [auto, setAuto] = useState(false);
  const [skip, setSkip] = useState(false);
  const [bgUrl, setBgUrl] = useState<string>(DEFAULT_BG);
  const [prevBgUrl, setPrevBgUrl] = useState<string>("");
  const [currentAct, setCurrentAct] = useState("");
  const activePanel = ui.activePanel;
  const [codeTxtUrl, setCodeTxtUrl] = useState("");
  const [transitionActive, setTransitionActive] = useState(false);
  const [transitionType, setTransitionType] = useState("fade-black");
  const [effectActive, setEffectActive] = useState("");
  const [showRain, setShowRain] = useState(false);
  const [sceneBlur, setSceneBlur] = useState(false);
  const [stageChars, setStageChars] = useState<StageCharacter[]>([]);
  const [spriteReadyMap, setSpriteReadyMap] = useState<Record<string, boolean>>({});
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [bgmMuted, setBgmMuted] = useState(false);
  const [currentBgmId, setCurrentBgmId] = useState("");
  const [currentBgmName, setCurrentBgmName] = useState("");
  const [bgmList, setBgmList] = useState<{ id: string; label: string }[]>([]);
  const [sfxList, setSfxList] = useState<{ id: string; label: string }[]>([]);
  const [titleReady, setTitleReady] = useState(false);
  const [textVisible, setTextVisible] = useState(true);
  const [cgVisible, setCgVisible] = useState(false);
  const [cgClosing, setCgClosing] = useState(false);
  const [cgMediaKind, setCgMediaKind] = useState<"image" | "video">("image");
  const [cgImageUrl, setCgImageUrl] = useState("");
  const [cgVideoUrl, setCgVideoUrl] = useState("");
  const [lowPerfMode, setLowPerfMode] = useState(false);
  const [hudAwake, setHudAwake] = useState(false);
  const [startTransitioning, setStartTransitioning] = useState(false);
  const [screenFlashVisible, setScreenFlashVisible] = useState(false);
  const [creditsRollReady, setCreditsRollReady] = useState(false);
  const [saveSlots, setSaveSlots] = useState<Array<SaveSlot | null>>(() => readSaveSlots(SAVE_SLOT_COUNT));
  const [selectedSaveSlot, setSelectedSaveSlot] = useState(0);
  const workspaceMode = ui.workspaceMode;
  const isEditorMode = workspaceMode === "editor";
  const [assetQuery, setAssetQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<keyof Manifest | "all">("all");
  const [resourcePage, setResourcePage] = useState(0);
  const [debugPage, setDebugPage] = useState(0);
  const [manifestState, setManifestState] = useState<Manifest>(() =>
    normalizeManifest(readJson<Manifest>(STORAGE_KEYS.manifest, {})),
  );
  const [sceneBgOverrides, setSceneBgOverrides] = useState<Record<string, SceneBgOverride>>(() => readSceneBgOverrides());
  const [sceneQuery, setSceneQuery] = useState("");
  const [selectedSceneName, setSelectedSceneName] = useState("");
  const [selectedBackgroundAssetId, setSelectedBackgroundAssetId] = useState("");
  const [customSceneBgUrl, setCustomSceneBgUrl] = useState("");
  const [openingPreludeVisible, setOpeningPreludeVisible] = useState(false);
  const [openingPreludeText, setOpeningPreludeText] = useState("第一幕 · 正在展开");

  const autoTimeoutRef = useRef<number | null>(null);
  const typingFrameRef = useRef<number | null>(null);
  const typingDelayRef = useRef<number | null>(null);
  const hudSleepRef = useRef<number | null>(null);
  const lastBgRef = useRef("");
  const codeTxtUrlRef = useRef("");
  const bgmRef = useRef<HTMLAudioElement>(new Audio());
  const bgmFadeRef = useRef<HTMLAudioElement>(new Audio());
  const sfxRef = useRef<HTMLAudioElement>(new Audio());
  const bgmUrlRef = useRef("");
  const sfxUrlRef = useRef("");
  const cgVideoUrlRef = useRef("");
  const cgVideoRef = useRef<HTMLVideoElement>(null);
  const bgAssetUrlCacheRef = useRef<Record<string, string>>({});
  const cgCloseTimerRef = useRef<number | null>(null);
  const preludeTimerRef = useRef<number | null>(null);
  const uiPulseRef = useRef<number | null>(null);
  const cgSeenRef = useRef("");

  const setShowLog = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setUi((prev) => ({
      ...prev,
      showLog: typeof value === "function" ? value(prev.showLog) : value,
    }));
  }, []);

  const setActivePanel = useCallback((value: string | null | ((prev: string | null) => string | null)) => {
    setUi((prev) => ({
      ...prev,
      activePanel: typeof value === "function" ? value(prev.activePanel) : value,
    }));
  }, []);

  const setShowQaPanel = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setUi((prev) => ({
      ...prev,
      showQaPanel: typeof value === "function" ? value(prev.showQaPanel) : value,
    }));
  }, []);

  const setOpenQaIndex = useCallback((value: number | null | ((prev: number | null) => number | null)) => {
    setUi((prev) => ({
      ...prev,
      openQaIndex: typeof value === "function" ? value(prev.openQaIndex) : value,
    }));
  }, []);

  const setWorkspaceMode = useCallback((value: "player" | "editor" | ((prev: "player" | "editor") => "player" | "editor")) => {
    setUi((prev) => ({
      ...prev,
      workspaceMode: typeof value === "function" ? value(prev.workspaceMode) : value,
    }));
  }, []);

  const curLine = SCRIPT.lines[index];

  useEffect(() => {
    bgmRef.current.loop = true;
    bgmFadeRef.current.loop = true;
    sfxRef.current.preload = "auto";
  }, []);

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
    if (phase === "title") {
      const timer = window.setTimeout(() => setTitleReady(true), 120);
      return () => window.clearTimeout(timer);
    }
    setTitleReady(false);
    return undefined;
  }, [phase]);

  useEffect(() => {
    if (phase !== "credits") {
      setCreditsRollReady(false);
      return;
    }
    setCreditsRollReady(false);
    const timer = window.setTimeout(() => setCreditsRollReady(true), lowPerfMode ? 900 : 1600);
    return () => window.clearTimeout(timer);
  }, [lowPerfMode, phase]);

  const pulseUi = useCallback(
    (_kind?: string) => {
      if (uiPulseRef.current) window.clearTimeout(uiPulseRef.current);
      uiPulseRef.current = window.setTimeout(() => {
        uiPulseRef.current = null;
      }, 120);
    },
    [],
  );

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
      if (scene === curLine?.scene) {
        const url = await ensureBackgroundAssetUrl(assetId);
        if (url) {
          setBgUrl(url);
          lastBgRef.current = url;
          pulseUi("scene");
        }
      }
    },
    [curLine?.scene, ensureBackgroundAssetUrl, getBackgroundAssetLabel, pulseUi, sceneBgOverrides],
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

  const refreshBgmList = useCallback(() => {
    try {
      const manifest = normalizeManifest(readJson<Manifest>(STORAGE_KEYS.manifest, {}));
      setManifestState(manifest);
      setBgmList(manifest.bgm || []);
      setSfxList(manifest.sfx || []);
    } catch {
      setManifestState({});
      setBgmList([]);
      setSfxList([]);
    }
  }, []);

  useEffect(() => {
    refreshBgmList();
  }, [refreshBgmList]);

  const batchRenameResources = useCallback(() => {
    const next = prompt("批量重命名：输入前缀");
    if (!next) return;
    const updated: Manifest = { ...manifestState };
    (["backgrounds", "sprite", "video", "bgm", "sfx"] as const).forEach((kind) => {
      updated[kind] = (updated[kind] || []).map((item, idx) => ({ ...item, label: `${next}-${idx + 1}` }));
    });
    localStorage.setItem(STORAGE_KEYS.manifest, JSON.stringify(updated));
    setManifestState(updated);
    refreshBgmList();
  }, [manifestState, refreshBgmList]);

  useEffect(() => {
    setSaveSlots(readSaveSlots(SAVE_SLOT_COUNT));
  }, []);

  useEffect(() => {
    if (!selectedSceneName) {
      const initialScene = curLine?.scene || SCRIPT_SCENES[0] || "";
      setSelectedSceneName(initialScene);
      const initialOverride = sceneBgOverrides[initialScene];
      setCustomSceneBgUrl(initialOverride?.source === "url" ? initialOverride.value : "");
      setSelectedBackgroundAssetId(initialOverride?.source === "asset" ? initialOverride.value : "");
    }
  }, [curLine?.scene, sceneBgOverrides, selectedSceneName]);

  useEffect(() => {
    if (!selectedSceneName) return;
    const override = sceneBgOverrides[selectedSceneName];
    setCustomSceneBgUrl(override?.source === "url" ? override.value : "");
    setSelectedBackgroundAssetId(override?.source === "asset" ? override.value : "");
  }, [sceneBgOverrides, selectedSceneName]);

  useEffect(() => {
    if (!isEditorMode && (activePanel === "assets" || activePanel === "debug")) {
      setActivePanel(null);
    }
  }, [activePanel, isEditorMode]);

  useEffect(() => {
    queueImagePreload(TITLE_SCREEN_BG);
    queueImagePreload(CORNER_IMG_URL);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const upcoming = new Set<string>();
    for (let i = index; i < Math.min(SCRIPT.lines.length, index + 3); i += 1) {
      upcoming.add(resolveSceneBackground(SCRIPT.lines[i]?.scene));
      const line = SCRIPT.lines[i];
      if (!line) continue;
      getSceneCharacters(SCRIPT.lines, i, line.speaker).forEach((ch) => {
        upcoming.add(ch.spriteUrl);
      });
    }
    upcoming.forEach((url) => {
      queueImagePreload(url);
      void ensureImageReady(url).then(() => {
        setSpriteReadyMap((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
      });
    });
  }, [index, phase, resolveSceneBackground]);

  useEffect(() => {
    if (phase !== "playing" || !curLine) return;
    let nextBg = resolveSceneBackground(curLine.scene);
    const special = getSpecialBg(index);
    if (special) {
      nextBg = special;
    }

    const override = curLine.scene ? sceneBgOverrides[curLine.scene] : undefined;
    const loadAssetBg = async () => {
      if (override?.source !== "asset") return nextBg;
      const url = await ensureBackgroundAssetUrl(override.value);
      return url || nextBg;
    };

    if (nextBg !== lastBgRef.current) {
      let cancelled = false;
      let clearTimer: number | null = null;
      const nextTransition = curLine.transition || "dissolve";
      const currentBg = bgUrl || lastBgRef.current || DEFAULT_BG;

      if (!lowPerfMode) {
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
          if (lowPerfMode) return;
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
  }, [bgUrl, curLine, ensureBackgroundAssetUrl, index, lowPerfMode, phase, pulseUi, resolveSceneBackground, sceneBgOverrides]);

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
    setShowRain(Boolean(curLine.scene?.includes("雨") || curLine.effect === "rain"));
    setSceneBlur(Boolean(curLine.scene?.includes("梦境") || curLine.scene?.includes("回忆") || curLine.effect === "blur"));
    if (curLine.effect && !["rain", "blur", "none"].includes(curLine.effect)) {
      return triggerEffect(curLine.effect);
    }
    return undefined;
  }, [curLine, phase, triggerEffect]);

  useEffect(() => {
    if (cgCloseTimerRef.current) {
      window.clearTimeout(cgCloseTimerRef.current);
      cgCloseTimerRef.current = null;
    }
    if (phase !== "playing" || !curLine?.cg || cgVisible) return;
    const cgKey = `${index}:${curLine.cg}`;
    if (cgSeenRef.current === cgKey) return;
    let cancelled = false;
    const posterUrl = resolveSceneBackground(curLine.scene) || bgUrl || DEFAULT_BG;
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

  const videoMatch = findBestAssetMatch(manifestState.video, [curLine.cg, curLine.scene || "", "cg", "视频"]);
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
  }, [bgUrl, cgVisible, curLine, index, manifestState.video, phase, pulseUi]);

  useEffect(() => {
    if (phase !== "playing" || !curLine) return;
    setStageChars(getSceneCharacters(SCRIPT.lines, index, curLine.speaker));
    const upcoming = new Set<string>();
    for (let i = index; i < Math.min(SCRIPT.lines.length, index + 2); i += 1) {
      const line = SCRIPT.lines[i];
      if (!line) continue;
      getSceneCharacters(SCRIPT.lines, i, line.speaker).forEach((ch) => {
        upcoming.add(ch.spriteUrl);
      });
    }
    upcoming.forEach((url) => {
      queueImagePreload(url);
      void ensureImageReady(url).then(() => {
        setSpriteReadyMap((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
      });
    });
  }, [curLine, index, phase]);

  useEffect(() => {
    if (!cgVisible || cgMediaKind !== "video") return;
    const video = cgVideoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => undefined);
  }, [cgMediaKind, cgVisible, cgVideoUrl]);

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
    if (phase !== "playing") return;
    if (!curLine) {
      setPhase("credits");
      return;
    }
    if (curLine.speaker === "SYSTEM" && curLine.text?.startsWith("JUMP:")) {
      const label = curLine.text.slice(5).trim();
      const target = SCRIPT.labelMap.get(label);
      if (typeof target === "number") {
        setIndex(target);
      } else {
        setIndex((value) => Math.min(SCRIPT.lines.length, value + 1));
      }
      return;
    }

    setCurrentAct(curLine.act);
    setTextVisible(false);
    if (curLine.kind !== "choice") {
      pulseUi(curLine.effect && curLine.effect !== "none" ? "emotion" : "story");
    }
    if (typingFrameRef.current) cancelAnimationFrame(typingFrameRef.current);
    if (typingDelayRef.current) window.clearTimeout(typingDelayRef.current);
    typingDelayRef.current = window.setTimeout(() => {
      setDisplayedText("");
      setTyping(true);
      setTextVisible(true);
      let nextText = curLine.text || "";
      if (curLine.kind === "choice") nextText = "请选择：";
      if (skip || settings.typeMs === 0) {
        setDisplayedText(nextText);
        setTyping(false);
        return;
      }

      let ci = 0;
      let lastTime = performance.now();
      let frameId = 0;
      const frame = (now: number) => {
        const effectiveDelay = getLineTypingDelay(nextText, ci, settings.typeMs);
        const delta = now - lastTime;
        if (delta >= effectiveDelay) {
          const previousChar = nextText[ci - 1] || "";
          const step = PAUSE_CHARS[previousChar] ? 1 : Math.max(1, Math.floor(delta / Math.max(1, settings.typeMs)));
          ci = Math.min(nextText.length, ci + step);
          setDisplayedText(nextText.slice(0, ci));
          lastTime = now;
        }
        if (ci < nextText.length) {
          frameId = requestAnimationFrame(frame);
          typingFrameRef.current = frameId;
        } else {
          setTyping(false);
          typingFrameRef.current = null;
        }
      };
      frameId = requestAnimationFrame(frame);
      typingFrameRef.current = frameId;
    }, 120);

    return () => {
      if (typingDelayRef.current) window.clearTimeout(typingDelayRef.current);
      if (typingFrameRef.current) cancelAnimationFrame(typingFrameRef.current);
    };
  }, [curLine, phase, settings.typeMs, skip]);

  const commitSaveSlot = useCallback(
    (slotIndex: number) => {
      const data = {
        ...buildSaveSnapshot(index, log, currentAct, currentBgmName, curLine, SCRIPT.lines.length),
        slot: slotIndex,
      };
      const nextSlots = readSaveSlots(SAVE_SLOT_COUNT);
      nextSlots[slotIndex] = data;
      writeSaveSlots(nextSlots, SAVE_SLOT_COUNT);
      setSaveSlots(nextSlots);
      localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(data));
      return data;
    },
    [currentAct, currentBgmName, curLine, index, log],
  );

  const saveGame = useCallback(
    (slotIndex = selectedSaveSlot, persistSlot = true) => {
      if (persistSlot) {
        commitSaveSlot(slotIndex);
      } else {
        const data = buildSaveSnapshot(index, log, currentAct, currentBgmName, curLine, SCRIPT.lines.length);
        localStorage.setItem(STORAGE_KEYS.save, JSON.stringify(data));
      }
      pulseUi("ui");
    },
    [commitSaveSlot, currentAct, currentBgmName, curLine, index, log, pulseUi, selectedSaveSlot],
  );

  const loadSaveSlot = useCallback(
    (slotIndex: number) => {
      const slot = saveSlots[slotIndex];
      if (!slot) return;
      setPhase("playing");
      setIndex(Math.min(SCRIPT.lines.length - 1, slot.index));
      setLog(slot.log || []);
      setCurrentAct(slot.act || "");
      setActivePanel(null);
      setShowLog(false);
      setAuto(false);
      setSkip(false);
      setOpeningPreludeVisible(false);
      setCgClosing(false);
      setCgMediaKind("image");
      setCgVideoUrl("");
      cgSeenRef.current = "";
      stopBgm();
      const match = bgmList.find((item) => item.label === slot.bgmName || item.label.includes(slot.bgmName || ""));
      if (match) {
        void loadAndPlayBgm(match.id);
      } else {
        setCurrentBgmId("");
        setCurrentBgmName(slot.bgmName || "");
      }
      pulseUi("scene");
    },
    [bgmList, loadAndPlayBgm, pulseUi, saveSlots, stopBgm],
  );

  const continueLastGame = useCallback(() => {
    const lastSave = safeParse<SaveSlot | null>(localStorage.getItem(STORAGE_KEYS.save), null);
    if (!lastSave) return;
    setPhase("playing");
    setIndex(Math.min(SCRIPT.lines.length - 1, lastSave.index));
    setLog(lastSave.log || []);
    setCurrentAct(lastSave.act || "");
    setActivePanel(null);
    setShowLog(false);
    setAuto(false);
    setSkip(false);
    setOpeningPreludeVisible(false);
    setCgClosing(false);
    setCgMediaKind("image");
    setCgVideoUrl("");
    cgSeenRef.current = "";
    stopBgm();
    const match = bgmList.find((item) => item.label === lastSave.bgmName || item.label.includes(lastSave.bgmName || ""));
    if (match) {
      void loadAndPlayBgm(match.id);
    } else {
      setCurrentBgmId("");
      setCurrentBgmName(lastSave.bgmName || "");
    }
    pulseUi("scene");
  }, [bgmList, loadAndPlayBgm, pulseUi, stopBgm]);

  const deleteSaveSlot = useCallback(
    (slotIndex: number) => {
      const nextSlots = readSaveSlots(SAVE_SLOT_COUNT);
      nextSlots[slotIndex] = null;
      writeSaveSlots(nextSlots, SAVE_SLOT_COUNT);
      setSaveSlots(nextSlots);
      pulseUi("ui");
    },
    [pulseUi],
  );

  const closeCg = useCallback((advance = false) => {
    if (!cgVisible) return;
    cgSeenRef.current = `${index}:${curLine?.cg || ""}`;
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
        setIndex((value) => Math.min(SCRIPT.lines.length, value + 1));
      }
      cgCloseTimerRef.current = null;
    }, 240);
  }, [cgVisible, curLine?.cg, index, phase, pulseUi]);

  const triggerOpeningPrelude = useCallback((text: string) => {
    if (preludeTimerRef.current) window.clearTimeout(preludeTimerRef.current);
    setOpeningPreludeText(text);
    setOpeningPreludeVisible(true);
    preludeTimerRef.current = window.setTimeout(() => {
      setOpeningPreludeVisible(false);
      preludeTimerRef.current = null;
    }, 1500);
  }, []);

  const handleNext = useCallback(() => {
    if (phase !== "playing" || !curLine) return;
    if (cgVisible) {
      closeCg(true);
      return;
    }
    if (typing) {
      if (typingFrameRef.current) {
        cancelAnimationFrame(typingFrameRef.current);
        typingFrameRef.current = null;
      }
      setDisplayedText(curLine.kind === "choice" ? "请选择：" : curLine.text || "");
      setTyping(false);
      return;
    }
    if (curLine.kind === "choice") return;
    if (curLine.kind === "label") {
      setIndex((value) => value + 1);
      return;
    }
    if (curLine.speaker && curLine.text) {
      setLog((prev) => [...prev, { who: curLine.speaker || "旁白", text: curLine.text || "" }].slice(-100));
    }
    if (curLine.cg) {
      pulseUi("cg");
    }
    setIndex((value) => Math.min(SCRIPT.lines.length, value + 1));
  }, [cgVisible, closeCg, curLine, phase, pulseUi, typing]);

  const handlePrev = useCallback(() => {
    if (phase !== "playing") return;
    setAuto(false);
    setSkip(false);
    setTyping(false);
    cgSeenRef.current = "";
    if (index <= 0) return;
    let nextIndex = index - 1;
    while (nextIndex > 0) {
      const line = SCRIPT.lines[nextIndex];
      if (line.kind === "label" || line.kind === "choice") {
        nextIndex -= 1;
      } else {
        break;
      }
    }
    setIndex(nextIndex);
  }, [index, phase]);

  const handleChoice = useCallback((cmd: string) => {
    cgSeenRef.current = "";
    if (cmd.startsWith("@jump")) {
      const label = cmd.replace("@jump", "").trim();
      const target = SCRIPT.labelMap.get(label);
      setIndex(typeof target === "number" ? target : index + 1);
      return;
    }
    setIndex((value) => value + 1);
  }, [index]);

  useEffect(() => {
    if (autoTimeoutRef.current) {
      window.clearTimeout(autoTimeoutRef.current);
    }
    if (phase !== "playing" || (!auto && !skip) || typing || curLine?.kind === "choice" || !curLine) return;
    const delay = skip ? 50 : Math.max(180, settings.autoMs);
    autoTimeoutRef.current = window.setTimeout(handleNext, delay);
    return () => {
      if (autoTimeoutRef.current) {
        window.clearTimeout(autoTimeoutRef.current);
      }
    };
  }, [auto, curLine, handleNext, phase, settings.autoMs, skip, typing]);

  const startNewGame = () => {
    if (startTransitioning) return;
    setStartTransitioning(true);
    setScreenFlashVisible(true);
    triggerOpeningPrelude("第一幕 · 章节开启");
    setIndex(0);
    setLog([]);
    lastBgRef.current = "";
    setActivePanel(null);
    setCgVisible(false);
    setCgClosing(false);
    setCgMediaKind("image");
    setCgVideoUrl("");
    cgSeenRef.current = "";
    setOpeningPreludeVisible(true);
    stopBgm();
    window.setTimeout(() => {
      setPhase("playing");
      setHudAwake(true);
    }, lowPerfMode ? 180 : 260);
    window.setTimeout(() => {
      setScreenFlashVisible(false);
      setStartTransitioning(false);
    }, lowPerfMode ? 620 : 720);
  };

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

  const togglePanel = (name: string) => {
    if (!isEditorMode && (name === "assets" || name === "debug")) return;
    pulseUi("ui");
    setActivePanel((prev) => (prev === name ? null : name));
  };

  const uploadAsset = async (kind: "bg" | "sprite" | "video" | "bgm" | "sfx") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "bgm" || kind === "sfx" ? "audio/*" : kind === "video" ? "video/*" : "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const label = prompt("资源名称", file.name) || file.name;
      const id = `${kind}_${crypto.randomUUID()}`;
      await AssetDB.put(AssetDB.STORE_ASSETS, id, file);
      try {
        const manifest = normalizeManifest(readJson<Manifest>(STORAGE_KEYS.manifest, {}));
        const key = kind === "bg" ? "backgrounds" : kind;
        manifest[key] = [{ id, label }, ...((manifest[key] || []) as AssetEntry[])];
        localStorage.setItem(STORAGE_KEYS.manifest, JSON.stringify(manifest));
        refreshBgmList();
      } catch {
        // ignore
      }
      alert("上传成功");
    };
    input.click();
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (phase === "playing") {
        setHudAwake(true);
        if (hudSleepRef.current) window.clearTimeout(hudSleepRef.current);
        hudSleepRef.current = window.setTimeout(() => setHudAwake(false), 2200);
      }
      if (phase === "warning") return;
      if (phase === "title") {
        if (event.key === "Escape") {
          setActivePanel(null);
          setShowQaPanel(false);
          setOpenQaIndex(null);
          return;
        }
        if ((event.key === " " || event.key === "Enter") && !activePanel && !showQaPanel) {
          event.preventDefault();
          startNewGame();
        }
        return;
      }
      if (phase !== "playing") return;
      if (cgVisible && (event.key === " " || event.key === "Enter" || event.key === "Escape")) {
        event.preventDefault();
        closeCg(true);
        return;
      }
      if ((event.key === " " || event.key === "Enter") && !activePanel && !showLog) {
        event.preventDefault();
        handleNext();
      }
      if (event.key === "Backspace" && !activePanel && !showLog) {
        event.preventDefault();
        handlePrev();
      }
      if (event.key.toLowerCase() === "l") setShowLog((value) => !value);
      if (event.key.toLowerCase() === "s") saveGame();
      if (event.key === "Escape") {
        setActivePanel(null);
        setShowLog(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [activePanel, cgVisible, closeCg, handleNext, handlePrev, phase, saveGame, showLog, showQaPanel]);

  useEffect(() => {
    if (phase !== "playing") {
      setHudAwake(false);
      if (hudSleepRef.current) window.clearTimeout(hudSleepRef.current);
      return;
    }
    const wakeHud = () => {
      setHudAwake(true);
      if (hudSleepRef.current) window.clearTimeout(hudSleepRef.current);
      hudSleepRef.current = window.setTimeout(() => setHudAwake(false), 2200);
    };
    const onMove = (event: MouseEvent) => {
      if (event.clientY <= 112 || event.clientX <= 112) wakeHud();
    };

    if (activePanel || showLog || cgVisible) setHudAwake(true);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (hudSleepRef.current) window.clearTimeout(hudSleepRef.current);
    };
  }, [activePanel, cgVisible, phase, showLog]);

  useEffect(() => {
    if (phase === "playing" && index > 0) {
      saveGame(selectedSaveSlot, false);
    }
  }, [index, phase, saveGame, selectedSaveSlot]);

  const handleExportAllCodeTxt = () => {
    const files = [
      { path: ".gitignore", content: gitignoreSource },
      { path: ".github/workflows/deploy-pages.yml", content: workflowSource },
      { path: "index.html", content: indexHtmlSource },
      { path: "package-lock.json", content: packageLockSource },
      { path: "package.json", content: packageJsonSource },
      { path: "tsconfig.json", content: tsconfigSource },
      { path: "vite.config.ts", content: viteConfigSource },
      { path: "src/main.tsx", content: mainSource },
      { path: "src/App.tsx", content: appSource },
      { path: "src/engine.ts", content: engineSource },
      { path: "src/script.ts", content: scriptSource },
      { path: "src/db.ts", content: dbSource },
      { path: "src/index.css", content: cssSource },
      { path: "src/vite-env.d.ts", content: viteEnvSource },
      { path: "src/utils/cn.ts", content: cnSource },
    ].map((file) => ({ ...file, language: getCodeFenceLanguage(file.path) }));

    const header = [
      "VN Studio - 完整源码导出",
      `导出时间: ${new Date().toLocaleString()}`,
      `文件数: ${files.length}`,
      "",
      "说明：以下内容按原始文件路径逐个导出，每个文件使用独立代码块包裹，便于校验与还原。",
      "",
      "========================================",
      "",
    ].join("\n");

    const body = files
      .map((file) =>
        [
          `FILE: ${file.path}`,
          `LANG: ${file.language}`,
          "----------------------------------------",
          `\`\`\`${file.language}`,
          file.content.replace(/\s+$/u, ""),
          "```",
          "",
          "========================================",
          "",
        ].join("\n"),
      )
      .join("");

    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    if (codeTxtUrlRef.current) URL.revokeObjectURL(codeTxtUrlRef.current);
    const url = URL.createObjectURL(blob);
    codeTxtUrlRef.current = url;
    setCodeTxtUrl(url);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "VN_全部代码.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  useEffect(() => {
    return () => {
      if (codeTxtUrlRef.current) URL.revokeObjectURL(codeTxtUrlRef.current);
      if (bgmUrlRef.current) URL.revokeObjectURL(bgmUrlRef.current);
      if (sfxUrlRef.current) URL.revokeObjectURL(sfxUrlRef.current);
      if (cgVideoUrlRef.current) URL.revokeObjectURL(cgVideoUrlRef.current);
      Object.values(bgAssetUrlCacheRef.current).forEach((url) => URL.revokeObjectURL(url));
      if (cgCloseTimerRef.current) window.clearTimeout(cgCloseTimerRef.current);
      if (preludeTimerRef.current) window.clearTimeout(preludeTimerRef.current);
      if (uiPulseRef.current) window.clearTimeout(uiPulseRef.current);
    };
  }, []);

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
  const dialogueTone = getDialogueTone(curLine);
  const emphasisLine = isEmphasisLine(curLine?.text);
  const cgCaption = getCgCaption(currentAct, curLine);
  const currentBgmLabel = useMemo(
    () => getCurrentBgmLabel(bgmList, currentBgmId, currentBgmName),
    [bgmList, currentBgmId, currentBgmName],
  );
  const bgmMoodClass = useMemo(() => getBgmMoodClass(currentBgmLabel), [currentBgmLabel]);
  const sceneProgress = useMemo(() => getSceneProgress(index, SCRIPT.lines.length), [index]);
  const titlePanelOpen = useMemo(
    () => phase === "title" && (activePanel === "settings" || (isEditorMode && activePanel === "assets")),
    [activePanel, isEditorMode, phase],
  );
  const hasContinueSave = Boolean(localStorage.getItem(STORAGE_KEYS.save));
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
          <DustCanvas active={!lowPerfMode} lowPerfMode={lowPerfMode} />

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
              <button className="title-btn" onClick={() => setWorkspaceMode((value) => (value === "editor" ? "player" : "editor"))}>
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

          {showQaPanel && (
            <div
              onClick={() => {
                setShowQaPanel(false);
                setOpenQaIndex(null);
              }}
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
                onClick={(e) => e.stopPropagation()}
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
                    <div style={{ fontSize: "12px", opacity: 0.7, letterSpacing: "0.12em" }}>
                      Q&A
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 700 }}>
                      制作问答
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQaPanel(false);
                      setOpenQaIndex(null);
                    }}
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
                  {QA_ITEMS.map((item, idx) => {
                    const opened = openQaIndex === idx;
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
                          onClick={() => setOpenQaIndex(opened ? null : idx)}
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
          )}

          {titlePanelOpen && (
            <div className="title-panel-overlay" onClick={() => setActivePanel(null)}>
              <div className="title-panel-shell" onClick={(event) => event.stopPropagation()}>
                <div className="title-panel-head">
                  <div>
                    <div className="title-panel-kicker">系统菜单</div>
                    <div className="title-panel-title">{activePanel === "settings" ? "设置" : "资源管理"}</div>
                  </div>
                  <button className="title-panel-close" onClick={() => setActivePanel(null)}>
                    关闭
                  </button>
                </div>
                <div className="title-panel-body">
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
                </div>
              </div>
            </div>
          )}
        </TitleScene>
      )}

      {phase === "credits" && (
        <CreditsScene>
          <div
            className="credits-bg"
            style={{
              backgroundImage: `url("${TITLE_SCREEN_BG}")`,
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
          <button className="btn credits-return" onClick={() => setPhase("title")}>
            返回标题
          </button>
          <div id="credits-content" className={creditsRollReady ? "roll" : ""}>
            <div className="credit-kicker">END ROLL</div>
            <div className="credit-title">制作团队</div>
            <div className="credit-subtitle">一个关于真相、记忆与归途的故事。</div>
            {CREDITS_BLOCKS.map((block) => (
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

          <div id="panelBar" className={`${hudAwake || activePanel || showLog ? "awake" : ""} ${activePanel ? "panel-open" : ""}`.trim()}>
            <button className="pbtn" onClick={handlePrev}>
              ◀
            </button>
            <button className="pbtn" onClick={handleNext}>
              ▶
            </button>
            <button className="pbtn" aria-pressed={auto} onClick={() => { setAuto(!auto); setSkip(false); }}>
              自动
            </button>
            <button className="pbtn" aria-pressed={skip} onClick={() => { setSkip(!skip); setAuto(false); }}>
              跳过
            </button>
            <button className="pbtn" onClick={() => setShowLog(true)}>
              历史
            </button>
            <button className="pbtn" onClick={() => togglePanel("assets")}>
              资源
            </button>
            <button className="pbtn" onClick={() => togglePanel("settings")}>
              设置
            </button>
            <button className="pbtn" aria-pressed={activePanel === "bgm"} onClick={() => togglePanel("bgm")}>
              {bgmPlaying && !bgmMuted ? "♫" : "BGM"}
            </button>
            <button className="pbtn" onClick={() => togglePanel("save")}>
              存档槽
            </button>
            {isEditorMode && (
              <button className="pbtn" onClick={() => togglePanel("debug")}>
                调试
              </button>
            )}
            <button className="pbtn" onClick={() => setWorkspaceMode((value) => (value === "editor" ? "player" : "editor"))}>
              {isEditorMode ? "玩家模式" : "编辑器"}
            </button>
            <button className="pbtn" onClick={() => { setPhase("title"); setAuto(false); setSkip(false); }}>
              标题
            </button>
            <button className="pbtn" onClick={handleExportAllCodeTxt}>
              代码
            </button>
            {codeTxtUrl && (
              <a className="pbtn" href={codeTxtUrl} download="VN_全部代码.txt" style={{ textDecoration: "none" }}>
                ⬇TXT
              </a>
            )}
          </div>

          {isEditorMode && (
            <div className={`panel ${activePanel === "assets" ? "show" : ""}`}>
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
            </div>
          )}

          <div className={`panel ${activePanel === "save" ? "show" : ""}`}>
            <SavePanel
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
            />
          </div>

          {isEditorMode && (
            <div className={`panel ${activePanel === "debug" ? "show" : ""}`}>
            <DebugPanel
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
                setBgUrl(nextBg);
                lastBgRef.current = nextBg;
                pulseUi("scene");
              }}
              onSwitchEmotion={() => {
                setStageChars((prev) =>
                  prev.map((ch) => ({
                    ...ch,
                    expression: ch.expression === "panic" ? "calm" : "panic",
                  })),
                );
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
            />
            </div>
          )}

          <div className={`panel ${activePanel === "settings" ? "show" : ""}`}>
            <SettingsPanel settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} />
            <div className="card">
              <div className="row">
                <span className="label">场景信息</span>
                <span className="tiny mono">
                  #{index} · {curLine?.scene || "无场景标记"}
                </span>
              </div>
              {currentBgmName && (
                <div className="row">
                  <span className="label">当前BGM</span>
                  <span className="tiny mono">{currentBgmName}</span>
                </div>
              )}
              {curLine?.effect && (
                <div className="row">
                  <span className="label">当前特效</span>
                  <span className="tiny mono">{curLine.effect}</span>
                </div>
              )}
            </div>
          </div>

          <div className={`panel ${activePanel === "bgm" ? "show" : ""}`}>
            <BgmPanel
              bgmPlaying={bgmPlaying}
              bgmMuted={bgmMuted}
              currentBgmLabel={currentBgmLabel}
              currentBgmId={currentBgmId}
              bgmList={bgmList}
              bgmVol={settings.bgmVol}
              sfxVol={settings.sfxVol}
              onToggleBgm={toggleBgm}
              onStopBgm={stopBgm}
              onToggleMute={toggleMute}
              onLoadAndPlayBgm={(id) => void loadAndPlayBgm(id)}
              onSettingsChange={setSettings}
            />
          </div>

          <div id="hud" style={{ display: curLine ? "block" : "none" }}>
            <div
              id="box"
              className={`${!typing && curLine?.kind !== "choice" ? "can-advance" : ""} ${curLine?.kind === "choice" ? "choice-mode" : ""} tone-${dialogueTone} ${emphasisLine ? "emphasis-line" : ""}`.trim()}
              onClick={() => { if (!curLine?.options) handleNext(); }}
            >
              <div id="name" style={{ display: showName ? "flex" : "none" }}>
                <span className="name-line-left" style={{ background: `linear-gradient(to right, transparent 0%, ${speakerColor} 100%)` }} />
                <span className="name-text-inner" style={{ color: speakerColor, borderColor: speakerColor.replace("0.95", "0.32") }}>
                  <span>{speaker}</span>
                </span>
                <span className="name-line-right" style={{ background: `linear-gradient(to left, transparent 0%, ${speakerColor} 100%)` }} />
              </div>

              <div id="text" className={`${textVisible ? "show" : "text-exit"} tone-${dialogueTone} ${emphasisLine ? "emphasis-line" : ""}`.trim()}>
                {curLine?.kind === "choice" ? "请选择：" : displayedText}
              </div>

              <div id="choices" className={curLine?.kind === "choice" ? "show" : ""}>
                {curLine?.kind === "choice" && <div className="choices-kicker">命运分歧</div>}
                {curLine?.kind === "choice" &&
                  curLine.options?.map((opt, idx) => {
                    const choiceTone = getChoiceTone(opt.text);
                    return (
                      <button
                        key={`${opt.text}_${idx}`}
                        className={`choice choice-${choiceTone}`}
                        onClick={(e) => { e.stopPropagation(); handleChoice(opt.cmd); }}
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

          <div id="backlog" className={showLog ? "show" : ""}>
            <div className="wrap">
              <div className="top">
                <div className="t">历史记录</div>
                <button className="btn" onClick={() => setShowLog(false)}>
                  关闭
                </button>
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
        </PlayingScene>
      )}

      <div className={`screen-flash ${screenFlashVisible ? "show start-flash" : ""}`}>
        <div className="screen-flash-title">盛开在谎言之上</div>
      </div>

      {openingPreludeVisible && phase === "playing" && (
        <div className="opening-prelude">
          <div className="opening-prelude-backdrop" />
          <div className="opening-prelude-inner">
            <div className="opening-prelude-kicker">OPENING</div>
            <div className="opening-prelude-title">{openingPreludeText}</div>
            <div className="opening-prelude-copy">黑场、字幕、环境音和轻微推进，正在把这一幕正式拉开。</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function App() {
  return useVnRuntime();
}
