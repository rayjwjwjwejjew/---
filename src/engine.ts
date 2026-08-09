import { RAW_SCRIPT } from "./script";
import { DEFAULT_BG, SCENE_BG, getScenePresentation } from "./vnStoryPresentation";

export { DEFAULT_BG, SCENE_BG, getCgImage, getSceneBg, getScenePresentation } from "./vnStoryPresentation";

export interface ScriptLine {
  kind: "line" | "title" | "label" | "choice";
  act: string;
  speaker?: string;
  text?: string;
  name?: string;
  scene?: string;
  options?: { text: string; cmd: string }[];
  bgm?: string;
  sfx?: string;
  effect?: string;
  transition?: string;
  cg?: string;
}

export interface ParsedScript {
  lines: ScriptLine[];
  labelMap: Map<string, number>;
}

type CharacterExpression = "calm" | "hesitant" | "panic" | "breakdown" | "shadow";

const PUBLIC_CHARACTER_BASE = `${import.meta.env.BASE_URL}characters/`;

export const CHARACTER_SPRITES: Record<string, string> = {
  锐: `${PUBLIC_CHARACTER_BASE}rui-calm.webp`,
  蒋: `${PUBLIC_CHARACTER_BASE}jiang.webp`,
  俞: `${PUBLIC_CHARACTER_BASE}yu.webp`,
  小猫: `${PUBLIC_CHARACTER_BASE}yu.webp`,
  图书管理员老师: `${PUBLIC_CHARACTER_BASE}librarian.webp`,
  何老师: `${PUBLIC_CHARACTER_BASE}teacher-he.webp`,
  老师A: `${PUBLIC_CHARACTER_BASE}teacher-a.webp`,
  老师B: `${PUBLIC_CHARACTER_BASE}teacher-b.webp`,
  教导处老师: `${PUBLIC_CHARACTER_BASE}discipline-teacher.webp`,
  旁边老师: `${PUBLIC_CHARACTER_BASE}teacher-side.webp`,
  孙学长: `${PUBLIC_CHARACTER_BASE}senior-sun.webp`,
  "？？学长": `${PUBLIC_CHARACTER_BASE}senior-sun.webp`,
  学长: `${PUBLIC_CHARACTER_BASE}senior-sun.webp`,
  "？？？": `${PUBLIC_CHARACTER_BASE}yu.webp`,
  植物人学长的妈妈: `${PUBLIC_CHARACTER_BASE}senior-mother.gif`,
  马佳宁: `${PUBLIC_CHARACTER_BASE}librarian.webp`,
  调查员甲: `${PUBLIC_CHARACTER_BASE}discipline-teacher.webp`,
  调查员乙: `${PUBLIC_CHARACTER_BASE}teacher-side.webp`,
  校领导: `${PUBLIC_CHARACTER_BASE}discipline-teacher.webp`,
  金仕涵: `${PUBLIC_CHARACTER_BASE}jin-shihan.webp`,
  体育组组长: `${PUBLIC_CHARACTER_BASE}teacher-a.webp`,
  年级组长: `${PUBLIC_CHARACTER_BASE}teacher-a.webp`,
  女警员: `${PUBLIC_CHARACTER_BASE}librarian.webp`,
};

const CHARACTER_VARIANTS: Partial<Record<keyof typeof CHARACTER_SPRITES, Partial<Record<CharacterExpression, string>>>> = {
  锐: { hesitant: `${PUBLIC_CHARACTER_BASE}rui-hesitant.webp` },
};

export const CHARACTER_COLORS: Record<string, string> = {
  锐: "rgba(128, 191, 255, 0.95)",
  蒋: "rgba(255, 193, 122, 0.95)",
  俞: "rgba(176, 226, 177, 0.95)",
  何老师: "rgba(199, 166, 232, 0.95)",
  马佳宁: "rgba(255, 183, 199, 0.95)",
  孙学长: "rgba(236, 214, 139, 0.95)",
};

const SFX_EFFECT_MAP: Record<string, string> = {
  心跳声加速: "shake",
  心跳声: "shake",
  惊恐的心跳声: "shake",
  突然的拉扯声: "shake",
  铁锁断裂声: "shake",
  金属碰撞声: "shake",
  滑倒声: "shake",
  指甲划过硬物的声音: "shake",
  球落入黑暗的回响: "darken",
  厚重的铁门开启声: "shake",
};

const BGM_MOOD_MAP: Record<string, string> = {
  悲伤钢琴曲: "darken",
  日常校园曲: "brighten",
  轻快的运动曲: "brighten",
  渐渐转为压抑的氛围曲: "darken",
  恐怖悬疑曲: "darken",
  平静但带有不安的夜曲: "darken",
  不安的夜曲: "darken",
  疑惑的日常曲: "none",
  热闹的校园活动曲: "brighten",
  若有所思的曲调: "none",
  沉重的对话曲: "darken",
  悬疑调查曲: "darken",
  紧张的对话曲: "none",
  压抑的氛围曲: "darken",
  转折的调查曲: "none",
  安静的调查曲: "none",
  悲伤的探访曲: "darken",
  忧郁的钢琴曲: "darken",
  压抑的日常曲: "darken",
  紧张的高潮曲: "shake",
  纠结的情感曲: "darken",
  沉重的揭示曲: "darken",
  紧张的潜入曲: "shake",
  沉重的审判曲: "darken",
  治愈的告别曲: "brighten",
  安静的钢琴独奏: "brighten",
};

