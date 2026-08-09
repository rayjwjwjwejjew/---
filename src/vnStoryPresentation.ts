const PUBLIC_BG_BASE = `${import.meta.env.BASE_URL}scene-bg/`;
const PUBLIC_CG_BASE = `${import.meta.env.BASE_URL}cg/`;

const STORY_ASSETS = {
  schoolExterior: `${PUBLIC_BG_BASE}story-school-exterior.webp`,
  corridorDay: `${PUBLIC_BG_BASE}story-corridor-day.webp`,
  classroom: `${PUBLIC_BG_BASE}story-classroom.webp`,
  cafeteria: `${PUBLIC_BG_BASE}story-cafeteria.webp`,
  basement: `${PUBLIC_BG_BASE}story-basement.webp`,
  basementDoor: `${PUBLIC_BG_BASE}basement-door.png`,
  dormNight: `${PUBLIC_BG_BASE}story-dorm-night.webp`,
  dormDay: `${PUBLIC_BG_BASE}dorm-room.png`,
  hospitalExterior: `${PUBLIC_BG_BASE}story-hospital-exterior.webp`,
  hospitalCorridor: `${PUBLIC_BG_BASE}story-hospital-corridor.webp`,
  hospitalRoom: `${PUBLIC_BG_BASE}hospital-room.png`,
  library: `${PUBLIC_BG_BASE}library.png`,
  baseballDay: `${PUBLIC_BG_BASE}school-front.png`,
  baseballNight: `${PUBLIC_BG_BASE}story-baseball-night.webp`,
  rainWindow: `${PUBLIC_BG_BASE}story-rain-window.webp`,
  rooftopSunset: `${PUBLIC_BG_BASE}rooftop-sunset.png`,
  teacherRoom: `${PUBLIC_BG_BASE}teacher-room.png`,
  adminBuilding: `${PUBLIC_BG_BASE}story-admin-building.webp`,
} as const;

export const DEFAULT_BG = STORY_ASSETS.schoolExterior;

export const SCENE_BG = {
  underground: STORY_ASSETS.basement,
  undergroundDark: STORY_ASSETS.basement,
  undergroundDoor: STORY_ASSETS.basementDoor,
  corridor: STORY_ASSETS.corridorDay,
  corridorNight: STORY_ASSETS.corridorDay,
  dormNight: STORY_ASSETS.dormNight,
  dormDay: STORY_ASSETS.dormDay,
  cafeteria: STORY_ASSETS.cafeteria,
  library: STORY_ASSETS.library,
  hospital: STORY_ASSETS.hospitalExterior,
  hospitalCorridor: STORY_ASSETS.hospitalCorridor,
  hospitalRoom: STORY_ASSETS.hospitalRoom,
  sportsField: STORY_ASSETS.baseballDay,
  sportsEvening: STORY_ASSETS.baseballNight,
  basketball: STORY_ASSETS.baseballNight,
  classroom: STORY_ASSETS.classroom,
  classroomEmpty: STORY_ASSETS.rainWindow,
  rooftopSunset: STORY_ASSETS.rooftopSunset,
  rooftopDay: STORY_ASSETS.schoolExterior,
  dreamField: STORY_ASSETS.schoolExterior,
  rainy: STORY_ASSETS.schoolExterior,
  rainyHeavy: STORY_ASSETS.schoolExterior,
  bus: STORY_ASSETS.schoolExterior,
  office: STORY_ASSETS.adminBuilding,
  gymnasium: STORY_ASSETS.schoolExterior,
  schoolBldg: STORY_ASSETS.schoolExterior,
  schoolDawn: STORY_ASSETS.adminBuilding,
  schoolNight: STORY_ASSETS.adminBuilding,
  garden: STORY_ASSETS.schoolExterior,
  gardenRain: STORY_ASSETS.schoolExterior,
  teacherRoom: STORY_ASSETS.teacherRoom,
  adminBldg: STORY_ASSETS.adminBuilding,
  schoolEvent: STORY_ASSETS.baseballDay,
  stands: STORY_ASSETS.schoolExterior,
  policeScene: STORY_ASSETS.adminBuilding,
  nightSky: STORY_ASSETS.adminBuilding,
  overcast: STORY_ASSETS.schoolExterior,
  sunset: STORY_ASSETS.rooftopSunset,
  meetingRoom: STORY_ASSETS.teacherRoom,
} as const;

export type ScenePresentation = {
  background: string | null;
  transition: "cut" | "dissolve" | "fade-black" | "fade-white" | "expand" | "blinds";
  effect?: "rain" | "blur";
};

type SceneRule = {
  test: RegExp;
  background: string;
};

