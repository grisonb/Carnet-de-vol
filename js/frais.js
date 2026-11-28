// v0.68 (R166) : frais d'escale (indemnités journalières, pour les frais réels d'impôts). Logique pure, testée sous Node.
// Ce n'est PAS une donnée du carnet EASA : ni PDF EASA, ni CSV, ni totaux d'heures, ni anomalies.
//
// Données (voyagent avec la synchro NAS et la sauvegarde) :
//   vol.frais = { type: 'journee' | 'j1' | 'j2' | null, pays + paysManuel (J.1 : pays de la nuit choisi à la main), le } ; v0.70 :
//               la case vaut pour toute la journée (cochée sur tous ses vols) ; (case « Détachement » : jamais gardée sur le vol,
//               elle découle des dates d'un détachement)
//   réglage PARTAGÉ « detachement-<id> » = { id, du, au, pays (principal), nuits: { 'AAAA-MM-JJ': pays }, le } ; supprimé : { supprime: true, le }
//   réglage PARTAGÉ « bareme-<année> » = { annee, journee (centimes | null), pays: [{ nom, montant (centimes | null), zone: 'euro' | 'monde' }], le }
// Montants en CENTIMES (jamais de virgule flottante dans les sommes).
import { ajouterJours, dateFr } from './temps.js';
import { estSimulation } from './modele.js';
import { baremeOfficiel } from './baremes-officiels.js';

export const PREFIXE_DETACHEMENT = 'detachement-', PREFIXE_BAREME = 'bareme-';
export const cleDetachement = id => PREFIXE_DETACHEMENT + id;
export const cleBareme = annee => PREFIXE_BAREME + annee;
export const estCleFrais = c => typeof c === 'string' && (c.startsWith(PREFIXE_DETACHEMENT) || c.startsWith(PREFIXE_BAREME));
export const LIBELLES = { journee: 'Vol journée', j1: 'J.1', j2: 'J.2', detachement: 'Détachement' };

// ---------- Montants ----------
// 17400 -> « 174,00 € » ; 234900 -> « 2 349,00 € »
export function euros(c) {
  const n = Math.round(Number(c) || 0), e = Math.floor(Math.abs(n) / 100), ct = String(Math.abs(n) % 100).padStart(2, '0');
  return `${n < 0 ? '−' : ''}${e.toLocaleString('fr-FR')},${ct} €`;
}
// « 174 », « 174,00 », « 174.5 », « 1 234,56 € » -> centimes ; vide -> null ; invalide -> NaN
export function lireMontant(t) {
  const s = String(t ?? '').replace(/[\s  €]/g, '').replace(',', '.');
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}
const coef = x => String(x).replace('.', ','); // 1.5 -> « 1,5 »