const ACT_DEFAULT_BGM: Array<[RegExp, string]> = [
  [/第一幕/, "悲伤钢琴曲"],
  [/第二幕/, "日常校园曲"],
  [/第三幕/, "不安的夜曲"],
  [/第四幕/, "疑惑的日常曲"],
  [/第五幕/, "若有所思的曲调"],
  [/第六幕/, "悬疑调查曲"],
  [/第七幕/, "转折的调查曲"],
  [/第八幕/, "悲伤的探访曲"],
  [/过渡幕/, "忧郁的钢琴曲"],
  [/第九幕/, "压抑的日常曲"],
  [/第十幕/, "紧张的高潮曲"],
  [/第十一幕/, "纠结的情感曲"],
  [/第十二幕/, "沉重的揭示曲"],
  [/第十三幕/, "紧张的潜入曲"],
  [/第十四幕/, "沉重的审判曲"],
  [/尾声/, "治愈的告别曲"],
];

function getActDefaultBgm(act: string): string | undefined {
  return ACT_DEFAULT_BGM.find(([pattern]) => pattern.test(act))?.[1];
}

export function parseScript(raw: string): ParsedScript {
  const linesRaw = raw.split(/\r?\n/);
  const out: ScriptLine[] = [];
  let act = "第一幕";
  let bracketSpeaker: string | null = null;
  let currentScene: string | undefined;
  let currentBgm = getActDefaultBgm(act);
  let pendingSfx: string | undefined;
  let pendingEffect: string | undefined;
  let pendingTransition: string | undefined;
  let pendingCg: string | undefined;

  const flushLine = (line: Omit<ScriptLine, "act">) => {
    out.push({ act, bgm: line.bgm ?? currentBgm, ...line });
    pendingSfx = undefined;
    pendingEffect = undefined;
    pendingTransition = undefined;
    pendingCg = undefined;
  };

  for (let i = 0; i < linesRaw.length; i += 1) {
    let line = linesRaw[i].trim();
    if (!line) continue;

    const actMatch = line.match(/^第([一二三四五六七八九十百0-9]+)幕：(.+)$/);
    const transMatch = line.match(/^(过渡幕|尾声)：(.+)$/);
    if (actMatch || transMatch) {
      act = actMatch ? `第${actMatch[1]}幕：${actMatch[2].trim()}` : `${transMatch![1]}：${transMatch![2].trim()}`;
      currentBgm = getActDefaultBgm(act);
      flushLine({
        kind: "title",
        speaker: "SYSTEM",
        text: act,
        scene: currentScene,
        effect: pendingEffect ?? (currentBgm ? BGM_MOOD_MAP[currentBgm] : undefined),
        transition: "fade-black",
        cg: pendingCg,
      });
      bracketSpeaker = null;
      continue;
    }

    if (line.startsWith("::")) {
      flushLine({ kind: "label", name: line.slice(2).trim(), scene: currentScene });
      bracketSpeaker = null;
      continue;
    }

    const bracket = line.match(/^【(.+?)】$/);
    if (bracket) {
      const tag = bracket[1].trim();
      if (tag.startsWith("场景：") || tag.startsWith("场景:")) {
        currentScene = tag.replace(/^场景[：:]/, "").trim();
        const presentation = getScenePresentation(currentScene);
        pendingTransition = presentation.transition;
        pendingEffect = presentation.effect ?? pendingEffect;
        bracketSpeaker = null;
        continue;
      }
      if (tag.startsWith("BGM：") || tag.startsWith("BGM:")) {
        currentBgm = tag.replace(/^BGM[：:]/, "").trim();
        pendingEffect = pendingEffect ?? BGM_MOOD_MAP[currentBgm];
        bracketSpeaker = null;
        continue;
      }
      if (tag.startsWith("音效：") || tag.startsWith("音效:")) {
        pendingSfx = tag.replace(/^音效[：:]/, "").trim();
        pendingEffect = SFX_EFFECT_MAP[pendingSfx] ?? pendingEffect;
        bracketSpeaker = null;
        continue;
      }
      if (tag.startsWith("CG：") || tag.startsWith("CG:")) {
        pendingCg = tag.replace(/^CG[：:]/, "").trim();
        pendingTransition = pendingTransition ?? "fade-white";
        bracketSpeaker = null;
        continue;
      }
      bracketSpeaker = tag.includes("·内心") ? "SKIP_INNER" : tag;
      continue;
    }

    if (bracketSpeaker === "SKIP_INNER") continue;

    if (line.toLowerCase() === "[[choice]]") {
      const options: { text: string; cmd: string }[] = [];
      while (i + 1 < linesRaw.length) {
        const next = linesRaw[i + 1].trim();
        if (!next) {
          i += 1;
          continue;
        }
        if (!/^(-\s*)?.+\s*->\s*.+$/.test(next)) break;
        i += 1;
        const [text = "……", cmd = ""] = next.replace(/^-+\s*/, "").split("->").map((item) => item.trim());
        options.push({ text, cmd });
      }
      flushLine({ kind: "choice", speaker: "SYSTEM", options, scene: currentScene, sfx: pendingSfx, effect: pendingEffect, transition: pendingTransition, cg: pendingCg });
      bracketSpeaker = null;
      continue;
    }

    if (line.startsWith("@jump ")) {
      flushLine({ kind: "line", speaker: "SYSTEM", text: `JUMP:${line.replace("@jump", "").trim()}`, scene: currentScene });
      continue;
    }

    line = line.replace(/^\*+(.+?)\*+\s*/, "$1");
    const dialogueIdx = line.indexOf("：");
    if (dialogueIdx > 0 && dialogueIdx < 24) {
      flushLine({
        kind: "line",
        speaker: line.slice(0, dialogueIdx).replace(/^\*+|\*+$/g, "").trim(),
        text: line.slice(dialogueIdx + 1).trim() || "……",
        scene: currentScene,
        sfx: pendingSfx,
        effect: pendingEffect,
        transition: pendingTransition,
        cg: pendingCg,
      });
      bracketSpeaker = null;
      continue;
    }

    flushLine({ kind: "line", speaker: bracketSpeaker ?? "旁白", text: line, scene: currentScene, sfx: pendingSfx, effect: pendingEffect, transition: pendingTransition, cg: pendingCg });
  }

  const labelMap = new Map<string, number>();
  out.forEach((item, index) => {
    if (item.kind === "label" && item.name) labelMap.set(item.name, index);
  });
  return { lines: out, labelMap };
}

