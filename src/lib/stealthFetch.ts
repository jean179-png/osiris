/**
 * OSIRIS — Stealth Fetch Utility
 * Generates randomized HTTP headers to distribute API requests
 * across a pool of spoofed residential IP addresses and browser fingerprints.
 *
 * Uses Node's https client rather than Next's bundled undici `fetch`, which
 * stalls with `TypeError: fetch failed` / UND_ERR_CONNECT_TIMEOUT on many
 * upstreams (adsb.fi, Carto tiles, USGS, FIRMS, MBTA, …) from the server runtime.
 */

import dns from 'dns';
import http from 'http';
import https from 'https';
import zlib from 'zlib';
import type { Readable } from 'stream';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* older Node */
}

// Residential IP ranges (common ISP subnets globally)
const IP_POOLS = [
  // US Comcast
  { base: [73, 15], range: [255, 255] },
  { base: [98, 24], range: [255, 255] },
  { base: [174, 51], range: [255, 255] },
  // US AT&T
  { base: [107, 77], range: [255, 255] },
  { base: [166, 198], range: [255, 255] },
  // US Verizon
  { base: [71, 172], range: [255, 255] },
  { base: [100, 0], range: [127, 255] },
  // UK BT
  { base: [86, 128], range: [127, 255] },
  { base: [81, 132], range: [63, 255] },
  // DE Telekom
  { base: [91, 64], range: [63, 255] },
  { base: [80, 128], range: [63, 255] },
  // FR Orange
  { base: [90, 0], range: [63, 255] },
  { base: [86, 192], range: [63, 255] },
  // IT Telecom Italia
  { base: [79, 0], range: [63, 255] },
  { base: [87, 0], range: [31, 255] },
  // BR Vivo
  { base: [177, 0], range: [127, 255] },
  // AU Telstra
  { base: [101, 160], range: [31, 255] },
  // IN Jio
  { base: [49, 32], range: [31, 255] },
  // CA Rogers
  { base: [99, 224], range: [31, 255] },
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
];

function randomInt(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}

function generateResidentialIP(): string {
  const pool = IP_POOLS[randomInt(IP_POOLS.length - 1)];
  const octet3 = pool.base[1] + randomInt(pool.range[0]);
  const octet4 = randomInt(pool.range[1]);
  return `${pool.base[0]}.${octet3}.${octet4 || 1}.${randomInt(254) + 1}`;
}

function randomUA(): string {
  return USER_AGENTS[randomInt(USER_AGENTS.length - 1)];
}

/**
 * Generate spoofed headers for a stealth fetch request.
 * Merges with any existing headers you pass in.
 */
export function stealthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const ip = generateResidentialIP();
  return {
    'User-Agent': randomUA(),
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Forwarded-For': ip,
    'X-Real-IP': ip,
    ...extraHeaders,
  };
}

function headersToObject(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function resolveUrl(url: string | URL | Request): string {
  if (typeof url === 'string') return url;
  if (url instanceof URL) return url.toString();
  return url.url;
}

function timeoutMsFromSignal(signal: AbortSignal | null | undefined, fallback: number): number {
  if (!signal) return fallback;
  // AbortSignal.timeout(n) exposes nothing reliable across runtimes; keep a hard cap.
  return fallback;
}

/**
 * Perform a fetch with stealth headers injected automatically.
 * Drop-in replacement for global fetch() with identical signature (GET/HEAD/POST).
 */
export async function stealthFetch(
  url: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const target = resolveUrl(url);
  const method = (init?.method || 'GET').toUpperCase();
  const headers = stealthHeaders(headersToObject(init?.headers));
  const timeoutMs = timeoutMsFromSignal(init?.signal ?? null, 30_000);
  const body =
    init?.body == null
      ? undefined
      : typeof init.body === 'string'
        ? Buffer.from(init.body)
        : Buffer.isBuffer(init.body)
          ? init.body
          : Buffer.from(await new Response(init.body).arrayBuffer());

  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const ok = (res: Response) => {
      if (settled) return;
      settled = true;
      resolve(res);
    };

    if (init?.signal?.aborted) {
      fail(init.signal.reason ?? new Error('aborted'));
      return;
    }

    const onAbort = () => {
      req.destroy(new Error('aborted'));
    };
    init?.signal?.addEventListener('abort', onAbort, { once: true });

    const parsed = new URL(target);
    const lib = parsed.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
        path: parsed.pathname + parsed.search,
        method,
        headers: {
          ...headers,
          ...(body ? { 'Content-Length': String(body.length) } : {}),
        },
        timeout: timeoutMs,
        family: 4,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const encoding = (res.headers['content-encoding'] || '').toLowerCase();
        let stream: Readable = res;
        if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        stream.on('error', fail);
        stream.on('end', () => {
          init?.signal?.removeEventListener('abort', onAbort);
          const buf = Buffer.concat(chunks);
          const outHeaders = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (v == null) continue;
            // Body is already decoded — don't advertise encoding to Response consumers.
            if (k.toLowerCase() === 'content-encoding') continue;
            if (k.toLowerCase() === 'content-length') continue;
            if (Array.isArray(v)) v.forEach((item) => outHeaders.append(k, item));
            else outHeaders.set(k, v);
          }
          ok(new Response(buf, { status, headers: outHeaders }));
        });
      },
    );

    req.on('timeout', () => req.destroy(new Error('stealthFetch Hard Timeout')));
    req.on('error', fail);
    if (body) req.end(body);
    else req.end();
  });
}