// ---------- Barèmes ----------
// v0.69 (R169) : années 2022 à 2025 : barème officiel intégré (js/baremes-officiels.js) ; ce que le pilote a saisi passe avant
// (montant ou zone différents du bulletin : « modifié » ; pays absent du bulletin : « ajouté »). Autres années : saisie à la main.
export function baremeVide(annee) { return { annee: String(annee), journee: null, pays: [{ nom: 'France', montant: null, zone: 'euro' }] }; }
const norm = s => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[–—-]/g, '-').replace(/\s+/g, ' ');
// Barème complet d'une année : { annee, journee, journeeOfficielle, officiel, source, pays: [{ nom, montant, zone, periodes, source:
// 'bulletin' | 'modifie' | 'ajoute', officiel?: { montant, zone, periodes }, note? }] } (France toujours présente, en Euro-Europe)
export function baremeDe(baremes, annee) {
  const a = String(annee), off = baremeOfficiel(a), u = baremes && baremes.get(a);
  const pays = [], idx = new Map();
  if (off) for (const p of off.pays) {
    const e = { nom: p.nom, montant: p.montant, zone: p.zone, periodes: p.periodes, source: 'bulletin', officiel: { montant: p.montant, zone: p.zone, periodes: p.periodes }, ...(p.note ? { note: p.note } : {}) };
    pays.push(e); idx.set(norm(p.nom), e);
  }
  for (const p of (u && Array.isArray(u.pays) ? u.pays : [])) {
    if (!p || !p.nom) continue;
    const m = p.montant ?? null, e = idx.get(norm(p.nom));
    if (e) {
      const autreMontant = m !== null && m !== e.officiel.montant, autreZone = !!p.zone && p.zone !== e.officiel.zone;
      if (autreMontant || autreZone) {
        e.source = 'modifie'; e.zone = p.zone || e.zone;
        if (autreMontant) { e.montant = m; e.periodes = []; } // montant saisi : le même toute l'année
      }
    } else { const n = { nom: p.nom, montant: m, zone: p.zone === 'monde' ? 'monde' : 'euro', periodes: [], source: 'ajoute' }; pays.push(n); idx.set(norm(p.nom), n); }
  }
  if (!idx.has('FRANCE')) pays.unshift({ nom: 'France', montant: null, zone: 'euro', periodes: [], source: 'ajoute' });
  const ju = u && u.journee !== null && u.journee !== undefined ? u.journee : null;
  return { annee: a, journee: ju ?? (off ? off.journee : null), journeeOfficielle: off ? off.journee : null, journeeModifiee: ju !== null && off ? ju !== off.journee : false,
    officiel: !!off, source: off ? off.source : '', pays };
}
export const paysDuBareme = (b, nom) => (b.pays || []).find(p => norm(p.nom) === norm(nom)) || null;
// Montant d'un pays à une date (montants datés : la période qui contient la date, sinon le montant de base)
export function montantA(p, date) {
  if (!p) return null;
  const md = String(date || '').slice(5);
  const per = (p.periodes || []).filter(x => md >= x.du && md <= x.au).pop();
  return per ? per.montant : (p.montant ?? null);
}

// ---------- Calcul ----------
// termes : [{ c (coefficient), pays, date }] ; chaque terme prend le barème de l'année de SA date (nuit, ou jour en zone Monde).
// Renvoie { montant (centimes), manquant, detail, termes }
export function calculerTermes(termes, baremes, zone) {
  const avec = termes.map(t => ({ ...t, m: montantA(paysDuBareme(baremeDe(baremes, t.date.slice(0, 4)), t.pays), t.date) }));
  const manquant = !avec.length || avec.some(t => t.m === null || t.m === undefined);
  const montant = manquant ? 0 : Math.round(avec.reduce((s, t) => s + t.c * t.m, 0));
  const memes = avec.length && avec.every(t => t.m === avec[0].m);
  const detail = !avec.length ? '' : memes
    ? (zone === 'monde' ? `${avec.length} indemnité${avec.length > 1 ? 's' : ''} × ${avec[0].m === null ? '?' : euros(avec[0].m)}`
      : `${avec.map(t => coef(t.c)).join(' + ')} indemnité × ${avec[0].m === null ? '?' : euros(avec[0].m)}`)
    : avec.map(t => `${coef(t.c)} × ${t.m === null ? `? (${t.pays})` : euros(t.m)}`).join(' + ');
  return { montant, manquant, detail, termes: avec };
}
// Termes d'un séjour : nuits [{ date, pays }], jours [dates]. Zone Euro-Europe : 1 indemnité du pays de chaque nuit, la dernière 1,5.
// Zone Monde : 1 indemnité par jour, chaque jour au pays de sa nuit (le dernier jour : celui de la dernière nuit).
export function termesSejour(zone, nuits, jrs) {
  if (zone === 'monde') return jrs.map((date, i) => ({ c: 1, date, pays: (nuits[Math.min(i, nuits.length - 1)] || {}).pays }));
  return nuits.map((n, i) => ({ c: i === nuits.length - 1 ? 1.5 : 1, date: n.date, pays: n.pays }));
}
// (compatibilité v0.68 : nuits = pays, un seul barème) ; date fictive dans l'année du barème
export function calculer(zone, nuits, nbJours, bareme) {
  const a = bareme.annee || '2000', d = i => `${a}-01-${String(1 + i).padStart(2, '0')}`;
  const n = nuits.map((pays, i) => ({ date: d(i), pays }));
  const jrs = Array.from({ length: Math.max(1, nbJours) }, (_, i) => d(i));
  return calculerTermes(termesSejour(zone, n.length ? n : [{ date: d(0), pays: nuits[0] }], jrs), new Map([[String(a), bareme]]), zone);
}

