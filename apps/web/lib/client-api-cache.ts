type ResponseSnapshot = {
  body: string;
  headers: Record<string, string>;
  status: number;
  statusText: string;
  expiresAt: number;
};

const responseCache = new Map<string, ResponseSnapshot>();
const pendingRequests = new Map<string, Promise<ResponseSnapshot>>();

function restoreResponse(snapshot: ResponseSnapshot) {
  return new Response(snapshot.body, {
    headers: snapshot.headers,
    status: snapshot.status,
    statusText: snapshot.statusText,
  });
}

async function requestSnapshot(url: string, ttlMs: number) {
  const response = await fetch(url, { cache: 'no-store' });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => { headers[key] = value; });
  const snapshot: ResponseSnapshot = {
    body: await response.text(),
    headers,
    status: response.status,
    statusText: response.statusText,
    expiresAt: Date.now() + ttlMs,
  };
  if (response.ok) responseCache.set(url, snapshot);
  return snapshot;
}

export async function cachedApiFetch(url: string, ttlMs = 15_000) {
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return restoreResponse(cached);
  if (cached) responseCache.delete(url);

  let pending = pendingRequests.get(url);
  if (!pending) {
    pending = requestSnapshot(url, ttlMs).finally(() => pendingRequests.delete(url));
    pendingRequests.set(url, pending);
  }
  return restoreResponse(await pending);
}

export function invalidateApiCache(...urlPrefixes: string[]) {
  for (const url of responseCache.keys()) {
    if (urlPrefixes.some(prefix => url.startsWith(prefix))) responseCache.delete(url);
  }
}
