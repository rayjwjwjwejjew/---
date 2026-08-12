const IMAGE_READY_CACHE = new Map<string, Promise<void>>();
const IMAGE_PREFETCH_QUEUE: string[] = [];
const IMAGE_PREFETCH_LIMIT = 3;
let IMAGE_PREFETCH_ACTIVE = 0;

export function ensureImageReady(url: string): Promise<void> {
  const cached = IMAGE_READY_CACHE.get(url);
  if (cached) return cached;

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    let finished = false;
    img.decoding = "async";
    img.loading = "eager";
    const finish = () => {
      if (finished) return;
      finished = true;
      if (typeof img.decode === "function") {
        void img.decode().catch(() => undefined).finally(resolve);
        return;
      }
      resolve();
    };
    img.onload = finish;
    img.onerror = () => resolve();
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      finish();
    }
  });

  IMAGE_READY_CACHE.set(url, promise);
  return promise;
}

function pumpImagePreloadQueue() {
  while (IMAGE_PREFETCH_ACTIVE < IMAGE_PREFETCH_LIMIT && IMAGE_PREFETCH_QUEUE.length > 0) {
    const url = IMAGE_PREFETCH_QUEUE.shift();
    if (!url || IMAGE_READY_CACHE.has(url)) continue;
    IMAGE_PREFETCH_ACTIVE += 1;
    void ensureImageReady(url).finally(() => {
      IMAGE_PREFETCH_ACTIVE = Math.max(0, IMAGE_PREFETCH_ACTIVE - 1);
      pumpImagePreloadQueue();
    });
  }
}

export function queueImagePreload(url: string | null | undefined) {
  if (!url || IMAGE_READY_CACHE.has(url) || IMAGE_PREFETCH_QUEUE.includes(url)) return;
  IMAGE_PREFETCH_QUEUE.push(url);
  pumpImagePreloadQueue();
}
