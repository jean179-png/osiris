export interface RadiationStation {
  name: string;
  city: string;
  country: string;
  reading: number;
  status: 'NORMAL' | 'WARNING' | 'DANGER';
  network: string;
  lat: number;
  lng: number;
}

type SafecastRow = {
  id?: number;
  value?: number;
  unit?: string;
  location_name?: string | null;
  latitude?: number;
  longitude?: number;
};

/** Rough CPM → nSv/h for common GM tubes used by Safecast. */
export function cpmToNsvh(cpm: number): number {
  return Math.round(cpm * 10);
}

export function statusForNsvh(nsvh: number): RadiationStation['status'] {
  if (nsvh >= 1000) return 'DANGER';
  if (nsvh >= 300) return 'WARNING';
  return 'NORMAL';
}

export function mapSafecastToStations(rows: unknown, max = 500): RadiationStation[] {
  if (!Array.isArray(rows)) return [];
  const out: RadiationStation[] = [];
  for (const row of rows as SafecastRow[]) {
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const raw = Number(row.value);
    if (!Number.isFinite(raw)) continue;
    const unit = (row.unit || 'cpm').toLowerCase();
    let nsvh = raw;
    if (unit === 'cpm') nsvh = cpmToNsvh(raw);
    else if (unit.includes('usv')) nsvh = Math.round(raw * 1000);
    else if (unit.includes('nsv')) nsvh = Math.round(raw);
    out.push({
      name: row.location_name || `Safecast #${row.id ?? out.length}`,
      city: '',
      country: '',
      reading: nsvh,
      status: statusForNsvh(nsvh),
      network: 'Safecast',
      lat,
      lng,
    });
    if (out.length >= max) break;
  }
  return out;
}
