import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssetDB } from "./db";
import { getBgmMoodClass, getCurrentBgmLabel } from "./vnDerived";
import type { Settings } from "./vnCore";

type AudioItem = { id: string; label: string };

type UseAudioRuntimeArgs = {
  settings: Settings;
  bgmList: AudioItem[];
};

type SfxLayer = "ui" | "scene" | "story" | "cg" | "emotion";

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
  const audioCtxRef = useRef<AudioContext | null>(null);
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

  const ensureAudioContext = useCallback(() => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtxRef.current = new Ctor();
    return audioCtxRef.current;
  }, []);

  const playLayerTone = useCallback(
    (layer: SfxLayer) => {
      if (settings.sfxVol <= 0) return;
      const ctx = ensureAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => undefined);
      }

      const master = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const vol = settings.sfxVol / 100;
      const now = ctx.currentTime;
      const config: Record<SfxLayer, { type: OscillatorType; base: number; peak: number; dur: number; q: number }> = {
        ui: { type: "triangle", base: 640, peak: 920, dur: 0.08, q: 0.75 },
        scene: { type: "sine", base: 260, peak: 380, dur: 0.16, q: 0.9 },
        story: { type: "triangle", base: 180, peak: 300, dur: 0.24, q: 0.82 },
        cg: { type: "sine", base: 120, peak: 220, dur: 0.36, q: 0.7 },
        emotion: { type: "square", base: 320, peak: 540, dur: 0.28, q: 1.1 },
      };
      const item = config[layer];
      master.gain.setValueAtTime(vol * 0.22, now);
      master.gain.exponentialRampToValueAtTime(vol * 0.04, now + item.dur);
      filter.type = layer === "cg" ? "lowpass" : "bandpass";
      filter.frequency.setValueAtTime(item.base, now);
      filter.frequency.exponentialRampToValueAtTime(item.peak, now + item.dur * 0.55);
      filter.Q.value = item.q;
      osc.type = item.type;
      osc.frequency.setValueAtTime(item.base, now);
      osc.frequency.exponentialRampToValueAtTime(item.peak, now + item.dur * 0.32);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      master.connect(ctx.destination);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.9, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + item.dur);
      osc.start(now);
      osc.stop(now + item.dur + 0.02);
    },
    [ensureAudioContext, settings.sfxVol],
  );

  const pulseUi = useCallback(
    (layer: SfxLayer = "ui") => {
      if (uiPulseRef.current) window.clearTimeout(uiPulseRef.current);
      playLayerTone(layer);
      uiPulseRef.current = window.setTimeout(() => {
        uiPulseRef.current = null;
      }, 120);
    },
    [playLayerTone],
  );

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
      audioCtxRef.current?.close().catch(() => undefined);
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
