// v0.59 (R151) : graphique « profil » sous la trace du vol (dessin maison en SVG, aucune bibliothèque) :
// altitude en bleu (aire, pieds à gauche), vitesse sol en vert (ligne, nœuds à droite), heures en bas dans le fuseau du vol
// (UTC, ou LOC = fuseau du terrain de départ). Doigt / souris posé ou glissé : trait vertical, « 10:34  16 000 ft  236 kt »
// au-dessus, point jaune au même instant sur la carte. AFFICHAGE SEULEMENT.
import { $ } from './commun.js';
import { profilDeTrace, valeursA, echelle, PAS_ALTITUDE, PAS_VITESSE, texteAltitude, nombreFr, graduationsTemps } from '../profil.js';

const NS = 'http://www.w3.org/2000/svg';
const H = 170, G = 40, D = 40, HAUT = 14, BAS = 28; // hauteur et marges (px)
let P = null; // profil affiché : { pr, mode, tz, placer, t0, t1, el: {…} }

const fmt = new Map();
export function heureAffichee(ms, mode, tz) {
  if (mode !== 'loc' || !tz) return new Date(ms).toISOString().slice(11, 16);
  if (!fmt.has(tz)) fmt.set(tz, new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  return fmt.get(tz).format(new Date(ms));
}

const el = (nom, attrs = {}, parent = null) => {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

// Chemins (une courbe coupée là où il manque des valeurs)
function chemins(pr, v, x, y, base) {
  let ligne = '', aire = '', seg = [];
  const fin = () => {
    if (seg.length >= 2) {
      ligne += 'M' + seg.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join('L');
      aire += `M${seg[0][0].toFixed(1)},${base}` + seg.map(([a, b]) => `L${a.toFixed(1)},${b.toFixed(1)}`).join('') + `L${seg[seg.length - 1][0].toFixed(1)},${base}Z`;
    }
    seg = [];
  };
  for (let i = 0; i < pr.t.length; i++) { if (v[i] === null) fin(); else seg.push([x(pr.t[i]), y(v[i])]); }
  fin();
  return { ligne, aire };
}

function dessiner() {
  const svg = $('#pf-svg'), pr = P.pr;
  const W = Math.max(200, Math.round(svg.getBoundingClientRect().width || svg.parentElement.clientWidth || 340));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H);
  svg.textContent = '';
  const t0 = pr.t[0], t1 = pr.t[pr.t.length - 1], bas = H - BAS;
  const x = t => G + (t - t0) / (t1 - t0) * (W - G - D);
  const ea = echelle(pr.aAlt ? Math.max(...pr.alt.filter(v => v !== null)) : 0, PAS_ALTITUDE);
  const eg = echelle(pr.aGs ? Math.max(...pr.gs.filter(v => v !== null)) : 0, PAS_VITESSE);
  const ya = v => bas - v / ea.max * (bas - HAUT), yg = v => bas - v / eg.max * (bas - HAUT);
  for (let k = 0; k <= 4; k++) {
    const yy = bas - k * (bas - HAUT) / 4;
    el('line', { x1: G, x2: W - D, y1: yy, y2: yy, class: 'pf-gr' }, svg);
    if (pr.aAlt) el('text', { x: G - 4, y: yy + 4, class: 'pf-ax pf-axa', 'text-anchor': 'end' }, svg).textContent = texteAltitude(ea.pas * k);
    if (pr.aGs) el('text', { x: W - D + 4, y: yy + 4, class: 'pf-ax pf-axg' }, svg).textContent = String(eg.pas * k);
  }
  if (pr.aAlt) el('text', { x: G - 4, y: HAUT - 5, class: 'pf-ax pf-axa', 'text-anchor': 'end' }, svg).textContent = 'ft';
  if (pr.aGs) el('text', { x: W - D + 4, y: HAUT - 5, class: 'pf-ax pf-axg' }, svg).textContent = 'kt';
  if (pr.aAlt) { const c = chemins(pr, pr.alt, x, ya, bas); el('path', { d: c.aire, class: 'pf-aa' }, svg); el('path', { d: c.ligne, class: 'pf-al' }, svg); }
  if (pr.aGs) el('path', { d: chemins(pr, pr.gs, x, yg, bas).ligne, class: 'pf-gl' }, svg);
  for (const t of graduationsTemps(t0, t1, W < 300 ? 3 : 4)) {
    el('text', { x: x(t), y: H - 9, class: 'pf-ax', 'text-anchor': 'middle' }, svg).textContent = heureAffichee(t, P.mode, P.tz);
  }
  const cur = el('g', { class: 'pf-cur', visibility: 'hidden' }, svg);
  P.el = { cur, trait: el('line', { y1: HAUT, y2: bas, class: 'pf-trait' }, cur),
    pa: pr.aAlt ? el('circle', { r: 4, class: 'pf-pa' }, cur) : null, pg: pr.aGs ? el('circle', { r: 4, class: 'pf-pg' }, cur) : null };
  Object.assign(P, { W, x, ya, yg, t0, t1 });
  if (P.tCur !== undefined) montrer(P.tCur);
}

function montrer(t) {
  P.tCur = t;
  const v = valeursA(P.pr, t), xx = P.x(t).toFixed(1);
  P.el.cur.setAttribute('visibility', 'visible');
  P.el.trait.setAttribute('x1', xx); P.el.trait.setAttribute('x2', xx);
  const point = (c, val, y) => { if (!c) return; c.setAttribute('visibility', val === null ? 'hidden' : 'visible'); if (val !== null) { c.setAttribute('cx', xx); c.setAttribute('cy', y(val).toFixed(1)); } };
  point(P.el.pa, v.alt, P.ya); point(P.el.pg, v.gs, P.yg);
  const val = $('#pf-val');
  val.classList.remove('vide');
  val.innerHTML = `<span class="pf-h">${heureAffichee(t, P.mode, P.tz)}</span>`
    + (P.pr.aAlt ? `<span class="pf-a">${v.alt === null ? '–' : nombreFr(v.alt)} ft</span>` : '')
    + (P.pr.aGs ? `<span class="pf-g">${v.gs === null ? '–' : nombreFr(v.gs)} kt</span>` : '');
  if (P.placer) P.placer(v.lat, v.lon);
}

let attente = null, dernierX = 0;
function suivre(e) {
  if (!P || !P.x) return;
  const r = $('#pf-svg').getBoundingClientRect();
  dernierX = (e.clientX - r.left) * (P.W / r.width);
  if (attente) return;
  attente = requestAnimationFrame(() => {
    attente = null;
    const f = Math.min(1, Math.max(0, (dernierX - G) / (P.W - G - D)));
    montrer(P.t0 + f * (P.t1 - P.t0));
  });
}

// points : ceux de la trace affichée ; mode : 'utc' | 'loc' ; tz : fuseau du départ ; placer(lat, lon) : point jaune sur la carte
// Renvoie true si un graphique est affiché.
export function afficherProfil(points, { mode = 'utc', tz = '', placer = null } = {}) {
  const pr = points && points.length >= 2 ? profilDeTrace(points) : null;
  const zone = $('#profil');
  if (!pr) { cacherProfil(); return false; }
  P = { pr, mode, tz, placer };
  zone.hidden = false;
  $('#pf-val').classList.add('vide'); $('#pf-val').textContent = 'Pose le doigt sur le graphique';
  $('#pf-leg').innerHTML = (pr.aAlt ? '<span><i class="pf-la"></i>Altitude</span>' : '') + (pr.aGs ? '<span><i class="pf-lg"></i>Vitesse sol</span>' : '');
  dessiner();
  // zone pas encore à sa largeur (fiche en train de s'ouvrir) : redessinée à l'image suivante
  requestAnimationFrame(() => { if (P && P.pr === pr && Math.round($('#pf-svg').getBoundingClientRect().width) !== P.W) dessiner(); });
  return true;
}
export function cacherProfil() { P = null; const z = $('#profil'); if (z) { z.hidden = true; $('#pf-svg').textContent = ''; $('#pf-leg').textContent = ''; $('#pf-val').textContent = ''; } }
// LOC / UTC changé dans la saisie : heures de l'axe et du curseur dans le nouveau fuseau
export function changerFuseauProfil(mode, tz) { if (!P) return; P.mode = mode; if (tz) P.tz = tz; dessiner(); }

export function initProfil() {
  const svg = $('#pf-svg');
  svg.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') svg.setPointerCapture?.(e.pointerId); suivre(e); });
  svg.addEventListener('pointermove', suivre);
  let large = 0;
  addEventListener('resize', () => { if (!P || $('#profil').hidden) return; const w = Math.round(svg.getBoundingClientRect().width); if (w && w !== large) { large = w; dessiner(); } });
}
export const _profilAffiche = () => P;
