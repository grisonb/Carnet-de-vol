// v0.62 (R156) : « Anomalies traitées » (logique pure, testée sous Node). Ce n'est PAS une donnée du carnet : ni PDF, ni CSV,
// ni totaux ; aucune ligne ne modifie un vol (ni ses heures, ni « Modifié le »).
//
// Corrigées : réglage PARTAGÉ `anomaliesCorrigees` = [{ id, volId, le (ISO | null = date inconnue), origine ('saisie' | 'flylog'),
//   l: [{ cle, avant: [textes], apres: [textes] }] }]. Une ligne est notée quand un vol qui avait un « ! » (non ignoré) est
//   enregistré et qu'une anomalie a disparu ; ou retrouvée dans le fichier FlyLog d'origine (rattrapage). Le vol lui-même
//   (date, trajet, avion) est lu dans le carnet au moment d'afficher : vol supprimé = ligne cachée.
// Ignorées : lues dans les vols (`anomaliesIgnorees`, R155) : rien n'est gardé à part.
// Synchro : la liste se fusionne (réunion par id : une ligne ajoutée sur chaque appareil est gardée des deux côtés).
import { hm, dateFr } from './temps.js';
import { cleDoublon, formaterImmat } from './modele.js';
import { anomaliesDuCarnet, estIgnore } from './anomalies.js';
import { lignesSuivi, suiviDepuisFlyLog } from './suivi.js';

export const MAX_CORRIGEES = 300; // la liste voyage en un seul élément (le NAS refuse plus de 64 Ko)
const n = x => Number(x) || 0;
const code = e => String((e && (e.code || e.nom)) || '').trim().toUpperCase();
const h = x => (x ? `${String(x).replace(':', 'h')} UTC` : '—');

// L'anomalie en mots simples
export function libelleAnomalie(cle) {
  const [t] = String(cle).split('|');
  return ({
    a: 'Terrain intermédiaire, 0 att.', b: 'Arrivée de nuit, 0 att. de nuit',
    'c-nuit': 'Temps de nuit plus grand que le temps de vol', 'c-ifr': 'Temps IFR plus grand que le temps de vol',
    'd-fn': 'Temps des fonctions différent du temps de vol', 'd-inst': 'Temps instructeur plus grand que le temps de vol',
    'd-exam': 'Temps examinateur plus grand que le temps de vol', e: 'Arrivée avant le départ ou vol de plus de 10 h',
    f: 'Vols qui se chevauchent', g: 'Intermédiaire = départ ou arrivée', h: 'Vol saisi deux fois',
  })[t] || 'Anomalie';
}

