// v0.61 (R155) : anomalies du carnet, calculées UNE fois par changement du carnet (4 000 vols : une passe + un tri) et partagées
// par l'accueil (triangle « ! », bouton jaune) et la saisie (cadre « Anomalie détectée »). Affichage seulement.
import { etat } from '../etat.js';
import { terrain } from '../terrains.js';
import { anomaliesDuCarnet } from '../anomalies.js';

let cache = { cle: null, map: new Map() };
export function anomaliesActuelles() {
  const cle = `${etat.revision}|${etat.vols.length}|${etat.avions.size}`;
  if (cache.cle !== cle || cache.vols !== etat.vols) cache = { cle, vols: etat.vols, map: anomaliesDuCarnet(etat.vols, etat.avions, c => terrain(c)) };
  return cache.map;
}
export const anomaliesDe = id => anomaliesActuelles().get(id) || [];
// Triangle jaune « ! » dessiné par l'app (pas un emoji)
export const TRIANGLE = '<svg viewBox="0 0 24 22" width="20" height="18" aria-hidden="true"><path d="M12 1.5 L23 20.5 H1 Z" fill="#f5c400" stroke="#1b2433" stroke-width="2" stroke-linejoin="round"/><rect x="10.8" y="7" width="2.4" height="7.5" rx="1" fill="#1b2433"/><circle cx="12" cy="17.3" r="1.4" fill="#1b2433"/></svg>';
// v0.62 (R156) : les mêmes, vols ignorés compris (liste « Ignorées », corrections notées à l'enregistrement)
let cacheB = { cle: null, map: new Map() };
export function anomaliesBrutes() {
  const cle = `${etat.revision}|${etat.vols.length}|${etat.avions.size}`;
  if (cacheB.cle !== cle || cacheB.vols !== etat.vols) cacheB = { cle, vols: etat.vols, map: anomaliesDuCarnet(etat.vols, etat.avions, c => terrain(c), { avecIgnorees: true }) };
  return cacheB.map;
}
