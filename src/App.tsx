import { memo, useCallback, useEffect, useRef, useState } from "react";
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

const KEY_SETTINGS = "vn_settings_v1";
const KEY_MANIFEST = "vn_manifest_v1";
const KEY_SAVE = "vn_save_v1";

const DEFAULT_SETTINGS = {
  typeMs: 18,
  autoMs: 820,
  dim: 18,
  spriteW: 250,
  spriteOpacity: 100,
  bgScale: 104,
  bgOpacity: 100,
  spriteY: 0,
  spriteX: 0,
  bgmVol: 70,
  sfxVol: 70,
  uiSfxId: "",
  uiAlpha: 60,
};

type Settings = typeof DEFAULT_SETTINGS;
type GamePhase = "warning" | "title" | "playing" | "credits";
type LogItem = { who: string; text: string };
type Manifest = { bgm?: { id: string; label: string }[]; sfx?: { id: string; label: string }[] };

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
const IMAGE_READY_CACHE = new Map<string, Promise<void>>();
const IMAGE_PREFETCH_QUEUE: string[] = [];
const IMAGE_PREFETCH_LIMIT = 3;
let IMAGE_PREFETCH_ACTIVE = 0;

const QA_ITEMS = [
  { q: "1、为什么做这个？", a: "m成分占比太高" },
  { q: "2、后面还会更新吗？", a: "会，后面还会出第二部或者番外补充一些角色背景吧" },
  { q: "3、这个奇怪生物是什么（重要)？", a: "后续我当做不影响剧情和体验的吐槽旁白，要在剧情点击才会进行吐槽" },
  { q: "4、这个故事有原型吗？", a: "难说" },
];

function readJson<T extends Record<string, unknown>>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function getBgmMoodClass(name: string): string {
  if (!name) return "bgm-neutral";
  if (/(悬疑|压抑|紧张|高潮|审判|恐怖)/.test(name)) return "bgm-tense";
  if (/(告别|钢琴|日常|治愈|安静|忧郁|悲伤)/.test(name)) return "bgm-soft";
  return "bgm-neutral";
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

function ensureImageReady(url: string): Promise<void> {
  const cached = IMAGE_READY_CACHE.get(url);
  if (cached) return cached;

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    const finish = () => {
      if (typeof img.decode === "function") {
        void img.decode().catch(() => undefined).finally(resolve);
        return;
      }
      resolve();
    };
    img.onload = finish;
    img.onerror = () => resolve();
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      finish();
    }
  });

  IMAGE_READY_CACHE.set(url, promise);
  return promise;
}

function pumpImagePreloadQueue() {
  while (IMAGE_PREFETCH_ACTIVE < IMAGE_PREFETCH_LIMIT && IMAGE_PREFETCH_QUEUE.length > 0) {
    const url = IMAGE_PREFETCH_QUEUE.shift();
    if (!url || IMAGE_READY_CACHE.has(url)) continue;
    IMAGE_PREFETCH_ACTIVE += 1;
    void ensureImageReady(url).finally(() => {
      IMAGE_PREFETCH_ACTIVE = Math.max(0, IMAGE_PREFETCH_ACTIVE - 1);
      pumpImagePreloadQueue();
    });
  }
}

function preloadImage(url: string | null | undefined) {
  if (!url || IMAGE_READY_CACHE.has(url) || IMAGE_PREFETCH_QUEUE.includes(url)) return;
  IMAGE_PREFETCH_QUEUE.push(url);
  pumpImagePreloadQueue();
}

function queueImagePreload(url: string | null | undefined) {
  preloadImage(url);
}

