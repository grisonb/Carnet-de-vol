// v0.61 (R154) : « reporté sur le carnet papier » (logique pure, testée sous Node). Ce n'est PAS une donnée du carnet :
// ni PDF, ni CSV, ni totaux ; aucune heure ne change.
//
// Un vol SANS le champ `aReporter` est « reporté » : tous les vols existants le sont sans être réécrits, ceux d'une ancienne
// sauvegarde aussi. Un vol créé depuis la v0.61 (saisi à la main, importé de NPF-Q400) arrive avec `aReporter: true`.
// `reporteLe` : heure du dernier appui sur le rond (synchro : entre deux versions qui ne diffèrent QUE par cet état, la plus
// récente gagne, sans conflit à choisir).
import { estSimulation } from './modele.js';

export const estAReporter = v => !!v && v.aReporter === true && !estSimulation(v);
export const nbAReporter = vols => vols.reduce((n, v) => n + (estAReporter(v) ? 1 : 0), 0);

// Vol après un appui sur le rond (copie ; le vol d'origine ne change pas)
export function basculerReport(v, maintenant = new Date().toISOString()) {
  const { aReporter, ...reste } = v;
  return aReporter === true ? { ...reste, reporteLe: maintenant } : { ...reste, aReporter: true, reporteLe: maintenant };
}

// Champs propres à cet état, au « ! » ignoré (R155, anomaliesIgnorees) et l'heure d'enregistrement : ce ne sont pas des
// données du carnet
const HORS_REPORT = ['aReporter', 'reporteLe', 'anomaliesIgnorees', 'modifieLe', 'frais']; // v0.68 (R166) : case « frais d'escale »
const sansReport = v => JSON.stringify(Object.keys(v || {}).filter(k => !HORS_REPORT.includes(k)).sort().map(k => [k, v[k]]));
// Deux versions d'un vol qui ne diffèrent que par « reporté / à reporter » et / ou le « ! » ignoré
export const seulReportDiffere = (a, b) => !!a && !!b && sansReport(a) === sansReport(b);
// La plus récente des deux (heure du dernier appui, sinon de l'enregistrement) : 'a' ou 'b'
export function plusRecentReport(a, b) {
  const t = v => Date.parse((v && (v.reporteLe || v.modifieLe)) || '') || 0;
  return t(a) >= t(b) ? 'a' : 'b';
}

// v0.61 (R155) : deux versions qui ne diffèrent que par ces états : chacun pris dans la version où il a été changé le plus
// récemment (rond : reporteLe ; « ! » ignoré : anomaliesIgnorees.le). Renvoie le vol fusionné (copie).
export function fusionnerEtats(ici, nas) {
  const t = x => Date.parse(x || '') || 0;
  const r = { ...nas };
  if (t(ici.reporteLe) > t(nas.reporteLe)) {
    if (ici.aReporter === true) r.aReporter = true; else delete r.aReporter;
    r.reporteLe = ici.reporteLe;
  }
  const li = ici.anomaliesIgnorees, ln = nas.anomaliesIgnorees;
  if (t(li && li.le) > t(ln && ln.le)) r.anomaliesIgnorees = li;
  // v0.68 (R166) : case « frais d'escale » : la plus récente (frais.le)
  const fi = ici.frais, fn = nas.frais;
  if (t(fi && fi.le) > t(fn && fn.le)) r.frais = fi;
  return r;
}
