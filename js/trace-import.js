// v0.55 (R139) : trace d'un vol importée depuis un fichier (GPX, KML, KMZ, IGC, GeoJSON, CSV latitude / longitude / heure ;
// fichiers d'applis comme myTracks). Logique pure (testée sous Node) : lecture, simplification, encodage compact.
// - La trace est rangée AVEC le vol (`vol.traceImportee`) : elle voyage par la synchro et la sauvegarde de secours ;
//   ni le tableur CSV ni le PDF ne la contiennent ; elle ne change jamais les heures.
// - Le NAS (carnet.php v5, inchangé) refuse un élément de plus de 64 Ko : la trace est simplifiée (Douglas-Peucker,
//   1 500 points au plus) puis encodée (« polyline » : ~10 caractères par point), et réduite encore si le vol dépassait
//   TAILLE_VOL_MAX caractères (marge sous les 60 000 de la synchro).
// Point lu : [instant ms UTC | null, lat, lon, altitude m | null, vitesse sol kt (facultative)]. Rangé (v0.59, R151) : altitude
// en pieds, arrondie à 10 ft (clé « a ») et vitesse sol mesurée en nœuds entiers (clé « v ») ; clés absentes si le fichier
// n'en a pas ; après decoderPoints : [instant, lat, lon, altitude ft | null, vitesse kt | null].
// Vitesse dans un GPX : <mytracks:speed> (myTracks) en km/h ; <speed> (GPX 1.0) et <gpxtpx:speed> (Garmin…) en m/s.

export const POINTS_MAX = 1500;
export const TAILLE_VOL_MAX = 50000;
export const FORMATS = 'GPX, KML, KMZ, IGC, GeoJSON ou CSV (latitude, longitude, heure)';
const MESSAGES = {
  format: `Format non reconnu. Formats acceptés : ${FORMATS}.`,
  vide: 'Aucun point lisible dans ce fichier : rien n\'a changé.',
  kmz: 'Fichier KMZ illisible : rien n\'a changé.',
};

// ---------- Outils ----------
const nombre = x => { const n = Number(String(x).trim().replace(',', '.')); return Number.isFinite(n) ? n : null; };
const instant = x => {
  if (x === null || x === undefined || x === '') return null;
  if (typeof x === 'number' || /^\d{9,13}(\.\d+)?$/.test(String(x).trim())) { const n = Number(x); return n < 1e11 ? Math.round(n * 1000) : Math.round(n); }
  let t = String(x).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(t)) t = t.replace(' ', 'T') + 'Z'; // sans fuseau : UTC
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
};
const pointValide = p => p && Number.isFinite(p[1]) && Number.isFinite(p[2]) && Math.abs(p[1]) <= 90 && Math.abs(p[2]) <= 180 && !(p[1] === 0 && p[2] === 0);
const attr = (balise, nom) => { const m = new RegExp(`\\b${nom}\\s*=\\s*["']([^"']*)["']`, 'i').exec(balise); return m ? m[1] : null; };
const contenuDe = (xml, nom) => { const m = new RegExp(`<(?:\\w+:)?${nom}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${nom}>`, 'i').exec(xml); return m ? m[1].trim() : null; };

// ---------- GPX ----------
function lireGpx(t) {
  const lire = nom => {
    const l = [], re = new RegExp(`<${nom}\\b([^>]*?)(/>|>([\\s\\S]*?)</${nom}>)`, 'gi');
    let m;
    while ((m = re.exec(t))) {
      const lat = nombre(attr(m[1], 'lat')), lon = nombre(attr(m[1], 'lon')), dedans = m[3] || '';
      // v0.59 (R151) : vitesse sol mesurée (convertie en nœuds)
      const kmh = /<mytracks:speed\b/i.test(dedans), v = nombre(contenuDe(dedans, 'speed') ?? '');
      const kt = v === null || v < 0 ? null : kmh ? v / 1.852 : v * 1.943844;
      l.push([instant(contenuDe(dedans, 'time')), lat, lon, nombre(contenuDe(dedans, 'ele') ?? ''), ...(kt === null ? [] : [kt])]);
    }
    return l;
  };
  for (const nom of ['trkpt', 'rtept', 'wpt']) { const l = lire(nom).filter(pointValide); if (l.length >= 2) return l; }
  return [];
}

