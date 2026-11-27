// v0.68 (R166) : frais d'escale (indemnités journalières, pour les frais réels d'impôts). Logique pure, testée sous Node.
// Ce n'est PAS une donnée du carnet EASA : ni PDF EASA, ni CSV, ni totaux d'heures, ni anomalies.
//
// Données (voyagent avec la synchro NAS et la sauvegarde) :
//   vol.frais = { type: 'journee' | 'j2' | null, pays (J+2 : pays de la nuit), le }  (case « Détachement » : jamais gardée sur le vol,
//               elle découle des dates d'un détachement)
//   réglage PARTAGÉ « detachement-<id> » = { id, du, au, pays (principal), nuits: { 'AAAA-MM-JJ': pays }, le } ; supprimé : { supprime: true, le }
//   réglage PARTAGÉ « bareme-<année> » = { annee, journee (centimes | null), pays: [{ nom, montant (centimes | null), zone: 'euro' | 'monde' }], le }
// Montants en CENTIMES (jamais de virgule flottante dans les sommes).
import { ajouterJours, dateFr } from './temps.js';
import { estSimulation } from './modele.js';

export const PREFIXE_DETACHEMENT = 'detachement-', PREFIXE_BAREME = 'bareme-';
export const cleDetachement = id => PREFIXE_DETACHEMENT + id;
export const cleBareme = annee => PREFIXE_BAREME + annee;
export const estCleFrais = c => typeof c === 'string' && (c.startsWith(PREFIXE_DETACHEMENT) || c.startsWith(PREFIXE_BAREME));
export const LIBELLES = { journee: 'Vol journée', j2: 'J+2', detachement: 'Détachement' };

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
export function baremeVide(annee) { return { annee: String(annee), journee: null, pays: [{ nom: 'France', montant: null, zone: 'euro' }] }; }
// Barème d'une année (France toujours présente, en Euro-Europe)
export function baremeDe(baremes, annee) {
  const b = baremes && baremes.get(String(annee));
  if (!b) return baremeVide(annee);
  const pays = Array.isArray(b.pays) ? b.pays.filter(p => p && p.nom) : [];
  if (!pays.some(p => norm(p.nom) === 'FRANCE')) pays.unshift({ nom: 'France', montant: null, zone: 'euro' });
  return { ...b, annee: String(annee), pays };
}
const norm = s => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const paysDuBareme = (b, nom) => (b.pays || []).find(p => norm(p.nom) === norm(nom)) || null;

// ---------- Calcul ----------
// nuits : pays de chaque nuit (dans l'ordre) ; jours : nombre de jours. Renvoie { montant (centimes), manquant, detail, termes }
// Zone Euro-Europe : 1 indemnité du pays de chaque nuit, la dernière nuit 1,5. Zone Monde : 1 indemnité par jour, chaque jour au
// pays de sa nuit (le dernier jour : celui de la dernière nuit). Zone de la ligne : celle de son pays principal.
export function calculer(zone, nuits, jours, bareme) {
  let termes;
  if (zone === 'monde') {
    const parJour = Array.from({ length: Math.max(1, jours) }, (_, i) => nuits[Math.min(i, nuits.length - 1)] ?? nuits[0]);
    termes = parJour.map(p => ({ c: 1, pays: p }));
  } else termes = nuits.map((p, i) => ({ c: i === nuits.length - 1 ? 1.5 : 1, pays: p }));
  const avec = termes.map(t => ({ ...t, m: (paysDuBareme(bareme, t.pays) || {}).montant ?? null }));
  const manquant = !avec.length || avec.some(t => t.m === null || t.m === undefined);
  const montant = manquant ? 0 : Math.round(avec.reduce((s, t) => s + t.c * t.m, 0));
  const memes = avec.length && avec.every(t => t.m === avec[0].m);
  const detail = !avec.length ? '' : memes
    ? (zone === 'monde' ? `${avec.length} indemnité${avec.length > 1 ? 's' : ''} × ${avec[0].m === null ? '?' : euros(avec[0].m)}`
      : `${avec.map(t => coef(t.c)).join(' + ')} indemnité × ${avec[0].m === null ? '?' : euros(avec[0].m)}`)
    : avec.map(t => `${coef(t.c)} × ${t.m === null ? `? (${t.pays})` : euros(t.m)}`).join(' + ');
  return { montant, manquant, detail, termes: avec };
}

// ---------- Lignes ----------
const jours = (du, au) => { const l = []; for (let d = du; d <= au; d = ajouterJours(d, 1)) l.push(d); return l; };
export const detachementsActifs = dets => (dets || []).filter(d => d && !d.supprime && d.du && d.au && d.du <= d.au);
// Détachement qui contient cette date (le plus récent s'il y en a deux)
export const detachementDe = (dets, date) => detachementsActifs(dets).filter(d => date >= d.du && date <= d.au).sort((a, b) => (b.le || '').localeCompare(a.le || ''))[0] || null;
// Nuits d'un détachement : [{ date, pays }] (une par jour sauf le dernier)
export const nuitsDe = d => jours(d.du, d.au).slice(0, -1).map(date => ({ date, pays: (d.nuits && d.nuits[date]) || d.pays || 'France' }));
// Type affiché sur la fiche d'un vol : 'detachement' si sa date tombe dans un détachement, sinon sa case
export const typeDuVol = (v, dets) => (detachementDe(dets, v.date) ? 'detachement' : (v.frais && v.frais.type) || null);