// ---------- Lignes ----------
const jours = (du, au) => { const l = []; for (let d = du; d <= au; d = ajouterJours(d, 1)) l.push(d); return l; };
export const detachementsActifs = dets => (dets || []).filter(d => d && !d.supprime && d.du && d.au && d.du <= d.au);
// Détachement qui contient cette date (le plus récent s'il y en a deux)
export const detachementDe = (dets, date) => detachementsActifs(dets).filter(d => date >= d.du && date <= d.au).sort((a, b) => (b.le || '').localeCompare(a.le || ''))[0] || null;
// v0.70 (R178) : pays de la nuit d'un jour = pays du terrain d'arrivée du DERNIER vol de la journée (paysDe(code) -> nom | null)
const derniere = (vols, date) => vols.filter(v => v.date === date).sort((a, b) => ((a.hDep || '') + (a.hArr || '')).localeCompare((b.hDep || '') + (b.hArr || ''))).pop() || null;
export function paysAuto(vols, date, paysDe = () => null) { const v = derniere(vols, date); return v ? { pays: paysDe(v.arr), code: v.arr || '' } : null; }
// Nuits d'un détachement : [{ date, pays, code, manuel }] (une par jour sauf le dernier). Choix à la main (d.nuits) d'abord ; sinon pays du
// dernier atterrissage du jour ; jour sans vol (ou code inconnu) : pays de la nuit précédente ; la première : pays du détachement.
export function nuitsDe(d, { vols = [], paysDe = () => null } = {}) {
  let prec = d.pays || 'France';
  return jours(d.du, d.au).slice(0, -1).map(date => {
    const m = d.nuits && d.nuits[date];
    if (m) { prec = m; const a = paysAuto(vols, date, paysDe); return { date, pays: m, code: a ? a.code : '', manuel: true }; }
    const a = paysAuto(vols, date, paysDe);
    if (a && a.pays) prec = a.pays;
    return { date, pays: prec, code: a ? a.code : '', manuel: false };
  });
}
// v0.70 (R173) : la case valait pour toute la journée : celle cochée le plus récemment parmi les vols du jour (frais.le).
// v0.71 : sert seulement à la reprise des données de la v0.70 (`fixerFraisParVol`) : chaque vol a maintenant SA case.
export function fraisDuJour(vols, date) {
  let f = null;
  for (const v of vols) if (v.date === date && v.frais && (!f || (v.frais.le || '') > (f.le || ''))) f = v.frais;
  return f;
}
// Type affiché sur la fiche d'un vol : 'detachement' si sa date tombe dans un détachement, sinon SA case (v0.71, R180)
export const typeDuVol = (v, dets) => (detachementDe(dets, v.date) ? 'detachement' : (v.frais && v.frais.type) || null);

// v0.71 : reprise de la v0.70 (case de la journée) : chaque vol reçoit la case de sa journée (même résultat, mêmes montants).
// Renvoie les vols changés (copies ; « le » de la case gardé : même résultat sur tous les appareils).
export function fixerFraisParVol(vols) {
  const parJour = new Map(), changes = [];
  for (const v of vols) if (v && v.date && !estSimulation(v)) { if (!parJour.has(v.date)) parJour.set(v.date, []); parJour.get(v.date).push(v); }
  const cle = f => JSON.stringify([f ? f.type || null : null, f && f.pays || null, !!(f && f.paysManuel)]);
  for (const [date, l] of parJour) {
    const f = fraisDuJour(l, date);
    if (!f) continue;
    for (const v of l) if (cle(v.frais) !== cle(f)) changes.push({ ...v, frais: { ...f } });
  }
  return changes;
}

