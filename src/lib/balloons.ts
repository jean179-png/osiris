export interface BalloonRow {
  callsign: string;
  type: string;
  status: string;
  altitude: number;
  speed: number;
  verticalRate: number;
  temperature: number;
  color: string;
  lat: number;
  lng: number;
}

type SondeFrame = {
  serial?: string;
  type?: string;
  subtype?: string;
  lat?: number;
  lon?: number;
  alt?: number;
  vel_h?: number;
  vel_v?: number;
  temp?: number;
  heading?: number;
  datetime?: string;
};

const COLORS = ['#00E5FF', '#FF9500', '#E040FB', '#76FF03', '#FFEB3B', '#FF5252'];

function colorFor(serial: string): string {
  let h = 0;
  for (let i = 0; i < serial.length; i++) h = (h * 31 + serial.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length]!;
}

/** Map SondeHub telemetry object → balloon rows (latest frame per serial). */
export function mapSondeHubToBalloons(data: unknown, max = 800): BalloonRow[] {
  if (!data || typeof data !== 'object') return [];
  const out: BalloonRow[] = [];
  for (const [serial, frames] of Object.entries(data as Record<string, unknown>)) {
    if (!frames || typeof frames !== 'object') continue;
    const times = Object.keys(frames as object).sort();
    const lastKey = times[times.length - 1];
    if (!lastKey) continue;
    const frame = (frames as Record<string, SondeFrame>)[lastKey];
    if (!frame) continue;
    const lat = Number(frame.lat);
    const lng = Number(frame.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const alt = Number(frame.alt);
    const velH = Number(frame.vel_h);
    const velV = Number(frame.vel_v);
    const temp = Number(frame.temp);
    out.push({
      callsign: frame.serial || serial,
      type: frame.subtype || frame.type || 'radiosonde',
      status: Number.isFinite(velV) && velV < -2 ? 'descending' : Number.isFinite(velV) && velV > 2 ? 'ascending' : 'floating',
      altitude: Number.isFinite(alt) ? Math.round(alt) : 0,
      speed: Number.isFinite(velH) ? Math.round(velH * 3.6) : 0,
      verticalRate: Number.isFinite(velV) ? velV : 0,
      temperature: Number.isFinite(temp) ? Math.round(temp * 10) / 10 : 0,
      color: colorFor(serial),
      lat,
      lng,
    });
    if (out.length >= max) break;
  }
  return out;
}
