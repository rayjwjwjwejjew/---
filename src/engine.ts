import { RAW_SCRIPT } from "./script";

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

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    svg
      .replace(/\n+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim(),
  )}`;
}

function createSceneSvg(content: string, defs = ""): string {
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.62)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.10)" />
        </linearGradient>
        <linearGradient id="floorGloss" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.16)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.02)" />
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="rgba(0,0,0,0.18)" />
        </filter>
        ${defs}
      </defs>
      ${content}
    </svg>
  `);
}

function campusNightScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#091223"/>
    <rect width="1600" height="520" fill="url(#skyNight)"/>
    <rect y="520" width="1600" height="380" fill="#101a26"/>
    <circle cx="1320" cy="126" r="60" fill="#f5f2db" opacity="0.92"/>
    <g fill="#d9e4ff" opacity="0.72">
      <circle cx="210" cy="92" r="2"/><circle cx="260" cy="130" r="1.8"/><circle cx="480" cy="88" r="1.6"/>
      <circle cx="640" cy="116" r="2"/><circle cx="760" cy="76" r="2.2"/><circle cx="920" cy="98" r="1.7"/>
      <circle cx="1090" cy="124" r="2"/><circle cx="1440" cy="74" r="1.8"/>
    </g>
    <rect x="920" y="248" width="480" height="272" rx="10" fill="#52647f"/>
    <rect x="968" y="294" width="92" height="66" fill="#ffe9b6"/><rect x="1088" y="294" width="92" height="66" fill="#f2f7ff" opacity="0.45"/>
    <rect x="1208" y="294" width="92" height="66" fill="#ffe9b6"/><rect x="968" y="384" width="92" height="66" fill="#ffe9b6"/>
    <rect x="1088" y="384" width="92" height="66" fill="#ffe9b6"/><rect x="1208" y="384" width="92" height="66" fill="#ffe9b6"/>
    <rect x="610" y="280" width="250" height="220" rx="8" fill="#6e7c90"/>
    <rect x="650" y="326" width="170" height="90" fill="#d7ebff" opacity="0.44"/>
    <rect x="0" y="625" width="900" height="170" fill="#3a4959"/>
    <rect x="76" y="648" width="750" height="120" rx="18" fill="#7e8fa5"/>
    <ellipse cx="840" cy="640" rx="174" ry="104" fill="#162432"/>
    <ellipse cx="840" cy="640" rx="148" ry="82" fill="#58708c"/>
    <ellipse cx="840" cy="640" rx="128" ry="64" fill="#9ec2d7"/>
    <path d="M140 560 C220 470 310 454 420 470 C350 530 238 572 150 602 Z" fill="#192a28"/>
    <path d="M1340 570 C1420 486 1510 456 1600 482 L1600 640 L1290 638 Z" fill="#162925"/>
    <defs>
      <linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0e2144"/>
        <stop offset="58%" stop-color="#243d65"/>
        <stop offset="100%" stop-color="#5a7aa4"/>
      </linearGradient>
    </defs>
  `);
}

function schoolBuildingDayScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#e9f4ff"/>
    <rect width="1600" height="520" fill="url(#skyDay)"/>
    <rect y="520" width="1600" height="380" fill="#dbe6d2"/>
    <rect x="0" y="640" width="1600" height="260" fill="#cad7cd"/>
    <rect x="934" y="200" width="514" height="340" rx="12" fill="#f0efe8"/>
    <rect x="970" y="246" width="140" height="96" fill="#99c5ea"/><rect x="1146" y="246" width="140" height="96" fill="#99c5ea"/>
    <rect x="1322" y="246" width="90" height="96" fill="#99c5ea"/><rect x="970" y="378" width="140" height="104" fill="#ffda9e"/>
    <rect x="1146" y="378" width="140" height="104" fill="#ffda9e"/><rect x="1322" y="378" width="90" height="104" fill="#ffda9e"/>
    <rect x="710" y="278" width="190" height="222" rx="10" fill="#c6d2c6"/>
    <rect x="92" y="590" width="640" height="168" rx="16" fill="#a4c5c0"/>
    <rect x="150" y="642" width="520" height="70" rx="12" fill="#7ca2b1"/>
    <ellipse cx="310" cy="588" rx="142" ry="94" fill="#6b8f63"/>
    <ellipse cx="1256" cy="592" rx="122" ry="84" fill="#62885f"/>
    <path d="M0 706 L550 618 L812 706 L1600 706 L1600 900 L0 900 Z" fill="#e4dbcb"/>
    <path d="M470 620 L610 748 L728 620" fill="none" stroke="#b7c8d1" stroke-width="12" stroke-linecap="round"/>
    <defs>
      <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#90cfff"/>
        <stop offset="74%" stop-color="#d7efff"/>
        <stop offset="100%" stop-color="#eef7ff"/>
      </linearGradient>
    </defs>
  `);
}

function schoolDawnScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#f7ddd2"/>
    <rect width="1600" height="530" fill="url(#skyDawn)"/>
    <rect y="530" width="1600" height="370" fill="#d5c9c2"/>
    <rect x="160" y="236" width="1240" height="304" rx="12" fill="#59667b"/>
    <rect x="208" y="284" width="144" height="86" fill="#fff1cb"/><rect x="392" y="284" width="144" height="86" fill="#fff1cb"/>
    <rect x="576" y="284" width="144" height="86" fill="#fff1cb"/><rect x="760" y="284" width="144" height="86" fill="#f7fbff" opacity="0.54"/>
    <rect x="944" y="284" width="144" height="86" fill="#fff1cb"/><rect x="1128" y="284" width="144" height="86" fill="#fff1cb"/>
    <rect x="208" y="394" width="144" height="88" fill="#fff1cb"/><rect x="392" y="394" width="144" height="88" fill="#fff1cb"/>
    <rect x="576" y="394" width="144" height="88" fill="#fff1cb"/><rect x="944" y="394" width="144" height="88" fill="#fff1cb"/>
    <rect x="1128" y="394" width="144" height="88" fill="#fff1cb"/>
    <ellipse cx="180" cy="540" rx="154" ry="108" fill="#8f765f"/>
    <ellipse cx="1410" cy="548" rx="170" ry="110" fill="#726357"/>
    <path d="M0 682 H1600 V900 H0 Z" fill="#dbd0c5"/>
    <defs>
      <linearGradient id="skyDawn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f4a6a5"/>
        <stop offset="56%" stop-color="#f7c9b3"/>
        <stop offset="100%" stop-color="#f5f0df"/>
      </linearGradient>
    </defs>
  `);
}

function corridorScene(night = false) {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="${night ? "#111825" : "#f2ede3"}"/>
    <polygon points="0,900 1260,900 1600,640 1600,900" fill="${night ? "#31405c" : "#d1bba0"}"/>
    <polygon points="0,900 0,120 330,200 330,900" fill="${night ? "#263142" : "#efe4d4"}"/>
    <polygon points="330,900 330,200 1600,124 1600,640 1260,900" fill="${night ? "#42526d" : "#fbf7ef"}"/>
    <g opacity="${night ? "0.78" : "1"}">
      <rect x="404" y="234" width="164" height="222" rx="10" fill="${night ? "#7a9fc5" : "#a9d3f6"}"/>
      <rect x="642" y="220" width="180" height="250" rx="10" fill="${night ? "#6f94bb" : "#9bc9ee"}"/>
      <rect x="912" y="204" width="210" height="280" rx="10" fill="${night ? "#648aaf" : "#8ec0ea"}"/>
      <rect x="1198" y="188" width="236" height="320" rx="10" fill="${night ? "#597d9d" : "#84b6e4"}"/>
    </g>
    <rect x="0" y="100" width="1600" height="46" fill="${night ? "#4b5d7a" : "#d6cabd"}"/>
    <g fill="${night ? "#f4d8a0" : "#f4dfba"}">
      <circle cx="316" cy="124" r="14"/><circle cx="560" cy="124" r="14"/><circle cx="806" cy="124" r="14"/>
      <circle cx="1052" cy="124" r="14"/><circle cx="1298" cy="124" r="14"/>
    </g>
    <path d="M330 612 L1600 546" stroke="rgba(255,255,255,0.22)" stroke-width="7"/>
    <path d="M330 694 L1600 620" stroke="rgba(255,255,255,0.18)" stroke-width="7"/>
  `);
}

