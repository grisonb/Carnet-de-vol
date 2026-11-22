// v0.58 (R149) : vols groupés (plusieurs rotations sur une ligne : largage para, remorquage planeur…) et
// v0.58 (R150) : alerte quand le temps de vol d'un vol enregistré change. Fonctions sans écran (testées seules).
//
// Données (voyagent avec la synchro NAS et la sauvegarde) :
//   réglage PARTAGÉ « volsGroupesTypes » : { [code du type]: true | false } (absent = éteint)
//   avion.volsGroupes                     : true | false si réglé dans la fiche de l'avion (sinon absent / null = comme le type)
//   vol.volsGroupes                       : true si le temps de vol a été tapé à la main (vol.tempsTotal = ce temps ; les
//                                           heures bloc hDep / hArr restent celles tapées) ; absent sinon
import { codeType } from './compteurs.js';
import { hm } from './temps.js';
import { estSimulation } from './modele.js';

export const volsGroupesDuType = (code, parType) => (parType || {})[String(code || '').toUpperCase()] === true;
export const avionReglageVG = a => !!a && typeof a.volsGroupes === 'boolean';
// Priorité : l'avion (s'il est réglé), puis son type
export function volsGroupesAvion(a, parType) {
  if (!a) return false;
  return avionReglageVG(a) ? a.volsGroupes : volsGroupesDuType(codeType(a), parType);
}

// Temps de vol compté d'un vol (celui des totaux)
export const tempsDuVol = v => (!v ? 0 : v.tempsTotal || v.simTemps || 0);

// R150 : alerte (ou null) quand on enregistre un vol DÉJÀ enregistré dont le temps de vol change.
// vols : tous les vols (l'ancienne version comprise) ; avant / apres : le vol avant et après la modification.
export function alerteTemps(vols, avant, apres) {
  if (!avant || !apres) return null;
  const t0 = tempsDuVol(avant), t1 = tempsDuVol(apres);
  if (t0 === t1) return null;
  const d = t1 - t0, compte = x => (estSimulation(x) ? 0 : x.tempsTotal || 0);
  const total0 = vols.reduce((s, v) => s + (estSimulation(v) ? 0 : v.tempsTotal || 0), 0);
  const total1 = total0 - compte(avant) + compte(apres);
  return {
    avant: t0, apres: t1, ecart: d, total0, total1,
    texte: `Temps de vol modifié : ${hm(t0)} → ${hm(t1)} (${d > 0 ? '+' : '−'}${hm(Math.abs(d))}). Ton total HdV passe de ${hm(total0)} à ${hm(total1)}.`,
  };
}
