import { ALL_CONTENT_IMAGES, getCgImage } from "./engine";
import { CORNER_IMG_URL, TITLE_SCREEN_BG } from "./vnContent";
import { CG_ENTRIES } from "./vnProgress";

const OFFLINE_CACHE = "soul-returns-media-v3";

export const BUILT_IN_OFFLINE_ASSETS = Array.from(new Set([
  TITLE_SCREEN_BG,
  CORNER_IMG_URL,
  ...ALL_CONTENT_IMAGES,
  ...CG_ENTRIES.map((entry) => getCgImage(entry.label, entry.scene)).filter((url): url is string => Boolean(url)),
]));

export async function getOfflinePackStatus() {
  if (!("caches" in window)) return { supported: false, cached: 0, total: BUILT_IN_OFFLINE_ASSETS.length };
  const cache = await caches.open(OFFLINE_CACHE);
  return { supported: true, cached: (await cache.keys()).length, total: BUILT_IN_OFFLINE_ASSETS.length };
}

export async function downloadOfflinePack(onProgress: (done: number, total: number) => void, signal?: AbortSignal) {
  if (!("caches" in window)) throw new Error("当前浏览器不支持离线缓存");
  const cache = await caches.open(OFFLINE_CACHE);
  let done = 0;
  for (const url of BUILT_IN_OFFLINE_ASSETS) {
    if (signal?.aborted) throw new DOMException("离线下载已取消", "AbortError");
    const absoluteUrl = new URL(url, window.location.href).toString();
    if (!(await cache.match(absoluteUrl))) {
      const response = await fetch(absoluteUrl, { signal });
      if (!response.ok) throw new Error(`资源下载失败：${url}`);
      await cache.put(absoluteUrl, response);
    }
    done += 1;
    onProgress(done, BUILT_IN_OFFLINE_ASSETS.length);
  }
  return getOfflinePackStatus();
}

export async function removeOfflinePack() {
  await caches.delete(OFFLINE_CACHE);
  return getOfflinePackStatus();
}