// Keep the rules ordered from most specific to broadest so a new scene can be
// matched by adding one small entry instead of changing runtime control flow.
const SCENE_RULES: SceneRule[] = [
  { test: /地下室.*(门口|入口)/, background: SCENE_BG.undergroundDoor },
  { test: /地下室/, background: SCENE_BG.undergroundDark },
  { test: /附属医院门口/, background: SCENE_BG.hospital },
  { test: /病房内/, background: SCENE_BG.hospitalRoom },
  { test: /病房门口/, background: SCENE_BG.hospitalCorridor },
  { test: /医院/, background: SCENE_BG.hospital },
  { test: /图书馆/, background: SCENE_BG.library },
  { test: /食堂/, background: SCENE_BG.cafeteria },
  { test: /何老师房间|教工宿舍/, background: SCENE_BG.teacherRoom },
  { test: /行政楼.*小会议室外/, background: SCENE_BG.adminBldg },
  { test: /会议室外走廊/, background: SCENE_BG.corridor },
  { test: /小会议室内|会议室$/, background: SCENE_BG.meetingRoom },
  { test: /教导处|办公/, background: SCENE_BG.office },
  { test: /校友返校日活动现场/, background: SCENE_BG.schoolEvent },
  { test: /体育馆|大会/, background: SCENE_BG.gymnasium },
  { test: /空无一人的篮球场|篮球场/, background: SCENE_BG.basketball },
  { test: /操场.*(傍晚|晚)/, background: SCENE_BG.sportsEvening },
  { test: /操场|宿舍楼下/, background: SCENE_BG.sportsField },
  { test: /(寝室|宿舍).*(夜|深夜)/, background: SCENE_BG.dormNight },
  { test: /寝室|宿舍/, background: SCENE_BG.dormDay },
  { test: /暴雨中的花园/, background: SCENE_BG.gardenRain },
  { test: /学校花园旧址/, background: SCENE_BG.garden },
  { test: /(花园|花圃).*(暴雨|雨)/, background: SCENE_BG.gardenRain },
  { test: /花园|花圃/, background: SCENE_BG.garden },
  { test: /教室窗边/, background: SCENE_BG.classroomEmpty },
  { test: /教学楼内|走廊/, background: SCENE_BG.corridor },
  { test: /教室|早读|自习|教学楼窗边/, background: SCENE_BG.classroom },
  { test: /天台.*夕阳/, background: SCENE_BG.rooftopSunset },
  { test: /天台/, background: SCENE_BG.rooftopDay },
  { test: /回学校|公交车/, background: SCENE_BG.bus },
  { test: /梦境|回忆/, background: SCENE_BG.dreamField },
  { test: /黎明/, background: SCENE_BG.schoolDawn },
  { test: /调查|警/, background: SCENE_BG.policeScene },
  { test: /阴/, background: SCENE_BG.overcast },
  { test: /黄昏|夕阳|傍晚/, background: SCENE_BG.sunset },
  { test: /夜/, background: SCENE_BG.schoolNight },
  { test: /学校|教学楼/, background: SCENE_BG.schoolBldg },
];

function getSceneTransition(scene: string): ScenePresentation["transition"] {
  if (/梦境|回忆/.test(scene)) return "fade-white";
  if (/花园|操场|天台/.test(scene)) return "expand";
  if (/会议室|体育馆|大会/.test(scene)) return "blinds";
  if (/夜|深夜|地下室|暴雨/.test(scene)) return "fade-black";
  return "dissolve";
}

function getSceneEffect(scene: string): ScenePresentation["effect"] {
  if (/暴雨|雨/.test(scene)) return "rain";
  if (/梦境|回忆/.test(scene)) return "blur";
  return undefined;
}

export function getSceneBg(scene: string | undefined): string | null {
  return scene ? SCENE_RULES.find((rule) => rule.test.test(scene))?.background ?? null : null;
}

export function getScenePresentation(scene: string | undefined): ScenePresentation {
  const source = scene || "";
  return {
    background: getSceneBg(scene),
    transition: getSceneTransition(source),
    effect: getSceneEffect(source),
  };
}

export function getCgImage(cg: string | undefined, scene?: string): string | null {
  if (!cg) return null;
  if (cg.includes("血脸")) return `${PUBLIC_CG_BASE}blood-face.webp`;
  if (cg.includes("黎明前的校园")) return SCENE_BG.schoolDawn;
  if (cg.includes("泥土中露出的指骨")) return SCENE_BG.gardenRain;
  if (cg.includes("学校天台") || cg.includes("马树衡的灵魂")) return SCENE_BG.rooftopSunset;
  return getSceneBg(scene);
}
