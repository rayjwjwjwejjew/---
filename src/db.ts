const DB_NAME = "vn_studio_db_v1";
const STORE_ASSETS = "assets";
const STORE_META = "meta";

export const AssetDB = (() => {
  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_ASSETS)) {
          db.createObjectStore(STORE_ASSETS);
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(store: string, key: string, value: unknown) {
    const db = await open();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function get<T>(store: string, key: string): Promise<T | null> {
    const db = await open();
    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async function clear(store: string) {
    const db = await open();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function entries<T>(store: string): Promise<Array<{ key: string; value: T }>> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const objectStore = tx.objectStore(store);
      const request = objectStore.openCursor();
      const result: Array<{ key: string; value: T }> = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(result);
          return;
        }
        result.push({ key: String(cursor.key), value: cursor.value as T });
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  return { put, get, clear, entries, STORE_ASSETS, STORE_META };
})();
