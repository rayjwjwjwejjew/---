import { useCallback, useEffect, useRef, useState } from "react";
import { AssetDB } from "./db";
import type { IdentifiedScriptLine } from "./engine";
import { STORAGE_KEYS, type AssetEntry, type Settings } from "./vnCore";

export type VoiceBindings = Record<string, string>;

function readBindings(): VoiceBindings {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.voiceBindings) || "{}") as VoiceBindings;
  } catch {
    return {};
  }
}

type UseVoiceRuntimeArgs = {
  line?: IdentifiedScriptLine;
  phase: string;
  settings: Settings;
  voiceList: AssetEntry[];
  onVoiceActive: (active: boolean) => void;
};

export function useVoiceRuntime({ line, phase, settings, voiceList, onVoiceActive }: UseVoiceRuntimeArgs) {
  const [bindings, setBindings] = useState<VoiceBindings>(readBindings);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const audioUrlRef = useRef("");
  const playTokenRef = useRef(0);

  const finishVoice = useCallback(() => {
    setVoicePlaying(false);
    onVoiceActive(false);
  }, [onVoiceActive]);

  const stopVoice = useCallback(() => {
    playTokenRef.current += 1;
    audioRef.current.pause();
    audioRef.current.removeAttribute("src");
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = "";
    window.speechSynthesis?.cancel();
    finishVoice();
  }, [finishVoice]);

  useEffect(() => {
    audioRef.current.preload = "auto";
    const updateVoices = () => setSystemVoices(window.speechSynthesis?.getVoices() || []);
    updateVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", updateVoices);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", updateVoices);
  }, []);

  useEffect(() => {
    audioRef.current.volume = settings.voiceVol / 100;
    audioRef.current.muted = settings.voiceMuted;
  }, [settings.voiceMuted, settings.voiceVol]);

  useEffect(() => {
    stopVoice();
    if (phase !== "playing" || !line?.lineId || !line.text || line.kind === "choice" || line.kind === "label" || line.speaker === "SYSTEM" || settings.voiceMuted) return;
    const token = playTokenRef.current;
    const finishCurrentVoice = () => {
      if (token === playTokenRef.current) finishVoice();
    };
    const speakWithTts = () => {
      if (token !== playTokenRef.current || !settings.ttsEnabled || !window.speechSynthesis) return;
      const utterance = new SpeechSynthesisUtterance(line.text);
      utterance.lang = "zh-CN";
      utterance.rate = settings.ttsRate / 100;
      utterance.pitch = settings.ttsPitch / 100;
      utterance.voice = systemVoices.find((voice) => voice.lang.toLowerCase().startsWith("zh")) || null;
      utterance.onend = finishCurrentVoice;
      utterance.onerror = finishCurrentVoice;
      setVoicePlaying(true);
      onVoiceActive(true);
      window.speechSynthesis.speak(utterance);
    };
    const assetId = bindings[line.lineId];
    if (assetId && voiceList.some((item) => item.id === assetId)) {
      void AssetDB.get<Blob>(AssetDB.STORE_ASSETS, assetId).then((blob) => {
        if (token !== playTokenRef.current) return;
        if (!blob) {
          speakWithTts();
          return;
        }
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        audioRef.current.src = url;
        audioRef.current.volume = settings.voiceVol / 100;
        audioRef.current.muted = settings.voiceMuted;
        audioRef.current.onended = finishCurrentVoice;
        audioRef.current.onerror = finishCurrentVoice;
        setVoicePlaying(true);
        onVoiceActive(true);
        void audioRef.current.play().catch(() => {
          if (audioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            audioUrlRef.current = "";
          }
          speakWithTts();
        });
      });
      return;
    }
    speakWithTts();
  }, [bindings, finishVoice, line, onVoiceActive, phase, settings.ttsEnabled, settings.ttsPitch, settings.ttsRate, settings.voiceMuted, settings.voiceVol, stopVoice, systemVoices, voiceList]);

  useEffect(() => stopVoice, [stopVoice]);

  const bindVoice = useCallback((lineId: string, assetId: string) => {
    setBindings((current) => {
      const next = { ...current };
      if (assetId) next[lineId] = assetId;
      else delete next[lineId];
      localStorage.setItem(STORAGE_KEYS.voiceBindings, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    bindings,
    bindVoice,
    stopVoice,
    voicePlaying,
    systemVoices,
  };
}
