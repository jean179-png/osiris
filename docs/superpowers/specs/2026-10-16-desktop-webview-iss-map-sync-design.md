# Desktop YouTube webview + ISS map sync

**Date:** 2026-10-16  
**Status:** Approved

## News streams (desktop)

YouTube blocks third-party iframes for NBC/CBS/ABC and others (embed_allowed: false). Workaround: in Electron, play the real YouTube watch/live page in a Guest `<webview>` (first-party YouTube), not an embed iframe.

- Enable `webviewTag` in `desktop/main.mjs`.
- Live-feed overlay: if `window.osirisDesktop.isDesktop` and embed disallowed, render `<webview src={watchUrl}>`; else keep iframe / external card for browser.
- Map preview tiles unchanged: blocked feeds stay dots; click opens overlay.
- Non-YouTube (Rumble) stays external link.

## ISS map sync

Toggle `MAP SYNC` on SpaceCam. When on:

- Follow ISS (NORAD 25544) from live satellite positions / TLE.
- Center on ISS; pitch ~75° (nadir-ish); bearing = ground-track heading.
- Prefer satellite basemap while sync is on; restore previous style/camera on off.
- **Zoom must not break track:** user zoom updates preferred zoom; follow loop uses `map.getZoom()` and does not treat zoom gestures as interrupt. Pan/rotate may be overwritten by the next follow tick (lock-to-ISS).

