/**
 * Runs once when the Next.js Node server boots.
 * Prefer IPv4 — many upstreams hang on AAAA from this host.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  try {
    // webpackIgnore: edge/webpack must not resolve Node dns into the bundle.
    const dns = await import(/* webpackIgnore: true */ 'node:dns');
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    /* older Node */
  }
}
