import { memo, useEffect, useRef } from "react";
import type { StageCharacter } from "./engine";

export const RainCanvas = memo(function RainCanvas({
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

export const DustCanvas = memo(function DustCanvas({
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

export const StageSprites = memo(function StageSprites({
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