// v0.71 (R180 / R181) : appui sur la case t de la fiche du vol id. Renvoie les vols changés (copies).
// - cocher : ce vol, et les vols du même jour sans case (ou avec la case qu'avait ce vol), sauf ceux décochés à la main ;
//   J.1 : J.2 mis tout seul (auto) sur les vols du lendemain sans case (sauf ceux décochés à la main) ;
// - décocher : CE vol seulement (marqué « décoché à la main » : plus recoché tout seul) ; plus aucun J.1 ce jour-là :
//   les J.2 mis tout seuls le lendemain sont retirés (pas ceux cochés à la main).
export function changerCase(vols, id, t, le = new Date().toISOString()) {
  const v = vols.find(x => x.id === id);
  if (!v) return [];
  const reels = vols.filter(x => x && x.date && !estSimulation(x));
  const garde = f => (f && f.paysManuel && f.pays ? { pays: f.pays, paysManuel: true } : {});
  const typeDe = x => (x.frais && x.frais.type) || null, nouveau = new Map();
  const mettre = (x, f) => nouveau.set(x.id, { ...x, frais: f });
  const actuel = x => (nouveau.get(x.id) || x);
  const avant = typeDe(v), d = v.date, lendemain = ajouterJours(d, 1);
  if (t === avant || t === null) mettre(v, { type: null, ...garde(v.frais), decoche: true, le });
  else {
    mettre(v, { type: t, ...garde(v.frais), le });
    for (const x of reels) if (x.id !== v.id && x.date === d && !(x.frais && x.frais.decoche) && (typeDe(x) === null || typeDe(x) === avant)) mettre(x, { type: t, ...garde(x.frais), le });
    if (t === 'j1') for (const x of reels) if (x.date === lendemain && typeDe(x) === null && !(x.frais && x.frais.decoche)) mettre(x, { type: 'j2', auto: true, le });
  }
  if (avant === 'j1' && !reels.some(x => x.date === d && typeDe(actuel(x)) === 'j1')) {
    for (const x of reels) if (x.date === lendemain && typeDe(actuel(x)) === 'j2' && actuel(x).frais.auto) mettre(actuel(x), { type: null, le });
  }
  return [...nouveau.values()];
}
// v0.69 (R168) : toutes les étapes des vols, enchaînées dans l'ordre (un terrain répété à la suite n'apparaît qu'une fois)
export function etapesDe(vols) {
  const l = [];
  for (const v of vols) {
    const pts = [v.dep, ...(v.escales || []).map(e => e.code || e.nom), v.arr].map(t => String(t || '').trim()).filter(Boolean);
    pts.forEach((c, i) => { if (!(i === 0 && l[l.length - 1] === c)) l.push(c); }); // seul le terrain de jonction entre deux vols n'est pas répété
  }
  return l.join(' → ');
}
const zoneDe = (baremes, annees, pays) => { for (const a of annees) { const p = paysDuBareme(baremeDe(baremes, a), pays); if (p) return p.zone; } return 'euro'; };
// nom du pays tel qu'il est écrit dans le barème de l'année (sinon tel quel)
export const nomBareme = (baremes, annee, nom) => (nom ? (paysDuBareme(baremeDe(baremes, annee), nom) || { nom }).nom : null);
// v0.70 (R178) : pays trouvé tout seul : seulement s'il est dans le barème de l'année (sinon : à choisir à la main)
export const nomAuto = (baremes, annee, nom) => (nom ? (paysDuBareme(baremeDe(baremes, annee), nom) || {}).nom || null : null);

