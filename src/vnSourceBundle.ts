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

export function buildExportSourceFiles() {
  return [
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
}
