// v0.59 (R151) : profil altitude / vitesse sol sous la trace du vol. Logique pure (testée sous Node), AFFICHAGE SEULEMENT :
// rien ici ne change une heure, un temps ou un total.
//
// Points d'entrée : [instant ms UTC, lat, lon, altitude ft | null, vitesse sol kt | null (facultative)]
//   - traces ADS-B : altitude en pieds (0 au sol) fournie par le serveur ; vitesse sol pas fournie (à ce jour) ;
//   - traces importées : altitude gardée en pieds (convertie depuis les mètres du fichier) ;
//   - sans vitesse fournie, la vitesse sol est CALCULÉE avec les positions et les heures (distance parcourue sur ~30 s),
//     seulement si les points sont assez rapprochés (VITESSE_ECART_MAX).
// Points aberrants (un point isolé avec un saut impossible) : ignorés pour le dessin.

export const PIED = 3.28084;               // m -> ft
export const NOEUD = 1.943844;             // m/s -> kt
export const FENETRE_S = 30;               // vitesse calculée : distance parcourue sur au moins 30 s
export const VITESSE_ECART_MAX = 300;      // au-delà de 5 min entre deux points : vitesse non calculée
const MONTEE_MAX = 12000;                  // ft/min : au-delà, un saut d'altitude isolé est aberrant
const VITESSE_MAX = 650;                   // kt : au-delà, un saut de position isolé est aberrant
const SAUT_VITESSE = 120;                  // kt : saut isolé de vitesse fournie (aller-retour) aberrant