export const SCRIPT = parseScript(RAW_SCRIPT);

export interface StageCharacter {
  name: string;
  position: "left" | "center" | "right";
  spriteUrl: string;
  isSpeaking: boolean;
  expression: CharacterExpression;
}

function inferExpression(line: ScriptLine | undefined, speaker: string, isSpeaking: boolean): CharacterExpression {
  if (!line || !speaker) return "calm";
  if (!isSpeaking) return line.effect === "darken" || /地下室|深夜|秘密|调查/.test(line.scene || "") ? "shadow" : "calm";

  const stageText = [line.text || "", line.scene || "", line.effect || "", line.sfx || ""].join(" ");
  if (/(崩溃|怒气|流泪|哽咽|怒|失控|眼眶湿润|痛哭|撕心裂肺)/.test(stageText)) return "breakdown";
  if (line.effect === "shake" || /(惊恐|恐惧|颤抖|喘着气|不见了|怎么了|等等|喂|靠|呼|害怕|别|快)/.test(stageText)) return "panic";
  if (line.effect === "darken" || /(地下室|黑暗|秘密|调查|沉重|压抑|冷|空洞|死寂|没有回答)/.test(stageText)) return "shadow";
  if (/(沉默|犹豫|迟疑|轻声|低声|顿了一下|苦笑|半信半疑|将信将疑|……)/.test(stageText)) return "hesitant";
  return "calm";
}

function resolveCharacterSprite(name: string, expression: CharacterExpression): string {
  return CHARACTER_VARIANTS[name as keyof typeof CHARACTER_VARIANTS]?.[expression] || CHARACTER_SPRITES[name];
}

export function getSceneCharacters(lines: ScriptLine[], currentIndex: number, currentSpeaker: string | undefined): StageCharacter[] {
  const curScene = lines[currentIndex]?.scene;
  const recent: string[] = [];
  for (let i = currentIndex; i >= Math.max(0, currentIndex - 15); i -= 1) {
    const line = lines[i];
    if (line.scene !== curScene && line.scene && curScene) break;
    if (line.speaker && line.speaker !== "旁白" && line.speaker !== "SYSTEM" && CHARACTER_SPRITES[line.speaker] && !recent.includes(line.speaker)) recent.push(line.speaker);
    if (recent.length >= 3) break;
  }
  if (recent.length === 0 && currentSpeaker && CHARACTER_SPRITES[currentSpeaker]) recent.push(currentSpeaker);
  if (recent.length === 0) return [];

  const positions: StageCharacter["position"][] = recent.length === 1 ? ["center"] : recent.length === 2 ? ["left", "right"] : ["left", "center", "right"];
  return recent.map((name, index) => {
    const isSpeaking = name === currentSpeaker;
    const expression = inferExpression(lines[currentIndex], name, isSpeaking);
    return {
      expression,
      name,
      position: positions[index] ?? "center",
      spriteUrl: resolveCharacterSprite(name, expression),
      isSpeaking,
    };
  });
}

export const ALL_CONTENT_IMAGES = Array.from(new Set([
  DEFAULT_BG,
  ...Object.values(SCENE_BG),
  ...Object.values(CHARACTER_SPRITES),
  ...Object.values(CHARACTER_VARIANTS).flatMap((variants) => Object.values(variants || {})),
]));