function rooftopScene(sunset = false) {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="${sunset ? "#ffc8a0" : "#d8f1ff"}"/>
    <rect width="1600" height="560" fill="${sunset ? "url(#sunsetSky)" : "url(#daySky)"}"/>
    <rect y="560" width="1600" height="340" fill="${sunset ? "#bdd0dc" : "#d7ebf4"}"/>
    <rect x="0" y="588" width="1600" height="26" fill="${sunset ? "#acc1cb" : "#bfd9e6"}"/>
    <rect x="0" y="614" width="1600" height="230" fill="${sunset ? "#d6e1e8" : "#edf7fc"}"/>
    <rect x="84" y="380" width="26" height="238" fill="#7ec6b0"/><rect x="222" y="380" width="26" height="238" fill="#7ec6b0"/>
    <rect x="360" y="380" width="26" height="238" fill="#7ec6b0"/><rect x="498" y="380" width="26" height="238" fill="#7ec6b0"/>
    <rect x="636" y="380" width="26" height="238" fill="#7ec6b0"/><rect x="774" y="380" width="26" height="238" fill="#7ec6b0"/>
    <rect x="912" y="380" width="26" height="238" fill="#7ec6b0"/><rect x="1050" y="380" width="26" height="238" fill="#7ec6b0"/>
    <rect x="1188" y="380" width="26" height="238" fill="#7ec6b0"/><rect x="1326" y="380" width="26" height="238" fill="#7ec6b0"/>
    <rect x="62" y="368" width="1310" height="20" fill="#8acfb8"/>
    <rect x="1260" y="214" width="168" height="164" rx="10" fill="${sunset ? "#c5a98d" : "#d6d7de"}"/>
    <rect x="1088" y="248" width="120" height="130" rx="10" fill="${sunset ? "#b5c1d1" : "#c4d3e8"}"/>
    <defs>
      <linearGradient id="daySky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7cd0ff"/>
        <stop offset="80%" stop-color="#d7f4ff"/>
      </linearGradient>
      <linearGradient id="sunsetSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffb180"/>
        <stop offset="62%" stop-color="#ffd1aa"/>
        <stop offset="100%" stop-color="#ffe4c8"/>
      </linearGradient>
    </defs>
  `);
}

function rainySchoolScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#9eaeb8"/>
    <rect width="1600" height="560" fill="url(#rainSky)"/>
    <rect y="560" width="1600" height="340" fill="#7f8f9b"/>
    <rect x="210" y="250" width="1180" height="320" rx="12" fill="#556775"/>
    <rect x="258" y="302" width="164" height="104" fill="#a6c4d9"/><rect x="474" y="302" width="164" height="104" fill="#a6c4d9"/>
    <rect x="690" y="302" width="164" height="104" fill="#8cb5d2"/><rect x="906" y="302" width="164" height="104" fill="#a6c4d9"/>
    <rect x="1122" y="302" width="164" height="104" fill="#a6c4d9"/>
    <rect x="0" y="650" width="1600" height="250" fill="#74828e"/>
    <rect x="0" y="684" width="1600" height="60" fill="#c1d0d8" opacity="0.3"/>
    <g stroke="rgba(215,230,242,0.34)" stroke-width="7">
      <line x1="190" y1="0" x2="80" y2="900"/><line x1="360" y1="0" x2="250" y2="900"/>
      <line x1="530" y1="0" x2="420" y2="900"/><line x1="700" y1="0" x2="590" y2="900"/>
      <line x1="870" y1="0" x2="760" y2="900"/><line x1="1040" y1="0" x2="930" y2="900"/>
      <line x1="1210" y1="0" x2="1100" y2="900"/><line x1="1380" y1="0" x2="1270" y2="900"/>
      <line x1="1550" y1="0" x2="1440" y2="900"/>
    </g>
    <defs>
      <linearGradient id="rainSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7d93a6"/>
        <stop offset="72%" stop-color="#b3c0c8"/>
        <stop offset="100%" stop-color="#ced8dd"/>
      </linearGradient>
    </defs>
  `);
}

function dormScene(night = false) {
  if (!night) {
    return "https://i.imgur.com/pR8zjdc.png";
  }
  return createSceneSvg(`
    <rect width="1600" height="900" fill="${night ? "#111929" : "#f4f1e7"}"/>
    <rect width="1600" height="900" fill="${night ? "#182237" : "#f4f1e7"}"/>
    <rect x="0" y="610" width="1600" height="290" fill="${night ? "#b58f78" : "#d9b89a"}"/>
    <rect x="1030" y="180" width="420" height="316" fill="${night ? "#2a3955" : "#d3ecff"}"/>
    <rect x="1080" y="218" width="320" height="240" fill="${night ? "#355176" : "#a7d8ff"}"/>
    <rect x="82" y="438" width="250" height="176" rx="20" fill="${night ? "#51607a" : "#b5b7c0"}"/>
    <rect x="410" y="406" width="330" height="178" rx="34" fill="${night ? "#5f6287" : "#f2e3bb"}"/>
    <rect x="444" y="554" width="274" height="94" rx="30" fill="${night ? "#3e455f" : "#9ccbd9"}"/>
    <circle cx="584" cy="588" r="128" fill="${night ? "#324f70" : "#d2f5ef"}" opacity="0.45"/>
    <rect x="410" y="620" width="300" height="18" rx="9" fill="${night ? "#304053" : "#a1c8d7"}"/>
    <rect x="770" y="248" width="180" height="372" rx="10" fill="${night ? "#70686d" : "#b98d63"}"/>
    <g fill="${night ? "#d7dbe9" : "#f7fbff"}" opacity="${night ? "0.20" : "0.36"}">
      <rect x="804" y="282" width="112" height="18"/><rect x="804" y="322" width="112" height="18"/><rect x="804" y="362" width="112" height="18"/>
      <rect x="804" y="402" width="112" height="18"/><rect x="804" y="442" width="112" height="18"/><rect x="804" y="482" width="112" height="18"/>
    </g>
    <rect x="1180" y="560" width="244" height="110" rx="18" fill="${night ? "#b4c5e1" : "#d9e6fb"}"/>
    <rect x="220" y="562" width="112" height="42" rx="12" fill="${night ? "#29303e" : "#524640"}"/>
    <rect x="1210" y="528" width="176" height="34" rx="12" fill="${night ? "#f0dfcb" : "#fdf8ed"}"/>
    <rect x="1192" y="178" width="196" height="44" rx="12" fill="${night ? "#dae4f4" : "#eff7ff"}" opacity="0.56"/>
    <circle cx="160" cy="114" r="44" fill="${night ? "#ffe7ad" : "#fff4da"}" opacity="${night ? "0.24" : "0"}"/>
  `);
}

function cafeteriaScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#f7e6c7"/>
    <rect width="1600" height="900" fill="url(#cafeWarm)"/>
    <rect x="0" y="620" width="1600" height="280" fill="#8b5a3d"/>
    <rect x="0" y="0" width="1600" height="120" fill="#d1a16d"/>
    <rect x="260" y="168" width="56" height="210" rx="20" fill="#f1cf8c"/><rect x="620" y="168" width="56" height="210" rx="20" fill="#f1cf8c"/>
    <rect x="980" y="168" width="56" height="210" rx="20" fill="#f1cf8c"/><rect x="1340" y="168" width="56" height="210" rx="20" fill="#f1cf8c"/>
    <circle cx="288" cy="170" r="42" fill="#e0bb79"/><circle cx="648" cy="170" r="42" fill="#e0bb79"/><circle cx="1008" cy="170" r="42" fill="#e0bb79"/><circle cx="1368" cy="170" r="42" fill="#e0bb79"/>
    <rect x="66" y="468" width="316" height="174" rx="24" fill="#a7d6c5"/><rect x="126" y="540" width="196" height="92" rx="18" fill="#8fc7b4"/>
    <rect x="456" y="468" width="316" height="174" rx="24" fill="#a7d6c5"/><rect x="516" y="540" width="196" height="92" rx="18" fill="#8fc7b4"/>
    <rect x="846" y="468" width="316" height="174" rx="24" fill="#a7d6c5"/><rect x="906" y="540" width="196" height="92" rx="18" fill="#8fc7b4"/>
    <rect x="1180" y="420" width="344" height="46" rx="16" fill="#9c6746"/>
    <rect x="1180" y="474" width="344" height="22" rx="11" fill="#7f5239"/>
    <rect x="112" y="520" width="226" height="24" rx="12" fill="#c58e59"/><rect x="502" y="520" width="226" height="24" rx="12" fill="#c58e59"/>
    <rect x="892" y="520" width="226" height="24" rx="12" fill="#c58e59"/>
    <rect x="0" y="120" width="1600" height="320" fill="url(#sunWash)" opacity="0.32"/>
    <defs>
      <linearGradient id="cafeWarm" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#eec88e"/>
        <stop offset="62%" stop-color="#f7e6bb"/>
        <stop offset="100%" stop-color="#f9f1e4"/>
      </linearGradient>
      <linearGradient id="sunWash" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff8d5"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </linearGradient>
    </defs>
  `);
}

function undergroundEntranceScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#2c3439"/>
    <rect width="1600" height="900" fill="url(#dullWall)"/>
    <rect x="0" y="660" width="1600" height="240" fill="#48535a"/>
    <polygon points="170,900 562,900 760,250 368,250" fill="#59656d"/>
    <polygon points="782,900 1182,900 1360,250 966,250" fill="#66757c"/>
    <rect x="612" y="184" width="376" height="340" rx="10" fill="#556068"/>
    <rect x="660" y="220" width="280" height="256" rx="8" fill="#1f2427"/>
    <rect x="660" y="220" width="280" height="40" fill="#6c5642"/>
    <circle cx="962" cy="250" r="18" fill="#e6d09f"/>
    <rect x="120" y="312" width="160" height="28" rx="10" fill="#737b7e"/>
    <rect x="1290" y="298" width="170" height="30" rx="10" fill="#737b7e"/>
    <defs>
      <linearGradient id="dullWall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4c585d"/>
        <stop offset="100%" stop-color="#66757a"/>
      </linearGradient>
    </defs>
  `);
}

function undergroundChamberScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#0a0d12"/>
    <rect width="1600" height="900" fill="url(#basementFog)"/>
    <rect x="0" y="660" width="1600" height="240" fill="#1d232d"/>
    <rect x="178" y="140" width="1244" height="560" rx="10" fill="#161c25"/>
    <rect x="220" y="186" width="346" height="474" rx="10" fill="#252f39"/>
    <rect x="620" y="184" width="332" height="476" rx="10" fill="#202933"/>
    <rect x="1008" y="180" width="372" height="480" rx="10" fill="#1a222d"/>
    <rect x="220" y="502" width="1160" height="18" fill="#2a3640"/>
    <rect x="220" y="610" width="1160" height="18" fill="#2a3640"/>
    <rect x="1136" y="250" width="64" height="232" fill="#59322f"/>
    <path d="M1204 324 C1260 310 1290 278 1328 244" fill="none" stroke="#823936" stroke-width="14" stroke-linecap="round"/>
    <circle cx="1332" cy="238" r="10" fill="#9a4642"/>
    <circle cx="1260" cy="264" r="26" fill="#ffffff" opacity="0.08"/>
    <circle cx="1040" cy="204" r="42" fill="#ffe39a" opacity="0.18"/>
    <defs>
      <linearGradient id="basementFog" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0b1017"/>
        <stop offset="72%" stop-color="#151b23"/>
        <stop offset="100%" stop-color="#2c3540"/>
      </linearGradient>
    </defs>
  `);
}

function hospitalExteriorScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#edf7ff"/>
    <rect width="1600" height="500" fill="url(#hospitalSky)"/>
    <rect y="500" width="1600" height="400" fill="#dfe8ea"/>
    <rect x="182" y="214" width="1240" height="386" rx="18" fill="#f6fafd"/>
    <rect x="182" y="284" width="1240" height="36" fill="#a2cbdb"/>
    <g fill="#9cc9e9">
      <rect x="240" y="360" width="120" height="94"/><rect x="394" y="360" width="120" height="94"/><rect x="548" y="360" width="120" height="94"/>
      <rect x="702" y="360" width="120" height="94"/><rect x="856" y="360" width="120" height="94"/><rect x="1010" y="360" width="120" height="94"/>
      <rect x="1164" y="360" width="120" height="94"/>
    </g>
    <rect x="680" y="454" width="240" height="146" fill="#dde9f1"/>
    <rect x="736" y="484" width="128" height="116" fill="#87b9d5"/>
    <path d="M0 706 H1600 V900 H0 Z" fill="#cfd7da"/>
    <path d="M450 706 H1150 L1310 900 H290 Z" fill="#eef2f3"/>
    <circle cx="324" cy="628" r="72" fill="#8dc399"/><circle cx="1288" cy="628" r="76" fill="#84b590"/>
    <defs>
      <linearGradient id="hospitalSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#90d5ff"/>
        <stop offset="100%" stop-color="#eaf7ff"/>
      </linearGradient>
    </defs>
  `);
}

function hospitalRoomScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#f2f7fb"/>
    <rect x="0" y="640" width="1600" height="260" fill="#cdd9df"/>
    <rect x="1010" y="150" width="420" height="364" fill="#cbe3f7"/>
    <rect x="1060" y="198" width="320" height="268" fill="#a8d2f0"/>
    <rect x="170" y="432" width="520" height="166" rx="16" fill="#dfe9ef"/>
    <rect x="210" y="468" width="410" height="78" rx="16" fill="#ffffff"/>
    <rect x="676" y="296" width="228" height="302" rx="12" fill="#d7ddd8"/>
    <rect x="742" y="332" width="96" height="186" rx="10" fill="#c3d6cf"/>
    <rect x="92" y="218" width="172" height="228" rx="12" fill="#eef2f5"/>
    <rect x="304" y="232" width="180" height="112" rx="16" fill="#f7fcff"/>
    <rect x="242" y="606" width="420" height="26" rx="13" fill="#a8c3d2"/>
    <circle cx="1380" cy="212" r="44" fill="#fff1bf" opacity="0.54"/>
  `);
}

function gardenScene(rain = false) {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="${rain ? "#9ba7b2" : "#d9f5ff"}"/>
    <rect width="1600" height="500" fill="${rain ? "url(#gardenRainSky)" : "url(#gardenSky)"}"/>
    <rect y="500" width="1600" height="400" fill="${rain ? "#7f9382" : "#88c47d"}"/>
    <path d="M0 760 C220 648 420 628 660 664 C910 700 1128 730 1600 676 L1600 900 L0 900 Z" fill="${rain ? "#688467" : "#71b36c"}"/>
    <path d="M0 790 C280 718 480 706 792 744 C1080 778 1280 790 1600 754 L1600 900 L0 900 Z" fill="${rain ? "#5f775b" : "#5fa15c"}"/>
    <path d="M420 900 C540 722 700 660 842 666 C944 670 1082 722 1184 900 Z" fill="${rain ? "#ccbfa3" : "#e5d0ad"}"/>
    <rect x="718" y="300" width="164" height="154" rx="18" fill="${rain ? "#8f7867" : "#a88463"}"/>
    <circle cx="314" cy="570" r="110" fill="${rain ? "#4a6b49" : "#72ad61"}"/><circle cx="1238" cy="568" r="126" fill="${rain ? "#49694a" : "#78ba65"}"/>
    <g fill="${rain ? "#bc6680" : "#e18598"}">
      <circle cx="558" cy="662" r="18"/><circle cx="612" cy="688" r="16"/><circle cx="676" cy="648" r="18"/><circle cx="980" cy="686" r="18"/><circle cx="1042" cy="654" r="16"/>
    </g>
    ${
      rain
        ? `<g stroke="rgba(220,230,240,0.28)" stroke-width="7">
             <line x1="180" y1="0" x2="68" y2="900"/><line x1="448" y1="0" x2="336" y2="900"/><line x1="716" y1="0" x2="604" y2="900"/>
             <line x1="984" y1="0" x2="872" y2="900"/><line x1="1252" y1="0" x2="1140" y2="900"/><line x1="1520" y1="0" x2="1408" y2="900"/>
           </g>`
        : ""
    }
    <defs>
      <linearGradient id="gardenSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7fd2ff"/>
        <stop offset="100%" stop-color="#def7ff"/>
      </linearGradient>
      <linearGradient id="gardenRainSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#81909d"/>
        <stop offset="100%" stop-color="#ccd4d7"/>
      </linearGradient>
    </defs>
  `);
}

function libraryScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#f4ead6"/>
    <rect x="0" y="660" width="1600" height="240" fill="#a8724a"/>
    <rect x="0" y="0" width="1600" height="220" fill="#e7d3a5"/>
    <rect x="118" y="168" width="284" height="420" rx="10" fill="#6d503e"/><rect x="470" y="168" width="284" height="420" rx="10" fill="#6d503e"/>
    <rect x="822" y="168" width="284" height="420" rx="10" fill="#6d503e"/><rect x="1174" y="168" width="284" height="420" rx="10" fill="#6d503e"/>
    <g fill="#c48b5b">
      <rect x="150" y="210" width="220" height="44"/><rect x="150" y="278" width="220" height="44"/><rect x="150" y="346" width="220" height="44"/><rect x="150" y="414" width="220" height="44"/>
      <rect x="502" y="210" width="220" height="44"/><rect x="502" y="278" width="220" height="44"/><rect x="502" y="346" width="220" height="44"/><rect x="502" y="414" width="220" height="44"/>
      <rect x="854" y="210" width="220" height="44"/><rect x="854" y="278" width="220" height="44"/><rect x="854" y="346" width="220" height="44"/><rect x="854" y="414" width="220" height="44"/>
      <rect x="1206" y="210" width="220" height="44"/><rect x="1206" y="278" width="220" height="44"/><rect x="1206" y="346" width="220" height="44"/><rect x="1206" y="414" width="220" height="44"/>
    </g>
    <rect x="494" y="620" width="612" height="76" rx="20" fill="#d9ba8a"/>
    <rect x="556" y="678" width="488" height="34" rx="16" fill="#816048"/>
    <circle cx="800" cy="646" r="18" fill="#edf6f6"/>
  `);
}

function classroomScene(dusk = false) {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="${dusk ? "#e8d5bf" : "#eef6fb"}"/>
    <rect x="0" y="660" width="1600" height="240" fill="#cfa782"/>
    <rect x="1040" y="160" width="400" height="364" fill="${dusk ? "#f2c89c" : "#c9e6ff"}"/>
    <rect x="1082" y="200" width="320" height="286" fill="${dusk ? "#ffcf8b" : "#9ed5ff"}"/>
    <rect x="94" y="142" width="154" height="262" rx="12" fill="#d6e7ef"/>
    <rect x="310" y="162" width="160" height="242" rx="12" fill="#d6e7ef"/>
    <rect x="532" y="184" width="340" height="136" rx="12" fill="#6e8ba0"/>
    <g fill="#c79d70">
      <rect x="206" y="500" width="206" height="82" rx="12"/><rect x="502" y="500" width="206" height="82" rx="12"/><rect x="798" y="500" width="206" height="82" rx="12"/><rect x="1094" y="500" width="206" height="82" rx="12"/>
      <rect x="268" y="582" width="82" height="72" rx="10"/><rect x="564" y="582" width="82" height="72" rx="10"/><rect x="860" y="582" width="82" height="72" rx="10"/><rect x="1156" y="582" width="82" height="72" rx="10"/>
    </g>
    <rect x="134" y="420" width="1280" height="18" fill="rgba(255,255,255,0.28)"/>
  `);
}

function busScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#d6eefb"/>
    <rect width="1600" height="900" fill="url(#busInterior)"/>
    <polygon points="0,900 1600,900 1600,640 1310,430 290,430 0,640" fill="#7897ae"/>
    <rect x="208" y="166" width="1184" height="270" rx="30" fill="#a8d8ef"/>
    <rect x="258" y="208" width="1084" height="186" rx="22" fill="#84c7e4"/>
    <rect x="180" y="420" width="188" height="260" rx="26" fill="#4e8598"/><rect x="452" y="420" width="188" height="260" rx="26" fill="#4e8598"/>
    <rect x="724" y="420" width="188" height="260" rx="26" fill="#4e8598"/><rect x="996" y="420" width="188" height="260" rx="26" fill="#4e8598"/>
    <rect x="1268" y="420" width="152" height="260" rx="26" fill="#4e8598"/>
    <rect x="230" y="460" width="144" height="184" rx="20" fill="#8dc4d4"/><rect x="502" y="460" width="144" height="184" rx="20" fill="#8dc4d4"/>
    <rect x="774" y="460" width="144" height="184" rx="20" fill="#8dc4d4"/><rect x="1046" y="460" width="144" height="184" rx="20" fill="#8dc4d4"/>
    <rect x="1292" y="460" width="104" height="184" rx="20" fill="#8dc4d4"/>
    <rect x="782" y="180" width="32" height="110" rx="14" fill="#eff8fd"/>
    <rect x="788" y="290" width="20" height="96" rx="10" fill="#eff8fd"/>
    <defs>
      <linearGradient id="busInterior" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#e9f5ff"/>
        <stop offset="100%" stop-color="#cad9e4"/>
      </linearGradient>
    </defs>
  `);
}

function gymScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#efe6d6"/>
    <rect width="1600" height="220" fill="#d5c0a0"/>
    <rect x="0" y="220" width="1600" height="680" fill="#d8b28c"/>
    <rect x="110" y="140" width="1380" height="214" fill="#f4ead8"/>
    <rect x="132" y="180" width="1336" height="138" fill="#d6ecf7"/>
    <rect x="0" y="592" width="1600" height="308" fill="#bd8856"/>
    <rect x="244" y="590" width="1112" height="16" fill="#fff3df" opacity="0.4"/>
    <circle cx="800" cy="744" r="168" fill="none" stroke="#fff0c9" stroke-width="12" opacity="0.55"/>
    <rect x="790" y="590" width="20" height="310" fill="#fff0c9" opacity="0.5"/>
    <rect x="224" y="330" width="240" height="180" rx="18" fill="#8a6547"/><rect x="1136" y="330" width="240" height="180" rx="18" fill="#8a6547"/>
  `);
}

function officeScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#efe8dc"/>
    <rect x="0" y="640" width="1600" height="260" fill="#d7b38f"/>
    <rect x="1034" y="146" width="426" height="320" fill="#d2e9fb"/>
    <rect x="1076" y="186" width="340" height="244" fill="#a9d6f6"/>
    <rect x="140" y="188" width="260" height="300" rx="14" fill="#7d5f47"/>
    <rect x="178" y="222" width="184" height="38" fill="#c69362"/><rect x="178" y="282" width="184" height="38" fill="#c69362"/>
    <rect x="178" y="342" width="184" height="38" fill="#c69362"/><rect x="178" y="402" width="184" height="38" fill="#c69362"/>
    <rect x="470" y="460" width="700" height="172" rx="18" fill="#b98962"/>
    <rect x="1210" y="286" width="162" height="340" rx="16" fill="#cab596"/>
    <rect x="816" y="392" width="300" height="48" rx="16" fill="#fff8ef"/>
    <circle cx="1236" cy="338" r="24" fill="#5e8c7b"/>
  `);
}

function meetingRoomScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#f3ecdf"/>
    <rect x="0" y="610" width="1600" height="290" fill="#cda47e"/>
    <rect x="1090" y="140" width="370" height="320" fill="#d4ebff"/>
    <rect x="1132" y="182" width="286" height="236" fill="#a7d6fb"/>
    <rect x="252" y="470" width="1096" height="150" rx="28" fill="#bb875d"/>
    <rect x="310" y="420" width="140" height="120" rx="24" fill="#95b8bf"/><rect x="506" y="420" width="140" height="120" rx="24" fill="#95b8bf"/>
    <rect x="954" y="420" width="140" height="120" rx="24" fill="#95b8bf"/><rect x="1150" y="420" width="140" height="120" rx="24" fill="#95b8bf"/>
    <rect x="514" y="274" width="562" height="116" rx="20" fill="#ece5d8"/>
    <circle cx="1074" cy="332" r="16" fill="#d1bea4"/>
  `);
}

function teacherRoomScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#f3ecdf"/>
    <rect x="0" y="640" width="1600" height="260" fill="#d2ac88"/>
    <rect x="1070" y="170" width="380" height="320" fill="#cfe6f9"/>
    <rect x="1112" y="210" width="292" height="240" fill="#a9d3f3"/>
    <rect x="114" y="454" width="320" height="168" rx="20" fill="#d7ddd7"/>
    <rect x="142" y="482" width="264" height="110" rx="18" fill="#eef2ee"/>
    <rect x="542" y="280" width="214" height="352" rx="12" fill="#87664d"/>
    <rect x="784" y="418" width="224" height="214" rx="20" fill="#f2e3ba"/>
    <rect x="830" y="620" width="134" height="28" rx="14" fill="#c6dada"/>
    <rect x="1032" y="512" width="150" height="112" rx="12" fill="#c5b394"/>
    <circle cx="1190" cy="256" r="26" fill="#f4f8ff" opacity="0.48"/>
  `);
}

function schoolEventScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#f5eddc"/>
    <rect x="0" y="620" width="1600" height="280" fill="#c48f62"/>
    <rect x="0" y="0" width="1600" height="240" fill="#ead9b0"/>
    <rect x="130" y="170" width="1340" height="120" rx="20" fill="#f6fbff"/>
    <rect x="168" y="206" width="1264" height="48" rx="18" fill="#a8d1ef"/>
    <path d="M210 304 L1388 304" stroke="#f8d687" stroke-width="14" stroke-linecap="round"/>
    <g fill="#f3a8c8">
      <circle cx="320" cy="304" r="26"/><circle cx="498" cy="304" r="26"/><circle cx="676" cy="304" r="26"/><circle cx="854" cy="304" r="26"/>
      <circle cx="1032" cy="304" r="26"/><circle cx="1210" cy="304" r="26"/>
    </g>
    <rect x="186" y="420" width="1228" height="176" rx="28" fill="#8b684b"/>
    <rect x="248" y="472" width="1110" height="74" rx="20" fill="#f0eadf"/>
    <rect x="342" y="546" width="920" height="24" rx="12" fill="#cf9a6b"/>
  `);
}

function policeScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#0c1730"/>
    <rect width="1600" height="520" fill="url(#policeSky)"/>
    <rect y="520" width="1600" height="380" fill="#222c3d"/>
    <rect x="230" y="224" width="1140" height="320" rx="12" fill="#59687d"/>
    <rect x="270" y="272" width="164" height="98" fill="#f0d07a"/><rect x="480" y="272" width="164" height="98" fill="#9cc6e7"/>
    <rect x="690" y="272" width="164" height="98" fill="#f0d07a"/><rect x="900" y="272" width="164" height="98" fill="#9cc6e7"/>
    <rect x="1110" y="272" width="164" height="98" fill="#f0d07a"/>
    <rect x="0" y="670" width="1600" height="230" fill="#374357"/>
    <rect x="220" y="600" width="1160" height="50" fill="#6f7a88"/>
    <rect x="1050" y="600" width="400" height="118" rx="18" fill="#212836"/>
    <rect x="1100" y="628" width="62" height="16" rx="8" fill="#f84848"/><rect x="1168" y="628" width="62" height="16" rx="8" fill="#77a4ff"/>
    <ellipse cx="1140" cy="718" rx="210" ry="46" fill="#f84848" opacity="0.18"/>
    <ellipse cx="1260" cy="718" rx="220" ry="54" fill="#77a4ff" opacity="0.2"/>
    <defs>
      <linearGradient id="policeSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#14264c"/>
        <stop offset="100%" stop-color="#2b456a"/>
      </linearGradient>
    </defs>
  `);
}

function houseExteriorScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#dbf0ff"/>
    <rect width="1600" height="500" fill="url(#houseSky)"/>
    <rect y="500" width="1600" height="400" fill="#d6dbd9"/>
    <rect x="0" y="706" width="1600" height="194" fill="#b8bec1"/>
    <rect x="280" y="172" width="880" height="422" rx="10" fill="#f1dfc6"/>
    <rect x="280" y="410" width="880" height="184" fill="#a66b54"/>
    <polygon points="240,224 716,84 1212,224" fill="#f3ebdf"/>
    <rect x="338" y="250" width="230" height="174" fill="#8fd4ff"/>
    <rect x="730" y="270" width="278" height="58" fill="#2a3848"/>
    <rect x="796" y="320" width="150" height="216" fill="#4e3328"/>
    <rect x="1030" y="340" width="236" height="136" fill="#8fd4ff"/>
    <rect x="306" y="352" width="18" height="76" fill="#233443"/><rect x="542" y="352" width="18" height="76" fill="#233443"/>
    <rect x="250" y="446" width="238" height="222" rx="12" fill="#f0f1f5"/>
    <rect x="530" y="520" width="120" height="148" rx="6" fill="#4b4b4b"/>
    <rect x="960" y="520" width="330" height="78" fill="#6fbd67"/>
    <rect x="960" y="604" width="330" height="42" fill="#b84f3b"/>
    <rect x="732" y="548" width="250" height="88" rx="10" fill="#d5d9dc"/>
    <defs>
      <linearGradient id="houseSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#77cfff"/>
        <stop offset="100%" stop-color="#dff4ff"/>
      </linearGradient>
    </defs>
  `);
}

function ruralRoadScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#def4ff"/>
    <rect width="1600" height="520" fill="url(#ruralSky)"/>
    <rect y="520" width="1600" height="380" fill="#89c96d"/>
    <path d="M0 780 C280 648 520 624 814 658 C1110 692 1340 710 1600 670 L1600 900 L0 900 Z" fill="#5f9b58"/>
    <path d="M0 844 C200 760 422 736 700 750 C990 766 1280 790 1600 770 L1600 900 L0 900 Z" fill="#6dae61"/>
    <path d="M0 724 L310 664 L434 680 L120 760 Z" fill="#8c8f95"/>
    <path d="M0 738 L290 684" stroke="#cfd5d8" stroke-width="12" stroke-linecap="round"/>
    <rect x="210" y="468" width="320" height="172" fill="#f1f2ea"/>
    <polygon points="184,500 368,384 560,500" fill="#7f7158"/>
    <rect x="1198" y="330" width="16" height="350" fill="#8d7b65"/><rect x="1348" y="290" width="16" height="390" fill="#8d7b65"/>
    <circle cx="1112" cy="438" r="116" fill="#5d9b57"/><circle cx="1310" cy="420" r="96" fill="#63a55f"/>
    <rect x="574" y="574" width="244" height="104" fill="#a9d7a0"/><rect x="860" y="564" width="344" height="112" fill="#b6dd9d"/>
    <defs>
      <linearGradient id="ruralSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#74d2ff"/>
        <stop offset="100%" stop-color="#effbff"/>
      </linearGradient>
    </defs>
  `);
}

function hotSpringScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#102139"/>
    <rect width="1600" height="470" fill="url(#onsenSky)"/>
    <rect y="470" width="1600" height="430" fill="#253144"/>
    <ellipse cx="860" cy="666" rx="640" ry="170" fill="#7cb9c7" opacity="0.72"/>
    <ellipse cx="860" cy="684" rx="620" ry="150" fill="#a8dce1" opacity="0.86"/>
    <ellipse cx="860" cy="704" rx="600" ry="126" fill="#bfdfe2"/>
    <rect x="1160" y="224" width="360" height="400" fill="#8a5f45"/>
    <polygon points="1092,318 1536,318 1450,182 1184,182" fill="#6b4a36"/>
    <rect x="1010" y="312" width="20" height="270" fill="#9b8468"/><rect x="1140" y="312" width="20" height="270" fill="#9b8468"/><rect x="1310" y="312" width="20" height="270" fill="#9b8468"/>
    <circle cx="346" cy="676" r="46" fill="#6a727a"/><circle cx="468" cy="760" r="56" fill="#747d85"/><circle cx="628" cy="692" r="48" fill="#707980"/>
    <circle cx="980" cy="776" r="60" fill="#71797f"/><circle cx="1164" cy="720" r="52" fill="#778085"/>
    <path d="M0 780 C240 724 420 720 612 744 C828 772 1016 774 1600 722 L1600 900 L0 900 Z" fill="#334635"/>
    <g fill="#d7f0f5" opacity="0.35">
      <ellipse cx="762" cy="574" rx="72" ry="30"/><ellipse cx="916" cy="544" rx="84" ry="36"/><ellipse cx="1080" cy="594" rx="92" ry="34"/>
    </g>
    <defs>
      <linearGradient id="onsenSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#102543"/>
        <stop offset="72%" stop-color="#284972"/>
        <stop offset="100%" stop-color="#f6bb79"/>
      </linearGradient>
    </defs>
  `);
}