// v0.70 (R172 / R177) : reprise des cases J+2 (v0.68 / v0.69) : deux jours qui se suivent -> J.1 (premier jour, avec le pays de la
// nuit, gardé comme choisi) puis J.2 ; un J+2 seul -> J.2. Renvoie les vols changés (copies ; « le » gardé : même résultat partout).
export function reprendreJ2(vols) {
  const parJour = new Map();
  for (const v of vols) if (v && v.date && v.frais && v.frais.type === 'j2' && !estSimulation(v)) { if (!parJour.has(v.date)) parJour.set(v.date, []); parJour.get(v.date).push(v); }
  const dates = [...parJour.keys()].sort(), pris = new Set(), changes = [];
  for (const d of dates) {
    if (pris.has(d)) continue;
    const s = ajouterJours(d, 1);
    if (!parJour.has(s) || pris.has(s)) continue;
    pris.add(d); pris.add(s);
    const pays = (parJour.get(d).find(v => v.frais.pays) || {}).frais?.pays || 'France';
    for (const v of parJour.get(d)) changes.push({ ...v, frais: { ...v.frais, type: 'j1', pays, paysManuel: true } });
    for (const v of parJour.get(s)) { const { pays: _p, paysManuel: _m, ...f } = v.frais; changes.push({ ...v, frais: f }); }
  }
  return changes;
}