// Valeurs du vol qui comptent pour cette anomalie : [{ k, t }] (k : quoi, t : texte affiché)
function parties(cle, v, immatDe) {
  if (!v) return [];
  const [t, c] = String(cle).split('|');
  const P = (k, x) => ({ k, t: x });
  const T = P('T', `Temps de vol : ${hm(n(v.tempsTotal))}`);
  const esc = (v.escales || []).map(code).filter(Boolean);
  const date = P('date', `Date : ${dateFr(v.date)}`), dep = P('hDep', `Bloc départ : ${h(v.hDep)}`), arr = P('hArr', `Bloc arrivée : ${h(v.hArr)}`);
  switch (t) {
    case 'a': {
      const e = (v.escales || []).find(x => code(x) === c);
      return [P(c, e ? `${c} : ${n(e.attJour) + n(e.attNuit)} att.` : `${c} : retiré`)];
    }
    case 'g': return [P('dep', `Départ : ${v.dep || '—'}`), P('esc', `Intermédiaire${esc.length > 1 ? 's' : ''} : ${esc.join(', ') || 'aucun'}`), P('arr', `Arrivée : ${v.arr || '—'}`)];
    case 'b': return [P('arr', `Arrivée : ${v.arr || '—'}`), arr, P('nuit', `Att. nuit : ${n(v.attNuit)}`)];
    case 'c-nuit': return [P('nuit', `Nuit : ${hm(n(v.tempsNuit))}`), T];
    case 'c-ifr': return [P('ifr', `IFR : ${hm(n(v.tempsIFR))}`), T];
    case 'd-fn': return [['CdB', 'tempsCdB'], ['Copi', 'tempsCopi'], ['DC', 'tempsDC'], ['PICUS', 'tempsPICUS']].map(([l, k]) => P(k, `${l} : ${hm(n(v[k]))}`)).concat(T);
    case 'd-inst': return [P('inst', `Inst : ${hm(n(v.tempsInst))}`), T];
    case 'd-exam': return [P('exam', `Exam : ${hm(n(v.tempsExam))}`), T];
    case 'e': return [date, dep, arr, T];
    case 'f': return [date, dep, arr];
    case 'h': return [date, dep, arr, P('av', `Avion : ${immatDe(v) || '—'}`)];
    default: return [];
  }
}
export const SUR_L_AUTRE = 'Corrigé sur l\'autre vol (modifié ou supprimé)';
// Ancienne valeur -> nouvelle : seulement ce qui a changé (rien n'a changé dans ce vol : chevauchement ou doublon réglé sur l'autre)
export function avantApres(cle, ancien, nouveau, immatDe = () => '') {
  const a = parties(cle, ancien, immatDe), b = parties(cle, nouveau, immatDe);
  const tb = new Map(b.map(x => [x.k, x.t])), ta = new Map(a.map(x => [x.k, x.t]));
  const k = new Set([...a.filter(x => tb.get(x.k) !== x.t).map(x => x.k), ...b.filter(x => ta.get(x.k) !== x.t).map(x => x.k)]);
  if (!k.size) return { avant: [], apres: [SUR_L_AUTRE] };
  return { avant: a.filter(x => k.has(x.k)).map(x => x.t), apres: b.filter(x => k.has(x.k)).map(x => x.t) };
}

// Enregistrement d'un vol : avant = anomalies affichées (« ! » non ignoré) avant ; apres = anomalies du vol enregistré (ignorées
// comprises). Renvoie la ligne à ajouter, ou null.
export function correctionALaSaisie(avant, apres, ancien, nouveau, immatDe = () => '', maintenant = new Date().toISOString()) {
  if (!avant || !avant.length || !nouveau) return null;
  const restent = new Set((apres || []).map(x => x.cle));
  const cles = [...new Set(avant.map(x => x.cle))].filter(c => c && !restent.has(c));
  if (!cles.length) return null;
  return { id: `s|${nouveau.id}|${maintenant}`, volId: nouveau.id, le: maintenant, origine: 'saisie', l: cles.map(c => ({ cle: c, ...avantApres(c, ancien, nouveau, immatDe) })) };
}

const t = x => Date.parse(x || '') || 0;
const parDate = (a, b) => t(b.le) - t(a.le) || String(b.id).localeCompare(String(a.id));
// Lignes ajoutées à la liste (sans doublon d'id ; les plus récentes gardées)
export const OCTETS_CORRIGEES = 50000; // v0.63 : la liste reste un seul élément de moins de 64 Ko
export function ajouterCorrigees(liste, nouvelles) {
  const l = Array.isArray(liste) ? [...liste] : [], ids = new Set(l.map(x => x.id));
  for (const e of nouvelles || []) if (e && !ids.has(e.id)) { l.push(e); ids.add(e.id); }
  const r = l.sort(parDate).slice(0, MAX_CORRIGEES);
  while (r.length > 1 && JSON.stringify(r).length > OCTETS_CORRIGEES) r.pop();
  return r;
}
// Synchro : liste changée sur deux appareils -> réunion
export const fusionCorrigees = (ici, nas) => ajouterCorrigees(ici, nas);

