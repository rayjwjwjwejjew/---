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

function getTypingDelay(text: string, index: number, baseMs: number) {
  const char = text[index - 1] || "";
  let delay = baseMs * (PAUSE_CHARS[char] || 1);
  if (delay === baseMs) {
    const windowText = text.slice(Math.max(0, index - 4), index + 4);
    if (SMART_PAUSE_WORDS.some((word) => windowText.includes(word))) delay *= 1.8;
    if (EMOTION_WORDS.some((word) => windowText.includes(word))) delay *= 1.35;
  }
  return Math.max(12, Math.round(delay));
}

export type PlaybackTextStore = {
  getSnapshot: () => string;
  subscribe: (listener: () => void) => () => void;
};

type PlayTextOptions = {
  text: string;
  typeMs: number;
  instant: boolean;
  startDelayMs?: number;
  onStart: () => void;
  onReveal: () => void;
  onComplete: () => void;
};

export type PlaybackTextRuntime = PlaybackTextStore & {
  play: (options: PlayTextOptions) => void;
  complete: () => boolean;
  cancel: () => void;
};

export function createPlaybackTextRuntime(initialText = ""): PlaybackTextRuntime {
  let currentText = initialText;
  let targetText = initialText;
  let running = false;
  let frameId: number | null = null;
  let delayId: number | null = null;
  let completeCallback: (() => void) | null = null;
  let revealCallback: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const setText = (text: string) => {
    if (text === currentText) return;
    currentText = text;
    listeners.forEach((listener) => listener());
  };

  const clearTimers = () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    if (delayId !== null) window.clearTimeout(delayId);
    frameId = null;
    delayId = null;
  };

  const finish = () => {
    clearTimers();
    if (!running) return;
    running = false;
    const callback = completeCallback;
    completeCallback = null;
    callback?.();
  };

  const cancel = () => {
    clearTimers();
    running = false;
    completeCallback = null;
    revealCallback = null;
  };

  return {
    getSnapshot: () => currentText,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play: ({ text, typeMs, instant, startDelayMs = 120, onStart, onReveal, onComplete }) => {
      cancel();
      targetText = text;
      running = true;
      completeCallback = onComplete;
      revealCallback = onReveal;
      onStart();
      delayId = window.setTimeout(() => {
        delayId = null;
        setText("");
        revealCallback?.();
        revealCallback = null;
        if (instant || typeMs === 0) {
          setText(targetText);
          finish();
          return;
        }

        let characterIndex = 0;
        let lastTime = performance.now();
        const frame = (now: number) => {
          const effectiveDelay = getTypingDelay(targetText, characterIndex, typeMs);
          const delta = now - lastTime;
          if (delta >= effectiveDelay) {
            const previousChar = targetText[characterIndex - 1] || "";
            const step = PAUSE_CHARS[previousChar] ? 1 : Math.max(1, Math.floor(delta / Math.max(1, typeMs)));
            characterIndex = Math.min(targetText.length, characterIndex + step);
            setText(targetText.slice(0, characterIndex));
            lastTime = now;
          }
          if (characterIndex < targetText.length) {
            frameId = requestAnimationFrame(frame);
          } else {
            finish();
          }
        };
        frameId = requestAnimationFrame(frame);
      }, startDelayMs);
    },
    complete: () => {
      if (!running) return false;
      clearTimers();
      revealCallback?.();
      revealCallback = null;
      setText(targetText);
      finish();
      return true;
    },
    cancel,
  };
}
