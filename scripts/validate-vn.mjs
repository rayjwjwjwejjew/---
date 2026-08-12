import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "src/script.ts"), "utf8");
const labels = [...source.matchAll(/^::([\w.-]+)\s*$/gm)].map((match) => match[1]);
const jumps = [
  ...[...source.matchAll(/@jump\s+([\w.-]+)/g)].map((match) => match[1]),
  ...[...source.matchAll(/@if\s+[\w.-]+\s*=\s*.+?\s*->\s*([\w.-]+)/g)].map((match) => match[1]),
];
const errors = [];
const duplicates = labels.filter((label, index) => labels.indexOf(label) !== index);
for (const label of new Set(duplicates)) errors.push(`P0 DUPLICATE_LABEL ${label}`);
for (const label of new Set(jumps)) if (!labels.includes(label)) errors.push(`P0 MISSING_LABEL ${label}`);
for (const required of ["public/ui/title-background.webp", "public/ui/qa-corner.webp", "public/scene-bg", "public/characters"]) {
  if (!fs.existsSync(path.join(root, required))) errors.push(`P0 MISSING_ASSET ${required}`);
}

function validateMappedAssets(sourceFile, marker, publicDirectory) {
  const content = fs.readFileSync(path.join(root, sourceFile), "utf8");
  const pattern = new RegExp(`\\$\\{${marker}\\}([^\\x60]+)`, "g");
  for (const match of content.matchAll(pattern)) {
    const relativePath = path.join("public", publicDirectory, match[1]);
    if (!fs.existsSync(path.join(root, relativePath))) errors.push(`P0 MISSING_MAPPED_ASSET ${relativePath}`);
  }
}

validateMappedAssets("src/vnStoryPresentation.ts", "PUBLIC_BG_BASE", "scene-bg");
validateMappedAssets("src/vnStoryPresentation.ts", "PUBLIC_CG_BASE", "cg");
validateMappedAssets("src/engine.ts", "PUBLIC_CHARACTER_BASE", "characters");
validateMappedAssets("src/vnContent.ts", "PUBLIC_UI_BASE", "ui");

const chapterMarkers = [...source.matchAll(/\[\[chapter:([\w.-]+)\]\]/g)].map((match) => match[1]);
const chapterTitles = [...source.matchAll(/^(?:第[一二三四五六七八九十百0-9]+幕|过渡幕|尾声)：.+$/gm)];
const choiceMarkers = [...source.matchAll(/^\[\[choice(?::([\w.-]+))?\]\]$/gm)].map((match) => match[1]);
const cgMarkers = [...source.matchAll(/^【CG(?:#([\w.-]+))?[：:].+】$/gm)].map((match) => match[1]);
for (const [kind, ids] of [["CHAPTER", chapterMarkers], ["CHOICE", choiceMarkers], ["CG", cgMarkers]]) {
  if (ids.some((id) => !id)) errors.push(`P0 MISSING_${kind}_ID`);
  const duplicateIds = ids.filter((id, index) => id && ids.indexOf(id) !== index);
  for (const id of new Set(duplicateIds)) errors.push(`P0 DUPLICATE_${kind}_ID ${id}`);
}
if (chapterMarkers.length !== chapterTitles.length) errors.push(`P0 CHAPTER_ID_COUNT ${chapterMarkers.length}/${chapterTitles.length}`);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`VN validation passed: ${chapterMarkers.length} chapters, ${choiceMarkers.length} choices, ${cgMarkers.length} CGs, ${labels.length} labels, ${jumps.length} jumps.`);