// ---------- KML (LineString, gx:Track, sinon points) ----------
function lireKml(t) {
  // gx:Track (myTracks, Google) : <when> et <gx:coord> dans le même ordre
  const pistes = [...t.matchAll(/<gx:Track\b[^>]*>([\s\S]*?)<\/gx:Track>/gi)];
  if (pistes.length) {
    const l = [];
    for (const [, x] of pistes) {
      const quand = [...x.matchAll(/<when>([^<]*)<\/when>/gi)].map(m => instant(m[1]));
      const coords = [...x.matchAll(/<gx:coord>([^<]*)<\/gx:coord>/gi)].map(m => m[1].trim().split(/\s+/).map(nombre));
      coords.forEach((c, i) => l.push([quand.length === coords.length ? quand[i] : null, c[1], c[0], c[2] ?? null]));
    }
    const ok = l.filter(pointValide);
    if (ok.length >= 2) return ok;
  }
  const lignes = [...t.matchAll(/<LineString\b[^>]*>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/gi)].map(m => m[1]);
  const source = lignes.length ? lignes : [...t.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi)].map(m => m[1]);
  const l = [];
  for (const bloc of source) for (const tuple of bloc.trim().split(/\s+/)) {
    const c = tuple.split(',').map(nombre);
    if (c.length >= 2) l.push([null, c[1], c[0], c[2] ?? null]);
  }
  return l.filter(pointValide);
}

// ---------- IGC (enregistrements B) ----------
function lireIgc(t) {
  const d = /^HFDTE(?:DATE:)?(\d{2})(\d{2})(\d{2})/m.exec(t);
  const base = d ? Date.UTC(2000 + Number(d[3]), Number(d[2]) - 1, Number(d[1])) : null;
  const l = [];
  let avant = -1, jours = 0;
  for (const ligne of t.split(/\r?\n/)) {
    const m = /^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{5})([NS])(\d{3})(\d{5})([EW])[AV](\d{5}|-\d{4})(\d{5}|-\d{4})/.exec(ligne);
    if (!m) continue;
    const s = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    if (s < avant) jours++; // passage de minuit UTC
    avant = s;
    const lat = (Number(m[4]) + Number(m[5]) / 60000) * (m[6] === 'S' ? -1 : 1);
    const lon = (Number(m[7]) + Number(m[8]) / 60000) * (m[9] === 'W' ? -1 : 1);
    const alt = Number(m[11]) || Number(m[10]) || null;
    l.push([base === null ? null : base + (jours * 86400 + s) * 1000, lat, lon, alt]);
  }
  return l.filter(pointValide);
}

// ---------- GeoJSON ----------
function lireGeoJson(t) {
  let j;
  try { j = JSON.parse(t); } catch { return null; }
  const lignes = [], points = [];
  const geometrie = (g, props = {}) => {
    if (!g) return;
    const temps = props.coordTimes || props.times || null;
    if (g.type === 'LineString') lignes.push(g.coordinates.map((c, i) => [instant(Array.isArray(temps) ? temps[i] : null), c[1], c[0], c[2] ?? null]));
    else if (g.type === 'MultiLineString') g.coordinates.forEach((cs, k) => lignes.push(cs.map((c, i) => [instant(Array.isArray(temps) && Array.isArray(temps[k]) ? temps[k][i] : null), c[1], c[0], c[2] ?? null])));
    else if (g.type === 'Point') points.push([instant(props.time ?? props.timestamp ?? props.heure ?? null), g.coordinates[1], g.coordinates[0], g.coordinates[2] ?? null]);
    else if (g.type === 'GeometryCollection') (g.geometries || []).forEach(x => geometrie(x, props));
  };
  const objet = o => {
    if (!o || typeof o !== 'object') return;
    if (o.type === 'FeatureCollection') (o.features || []).forEach(objet);
    else if (o.type === 'Feature') geometrie(o.geometry, o.properties || {});
    else geometrie(o);
  };
  objet(j);
  const l = (lignes.length ? lignes.flat() : points).map(p => p.map(x => (typeof x === 'number' ? x : x === null ? null : nombre(x))));
  return l.filter(pointValide);
}

