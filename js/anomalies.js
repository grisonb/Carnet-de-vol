// v0.61 (R155) : anomalies signalées par un triangle « ! » (logique pure, testée sous Node). L'app ne corrige JAMAIS rien :
// elle signale seulement. Ce n'est pas une donnée du carnet (ni PDF, ni CSV, ni totaux).
//
// Anomalies (et aucune autre), vols simulateur et vols de simulation NPF non contrôlés :
//   a. terrain intermédiaire avec 0 atterrissage ;
//   b. arrivée de nuit (même règle que le temps de nuit : estNuit au bloc arrivée, au terrain d'arrivée) mais 0 atterrissage de nuit ;
//   c. temps de nuit ou temps IFR plus grand que le temps de vol (vol groupé : le temps tapé, qui est tempsTotal) ;
//   d. temps des fonctions incohérent avec le temps de vol : CdB + Copi + DC + PICUS = temps de vol (c'est ainsi que
//      FlyLog compte, le temps instructeur étant AUSSI compté en CdB) ; un vol instructeur saisi dans l'app n'a que le temps
//      instructeur (CdB à 0) : accepté ; temps instructeur ou examinateur plus grand que le temps de vol ;
//   e. arrivée avant le départ (un vol qui passe minuit n'en est pas une : c'est alors un vol de plus de 10 h), vol de plus de 10 h ;
//   f. deux vols qui se chevauchent (se toucher n'est pas chevaucher) ;
//   g. terrain intermédiaire identique au départ ou à l'arrivée (un aller-retour sans intermédiaire est normal) ;
//   h. vol saisi deux fois : même date, mêmes heures, même immatriculation (les deux sont signalés).
//
// Ignorer : vol.anomaliesIgnorees = { empreinte, le } ; empreinte = celle des données du vol qui servent au contrôle au moment
// d'ignorer. Tant que ces données ne changent pas, le « ! » ne revient pas ; vol modifié ensuite et anomalie : il revient.
import { estSimulation } from './modele.js';
import { estNuit } from './nuit.js';
import { hm, dateFr } from './temps.js';
import { empreinteTexte } from './synchro.js';

const MAX_VOL = 600; // 10 h
const JOUR = 864e5;
const n = x => Number(x) || 0;
const code = e => String((e && (e.code || e.nom)) || '').trim().toUpperCase();

// Données du vol qui servent au contrôle (empreinte pour « Ignorer »)
const CHAMPS = ['date', 'hDep', 'hArr', 'dep', 'arr', 'escales', 'avionId', 'tempsTotal', 'simTemps', 'tempsNuit', 'tempsIFR', 'tempsCdB', 'tempsCopi',
  'tempsDC', 'tempsInst', 'tempsPICUS', 'tempsExam', 'attJour', 'attNuit', 'fonction', 'volsGroupes', 'arriveePosition'];
export const empreinteControle = v => empreinteTexte(JSON.stringify(CHAMPS.map(k => (v[k] === undefined ? null : v[k]))));
export const estIgnore = v => !!(v && v.anomaliesIgnorees && v.anomaliesIgnorees.empreinte === empreinteControle(v));
export const ignorer = (v, maintenant = new Date().toISOString()) => ({ ...v, anomaliesIgnorees: { empreinte: empreinteControle(v), le: maintenant } });
// v0.62 (R156) : « Ne plus ignorer » : le « ! » revient ; l'heure reste (synchro : le changement le plus récent gagne)
export const nePlusIgnorer = (v, maintenant = new Date().toISOString()) => ({ ...v, anomaliesIgnorees: { empreinte: null, le: maintenant } });

// Début et fin du vol (ms UTC) : arrivée à l'heure ou avant le départ = le lendemain (passage de minuit)
function instants(v) {
  if (!v.date || !/^\d\d:\d\d$/.test(v.hDep || '') || !/^\d\d:\d\d$/.test(v.hArr || '')) return null;
  const debut = Date.parse(`${v.date}T${v.hDep}:00Z`);
  let fin = Date.parse(`${v.date}T${v.hArr}:00Z`);
  if (!Number.isFinite(debut) || !Number.isFinite(fin)) return null;
  if (fin < debut) fin += JOUR;
  return { debut, fin };
}
const heure = h => String(h || '').replace(':', 'h');