// Lignes affichées : vols encore dans le carnet, plus récentes en haut (date inconnue en bas)
export function corrigeesAffichees(liste, volsParId) {
  return (Array.isArray(liste) ? liste : []).filter(x => x && volsParId.has(x.volId)).sort(parDate);
}
// Vols ignorés (R155) : [{ vol, anomalies, le }], plus récents en haut. brutes : anomaliesDuCarnet(…, { avecIgnorees: true })
export function ignoreesAffichees(vols, brutes) {
  const r = [];
  for (const v of vols) if (v.anomaliesIgnorees && estIgnore(v) && (brutes.get(v.id) || []).length) r.push({ id: v.id, vol: v, anomalies: brutes.get(v.id), le: v.anomaliesIgnorees.le || null });
  return r.sort(parDate);
}
// Badge de Plus : nombre de vols dans la liste (les deux onglets)
export const nombreDeVols = (corrigees, ignorees) => new Set([...corrigees.map(x => x.volId), ...ignorees.map(x => x.id)]).size;

// ---------- Rattrapage depuis le fichier FlyLog d'origine ----------
// flVols / flAvions : les vols du fichier (analyserFlyLog sans vol existant) et leurs avions (Map id -> avion) ;
// vols / avions : le carnet. Chaque vol FlyLog est retrouvé comme à l'import d'origine (date, terrains, immatriculation, heure
// de départ, temps : quantités comptées clé par clé) ; à défaut, le vol importé de la même ligne du fichier, à la même date.
// Anomalie présente dans la version FlyLog et absente maintenant (ignorée = toujours là) = corrigée. Une anomalie déjà dans
// la liste pour ce vol n'est jamais ajoutée deux fois. Renvoie { nouvelles, parType, retrouves, parLigne, nonRetrouves, corrections }.
export function rattrapage({ flVols, flAvions, vols, avions, terrainDe = () => null, existantes = [] }) {
  const immatFl = v => formaterImmat((flAvions.get(v.avionId) || {}).immat || '');
  const immatIci = v => formaterImmat((avions.get(v.avionId) || {}).immat || '');
  const libres = new Map();
  const ici = vols.filter(v => v.simulation !== true);
  for (const v of ici) {
    const k = cleDoublon(v, immatIci(v));
    if (!libres.has(k)) libres.set(k, []);
    libres.get(k).push(v);
  }
  for (const l of libres.values()) l.sort((a, b) => n(a.ordre) - n(b.ordre));
  const pris = new Set(), paires = [];
  let parLigne = 0;
  const restants = [];
  for (const f of flVols) {
    const l = libres.get(cleDoublon(f, immatFl(f))) || [];
    const v = l.find(x => !pris.has(x.id));
    if (v) { pris.add(v.id); paires.push([f, v]); } else restants.push(f);
  }
  const parOrdre = new Map();
  for (const v of ici) if (v.source === 'flylog' && !pris.has(v.id)) parOrdre.set(`${n(v.ordre)}|${v.date}`, v);
  let nonRetrouves = 0;
  for (const f of restants) {
    const v = parOrdre.get(`${n(f.ordre)}|${f.date}`);
    if (v && !pris.has(v.id)) { pris.add(v.id); paires.push([f, v]); parLigne++; } else nonRetrouves++;
  }
  const avant = anomaliesDuCarnet(flVols, flAvions, terrainDe, { avecIgnorees: true });
  const maintenant = anomaliesDuCarnet(vols, avions, terrainDe, { avecIgnorees: true });
  const deja = new Set();
  for (const e of existantes || []) for (const a of e.l || []) deja.add(`${e.volId}|${a.cle}`);
  const nouvelles = [], parType = {};
  let corrections = 0;
  for (const [f, v] of paires) {
    const restent = new Set((maintenant.get(v.id) || []).map(x => x.cle));
    const cles = [...new Set((avant.get(f.id) || []).map(x => x.cle))].filter(c => !restent.has(c) && !deja.has(`${v.id}|${c}`));
    if (!cles.length) continue;
    const immat = x => (x === f ? immatFl(f) : immatIci(x));
    nouvelles.push({ id: `fl|${v.id}|${cles.join(',')}`, volId: v.id, le: v.modifieLe || null, origine: 'flylog', l: cles.map(c => ({ cle: c, ...avantApres(c, f, v, immat) })) });
    for (const c of cles) { const ty = c[0]; parType[ty] = (parType[ty] || 0) + 1; corrections++; }
  }
  return { nouvelles, parType, retrouves: paires.length, parLigne, nonRetrouves, corrections, paires, immatFl, immatIci };
}