// ---------- CSV (latitude, longitude, heure) ----------
const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/^"|"$/g, '');
function lireCsv(t) {
  const lignes = t.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lignes.length) return null;
  const sep = [';', '\t', ','].map(c => [c, lignes[0].split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const titres = lignes[0].split(sep).map(sansAccent);
  const col = noms => titres.findIndex(x => noms.includes(x));
  const iLat = col(['lat', 'latitude', 'lat (deg)', 'latitude (deg)']), iLon = col(['lon', 'lng', 'long', 'longitude', 'lon (deg)', 'longitude (deg)']);
  if (iLat < 0 || iLon < 0) return null;
  if (lignes.length < 2) return [];
  const iT = col(['time', 'heure', 'timestamp', 'datetime', 'date_time', 'utc', 'temps', 'date et heure', 'horodatage', 'time (utc)']);
  // v0.59 (R151) : altitude (mètres, sauf colonne marquée « ft »)
  const iAm = col(['alt', 'altitude', 'ele', 'elevation', 'alt (m)', 'altitude (m)', 'elevation (m)', 'ele (m)']);
  const iAf = col(['alt (ft)', 'altitude (ft)', 'altitude ft', 'alt ft']);
  const iD = col(['date']);
  const l = [];
  for (const ligne of lignes.slice(1)) {
    const c = ligne.split(sep).map(x => x.trim().replace(/^"|"$/g, ''));
    let quand = iT >= 0 ? c[iT] : iD >= 0 ? c[iD] : null;
    if (iT >= 0 && iD >= 0 && iD !== iT && /^\d{1,2}:\d{2}/.test(c[iT] || '')) quand = `${c[iD]}T${c[iT]}`;
    const alt = iAf >= 0 ? (nombre(c[iAf] ?? '') ?? null) : iAm >= 0 ? nombre(c[iAm] ?? '') : null;
    l.push([instant(quand), nombre(c[iLat] ?? ''), nombre(c[iLon] ?? ''), alt === null ? null : iAf >= 0 ? alt / 3.28084 : alt]);
  }
  return l.filter(pointValide);
}

// ---------- KMZ (zip) : le premier .kml du fichier ----------
export async function kmlDuKmz(octets) {
  const o = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  const dv = new DataView(o.buffer, o.byteOffset, o.byteLength);
  let fin = -1;
  for (let i = o.length - 22; i >= Math.max(0, o.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) return null;
  const n = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const entrees = [];
  for (let k = 0; k < n && p + 46 <= o.length && dv.getUint32(p, true) === 0x02014b50; k++) {
    const methode = dv.getUint16(p + 10, true), taille = dv.getUint32(p + 20, true);
    const ln = dv.getUint16(p + 28, true), le = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
    entrees.push({ nom: new TextDecoder().decode(o.subarray(p + 46, p + 46 + ln)), methode, taille, local });
    p += 46 + ln + le + lc;
  }
  const e = entrees.find(x => /(^|\/)doc\.kml$/i.test(x.nom)) || entrees.find(x => /\.kml$/i.test(x.nom));
  if (!e || dv.getUint32(e.local, true) !== 0x04034b50) return null;
  const debut = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
  const donnees = o.subarray(debut, debut + e.taille);
  if (e.methode === 0) return new TextDecoder().decode(donnees);
  if (e.methode !== 8 || typeof DecompressionStream === 'undefined') return null;
  try {
    const flux = new Blob([donnees]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(flux).text();
  } catch { return null; }
}

// Lit un fichier : { ok: true, format, points } ou { ok: false, message }. octets : Uint8Array / ArrayBuffer du fichier.
export async function lireTraceFichier(nom, octets) {
  const o = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  const ext = (/\.([a-z0-9]+)$/i.exec(nom || '') || [])[1]?.toLowerCase() || '';
  if (ext === 'kmz' || (o[0] === 0x50 && o[1] === 0x4b)) {
    const kml = await kmlDuKmz(o);
    if (kml === null) return { ok: false, message: MESSAGES.kmz };
    const points = lireKml(kml);
    return points.length >= 2 ? { ok: true, format: 'KMZ', points } : { ok: false, message: MESSAGES.vide };
  }
  const t = new TextDecoder().decode(o).replace(/^﻿/, '');
  const debut = t.trimStart().slice(0, 400).toLowerCase();
  let format = null;
  if (ext === 'gpx' || debut.includes('<gpx')) format = 'GPX';
  else if (ext === 'kml' || debut.includes('<kml')) format = 'KML';
  else if (ext === 'igc' || /^A[A-Z0-9]{3}/.test(t.trimStart()) && /^B\d{6}/m.test(t)) format = 'IGC';
  else if (['geojson', 'json'].includes(ext) || /^[[{]/.test(t.trimStart())) format = 'GeoJSON';
  else if (['csv', 'txt', 'tsv'].includes(ext) || /lat/i.test(t.split(/\r?\n/)[0] || '')) format = 'CSV';
  if (!format) return { ok: false, message: MESSAGES.format };
  const points = { GPX: lireGpx, KML: lireKml, IGC: lireIgc, GeoJSON: lireGeoJson, CSV: lireCsv }[format](t);
  if (points === null) return { ok: false, message: format === 'CSV' && ext === 'csv' ? 'CSV sans colonnes latitude et longitude : rien n\'a changé.' : MESSAGES.format };
  return points.length >= 2 ? { ok: true, format, points } : { ok: false, message: MESSAGES.vide };
}

// ---------- Simplification (Douglas-Peucker, tolérance cherchée pour ne pas dépasser max points) ----------
function garderDP(x, y, eps) {
  const n = x.length, garde = new Uint8Array(n);
  garde[0] = 1; garde[n - 1] = 1;
  const pile = [[0, n - 1]], e2 = eps * eps;
  while (pile.length) {
    const [a, b] = pile.pop();
    const dx = x[b] - x[a], dy = y[b] - y[a], l2 = dx * dx + dy * dy;
    let pire = -1, dMax = 0;
    for (let i = a + 1; i < b; i++) {
      let d;
      if (l2 === 0) d = (x[i] - x[a]) ** 2 + (y[i] - y[a]) ** 2;
      else { const c = dx * (y[i] - y[a]) - dy * (x[i] - x[a]); d = (c * c) / l2; }
      if (d > dMax) { dMax = d; pire = i; }
    }
    if (pire >= 0 && dMax > e2) { garde[pire] = 1; pile.push([a, pire], [pire, b]); }
  }
  return garde;
}
export function simplifier(points, max = POINTS_MAX) {
  const l = points.filter((p, i) => i === 0 || p[1] !== points[i - 1][1] || p[2] !== points[i - 1][2]);
  if (l.length <= max) return l;
  const lat0 = l[0][1] * Math.PI / 180, k = 111320;
  const x = Float64Array.from(l, p => p[2] * k * Math.cos(lat0)), y = Float64Array.from(l, p => p[1] * k);
  let bas = 0, haut = 50000, meilleur = null; // tolérance en mètres
  for (let i = 0; i < 40; i++) {
    const eps = (bas + haut) / 2, g = garderDP(x, y, eps);
    let n = 0; for (const v of g) n += v;
    if (n <= max) { meilleur = g; haut = eps; } else bas = eps;
    if (haut - bas < 0.5) break;
  }
  if (!meilleur) meilleur = garderDP(x, y, haut);
  return l.filter((p, i) => meilleur[i]);
}

// ---------- Encodage compact (algorithme « polyline » : lat, lon au 1e-5 ; secondes depuis t0) ----------
function ecrireNombre(n, sortie) {
  let v = n < 0 ? ~(n << 1) : n << 1;
  while (v >= 0x20) { sortie.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63)); v >>>= 5; }
  sortie.push(String.fromCharCode(v + 63));
}
export function encoderPoints(points) {
  const avecHeure = points.every(p => Number.isFinite(p[0]));
  const t0 = avecHeure ? Math.round(points[0][0] / 1000) : null;
  const s = [];
  let pl = 0, pn = 0, pt = 0;
  for (const p of points) {
    const la = Math.round(p[1] * 1e5), lo = Math.round(p[2] * 1e5);
    ecrireNombre(la - pl, s); ecrireNombre(lo - pn, s); pl = la; pn = lo;
    if (avecHeure) { const t = Math.round(p[0] / 1000) - t0; ecrireNombre(t - pt, s); pt = t; }
  }
  // v0.59 (R151) : altitude en dizaines de pieds (points sans altitude : la valeur connue la plus proche avant, sinon après)
  const alt = points.map(p => (Number.isFinite(p[3]) ? Math.round(p[3] * 3.28084 / 10) : null));
  const r = { t0, pts: s.join('') };
  const serie = vals => { // valeurs entières ; manquantes : la plus proche connue avant, sinon après
    let connu = vals.find(x => x !== null), pv = 0;
    const o = [];
    for (const x of vals) { if (x !== null) connu = x; ecrireNombre(connu - pv, o); pv = connu; }
    return o.join('');
  };
  if (alt.some(x => x !== null)) r.a = serie(alt);
  // v0.59 (R151) : vitesse sol mesurée (nœuds entiers) si le fichier en donne
  const vit = points.map(p => (Number.isFinite(p[4]) ? Math.round(p[4]) : null));
  if (vit.some(x => x !== null)) r.v = serie(vit);
  return r;
}
export function decoderPoints(trace) {
  if (!trace || typeof trace.pts !== 'string') return [];
  const avecHeure = Number.isFinite(trace.t0), s = trace.pts, out = [];
  let i = 0, la = 0, lo = 0, t = 0;
  const lire = () => {
    let r = 0, d = 0, b;
    do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << d; d += 5; } while (b >= 0x20 && i < s.length);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < s.length) {
    la += lire(); lo += lire();
    if (avecHeure) t += lire();
    out.push([avecHeure ? (trace.t0 + t) * 1000 : null, la / 1e5, lo / 1e5, null]);
  }
  // v0.59 (R151) : altitude (pieds) si la trace en a (traces importées avant la v0.59 : sans altitude)
  const serie = (txt, k, f) => {
    if (typeof txt !== 'string' || !txt) return;
    let j = 0, v = 0;
    const lireS = () => { let r = 0, d = 0, b; do { b = txt.charCodeAt(j++) - 63; r |= (b & 0x1f) << d; d += 5; } while (b >= 0x20 && j < txt.length); return r & 1 ? ~(r >> 1) : r >> 1; };
    for (const p of out) { v += lireS(); p[k] = v * f; }
  };
  serie(trace.a, 3, 10); // altitude (pieds)
  serie(trace.v, 4, 1);  // vitesse sol mesurée (nœuds)
  return out;
}

// Trace prête à ranger dans le vol : simplifiée, encodée, et assez petite pour la synchro avec ce vol.
// volSansTrace : le vol (sans trace) dont on mesure la taille.
export function traceImportee(points, { nom, format }, volSansTrace = {}, maintenant = new Date().toISOString()) {
  const base = JSON.stringify(volSansTrace).length;
  let max = POINTS_MAX, t;
  for (;;) {
    const s = simplifier(points, max), e = encoderPoints(s);
    t = { nom: String(nom || '').slice(0, 120), format, n: s.length, nOrigine: points.length, t0: e.t0, pts: e.pts, ...(e.a ? { a: e.a } : {}), ...(e.v ? { v: e.v } : {}), importeLe: maintenant };
    if (base + JSON.stringify(t).length + 20 <= TAILLE_VOL_MAX || max <= 50) break;
    max = Math.floor(max * 0.7);
  }
  return t;
}