// Toutes les lignes : [{ id, type ('journee' | 'j2' | 'detachement'), sorte ('j1' | 'j2' | 'paire'), annee, du, au, jours, nuits, vols,
// jourVols: [{ date, vols, etapes }], etapes, montant, manquant, incomplet, detail, detachementId, partie }]
// paysDe(code OACI) -> nom du pays (R178)
export function lignesFrais({ vols, detachements = [], baremes = new Map(), paysDe = () => null }) {
  const dets = detachementsActifs(detachements), lignes = [];
  const reels = (vols || []).filter(v => v && v.date && !estSimulation(v));
  const tri = l => [...l].sort((a, b) => (a.date + (a.hDep || '')).localeCompare(b.date + (b.hDep || '')));
  const jour = (date, t) => { const vl = tri((parDate.get(date) || []).filter(v => v.frais && v.frais.type === t)); return { date, vols: vl, etapes: etapesDe(vl) }; };
  // Détachements (les vols de leurs dates n'y comptent qu'une fois, jamais ailleurs). v0.69 (R167) : à cheval sur deux années :
  // une ligne par année ; chaque nuit (jour en Monde) au barème de son année ; le 1,5 seulement sur la dernière nuit du détachement.
  for (const d of dets) {
    const vd = tri(reels.filter(v => v.date >= d.du && v.date <= d.au));
    const n = nuitsDe(d, { vols: vd, paysDe: code => nomAuto(baremes, d.du.slice(0, 4), paysDe(code)) });
    const jrs = jours(d.du, d.au), zone = zoneDe(baremes, [d.du.slice(0, 4), d.au.slice(0, 4)], d.pays);
    const commun = { type: 'detachement', zone, pays: d.pays, detachementId: d.id, detachementDu: d.du, detachementAu: d.au, etapes: d.pays, incomplet: false };
    if (!n.length) { // un seul jour : comme un vol journée (zone euro), 1 indemnité (Monde)
      const b = baremeDe(baremes, d.du.slice(0, 4));
      const calc = zone === 'monde' ? calculerTermes([{ c: 1, date: d.du, pays: d.pays }], baremes, 'monde')
        : { montant: b.journee ?? 0, manquant: b.journee === null || b.journee === undefined, detail: '½ indemnité zone euro', termes: [] };
      lignes.push({ id: `det|${d.id}`, ...commun, annee: d.du.slice(0, 4), du: d.du, au: d.au, jours: 1, joursTotal: 1, nuits: [], vols: vd, partie: null, ...calc });
      continue;
    }
    const termes = termesSejour(zone, n, jrs), annees = [...new Set(termes.map(t => t.date.slice(0, 4)))];
    for (const a of annees) {
      const deux = annees.length > 1, du = deux && a > d.du.slice(0, 4) ? `${a}-01-01` : d.du, au = deux && a < d.au.slice(0, 4) ? `${a}-12-31` : d.au;
      const tp = termes.filter(t => t.date.slice(0, 4) === a), vp = deux ? vd.filter(v => v.date >= du && v.date <= au) : vd;
      lignes.push({ id: deux ? `det|${d.id}|${a}` : `det|${d.id}`, ...commun, annee: a, du, au, jours: jours(du, au).length, joursTotal: jrs.length,
        nuits: n.filter(x => x.date >= du && x.date <= au), vols: vp, partie: deux ? (a === annees[0] ? 'debut' : 'suite') : null, ...calculerTermes(tp, baremes, zone) });
    }
  }
  // v0.70 (R173) : une journée = TOUS ses vols ; sa case = celle cochée le plus récemment
  const hors = reels.filter(v => !detachementDe(dets, v.date)), parType = { journee: [], j1: [], j2: [] }, fraisJ = new Map(), parDate = new Map();
  for (const v of hors) { if (!parDate.has(v.date)) parDate.set(v.date, []); parDate.get(v.date).push(v); }
  for (const date of [...parDate.keys()].sort()) {
    // v0.71 (R180) : une ligne ne prend que les vols cochés (chaque vol a sa case)
    for (const t of Object.keys(parType)) {
      const l = parDate.get(date).filter(v => v.frais && v.frais.type === t);
      if (!l.length) continue;
      parType[t].push(date);
      if (t === 'j1') fraisJ.set(date, l.filter(v => v.frais.paysManuel && v.frais.pays).sort((a, b) => (b.frais.le || '').localeCompare(a.frais.le || ''))[0]?.frais || l[0].frais);
    }
  }
  for (const date of parType.journee) {
    const b = baremeDe(baremes, date.slice(0, 4)), manquant = b.journee === null || b.journee === undefined, j = jour(date, 'journee');
    lignes.push({ id: `journee|${date}`, type: 'journee', sorte: 'journee', annee: date.slice(0, 4), du: date, au: date, jours: 1, nuits: [], vols: j.vols, jourVols: [j], etapes: j.etapes,
      montant: manquant ? 0 : b.journee, manquant, detail: '½ indemnité zone euro', incomplet: false });
  }
  // v0.70 (R172 / R177) : J.1 suivi le lendemain d'un J.2 = une ligne (2 jours, 1 nuit, pays de la nuit sur le J.1) ; sinon incomplet
  const j2 = new Set(parType.j2), pris = new Set();
  for (const d of parType.j1) {
    const s = ajouterJours(d, 1), a = d.slice(0, 4);
    if (j2.has(s)) {
      pris.add(s);
      const f = fraisJ.get(d), auto = paysAuto(parDate.get(d) || [], d, paysDe);
      const pays = f.paysManuel && f.pays ? nomBareme(baremes, a, f.pays) : nomAuto(baremes, a, auto && auto.pays);
      const j1 = jour(d, 'j1'), jj2 = jour(s, 'j2'), vl = [...j1.vols, ...jj2.vols];
      const base = { id: `j2|${d}`, type: 'j2', sorte: 'paire', annee: a, du: d, au: s, jours: 2, vols: vl, jourVols: [j1, jj2], etapes: etapesDe(vl), pays, incomplet: false };
      if (!pays) { lignes.push({ ...base, nuits: [{ date: d, pays: null, code: auto ? auto.code : '' }], montant: 0, manquant: true, detail: 'Pays à choisir sur le J.1' }); continue; }
      const zone = zoneDe(baremes, [a], pays), nuits = [{ date: d, pays, code: auto ? auto.code : '' }];
      lignes.push({ ...base, zone, nuits, ...calculerTermes(termesSejour(zone, nuits, [d, s]), baremes, zone) });
    } else {
      const j = jour(d, 'j1');
      lignes.push({ id: `j1i|${d}`, type: 'j2', sorte: 'j1', annee: d.slice(0, 4), du: d, au: d, jours: 1, nuits: [], vols: j.vols, jourVols: [j], etapes: j.etapes, montant: 0, manquant: false,
        detail: 'Coche aussi le J.2 du lendemain', incomplet: true });
    }
  }
  for (const s of parType.j2) {
    if (pris.has(s)) continue;
    const j = jour(s, 'j2');
    lignes.push({ id: `j2i|${s}`, type: 'j2', sorte: 'j2', annee: s.slice(0, 4), du: s, au: s, jours: 1, nuits: [], vols: j.vols, jourVols: [j], etapes: j.etapes, montant: 0, manquant: false,
      detail: 'Coche aussi le J.1 de la veille', incomplet: true });
  }
  return lignes.sort((a, b) => b.du.localeCompare(a.du) || b.id.localeCompare(a.id));
}