// ---------- v0.63 (R157) : une carte par vol, trois onglets ----------
// corrigees : réglage anomaliesCorrigees ; suivis : Map id du vol -> suivi (js/suivi.js) ; opts : { immatDe } ; nomCompteur(cle).
// Corrigées : vols avec une anomalie corrigée (anomalies regroupées, la plus récente gardée par anomalie) ; dessous, tous les
// champs changés (suivi) ; sans suivi (lignes d'avant la v0.63) : l'ancienne valeur liée à l'anomalie.
// Modifiés : vols suivis, sans anomalie corrigée, dont au moins un champ diffère encore de son origine.
export function cartesTraitees({ vols, corrigees, suivis = new Map(), opts = {}, nomCompteur = c => c }) {
  const parId = new Map(vols.map(v => [v.id, v])), groupes = new Map();
  for (const e of Array.isArray(corrigees) ? corrigees : []) {
    if (!e || !parId.has(e.volId)) continue;
    if (!groupes.has(e.volId)) groupes.set(e.volId, { volId: e.volId, vol: parId.get(e.volId), le: null, an: new Map() });
    const g = groupes.get(e.volId);
    if (t(e.le) > t(g.le)) g.le = e.le;
    for (const a of e.l || []) {
      const x = g.an.get(a.cle);
      if (!x || (!(x.avant || []).length && (a.avant || []).length)) g.an.set(a.cle, a);
    }
  }
  const lignes = id => (suivis.has(id) ? lignesSuivi(suivis.get(id), parId.get(id), opts, nomCompteur) : null);
  const cCorrigees = [...groupes.values()].map(g => ({ volId: g.volId, id: g.volId, vol: g.vol, le: g.le, anomalies: [...g.an.values()], lignes: lignes(g.volId) })).sort(parDate);
  const cModifies = [];
  for (const [id, s] of suivis) {
    if (groupes.has(id) || !parId.has(id)) continue;
    const l = lignes(id);
    if (l.length) { const v = parId.get(id); cModifies.push({ volId: id, id, vol: v, le: v.modifieLe || s.le || null, lignes: l }); }
  }
  return { corrigees: cCorrigees, modifies: cModifies.sort(parDate) };
}
export const nombreDeVols3 = (...listes) => new Set(listes.flat().map(x => x.volId || x.id)).size;

// Rattrapage v0.63 : origines FlyLog de tous les vols retrouvés qui ont changé depuis l'import. suivis : Map id -> suivi existant.
// Renvoie { suivis: [[id, suivi]] (à écrire), modifies (vols changés depuis FlyLog) }.
export function rattrapageSuivis({ paires, suivis = new Map(), immatFl, immatIci, sauf = [] }) {
  const ecrire = [];
  let modifies = 0;
  for (const [f, v] of paires) {
    const opts = { immatDe: x => (x === f ? immatFl(f) : immatIci(x)), sauf };
    if (!suiviDepuisFlyLog(null, f, v, opts)) continue; // rien n'a changé depuis FlyLog
    modifies++;
    const s = suiviDepuisFlyLog(suivis.get(v.id) || null, f, v, opts);
    if (s) ecrire.push([v.id, s]);
  }
  return { suivis: ecrire, modifies };
}