const rad = x => x * Math.PI / 180;
export function distance(a, b) { // mètres (haversine)
  const dLat = rad(b[1] - a[1]), dLon = rad(b[2] - a[2]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const fini = x => typeof x === 'number' && Number.isFinite(x);

// Altitude : point isolé dont le saut (aller ET retour, sens opposés) dépasse MONTEE_MAX -> null
function altitudesPropres(pts) {
  const a = pts.map(p => (fini(p[3]) ? Math.max(0, p[3]) : null));
  const r = [...a];
  for (let i = 1; i < a.length - 1; i++) {
    if (a[i] === null || a[i - 1] === null || a[i + 1] === null) continue;
    const m1 = Math.max(1 / 60, (pts[i][0] - pts[i - 1][0]) / 60000), m2 = Math.max(1 / 60, (pts[i + 1][0] - pts[i][0]) / 60000);
    const d1 = a[i] - a[i - 1], d2 = a[i + 1] - a[i];
    if (Math.sign(d1) !== Math.sign(d2) && Math.abs(d1) / m1 > MONTEE_MAX && Math.abs(d2) / m2 > MONTEE_MAX) r[i] = null;
  }
  return r;
}
// Positions : point isolé « téléporté » (vitesse aller et retour > VITESSE_MAX, alors que ses voisins sont proches) -> exclu
function positionsValides(pts) {
  const ok = pts.map(() => true), v = (a, b) => distance(a, b) / Math.max(1, (b[0] - a[0]) / 1000) * NOEUD;
  for (let i = 1; i < pts.length - 1; i++) {
    const v1 = v(pts[i - 1], pts[i]), v2 = v(pts[i], pts[i + 1]), v3 = v(pts[i - 1], pts[i + 1]);
    if (v1 > VITESSE_MAX && v2 > VITESSE_MAX && v3 < Math.min(v1, v2) / 2) ok[i] = false;
  }
  return ok;
}
// Vitesse calculée en chaque point : distance parcourue (le long de la trace) sur une fenêtre d'au moins FENETRE_S
function vitessesCalculees(pts, ok) {
  const l = pts.map((p, i) => i).filter(i => ok[i]), res = pts.map(() => null);
  const cumul = [0];
  for (let k = 1; k < l.length; k++) cumul.push(cumul[k - 1] + distance(pts[l[k - 1]], pts[l[k]]));
  let a = 0, b = 0;
  for (let k = 0; k < l.length; k++) {
    // fenêtre [a, b] autour de k, élargie des deux côtés jusqu'à FENETRE_S
    a = k; b = k;
    while (pts[l[b]][0] - pts[l[a]][0] < FENETRE_S * 1000 && (a > 0 || b < l.length - 1)) {
      if (b < l.length - 1) b++;
      if (pts[l[b]][0] - pts[l[a]][0] < FENETRE_S * 1000 && a > 0) a--;
    }
    const dt = (pts[l[b]][0] - pts[l[a]][0]) / 1000;
    let ecart = 0;
    for (let j = a + 1; j <= b; j++) ecart = Math.max(ecart, (pts[l[j]][0] - pts[l[j - 1]][0]) / 1000);
    if (dt > 0 && ecart <= VITESSE_ECART_MAX) res[l[k]] = (cumul[b] - cumul[a]) / dt * NOEUD;
  }
  return res;
}
// Vitesse fournie : saut isolé (aller-retour) de plus de SAUT_VITESSE -> null
function vitessesFournies(pts) {
  const g = pts.map(p => (fini(p[4]) ? Math.max(0, p[4]) : null)), r = [...g];
  for (let i = 1; i < g.length - 1; i++) {
    if (g[i] === null || g[i - 1] === null || g[i + 1] === null) continue;
    const d1 = g[i] - g[i - 1], d2 = g[i + 1] - g[i];
    if (Math.sign(d1) !== Math.sign(d2) && Math.abs(d1) > SAUT_VITESSE && Math.abs(d2) > SAUT_VITESSE) r[i] = null;
  }
  return r;
}

// Profil d'une trace : { t, lat, lon, alt, gs, aAlt, aGs } (null si aucune courbe possible : pas d'heures, ou ni altitude
// ni vitesse). Les points sans heure sont ignorés ; les tableaux gardent les points rangés par heure.
export function profilDeTrace(points) {
  const pts = (points || []).filter(p => p && fini(p[0]) && fini(p[1]) && fini(p[2])).sort((a, b) => a[0] - b[0])
    .filter((p, i, l) => i === 0 || p[0] > l[i - 1][0]);
  if (pts.length < 2 || pts[pts.length - 1][0] <= pts[0][0]) return null;
  const alt = altitudesPropres(pts);
  const ok = positionsValides(pts);
  const fournie = pts.some(p => fini(p[4]));
  const gs = fournie ? vitessesFournies(pts) : vitessesCalculees(pts, ok);
  const aAlt = alt.filter(x => x !== null).length >= 2, aGs = gs.filter(x => x !== null).length >= 2;
  if (!aAlt && !aGs) return null;
  return { t: pts.map(p => p[0]), lat: pts.map(p => p[1]), lon: pts.map(p => p[2]), ok, alt: aAlt ? alt : null, gs: aGs ? gs.map(x => (x === null ? null : Math.round(x))) : null, aAlt, aGs };
}

// Valeur à l'instant t (interpolée entre les deux points voisins valides) ; null hors trace ou sans valeur voisine
function interpoler(tt, v, t) {
  if (!v || t < tt[0] || t > tt[tt.length - 1]) return null;
  let lo = 0, hi = tt.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tt[m] <= t) lo = m; else hi = m; }
  let i = lo; while (i >= 0 && v[i] === null) i--;
  let j = hi; while (j < tt.length && v[j] === null) j++;
  if (i < 0 && j >= tt.length) return null;
  if (i < 0) return v[j]; if (j >= tt.length) return v[i];
  if (tt[j] === tt[i]) return v[i];
  return v[i] + (v[j] - v[i]) * (t - tt[i]) / (tt[j] - tt[i]);
}
// Ce que montre le doigt à l'instant t : { t, alt (ft), gs (kt), lat, lon }
export function valeursA(pr, t) {
  const ok = pr.lat.map((x, i) => (pr.ok[i] ? x : null)), okl = pr.lon.map((x, i) => (pr.ok[i] ? x : null));
  const alt = interpoler(pr.t, pr.alt, t), gs = interpoler(pr.t, pr.gs, t);
  return { t, alt: alt === null ? null : Math.round(alt), gs: gs === null ? null : Math.round(gs), lat: interpoler(pr.t, ok, t), lon: interpoler(pr.t, okl, t) };
}

// Échelle « ronde » : 4 intervalles, pas choisi dans la liste (max >= la plus grande valeur)
export function echelle(max, pas = [100, 250, 500, 1000, 2000, 2500, 5000, 10000]) {
  const m = Math.max(1, max || 0);
  const p = pas.find(x => x * 4 >= m) || Math.ceil(m / 4 / pas[pas.length - 1]) * pas[pas.length - 1];
  return { pas: p, max: p * 4 };
}
export const PAS_ALTITUDE = [100, 250, 500, 1000, 2000, 2500, 5000, 10000];
export const PAS_VITESSE = [5, 10, 20, 25, 50, 75, 100, 150];
export const texteAltitude = v => (v >= 1000 ? `${String(v / 1000).replace('.', ',')}k` : String(v));
export const nombreFr = n => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');

// Heures de l'axe : pas « rond » (en minutes) pour ~4 graduations
export function graduationsTemps(t0, t1, n = 4) {
  const min = (t1 - t0) / 60000;
  const pas = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360].find(p => min / p <= n) || 720;
  const l = [], debut = Math.ceil(t0 / (pas * 60000)) * pas * 60000;
  for (let t = debut; t <= t1; t += pas * 60000) l.push(t);
  return l;
}