// Toutes les lignes : [{ id, type, annee, du, au, jours, nuits, vols, montant, manquant, incomplet, detail, detachementId }]
export function lignesFrais({ vols, detachements = [], baremes = new Map() }) {
  const dets = detachementsActifs(detachements), lignes = [];
  const reels = (vols || []).filter(v => v && v.date && !estSimulation(v));
  const tri = l => [...l].sort((a, b) => (a.date + (a.hDep || '')).localeCompare(b.date + (b.hDep || '')));
  // Détachements (les vols de leurs dates n'y comptent qu'une fois, jamais ailleurs)
  for (const d of dets) {
    const b = baremeDe(baremes, d.du.slice(0, 4)), n = nuitsDe(d), nb = jours(d.du, d.au).length;
    const zone = (paysDuBareme(b, d.pays) || {}).zone || 'euro';
    let calc;
    if (!n.length) { // un seul jour : comme un vol journée (zone euro), 1 indemnité (Monde)
      calc = zone === 'monde' ? calculer('monde', [d.pays], 1, b) : { montant: b.journee ?? 0, manquant: b.journee === null || b.journee === undefined, detail: '½ indemnité zone euro' };
    } else calc = calculer(zone, n.map(x => x.pays), nb, b);
    const vd = tri(reels.filter(v => v.date >= d.du && v.date <= d.au));
    lignes.push({ id: `det|${d.id}`, type: 'detachement', annee: d.du.slice(0, 4), du: d.du, au: d.au, jours: nb, nuits: n, vols: vd, zone, pays: d.pays,
      detachementId: d.id, ...calc, incomplet: false });
  }
  const hors = reels.filter(v => !detachementDe(dets, v.date));
  // Vols journée : une ligne par jour
  const parJour = new Map();
  for (const v of hors) if (v.frais && v.frais.type === 'journee') { if (!parJour.has(v.date)) parJour.set(v.date, []); parJour.get(v.date).push(v); }
  for (const [date, l] of parJour) {
    const b = baremeDe(baremes, date.slice(0, 4)), manquant = b.journee === null || b.journee === undefined;
    lignes.push({ id: `journee|${date}`, type: 'journee', annee: date.slice(0, 4), du: date, au: date, jours: 1, nuits: [], vols: tri(l), montant: manquant ? 0 : b.journee,
      manquant, detail: '½ indemnité zone euro', incomplet: false });
  }
  // J+2 : deux jours qui se suivent, cochés J+2 = une ligne (2 jours, 1 nuit) ; sinon « J+2 incomplet »
  const j2 = new Map();
  for (const v of hors) if (v.frais && v.frais.type === 'j2') { if (!j2.has(v.date)) j2.set(v.date, []); j2.get(v.date).push(v); }
  const dates = [...j2.keys()].sort(), pris = new Set();
  for (const d of dates) {
    if (pris.has(d)) continue;
    const s = ajouterJours(d, 1);
    if (j2.has(s) && !pris.has(s)) {
      pris.add(d); pris.add(s);
      const vl = tri([...j2.get(d), ...j2.get(s)]), pays = (vl.find(v => v.date === d && v.frais.pays) || {}).frais?.pays || 'France';
      const b = baremeDe(baremes, d.slice(0, 4)), zone = (paysDuBareme(b, pays) || {}).zone || 'euro';
      lignes.push({ id: `j2|${d}`, type: 'j2', annee: d.slice(0, 4), du: d, au: s, jours: 2, nuits: [{ date: d, pays }], vols: vl, zone, pays,
        ...calculer(zone, [pays], 2, b), incomplet: false });
    } else {
      pris.add(d);
      lignes.push({ id: `j2i|${d}`, type: 'j2', annee: d.slice(0, 4), du: d, au: d, jours: 1, nuits: [], vols: tri(j2.get(d)), montant: 0, manquant: false,
        detail: 'J+2 incomplet : coche aussi le vol de la veille ou du lendemain', incomplet: true });
    }
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

// Textes d'une ligne (liste, PDF)
export function titreLigne(x) {
  if (x.type === 'detachement') return `Détachement ${x.jours} jour${x.jours > 1 ? 's' : ''}`;
  if (x.type === 'j2') return x.incomplet ? 'J+2 incomplet' : 'J+2';
  return 'Vol journée';
}
export const datesLigne = x => (x.du === x.au ? dateFr(x.du) : `${dateFr(x.du).slice(0, 5)} → ${dateFr(x.au)}`);
export function lieuLigne(x) {
  if (x.type === 'journee') { const v = x.vols[0]; return v ? [v.dep, ...(v.escales || []).map(e => e.code || e.nom), v.arr].filter(Boolean).join(' → ') : ''; }
  if (x.type === 'j2' && x.incomplet) return `${x.vols.length} vol${x.vols.length > 1 ? 's' : ''}`;
  const pays = [...new Set(x.nuits.map(n => n.pays))].join(', ') || x.pays || '';
  return `${pays} · ${x.nuits.length} nuit${x.nuits.length > 1 ? 's' : ''} · ${x.vols.length} vol${x.vols.length > 1 ? 's' : ''}`;
}
export const montantLigne = x => (x.incomplet ? '0,00 €' : x.manquant ? 'Montant manquant' : euros(x.montant));