// Lignes d'une année (plus récentes en haut), total et résumé par type
export function anneeFrais(lignes, annee) {
  const l = lignes.filter(x => x.annee === String(annee));
  const compte = x => !x.incomplet && !x.manquant;
  const resume = {};
  // résumé : les lignes « Montant manquant » comptent dans le nombre (0 €) ; un J+2 incomplet ne compte pas
  for (const t of ['journee', 'j2', 'detachement']) {
    const lt = l.filter(x => x.type === t && !x.incomplet);
    resume[t] = { n: lt.length, montant: lt.filter(compte).reduce((s, x) => s + x.montant, 0), jours: lt.reduce((s, x) => s + x.jours, 0), nuits: lt.reduce((s, x) => s + x.nuits.length, 0) };
  }
  return { annee: String(annee), lignes: l, total: l.filter(compte).reduce((s, x) => s + x.montant, 0), resume };
}
export const anneesFrais = lignes => [...new Set(lignes.map(x => x.annee))].sort().reverse();

// Textes d'une ligne (liste, PDF). v0.70 (R175) : en tête, la date puis le type (« 03/12/2025 · Vol journée »)
export function typeLigne(x) {
  if (x.type === 'detachement') { const n = x.joursTotal || x.jours; return `Détachement ${n} jour${n > 1 ? 's' : ''}${x.partie ? ` (partie ${x.annee})` : ''}`; }
  if (x.type === 'j2') return x.sorte === 'j1' ? 'J.1 incomplet' : x.sorte === 'j2' ? 'J.2 incomplet' : 'J.1';
  return 'Vol journée';
}
export const titreLigne = x => `${dateFr(x.du)} · ${typeLigne(x)}`;
export const datesLigne = x => (x.du === x.au ? dateFr(x.du) : `${dateFr(x.du).slice(0, 5)} → ${dateFr(x.au)}`);
// Ligne grise du bas
export function lieuLigne(x) {
  const nv = `${x.vols.length} vol${x.vols.length > 1 ? 's' : ''}`;
  if (x.type === 'detachement') return `${datesLigne(x)} · ${x.nuits.length} nuit${x.nuits.length > 1 ? 's' : ''} · ${nv}`;
  if (x.type === 'j2' && x.sorte === 'paire') return `Nuit ${x.pays || 'à choisir'} · ${nv}`;
  return nv;
}
// v0.70 (R174) : nuits d'un détachement passées dans un autre pays que le sien : « Nuit 06/01 : FIMP »
export const nuitsAilleurs = x => (x.type === 'detachement' ? x.nuits.filter(n => n.pays && x.pays && n.pays.toUpperCase() !== x.pays.toUpperCase())
  .map(n => `Nuit ${dateFr(n.date).slice(0, 5)} : ${n.code || n.pays}`) : []);
export const montantLigne = x => (x.incomplet ? '0,00 €' : x.manquant ? 'Montant manquant' : euros(x.montant));
