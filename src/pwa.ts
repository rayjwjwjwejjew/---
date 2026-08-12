import { registerSW } from "virtual:pwa-register";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let installPrompt: InstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as InstallPromptEvent;
  window.dispatchEvent(new CustomEvent("vn-pwa-installable"));
});

export async function installPwa() {
  if (!installPrompt) return false;
  await installPrompt.prompt();
  const result = await installPrompt.userChoice;
  if (result.outcome === "accepted") installPrompt = null;
  return result.outcome === "accepted";
}

let applyUpdate: (reloadPage?: boolean) => Promise<void> = async () => undefined;

applyUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (window.confirm("游戏有新版本，是否现在更新？")) void applyUpdate(true);
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent("vn-offline-ready"));
  },
});
