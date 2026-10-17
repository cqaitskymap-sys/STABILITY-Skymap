const LIST_TTL = 30_000;

export const PAGE_TTL = 120_000;

type Entry = { data: unknown; at: number; epoch: number };

type Inflight = { epoch: number; promise: Promise<unknown> };

const memory = new Map<string, Entry>();
const inflight = new Map<string, Inflight>();
let epoch = 0;

function enabled() {
  return typeof window !== "undefined";
}

export function invalidateReadCache() {
  epoch += 1;
  memory.clear();
}

export function readFresh<T>(key: string, ttl: number): T | undefined {
  if (!enabled()) return undefined;
  const hit = memory.get(key);
  if (!hit || hit.epoch !== epoch) return undefined;
  if (Date.now() - hit.at > ttl) return undefined;
  return hit.data as T;
}

export function writeFresh(key: string, data: unknown) {
  if (!enabled()) return;
  memory.set(key, { data, at: Date.now(), epoch });
}

export function cachedRead<T>(key: string, loader: () => Promise<T>, ttl = LIST_TTL): Promise<T> {
  if (!enabled()) return loader();
  const hit = readFresh<T>(key, ttl);
  if (hit !== undefined) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending && pending.epoch === epoch) return pending.promise as Promise<T>;

  const started = epoch;
  const promise = loader()
    .then((data) => {
      if (started === epoch) memory.set(key, { data, at: Date.now(), epoch });
      return data;
    })
    .finally(() => {
      const current = inflight.get(key);
      if (current && current.epoch === started) inflight.delete(key);
    });
  inflight.set(key, { epoch: started, promise });
  return promise;
}
