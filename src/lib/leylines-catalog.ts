export const LEYLINES_ORIGIN = 'https://maps.leylines.net';
export const LEYLINES_ATTRIBUTION = 'Leylines Map · leylines.net';
export const LEYLINES_WATKINS_ATTRIBUTION =
  'Leylines Map · leylines.net · leyhunters.co.uk';

export type WatkinsLeyEntry = {
  slug: string;
  name: string;
  /** path after origin, starts with api/line/... */
  path: string;
};

function ley(slug: string, name: string, width = 50): WatkinsLeyEntry {
  return {
    slug,
    name,
    path: `api/line/leylines/lines/${slug}/${width}/255,255,66`,
  };
}

/** UK leyhunters set + St. Michael Line + Apollo–St.Michael Axis */
export const WATKINS_LEYS: WatkinsLeyEntry[] = [
  ley('arbor-low-line', 'Arbor Low Ley - Derbyshire/Staffordshire'),
  ley('avebury-line', 'Avebury Ley - Wiltshire'),
  ley('bradgate-line', 'Bradgate Ley - Leicestershire'),
  ley('cambridge-line', 'Cambridge Ley - Cambridgeshire'),
  ley('canterbury-line', 'Canterbury Ley - Kent'),
  ley('cerne-abbas-line', 'Cerne Abbas Ley - Dorset'),
  ley('devils-arrows-line', "Devil's Arrows Ley - North Yorkshire"),
  ley('glastonbury-line', 'Glastonbury Ley - Avon/Somerset'),
  ley('long-man-line', 'Long Man of Wilmington Ley - Sussex'),
  ley('maiden-castle-line', 'Maiden Castle Ley - Dorset'),
  ley('mayburgh-line', 'Mayburgh Ley - Cumbria'),
  ley('men-an-tol-line', 'Men-an-tol Ley - Cornwall'),
  ley('montgomery-line', 'Montgomery Ley - Powys/Shropshire'),
  ley('old-sarum-line', 'Old Sarum Ley - Wiltshire/Hampshire'),
  ley('rollright-line', 'Rollright Ley - Northamptonshire/Oxfordshire'),
  ley('rudston-line', 'Rudston Ley - North Yorkshire/Humberside'),
  ley('silbury-hill-line', 'Silbury Hill Ley - Wiltshire'),
  ley('st-pauls-cathedral-line', "St. Paul's Cathedral Ley - London"),
  ley('stonehenge-line', 'Stonehenge Ley - Wiltshire'),
  ley('strand-line', 'Strand Ley - London'),
  ley('uffington-line', 'Uffington Ley - Wiltshire/Oxfordshire'),
  ley('walterstone-line', 'Walterstone Ley - Hereford and Worcester/Gwent'),
  ley('weston-beacon-line', 'Weston Beacon Ley - Devon'),
  ley('winchester-line', 'Winchester Ley - Hampshire'),
  ley('st-michael-line', 'St. Michael Line', 10000),
  ley('st-michael-apollo-axis', 'Apollo-St.Michael Axis', 10000),
];

export type GridFamily = 'gravity-wells';

export function gridPath(family: GridFamily): string {
  if (family === 'gravity-wells') {
    return 'api/createGrid/0.0/0.0/0.0/diamond/gravitywells/basic/lines/off';
  }
  return 'api/createGrid/0.0/0.0/0.0/diamond/gravitywells/basic/lines/off';
}

export function parseGridFamily(raw: string | null | undefined): GridFamily | null {
  if (raw == null || raw === '') return null;
  if (raw === 'gravity-wells') return 'gravity-wells';
  return null;
}

export function watkinsUrl(entry: WatkinsLeyEntry): string {
  return `${LEYLINES_ORIGIN}/${entry.path}`;
}

export function gridUrl(family: GridFamily): string {
  return `${LEYLINES_ORIGIN}/${gridPath(family)}`;
}
