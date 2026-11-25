// v0.59 (R151) : graphique « profil » sous la trace du vol (dessin maison en SVG, aucune bibliothèque) :
// altitude en bleu (aire, pieds à gauche), vitesse sol en vert (ligne, nœuds à droite), heures en bas dans le fuseau du vol
// (UTC, ou LOC = fuseau du terrain de départ). Doigt / souris posé ou glissé : trait vertical, « 10:34  16 000 ft  236 kt »
// au-dessus, point jaune au même instant sur la carte. AFFICHAGE SEULEMENT.
// v0.60 (R152) : deux graphiques possibles, chacun avec sa zone : sous la petite carte (#profil) et dans la carte en plein
// écran (#cp-profil). La hauteur du dessin suit celle de sa zone (170 px sous la petite carte).
import { $ } from './commun.js';
import { profilDeTrace, valeursA, echelle, PAS_ALTITUDE, PAS_VITESSE, texteAltitude, nombreFr, graduationsTemps } from '../profil.js';

const NS = 'http://www.w3.org/2000/svg';
const G = 40, D = 40, HAUT = 14, BAS = 28; // marges (px)

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

// Chemins : un point ignoré (aberrant, valeur absente) est sauté ; la courbe n'est coupée que s'il manque des valeurs
// pendant plus de 5 min (v0.60 : avant, chaque point ignoré laissait une petite coupure blanche)
const TROU_MS = 5 * 60000;
function chemins(pr, v, x, y, base) {
  let ligne = '', aire = '', seg = [];
  const fin = () => {
    if (seg.length >= 2) {
      ligne += 'M' + seg.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join('L');
      aire += `M${seg[0][0].toFixed(1)},${base}` + seg.map(([a, b]) => `L${a.toFixed(1)},${b.toFixed(1)}`).join('') + `L${seg[seg.length - 1][0].toFixed(1)},${base}Z`;
    }
    seg = [];
  };
  let tDernier = null;
  for (let i = 0; i < pr.t.length; i++) {
    if (v[i] === null) continue;
    if (tDernier !== null && pr.t[i] - tDernier > TROU_MS) fin();
    seg.push([x(pr.t[i]), y(v[i])]); tDernier = pr.t[i];
  }
  fin();
  return { ligne, aire };
}

// ---------- Un graphique (zone : .pf-val, svg.pf-svg, .pf-leg) ----------
function creer(sel, hauteurFixe) {
  const zone = $(sel);
  const Z = { zone, val: zone.querySelector('.pf-val'), svg: zone.querySelector('.pf-svg'), leg: zone.querySelector('.pf-leg'), hauteurFixe, P: null, attente: null, dernierX: 0 };
  const suivre = e => {
    const P = Z.P;
    if (!P || !P.x) return;
    const r = Z.svg.getBoundingClientRect();
    Z.dernierX = (e.clientX - r.left) * (P.W / r.width);
    if (Z.attente) return;
    Z.attente = requestAnimationFrame(() => {
      Z.attente = null;
      if (!Z.P) return;
      const f = Math.min(1, Math.max(0, (Z.dernierX - G) / (Z.P.W - G - D)));
      montrer(Z, Z.P.t0 + f * (Z.P.t1 - Z.P.t0));
    });
  };
  Z.svg.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') Z.svg.setPointerCapture?.(e.pointerId); suivre(e); });
  Z.svg.addEventListener('pointermove', suivre);
  return Z;
}

function dessiner(Z) {
  const P = Z.P, svg = Z.svg, pr = P.pr, r = svg.getBoundingClientRect();
  const W = Math.max(200, Math.round(r.width || svg.parentElement.clientWidth || 340));
  const H = Z.hauteurFixe || Math.max(90, Math.round(r.height || 170));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); if (Z.hauteurFixe) svg.setAttribute('height', H);
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
  for (const t of graduationsTemps(t0, t1, W < 300 ? 3 : W > 600 ? 6 : 4)) {
    el('text', { x: x(t), y: H - 9, class: 'pf-ax', 'text-anchor': 'middle' }, svg).textContent = heureAffichee(t, P.mode, P.tz);
  }
  const cur = el('g', { class: 'pf-cur', visibility: 'hidden' }, svg);
  P.el = { cur, trait: el('line', { y1: HAUT, y2: bas, class: 'pf-trait' }, cur),
    pa: pr.aAlt ? el('circle', { r: 4, class: 'pf-pa' }, cur) : null, pg: pr.aGs ? el('circle', { r: 4, class: 'pf-pg' }, cur) : null };
  Object.assign(P, { W, H, x, ya, yg, t0, t1 });
  if (P.tCur !== undefined) montrer(Z, P.tCur);
}