function resolveBackgroundUrl(lineIndex: number): string {
  const line = SCRIPT.lines[lineIndex];
  if (!line) return DEFAULT_BG;
  const special = getSpecialBg(lineIndex);
  if (special) return special;
  return getSceneBg(line.scene) || DEFAULT_BG;
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
    for (let i = 0; i < (lowPerfMode ? 88 : 150); i += 1) {
      drops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        l: 8 + Math.random() * 18,
        v: 6 + Math.random() * 10,
        a: 0.15 + Math.random() * 0.25,
      });
    }

    let frameId = 0;
    const frameInterval = 1000 / (lowPerfMode ? 24 : 40);
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
    for (let i = 0; i < (lowPerfMode ? 36 : 72); i += 1) {
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
    const frameInterval = 1000 / (lowPerfMode ? 18 : 28);
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

const FloatingBgm = memo(function FloatingBgm({
  label,
  playing,
  muted,
  moodClass,
}: {
  label: string;
  playing: boolean;
  muted: boolean;
  moodClass: string;
}) {
  if (!label) return null;
  return (
    <div className={`bgm-indicator ${moodClass}`}>
      <div className="bgm-indicator-eyebrow">{muted ? "BGM 已静音" : playing ? "正在播放" : "BGM 待机"}</div>
      <div className="bgm-indicator-main">
        <span className="bgm-eq" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="bgm-indicator-text">{label}</span>
      </div>
    </div>
  );
});

export function App() {
  const [index, setIndex] = useState(0);
  const [settings, setSettings] = useState<Settings>(() => readJson(KEY_SETTINGS, DEFAULT_SETTINGS));
  const [phase, setPhase] = useState<GamePhase>("warning");
  const [log, setLog] = useState<LogItem[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [typing, setTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [auto, setAuto] = useState(false);
  const [skip, setSkip] = useState(false);
  const [bgUrl, setBgUrl] = useState(DEFAULT_BG);
  const [prevBgUrl, setPrevBgUrl] = useState("");
  const [currentAct, setCurrentAct] = useState("");
  const [activePanel, setActivePanel] = useState<string | null>(null);
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
  const [cgTitle, setCgTitle] = useState("");
  const [cgImageUrl, setCgImageUrl] = useState("");
  const [lowPerfMode, setLowPerfMode] = useState(false);
  const [hudAwake, setHudAwake] = useState(false);
  const [startTransitioning, setStartTransitioning] = useState(false);
  const [screenFlashVisible, setScreenFlashVisible] = useState(false);
  const [creditsRollReady, setCreditsRollReady] = useState(false);
  const [showQaPanel, setShowQaPanel] = useState(false);
  const [openQaIndex, setOpenQaIndex] = useState<number | null>(null);

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
    bgmRef.current.volume = settings.bgmVol / 100;
    sfxRef.current.volume = settings.sfxVol / 100;
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  const refreshBgmList = useCallback(() => {
    try {
      const manifest = JSON.parse(localStorage.getItem(KEY_MANIFEST) || "{}") as Manifest;
      setBgmList(manifest.bgm || []);
      setSfxList(manifest.sfx || []);
    } catch {
      setBgmList([]);
      setSfxList([]);
    }
  }, []);

  useEffect(() => {
    refreshBgmList();
  }, [refreshBgmList]);

  useEffect(() => {
    queueImagePreload(TITLE_SCREEN_BG);
    queueImagePreload(CORNER_IMG_URL);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const upcoming = new Set<string>();
    for (let i = index; i < Math.min(SCRIPT.lines.length, index + 8); i += 1) {
      upcoming.add(resolveBackgroundUrl(i));
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
  }, [index, phase]);

  useEffect(() => {
    if (phase !== "playing" || !curLine) return;
    let nextBg = DEFAULT_BG;
    const special = getSpecialBg(index);
    if (special) {
      nextBg = special;
    } else {
      const sceneBg = getSceneBg(curLine.scene);
      if (sceneBg) nextBg = sceneBg;
    }

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

      void ensureImageReady(nextBg)
        .catch(() => undefined)
        .then(() => {
          if (cancelled) return;
          setBgUrl(nextBg);
          lastBgRef.current = nextBg;
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
  }, [bgUrl, curLine, index, lowPerfMode, phase]);

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
    if (phase !== "playing" || !curLine?.cg) return;
    setCgTitle(curLine.cg);
    let cancelled = false;
    const cgUrl = getSceneBg(curLine.scene) || bgUrl || DEFAULT_BG;
    void ensureImageReady(cgUrl).then(() => {
      if (cancelled) return;
      setCgImageUrl(cgUrl);
      setCgVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [bgUrl, curLine, phase]);

  useEffect(() => {
    if (phase !== "playing" || !curLine) return;
    setStageChars(getSceneCharacters(SCRIPT.lines, index, curLine.speaker));
    const upcoming = new Set<string>();
    for (let i = index; i < Math.min(SCRIPT.lines.length, index + 6); i += 1) {
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
        const previousChar = nextText[ci - 1] || "";
        const pauseMultiplier = PAUSE_CHARS[previousChar] || 1;
        const effectiveDelay = settings.typeMs * pauseMultiplier;
        const delta = now - lastTime;
        if (delta >= effectiveDelay) {
          const step = pauseMultiplier > 1 ? 1 : Math.max(1, Math.floor(delta / settings.typeMs));
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

  const saveGame = useCallback(() => {
    const data = {
      index,
      log: log.slice(-50),
      act: currentAct,
      bgmName: currentBgmName,
    };
    localStorage.setItem(KEY_SAVE, JSON.stringify(data));
  }, [currentAct, currentBgmName, index, log]);

  const handleNext = useCallback(() => {
    if (phase !== "playing" || !curLine) return;
    if (cgVisible) {
      setCgVisible(false);
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
    setIndex((value) => Math.min(SCRIPT.lines.length, value + 1));
  }, [cgVisible, curLine, phase, typing]);

  const handlePrev = useCallback(() => {
    if (phase !== "playing") return;
    setAuto(false);
    setSkip(false);
    setTyping(false);
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
    setIndex(0);
    setLog([]);
    lastBgRef.current = "";
    setActivePanel(null);
    window.setTimeout(() => {
      setPhase("playing");
      setHudAwake(true);
    }, 260);
    window.setTimeout(() => {
      setScreenFlashVisible(false);
      setStartTransitioning(false);
    }, 720);
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
    setActivePanel((prev) => (prev === name ? null : name));
  };

  const uploadAsset = async (kind: "bg" | "sprite" | "bgm" | "sfx") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "bgm" || kind === "sfx" ? "audio/*" : "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const label = prompt("资源名称", file.name) || file.name;
      const id = `${kind}_${crypto.randomUUID()}`;
      await AssetDB.put(AssetDB.STORE_ASSETS, id, file);
      try {
        const manifest = JSON.parse(localStorage.getItem(KEY_MANIFEST) || "{}") as Record<string, { id: string; label: string }[]>;
        const key = kind === "bg" ? "backgrounds" : kind;
        manifest[key] = manifest[key] || [];
        manifest[key].unshift({ id, label });
        localStorage.setItem(KEY_MANIFEST, JSON.stringify(manifest));
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
        setCgVisible(false);
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
  }, [activePanel, cgVisible, handleNext, handlePrev, phase, saveGame, showLog, showQaPanel]);

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
      saveGame();
    }
  }, [index, phase, saveGame]);

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
  const currentBgmLabel = bgmList.find((item) => item.id === currentBgmId)?.label || currentBgmName || "";
  const bgmMoodClass = getBgmMoodClass(currentBgmLabel);
  const sceneProgress = `${Math.min(index + 1, SCRIPT.lines.length)}/${SCRIPT.lines.length}`;
  const titlePanelOpen = phase === "title" && (activePanel === "settings" || activePanel === "assets");

  const settingsPanelContent = (
    <>
      <div className="card">
        <div className="row">
          <span className="label">文字速度</span>
          <input type="range" min="0" max="60" value={settings.typeMs} onChange={(e) => setSettings((s) => ({ ...s, typeMs: Number(e.target.value) }))} />
          <span className="tiny mono">{settings.typeMs}ms</span>
        </div>
        <div className="row">
          <span className="label">自动间隔</span>
          <input type="range" min="180" max="2200" step="20" value={settings.autoMs} onChange={(e) => setSettings((s) => ({ ...s, autoMs: Number(e.target.value) }))} />
          <span className="tiny mono">{settings.autoMs}ms</span>
        </div>
        <div className="row">
          <span className="label">屏幕暗度</span>
          <input type="range" min="0" max="40" value={settings.dim} onChange={(e) => setSettings((s) => ({ ...s, dim: Number(e.target.value) }))} />
          <span className="tiny mono">{settings.dim}%</span>
        </div>
        <div className="row">
          <span className="label">立绘尺寸</span>
          <input type="range" min="140" max="420" step="10" value={settings.spriteW} onChange={(e) => setSettings((s) => ({ ...s, spriteW: Number(e.target.value) }))} />
          <span className="tiny mono">{settings.spriteW}px</span>
        </div>
        <div className="row">
          <span className="label">立绘透明度</span>
          <input type="range" min="0" max="100" value={settings.spriteOpacity} onChange={(e) => setSettings((s) => ({ ...s, spriteOpacity: Number(e.target.value) }))} />
          <span className="tiny mono">{settings.spriteOpacity}%</span>
        </div>
        <div className="row">
          <span className="label">背景缩放</span>
          <input type="range" min="100" max="150" value={settings.bgScale} onChange={(e) => setSettings((s) => ({ ...s, bgScale: Number(e.target.value) }))} />
          <span className="tiny mono">{settings.bgScale}%</span>
        </div>
        <div className="row">
          <span className="label">对话层透明</span>
          <input type="range" min="0" max="100" value={settings.uiAlpha} onChange={(e) => setSettings((s) => ({ ...s, uiAlpha: Number(e.target.value) }))} />
          <span className="tiny mono">{settings.uiAlpha}%</span>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setSettings(DEFAULT_SETTINGS)}>
            恢复默认
          </button>
          <span className="tiny">标题页只预览配置，开始游戏后仍可在左上角继续调整。</span>
        </div>
      </div>
    </>
  );

  const assetsPanelContent = (
    <>
      <div className="card">
        <div className="row">
          <button className="btn" onClick={() => uploadAsset("bg")}>
            上传背景
          </button>
          <button className="btn" onClick={() => uploadAsset("sprite")}>
            上传立绘
          </button>
          <button className="btn" onClick={() => uploadAsset("bgm")}>
            上传BGM
          </button>
          <button className="btn" onClick={() => uploadAsset("sfx")}>
            上传音效
          </button>
        </div>
        <div className="tiny">资源会保存在浏览器本地（IndexedDB）。</div>
        <div className="tiny" style={{ marginTop: 6 }}>TXT 导出会按原始路径完整输出源码；PDF 导出已移除。</div>
      </div>
      <div className="card">
        <div className="row">
          <span className="label">已上传BGM</span>
          <span className="tiny mono">{bgmList.length}</span>
        </div>
        <div className="row">
          <span className="label">已上传音效</span>
          <span className="tiny mono">{sfxList.length}</span>
        </div>
        <div className="tiny">建议文件名包含脚本关键词，便于自动匹配。</div>
      </div>
    </>
  );

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
        <div id="title-screen" className={titleReady ? "ready" : ""}>
          <div
            className="title-bg"
            style={{
              backgroundImage: `url("${TITLE_SCREEN_BG}")`,
              filter: "blur(7px)",
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
          <DustCanvas active lowPerfMode={lowPerfMode} />

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
              <button className="title-btn" onClick={() => setActivePanel("settings")}>
                <span className="title-btn-icon">⚙</span>
                <span>设置</span>
              </button>
              <button className="title-btn" onClick={() => setActivePanel("assets")}>
                <span className="title-btn-icon">♫</span>
                <span>资源管理</span>
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
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
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
                <div className="title-panel-body">{activePanel === "settings" ? settingsPanelContent : assetsPanelContent}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "credits" && (
        <div id="credits-screen" className="show">
          <div
            className="credits-bg"
            style={{
              backgroundImage: 'url("https://i.imgur.com/FAWl3AP.png")',
              filter: "blur(7px)",
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
        </div>
      )}

      {phase === "playing" && (
        <div className={`game-screen ${effectClasses} ${bgmMoodClass}`}>
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
          <DustCanvas active lowPerfMode={lowPerfMode} />
          <RainCanvas active={showRain} lowPerfMode={lowPerfMode} />

          <StageSprites stageChars={stageChars} spriteReadyMap={spriteReadyMap} />

          <div id="fx" />

          {cgVisible && (
            <div className="cg-overlay" onClick={() => setCgVisible(false)}>
              <div className="cg-panel" onClick={(event) => event.stopPropagation()}>
                <div className="cg-art" style={{ backgroundImage: `url("${cgImageUrl}")` }} />
                <div className="cg-meta">
                  <div className="cg-kicker">CG</div>
                  <div className="cg-title">{cgTitle}</div>
                  <button className="btn cg-close" onClick={() => setCgVisible(false)}>
                    继续
                  </button>
                </div>
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
            <button className="pbtn" onClick={saveGame}>
              存档
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

          <div className={`panel ${activePanel === "assets" ? "show" : ""}`}>
            {assetsPanelContent}
          </div>

          <div className={`panel ${activePanel === "settings" ? "show" : ""}`}>
            {settingsPanelContent}
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
            <div className="card">
              <div className="panel-title">BGM 控制</div>
              <div className="bgm-controls-row">
                <button className={`bgm-ctrl-btn ${bgmPlaying ? "active" : ""}`} onClick={toggleBgm}>
                  {bgmPlaying ? "⏸ 暂停" : "▶ 播放"}
                </button>
                <button className="bgm-ctrl-btn" onClick={stopBgm}>
                  ⏹ 停止
                </button>
                <button className={`bgm-ctrl-btn ${bgmMuted ? "muted" : ""}`} onClick={toggleMute}>
                  {bgmMuted ? "🔇 静音中" : "🔊 有声"}
                </button>
              </div>
              <div className="bgm-now-playing">
                {currentBgmLabel ? <span>正在播放：<strong>{currentBgmLabel}</strong></span> : <span className="bgm-no-music">未选择BGM</span>}
              </div>
            </div>
            <div className="card">
              <div className="panel-title">选择BGM</div>
              <div className="row">
                <select className="bgm-panel-select" value={currentBgmId} onChange={(e) => void loadAndPlayBgm(e.target.value)}>
                  <option value="">-- 无 --</option>
                  {bgmList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tiny">先在“资源”面板上传BGM文件，然后在这里选择播放。</div>
            </div>
            <div className="card">
              <div className="panel-title">音量</div>
              <div className="row">
                <span className="label">BGM音量</span>
                <input type="range" min="0" max="100" value={settings.bgmVol} onChange={(e) => setSettings((s) => ({ ...s, bgmVol: Number(e.target.value) }))} />
                <span className="tiny mono">{settings.bgmVol}%</span>
              </div>
              <div className="row">
                <span className="label">音效音量</span>
                <input type="range" min="0" max="100" value={settings.sfxVol} onChange={(e) => setSettings((s) => ({ ...s, sfxVol: Number(e.target.value) }))} />
                <span className="tiny mono">{settings.sfxVol}%</span>
              </div>
            </div>
            <div className="card">
              <div className="panel-title">音效资源</div>
              <div className="tiny">已上传音效：{sfxList.length}</div>
              <div className="tiny" style={{ marginTop: 4 }}>建议文件名包含脚本关键词，比如“心跳声加速”“滑倒声”“敲门声”。</div>
            </div>
          </div>

          <div id="hud" style={{ display: curLine ? "block" : "none" }}>
            <FloatingBgm label={currentBgmLabel} playing={bgmPlaying && !bgmMuted} muted={bgmMuted} moodClass={bgmMoodClass} />
            <div
              id="box"
              className={`${!typing && curLine?.kind !== "choice" ? "can-advance" : ""} ${curLine?.kind === "choice" ? "choice-mode" : ""}`.trim()}
              onClick={() => { if (!curLine?.options) handleNext(); }}
            >
              <div id="name" style={{ display: showName ? "flex" : "none" }}>
                <span className="name-line-left" style={{ background: `linear-gradient(to right, transparent 0%, ${speakerColor} 100%)` }} />
                <span className="name-text-inner" style={{ color: speakerColor, borderColor: speakerColor.replace("0.95", "0.32") }}>
                  <span>{speaker}</span>
                </span>
                <span className="name-line-right" style={{ background: `linear-gradient(to left, transparent 0%, ${speakerColor} 100%)` }} />
              </div>

              <div id="text" className={`${textVisible ? "show" : "text-exit"}`}>
                {curLine?.kind === "choice" ? "请选择：" : displayedText}
              </div>

              <div id="choices" className={curLine?.kind === "choice" ? "show" : ""}>
                {curLine?.kind === "choice" && <div className="choices-kicker">命运分歧</div>}
                {curLine?.kind === "choice" &&
                  curLine.options?.map((opt, idx) => (
                    <button key={`${opt.text}_${idx}`} className="choice" onClick={(e) => { e.stopPropagation(); handleChoice(opt.cmd); }}>
                      {opt.text}
                    </button>
                  ))}
              </div>

              <div id="subline">
                <div className="left">
                  <span className="story-meta-label">CHAPTER</span>
                  <span className="story-meta-value">{currentAct || "__ACT__"}</span>
                </div>
                <div className="right">
                  <span className="story-meta-label">COUNT</span>
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
        </div>
      )}

      <div className={`screen-flash ${screenFlashVisible ? "show start-flash" : ""}`}>
        <div className="screen-flash-title">盛开在谎言之上</div>
      </div>
    </div>
  );
}