function sportsFieldScene(evening = false) {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="${evening ? "#16314c" : "#d8f2ff"}"/>
    <rect width="1600" height="520" fill="${evening ? "url(#fieldEvening)" : "url(#fieldDay)"}"/>
    <rect y="520" width="1600" height="380" fill="${evening ? "#445561" : "#9bc784"}"/>
    <rect x="90" y="610" width="920" height="224" rx="20" fill="${evening ? "#47675d" : "#71b668"}"/>
    <rect x="120" y="640" width="860" height="164" rx="16" fill="${evening ? "#4a7a60" : "#60ac55"}"/>
    <circle cx="550" cy="720" r="120" fill="none" stroke="${evening ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.65)"}" stroke-width="10"/>
    <rect x="0" y="682" width="1600" height="58" fill="${evening ? "#807b7f" : "#bf6f61"}"/>
    <rect x="1080" y="520" width="310" height="220" rx="18" fill="${evening ? "#7f8ea0" : "#d6dfe5"}"/>
    <rect x="1140" y="566" width="190" height="118" rx="16" fill="${evening ? "#52667e" : "#8ab8d6"}"/>
    <rect x="125" y="590" width="18" height="100" fill="#ffffff"/><rect x="958" y="590" width="18" height="100" fill="#ffffff"/>
    <rect x="125" y="590" width="850" height="18" fill="#ffffff"/>
    <defs>
      <linearGradient id="fieldDay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#72d0ff"/>
        <stop offset="100%" stop-color="#ecfbff"/>
      </linearGradient>
      <linearGradient id="fieldEvening" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#254f7d"/>
        <stop offset="72%" stop-color="#5b7fa3"/>
        <stop offset="100%" stop-color="#f2bf7f"/>
      </linearGradient>
    </defs>
  `);
}

function basketballCourtScene() {
  return createSceneSvg(`
    <rect width="1600" height="900" fill="#f7cfab"/>
    <rect width="1600" height="500" fill="url(#courtSky)"/>
    <rect y="500" width="1600" height="400" fill="#7db16f"/>
    <rect x="120" y="580" width="1360" height="234" rx="24" fill="#6c7d8a"/>
    <rect x="180" y="620" width="1240" height="160" rx="18" fill="#5f7381"/>
    <circle cx="800" cy="700" r="124" fill="none" stroke="rgba(255,255,255,0.62)" stroke-width="10"/>
    <rect x="796" y="580" width="8" height="234" fill="rgba(255,255,255,0.62)"/>
    <rect x="210" y="544" width="18" height="126" fill="#adb9be"/><rect x="1372" y="544" width="18" height="126" fill="#adb9be"/>
    <rect x="206" y="536" width="68" height="12" rx="6" fill="#e5eff2"/><rect x="1320" y="536" width="68" height="12" rx="6" fill="#e5eff2"/>
    <circle cx="240" cy="566" r="32" fill="none" stroke="#e5eff2" stroke-width="8"/><circle cx="1360" cy="566" r="32" fill="none" stroke="#e5eff2" stroke-width="8"/>
    <defs>
      <linearGradient id="courtSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffbe8f"/>
        <stop offset="72%" stop-color="#ffd7b7"/>
        <stop offset="100%" stop-color="#fff0dd"/>
      </linearGradient>
    </defs>
  `);
}

const BG = {
  schoolNight: campusNightScene(),
  schoolDay: schoolBuildingDayScene(),
  schoolDawn: schoolDawnScene(),
  corridorDay: corridorScene(false),
  corridorNight: corridorScene(true),
  rooftopDay: rooftopScene(false),
  rooftopSunset: rooftopScene(true),
  rainySchool: rainySchoolScene(),
  dormDay: dormScene(false),
  dormNight: dormScene(true),
  cafeteria: cafeteriaScene(),
  undergroundDoor: undergroundEntranceScene(),
  underground: undergroundChamberScene(),
  hospitalExterior: hospitalExteriorScene(),
  hospitalRoom: hospitalRoomScene(),
  gardenDay: gardenScene(false),
  gardenRain: gardenScene(true),
  library: libraryScene(),
  classroomDay: classroomScene(false),
  classroomDusk: classroomScene(true),
  bus: busScene(),
  gym: gymScene(),
  office: officeScene(),
  meetingRoom: meetingRoomScene(),
  teacherRoom: teacherRoomScene(),
  schoolEvent: schoolEventScene(),
  policeScene: policeScene(),
  houseExterior: houseExteriorScene(),
  ruralRoad: ruralRoadScene(),
  hotSpring: hotSpringScene(),
  sportsFieldDay: sportsFieldScene(false),
  sportsFieldEvening: sportsFieldScene(true),
  basketballCourt: basketballCourtScene(),
} as const;

const LOCAL_BG = {
  schoolExterior: "/scene-bg/school-exterior.png",
  schoolFront: "/scene-bg/school-front.png",
  schoolInterior: "/scene-bg/school-interior.png",
  classroomCorridor: "/scene-bg/classroom-corridor.png",
  sportsFieldNight: "/scene-bg/sports-field-night.png",
  basementDoor: "/scene-bg/basement-door.png",
  basementDark: "/scene-bg/basement-dark.png",
  dormRoom: "/scene-bg/dorm-room.png",
  dormCommon: "/scene-bg/dorm-common.png",
  hospitalRoom: "/scene-bg/hospital-room.png",
  hospitalWaiting: "/scene-bg/hospital-waiting.jpg",
  library: "/scene-bg/library.png",
  rooftopSunset: "/scene-bg/rooftop-sunset.png",
  teacherRoom: "/scene-bg/teacher-room.png",
} as const;

const STORY_SCENE_BG = LOCAL_BG.schoolExterior;

export const DEFAULT_BG = STORY_SCENE_BG;

export const SCENE_BG: Record<string, string> = {
  underground: LOCAL_BG.basementDark,
  undergroundDark: LOCAL_BG.basementDark,
  undergroundDoor: LOCAL_BG.basementDoor,
  corridor: LOCAL_BG.schoolInterior,
  corridorNight: LOCAL_BG.classroomCorridor,
  dormNight: LOCAL_BG.dormRoom,
  dormDay: LOCAL_BG.dormRoom,
  cafeteria: STORY_SCENE_BG,
  library: LOCAL_BG.library,
  hospital: LOCAL_BG.hospitalWaiting,
  hospitalRoom: LOCAL_BG.hospitalRoom,
  sportsField: LOCAL_BG.schoolFront,
  sportsEvening: LOCAL_BG.sportsFieldNight,
  basketball: LOCAL_BG.sportsFieldNight,
  classroom: LOCAL_BG.schoolInterior,
  classroomEmpty: LOCAL_BG.schoolInterior,
  rooftopSunset: LOCAL_BG.rooftopSunset,
  rooftopDay: STORY_SCENE_BG,
  dreamField: STORY_SCENE_BG,
  rainy: STORY_SCENE_BG,
  rainyHeavy: STORY_SCENE_BG,
  bus: STORY_SCENE_BG,
  office: STORY_SCENE_BG,
  gymnasium: STORY_SCENE_BG,
  schoolBldg: LOCAL_BG.schoolExterior,
  schoolDawn: LOCAL_BG.schoolExterior,
  schoolNight: LOCAL_BG.schoolExterior,
  garden: STORY_SCENE_BG,
  gardenRain: STORY_SCENE_BG,
  teacherRoom: LOCAL_BG.teacherRoom,
  adminBldg: STORY_SCENE_BG,
  schoolEvent: LOCAL_BG.schoolFront,
  stands: STORY_SCENE_BG,
  policeScene: STORY_SCENE_BG,
  nightSky: STORY_SCENE_BG,
  overcast: STORY_SCENE_BG,
  sunset: LOCAL_BG.rooftopSunset,
  meetingRoom: LOCAL_BG.teacherRoom,
};

export const CHARACTER_SPRITES: Record<string, string> = {
  锐: "https://i.imgur.com/RMYcBeX.png",
  蒋: "https://i.imgur.com/xRBHPZu.png",
  俞: "https://i.imgur.com/BioDQB4.jpeg",
  小猫: "https://i.imgur.com/BioDQB4.jpeg",
  图书管理员老师: "https://i.imgur.com/tdPI7mK.jpeg",
  何老师: "https://i.imgur.com/U8WN9Kb.jpeg",
  老师A: "https://i.imgur.com/82XmTrj.jpeg",
  老师B: "https://i.imgur.com/xE3e54W.jpeg",
  教导处老师: "https://i.imgur.com/vEcaTQf.jpeg",
  旁边老师: "https://i.imgur.com/6hbyRf9.jpeg",
  孙学长: "https://i.imgur.com/rZeZN6Z.jpeg",
  "？？学长": "https://i.imgur.com/rZeZN6Z.jpeg",
  学长: "https://i.imgur.com/rZeZN6Z.jpeg",
  "？？？": "https://i.imgur.com/BioDQB4.jpeg",
  植物人学长的妈妈: "https://i.imgur.com/yNpNszf.gif",
  马佳宁: "https://i.imgur.com/tdPI7mK.jpeg",
  调查员甲: "https://i.imgur.com/vEcaTQf.jpeg",
  调查员乙: "https://i.imgur.com/6hbyRf9.jpeg",
  校领导: "https://i.imgur.com/vEcaTQf.jpeg",
  金仕涵: "https://i.imgur.com/SStY5m6.jpeg",
  体育组组长: "https://i.imgur.com/82XmTrj.jpeg",
  年级组长: "https://i.imgur.com/82XmTrj.jpeg",
  女警员: "https://i.imgur.com/tdPI7mK.jpeg",
};

const CHARACTER_VARIANTS: Partial<Record<keyof typeof CHARACTER_SPRITES, Partial<Record<CharacterExpression, string>>>> = {
  锐: {
    hesitant: "https://i.imgur.com/uK2YPCJ.png",
  },
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

function getSceneTransition(scene: string): string {
  if (scene.includes("梦境") || scene.includes("回忆")) return "fade-white";
  if (scene.includes("花园") || scene.includes("操场") || scene.includes("天台")) return "expand";
  if (scene.includes("会议室") || scene.includes("体育馆") || scene.includes("大会")) return "blinds";
  if (scene.includes("夜") || scene.includes("深夜") || scene.includes("地下室") || scene.includes("暴雨")) {
    return "fade-black";
  }
  return "dissolve";
}

function getSceneEffect(scene: string): string | undefined {
  if (scene.includes("暴雨") || scene.includes("雨")) return "rain";
  if (scene.includes("梦境") || scene.includes("回忆")) return "blur";
  return undefined;
}

export function getSceneBg(scene: string | undefined): string | null {
  if (!scene) return null;
  const s = scene;
  if (s.includes("操场边")) return LOCAL_BG.schoolFront;
  if (s.includes("空无一人的篮球场")) return LOCAL_BG.sportsFieldNight;
  if (s.includes("地下室") && (s.includes("门口") || s.includes("入口"))) return SCENE_BG.undergroundDoor;
  if (s.includes("地下室")) return SCENE_BG.undergroundDark;
  if (s.includes("何老师房间")) return SCENE_BG.teacherRoom;
  if (s.includes("教工宿舍")) return SCENE_BG.teacherRoom;
  if (s.includes("宿舍楼下")) return LOCAL_BG.schoolFront;
  if (s.includes("学校花园旧址")) return SCENE_BG.garden;
  if (s.includes("暴雨中的花园")) return SCENE_BG.gardenRain;
  if (s.includes("花园") || s.includes("花圃")) return s.includes("雨") ? SCENE_BG.gardenRain : SCENE_BG.garden;
  if (s.includes("病房内")) return SCENE_BG.hospitalRoom;
  if (s.includes("病房门口")) return SCENE_BG.hospital;
  if (s.includes("附属医院门口")) return SCENE_BG.hospital;
  if (s.includes("医院")) return SCENE_BG.hospital;
  if (s.includes("食堂")) return SCENE_BG.cafeteria;
  if (s.includes("图书馆")) return SCENE_BG.library;
  if (s.includes("教室窗边")) return SCENE_BG.classroomEmpty;
  if (s.includes("教室") || s.includes("教学楼") || s.includes("早读") || s.includes("自习")) return SCENE_BG.classroom;
  if (s.includes("教学楼内")) return SCENE_BG.classroom;
  if (s.includes("走廊")) return s.includes("夜") ? SCENE_BG.corridorNight : SCENE_BG.corridor;
  if (s.includes("寝室") || s.includes("宿舍")) return s.includes("夜") || s.includes("深夜") ? SCENE_BG.dormNight : SCENE_BG.dormDay;
  if (s.includes("天台")) return s.includes("夕阳") ? SCENE_BG.rooftopSunset : SCENE_BG.rooftopDay;
  if (s.includes("学校")) return SCENE_BG.schoolBldg;
  if (s.includes("梦境") || s.includes("回忆")) return SCENE_BG.dreamField;
  if (s.includes("回学校") || s.includes("公交车")) return SCENE_BG.bus;
  if (s.includes("篮球场")) return SCENE_BG.basketball;
  if (s.includes("操场")) return s.includes("傍晚") || s.includes("晚") ? SCENE_BG.sportsEvening : SCENE_BG.sportsField;
  if (s.includes("体育馆") || s.includes("大会")) return SCENE_BG.gymnasium;
  if (s.includes("小会议室")) return SCENE_BG.meetingRoom;
  if (s.includes("会议室")) return SCENE_BG.meetingRoom;
  if (s.includes("教导处") || s.includes("办公")) return SCENE_BG.office;
  if (s.includes("行政楼")) return SCENE_BG.adminBldg;
  if (s.includes("校友返校日活动")) return SCENE_BG.schoolEvent;
  if (s.includes("第五天周末")) return BG.hospitalExterior;
  if (s.includes("黎明")) return SCENE_BG.schoolDawn;
  if (s.includes("调查") || s.includes("警")) return SCENE_BG.policeScene;
  if (s.includes("阴")) return SCENE_BG.overcast;
  if (s.includes("黄昏") || s.includes("夕阳") || s.includes("傍晚")) return SCENE_BG.sunset;
  if (s.includes("夜")) return SCENE_BG.schoolNight;
  return null;
}

export function parseScript(raw: string): ParsedScript {
  const linesRaw = raw.split(/\r?\n/);
  const out: ScriptLine[] = [];
  let act = "第一幕";
  let bracketSpeaker: string | null = null;
  let currentScene: string | undefined;
  let currentBgm: string | undefined = getActDefaultBgm(act);
  let pendingSfx: string | undefined;
  let pendingEffect: string | undefined;
  let pendingTransition: string | undefined;
  let pendingCg: string | undefined;

  const actRe = /^第([一二三四五六七八九十百0-9]+)幕：(.+)$/;
  const transRe = /^(过渡幕|尾声)：(.+)$/;

  const flushLine = (line: Omit<ScriptLine, "act">) => {
    out.push({
      act,
      bgm: line.bgm ?? currentBgm,
      ...line,
    });
    pendingSfx = undefined;
    pendingEffect = undefined;
    pendingTransition = undefined;
    pendingCg = undefined;
  };

  for (let i = 0; i < linesRaw.length; i += 1) {
    let line = linesRaw[i].trim();
    if (!line) continue;

    const actMatch = line.match(actRe);
    if (actMatch) {
      act = `第${actMatch[1]}幕：${actMatch[2].trim()}`;
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

    const transMatch = line.match(transRe);
    if (transMatch) {
      act = `${transMatch[1]}：${transMatch[2].trim()}`;
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
        pendingTransition = getSceneTransition(currentScene);
        pendingEffect = getSceneEffect(currentScene) ?? pendingEffect;
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
      if (tag.includes("·内心")) {
        bracketSpeaker = "SKIP_INNER";
        continue;
      }
      bracketSpeaker = tag;
      continue;
    }

    if (bracketSpeaker === "SKIP_INNER") {
      continue;
    }

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
        const content = next.replace(/^-+\s*/, "");
        const [text = "……", cmd = ""] = content.split("->").map((item) => item.trim());
        options.push({ text, cmd });
      }
      flushLine({
        kind: "choice",
        speaker: "SYSTEM",
        options,
        scene: currentScene,
        sfx: pendingSfx,
        effect: pendingEffect,
        transition: pendingTransition,
        cg: pendingCg,
      });
      bracketSpeaker = null;
      continue;
    }

    if (line.startsWith("@jump ")) {
      const label = line.replace("@jump", "").trim();
      flushLine({ kind: "line", speaker: "SYSTEM", text: `JUMP:${label}`, scene: currentScene });
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

    flushLine({
      kind: "line",
      speaker: bracketSpeaker ?? "旁白",
      text: line,
      scene: currentScene,
      sfx: pendingSfx,
      effect: pendingEffect,
      transition: pendingTransition,
      cg: pendingCg,
    });
  }

  const labelMap = new Map<string, number>();
  out.forEach((item, idx) => {
    if (item.kind === "label" && item.name) {
      labelMap.set(item.name, idx);
    }
  });

  return { lines: out, labelMap };
}

export const SCRIPT = parseScript(RAW_SCRIPT);

export function getSpecialBg(_index?: number): string | null {
  return null;
}

export interface StageCharacter {
  name: string;
  position: "left" | "center" | "right";
  spriteUrl: string;
  isSpeaking: boolean;
  expression: CharacterExpression;
}

function inferExpression(line: ScriptLine | undefined, speaker: string, isSpeaking: boolean): CharacterExpression {
  if (!line || !speaker) return "calm";
  if (!isSpeaking) {
    if (line.effect === "darken" || /地下室|深夜|秘密|调查/.test(line.scene || "")) return "shadow";
    return "calm";
  }

  const text = line.text || "";
  const stageText = [text, line.scene || "", line.effect || "", line.sfx || ""].join(" ");

  if (/(崩溃|怒气|流泪|哽咽|怒|失控|眼眶湿润|痛哭|撕心裂肺)/.test(stageText)) return "breakdown";
  if (line.effect === "shake" || /(惊恐|恐惧|颤抖|喘着气|不见了|怎么了|等等|喂|靠|呼|害怕|别|快)/.test(stageText)) return "panic";
  if (line.effect === "darken" || /(地下室|黑暗|秘密|调查|沉重|压抑|冷|空洞|死寂|没有回答)/.test(stageText)) return "shadow";
  if (/(沉默|犹豫|迟疑|轻声|低声|顿了一下|苦笑|半信半疑|将信将疑|……)/.test(stageText)) return "hesitant";
  return "calm";
}

function resolveCharacterSprite(name: string, expression: CharacterExpression): string {
  const variants = CHARACTER_VARIANTS[name as keyof typeof CHARACTER_VARIANTS];
  if (variants?.[expression]) return variants[expression] || CHARACTER_SPRITES[name];
  return CHARACTER_SPRITES[name];
}

export function getSceneCharacters(
  lines: ScriptLine[],
  currentIndex: number,
  currentSpeaker: string | undefined,
): StageCharacter[] {
  const curScene = lines[currentIndex]?.scene;
  const recent: string[] = [];

  for (let i = currentIndex; i >= Math.max(0, currentIndex - 15); i -= 1) {
    const line = lines[i];
    if (line.scene !== curScene && line.scene && curScene) break;
    if (
      line.speaker &&
      line.speaker !== "旁白" &&
      line.speaker !== "SYSTEM" &&
      CHARACTER_SPRITES[line.speaker] &&
      !recent.includes(line.speaker)
    ) {
      recent.push(line.speaker);
    }
    if (recent.length >= 3) break;
  }

  if (recent.length === 0 && currentSpeaker && CHARACTER_SPRITES[currentSpeaker]) {
    recent.push(currentSpeaker);
  }
  if (recent.length === 0) return [];

  const positions: StageCharacter["position"][] =
    recent.length === 1 ? ["center"] : recent.length === 2 ? ["left", "right"] : ["left", "center", "right"];

  return recent.map((name, idx) => {
    const expression = inferExpression(lines[currentIndex], name, name === currentSpeaker);
    return {
      expression,
      name,
      position: positions[idx] ?? "center",
      spriteUrl: resolveCharacterSprite(name, expression),
      isSpeaking: name === currentSpeaker,
    };
  });
}

export const ALL_CONTENT_IMAGES: string[] = Array.from(
  new Set([
    DEFAULT_BG,
    ...Object.values(BG),
    ...Object.values(SCENE_BG),
    ...Object.values(CHARACTER_SPRITES),
    ...Object.values(CHARACTER_VARIANTS).flatMap((variants) => Object.values(variants || {})),
  ]),
);