function montrer(Z, t) {
  const P = Z.P;
  P.tCur = t;
  const v = valeursA(P.pr, t), xx = P.x(t).toFixed(1);
  P.el.cur.setAttribute('visibility', 'visible');
  P.el.trait.setAttribute('x1', xx); P.el.trait.setAttribute('x2', xx);
  const point = (c, val, y) => { if (!c) return; c.setAttribute('visibility', val === null ? 'hidden' : 'visible'); if (val !== null) { c.setAttribute('cx', xx); c.setAttribute('cy', y(val).toFixed(1)); } };
  point(P.el.pa, v.alt, P.ya); point(P.el.pg, v.gs, P.yg);
  Z.val.classList.remove('vide');
  Z.val.innerHTML = `<span class="pf-h">${heureAffichee(t, P.mode, P.tz)}</span>`
    + (P.pr.aAlt ? `<span class="pf-a">${v.alt === null ? '–' : nombreFr(v.alt)} ft</span>` : '')
    + (P.pr.aGs ? `<span class="pf-g">${v.gs === null ? '–' : nombreFr(v.gs)} kt</span>` : '');
  if (P.placer) P.placer(v.lat, v.lon);
}

function afficher(Z, points, { mode = 'utc', tz = '', placer = null } = {}) {
  const pr = points && points.length >= 2 ? profilDeTrace(points) : null;
  if (!pr) { cacher(Z); return false; }
  Z.P = { pr, mode, tz, placer };
  Z.zone.hidden = false;
  Z.val.classList.add('vide'); Z.val.textContent = 'Pose le doigt sur le graphique';
  Z.leg.innerHTML = (pr.aAlt ? '<span><i class="pf-la"></i>Altitude</span>' : '') + (pr.aGs ? '<span><i class="pf-lg"></i>Vitesse sol</span>' : '');
  dessiner(Z);
  // zone pas encore à sa taille (fiche ou plein écran en train de s'ouvrir) : redessinée à l'image suivante
  requestAnimationFrame(() => {
    if (!Z.P || Z.P.pr !== pr) return;
    const r = Z.svg.getBoundingClientRect();
    if (Math.round(r.width) !== Z.P.W || (!Z.hauteurFixe && Math.round(r.height) !== Z.P.H)) dessiner(Z);
  });
  return true;
}
function cacher(Z) {
  Z.P = null;
  if (Z.zone) { Z.zone.hidden = true; Z.svg.textContent = ''; Z.leg.textContent = ''; Z.val.textContent = ''; }
}
const redessinerSiBesoin = Z => {
  if (!Z || !Z.P || Z.zone.hidden) return;
  const r = Z.svg.getBoundingClientRect();
  if ((r.width && Math.round(r.width) !== Z.P.W) || (!Z.hauteurFixe && r.height && Math.round(r.height) !== Z.P.H)) dessiner(Z);
};

let MINI = null, PLEIN = null;
export function initProfil() {
  MINI = creer('#profil', 170);
  PLEIN = creer('#cp-profil', 0);
  addEventListener('resize', () => { redessinerSiBesoin(MINI); redessinerSiBesoin(PLEIN); });
}
// Sous la petite carte. points : ceux de la trace affichée ; mode : 'utc' | 'loc' ; tz : fuseau du départ ;
// placer(lat, lon) : point jaune sur la carte. Renvoie true si un graphique est affiché.
export const afficherProfil = (points, opts) => afficher(MINI, points, opts);
export const cacherProfil = () => { if (MINI) cacher(MINI); };
// v0.60 (R152) : dans la carte en plein écran
export const afficherProfilPlein = (points, opts) => afficher(PLEIN, points, opts);
export const cacherProfilPlein = () => { if (PLEIN) cacher(PLEIN); };
export const redessinerProfilPlein = () => redessinerSiBesoin(PLEIN);
export const aUnProfil = points => !!(points && points.length >= 2 && profilDeTrace(points));
// LOC / UTC changé dans la saisie : heures de l'axe et du curseur dans le nouveau fuseau (les deux graphiques)
export function changerFuseauProfil(mode, tz) {
  for (const Z of [MINI, PLEIN]) if (Z && Z.P) { Z.P.mode = mode; if (tz) Z.P.tz = tz; dessiner(Z); }
}
export const _profilAffiche = () => MINI && MINI.P;
export const _profilPlein = () => PLEIN && PLEIN.P;