// Anomalies d'un vol seul (a, b, c, d, e, g). terrainDe(code) -> { lat, lon } | null
export function anomaliesDuVol(v, terrainDe = () => null) {
  const l = [], T = n(v.tempsTotal);
  // a / g : terrains intermédiaires
  const dep = code({ code: v.dep }), arr = code({ code: v.arr });
  for (const e of v.escales || []) {
    const c = code(e);
    if (n(e.attJour) + n(e.attNuit) === 0) l.push({ type: 'a', cle: `a|${c}`, texte: `${c || 'Terrain sans nom'} (terrain intermédiaire) : 0 atterrissage` });
    if (c && (c === dep || c === arr)) l.push({ type: 'g', cle: `g|${c}`, texte: `${c} (terrain intermédiaire) : même terrain que ${c === dep ? 'le départ' : 'l\'arrivée'}` });
  }
  const i = instants(v);
  // b : arrivée de nuit, 0 atterrissage de nuit
  if (i) {
    const t = terrainDe(v.arr) || (v.arriveePosition && Number.isFinite(v.arriveePosition.lat) ? v.arriveePosition : null);
    if (t && Number.isFinite(t.lat) && Number.isFinite(t.lon) && estNuit(i.fin, t.lat, t.lon) && n(v.attNuit) === 0) {
      l.push({ type: 'b', cle: 'b', texte: `Arrivée de nuit (${v.arr || 'arrivée'} ${heure(v.hArr)} UTC) : 0 atterrissage de nuit` });
    }
  }
  // c : nuit / IFR plus grands que le temps de vol
  if (n(v.tempsNuit) > T) l.push({ type: 'c', cle: 'c-nuit', texte: `Temps de nuit (${hm(n(v.tempsNuit))}) plus grand que le temps de vol (${hm(T)})` });
  if (n(v.tempsIFR) > T) l.push({ type: 'c', cle: 'c-ifr', texte: `Temps IFR (${hm(n(v.tempsIFR))}) plus grand que le temps de vol (${hm(T)})` });
  // d : fonctions
  if (T > 0) {
    const prin = n(v.tempsCdB) + n(v.tempsCopi) + n(v.tempsDC) + n(v.tempsPICUS);
    const instSeul = prin === 0 && n(v.tempsInst) === T; // vol instructeur saisi dans l'app (CdB non rempli)
    if (prin !== T && !instSeul) {
      const det = [['CdB', v.tempsCdB], ['Copi', v.tempsCopi], ['DC', v.tempsDC], ['PICUS', v.tempsPICUS]].filter(x => n(x[1])).map(x => `${x[0]} ${hm(n(x[1]))}`);
      l.push({ type: 'd', cle: 'd-fn', texte: `Temps des fonctions (${det.length ? det.join(' + ') : '0h00'}) différent du temps de vol (${hm(T)})` });
    }
    if (n(v.tempsInst) > T) l.push({ type: 'd', cle: 'd-inst', texte: `Temps instructeur (${hm(n(v.tempsInst))}) plus grand que le temps de vol (${hm(T)})` });
    if (n(v.tempsExam) > T) l.push({ type: 'd', cle: 'd-exam', texte: `Temps examinateur (${hm(n(v.tempsExam))}) plus grand que le temps de vol (${hm(T)})` });
  }
  // e : arrivée avant le départ (lue comme un passage de minuit : vol de plus de 10 h), vol de plus de 10 h
  const bloc = i ? Math.round((i.fin - i.debut) / 60000) : null;
  if (bloc !== null && bloc > MAX_VOL && v.hArr < v.hDep) l.push({ type: 'e', cle: 'e', texte: `Arrivée (${heure(v.hArr)} UTC) avant le départ (${heure(v.hDep)} UTC), ou vol de ${hm(bloc)}` });
  else if ((bloc !== null && bloc > MAX_VOL) || T > MAX_VOL) l.push({ type: 'e', cle: 'e', texte: `Vol de ${hm(Math.max(bloc || 0, T))} (plus de 10 h)` });
  return l;
}

// Toutes les anomalies du carnet, en une passe : Map id -> [{ type, cle, texte }] (vols avec au moins une anomalie NON ignorée).
// avions : Map id -> avion ; terrainDe(code) -> { lat, lon } | null
// v0.62 (R156) : cle = l'anomalie précise (« a|LFML », « c-nuit »…), pour savoir laquelle a disparu ; { avecIgnorees: true } :
// les vols ignorés gardent aussi leurs anomalies (liste « Ignorées », corrections)
export function anomaliesDuCarnet(vols, avions, terrainDe = () => null, { avecIgnorees = false } = {}) {
  const res = new Map();
  const ajouter = (v, a) => { if (!res.has(v.id)) res.set(v.id, []); res.get(v.id).push(a); };
  const controles = [];
  for (const v of vols) {
    const av = avions.get(v.avionId);
    if (estSimulation(v) || (av && av.sim) || n(v.simTemps) > 0) continue; // séances simulateur : non contrôlées
    controles.push(v);
    for (const a of anomaliesDuVol(v, terrainDe)) ajouter(v, a);
  }
  // h : vol saisi deux fois (même date, mêmes heures, même immatriculation)
  const parCle = new Map();
  for (const v of controles) {
    if (!v.hDep || !v.hArr) continue;
    const av = avions.get(v.avionId), immat = String((av && av.immat) || v.avionId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const k = `${v.date}|${v.hDep}|${v.hArr}|${immat}`;
    if (!parCle.has(k)) parCle.set(k, []);
    parCle.get(k).push(v);
  }
  const doubles = new Set();
  for (const l of parCle.values()) if (l.length > 1) for (const v of l) { doubles.add(v.id); ajouter(v, { type: 'h', cle: 'h', texte: 'Vol saisi deux fois (même date, mêmes heures, même avion)' }); }
  // f : chevauchements, sur les vols triés par heure de départ (se toucher n'est pas chevaucher ; les doubles sont déjà signalés)
  const tries = controles.map(v => ({ v, i: instants(v) })).filter(x => x.i && x.i.fin - x.i.debut <= JOUR).sort((a, b) => a.i.debut - b.i.debut);
  let plusLong = null; // vol déjà vu qui finit le plus tard
  for (const x of tries) {
    if (plusLong && x.i.debut < plusLong.i.fin && !(doubles.has(x.v.id) && doubles.has(plusLong.v.id))) {
      const dire = y => `Chevauche le vol du ${dateFr(y.v.date)} ${y.v.dep || ''} → ${y.v.arr || ''} (${heure(y.v.hDep)} → ${heure(y.v.hArr)} UTC)`;
      ajouter(x.v, { type: 'f', cle: 'f', texte: dire(plusLong) });
      ajouter(plusLong.v, { type: 'f', cle: 'f', texte: dire(x) });
    }
    if (!plusLong || x.i.fin > plusLong.i.fin) plusLong = x;
  }
  // vols ignorés (données inchangées depuis « Ignorer ») : pas de « ! »
  if (avecIgnorees) return res;
  const parId = new Map(vols.map(v => [v.id, v]));
  for (const id of [...res.keys()]) if (estIgnore(parId.get(id))) res.delete(id);
  return res;
}
