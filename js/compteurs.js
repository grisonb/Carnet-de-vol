// v0.56 (R144) : compteurs gérables (Plus › Mes réglages › Compteurs), compteurs par défaut par type d'avion et par avion,
// compteurs ajoutés à un vol. Fonctions sans écran (testées seules).
//
// Données (toutes voyagent avec la synchro NAS et la sauvegarde ; le plus récent gagne) :
//   réglage « compteurs »        : l'ORDRE, comme avant ([{ cle, on }], « Feux » compris ; « on » = l'ancien choix, gardé tel quel)
//   réglage « compteursFiches »  : { [cle]: { nom, totaux, masque, cree, supprime } } (nom changé, compté ou non dans les Totaux…)
//   réglage « compteursTypes »   : { [code du type]: [cles] } (un type absent : compteurs de départ, voir departDuType)
//   avion.compteursPropres       : [cles] si l'avion n'est PAS « comme le type » (sinon absent / null)
//   vol.compteursAjoutes         : [cles] ajoutés à ce vol seulement (« Juste pour ce vol »)
// Les valeurs restent où elles étaient : vol.feux (Feux) et vol.compteurs[cle] (les autres). Rien n'est jamais effacé.

import { COMPTEURS, compteursRanges } from './modele.js';

export const FEUX = 'feux';
const BASE = [{ cle: FEUX, nom: 'Feux', court: 'feux' }, ...COMPTEURS];
export const CLES_BASE = BASE.map(c => c.cle);
export const estBase = cle => CLES_BASE.includes(cle);

// Tous les compteurs (sauf supprimés), dans l'ordre choisi : [{ cle, nom, court, totaux, masque, cree }]
export function listeCompteurs(fiches = {}, ordre = null) {
  fiches = fiches || {};
  const defs = new Map();
  for (const c of BASE) {
    const f = fiches[c.cle] || {};
    if (f.supprime && c.cle !== FEUX) continue;
    defs.set(c.cle, { cle: c.cle, nom: f.nom || c.nom, court: f.nom || c.court, totaux: f.totaux !== false, masque: !!f.masque, cree: false });
  }
  const crees = Object.entries(fiches).filter(([cle, f]) => f && f.cree && !f.supprime && !estBase(cle))
    .sort((a, b) => String(a[1].creeLe || '').localeCompare(String(b[1].creeLe || '')));
  for (const [cle, f] of crees) defs.set(cle, { cle, nom: f.nom || cle, court: f.nom || cle, totaux: f.totaux !== false, masque: !!f.masque, cree: true });
  const l = [];
  for (const o of compteursRanges(ordre)) if (defs.has(o.cle)) { l.push(defs.get(o.cle)); defs.delete(o.cle); }
  return [...l, ...defs.values()];
}

// Nouvel ordre (flèches ↑↓) : l'ordre complet, chaque entrée garde son ancien « on »
export function deplacer(ordre, liste, i, d) {
  const cles = liste.map(c => c.cle), j = i + d;
  if (j < 0 || j >= cles.length) return compteursRanges(ordre);
  [cles[i], cles[j]] = [cles[j], cles[i]];
  const on = new Map(compteursRanges(ordre).map(o => [o.cle, o.on]));
  const autres = compteursRanges(ordre).filter(o => !cles.includes(o.cle)); // supprimés : gardés à la fin (sans effet)
  return [...cles.map(cle => ({ cle, on: cle === FEUX ? true : !!on.get(cle) })), ...autres];
}

// Code du type d'un avion (les simulateurs ensemble : « SIM »)
export const codeType = a => (!a ? '' : a.sim ? 'SIM' : String(a.typeOACI || '').trim().toUpperCase());
const estSEP = c => !!c && c.equipage === 'SP' && c.moteurs === 'SE' && c.moteur === 'P';

// Compteurs de départ d'un type (tant que son choix n'a jamais été changé) :
//   DH8D (Dash 8 MR et MRE) : ce que l'app affichait jusqu'ici (Feux + les compteurs allumés dans l'ancien réglage)
//   CL2T (CL-415)            : Feux, Écopages, Amerrissages CL, Largages copi CL
//   types SEP (monopilote monomoteur piston) : Amerrissages SEP
//   les autres (et les simulateurs) : aucun. Largages para : aucun type.
export function departDuType(code, carac, ancien) {
  code = String(code || '').toUpperCase();
  if (code === 'DH8D') return [FEUX, ...compteursRanges(ancien).filter(c => c.cle !== FEUX && c.on).map(c => c.cle)];
  if (code === 'CL2T') return [FEUX, 'ecopages', 'amerrCL', 'largCopiCL'];
  if (code !== 'SIM' && estSEP(carac)) return ['amerrSEP'];
  return [];
}
export function compteursDuType(code, carac, parType, ancien) {
  const t = (parType || {})[String(code || '').toUpperCase()];
  return Array.isArray(t) ? [...t] : departDuType(code, carac, ancien);
}
// Priorité : l'avion (s'il n'est pas « comme le type »), puis son type
export const avionCommeLeType = a => !a || !Array.isArray(a.compteursPropres);
export function compteursParDefaut(avion, parType, ancien) {
  if (!avion) return [];
  if (!avionCommeLeType(avion)) return [...avion.compteursPropres];
  return compteursDuType(codeType(avion), avion, parType, ancien);
}

const aUneValeur = (vol, cle) => !!vol && (cle === FEUX ? vol.feux > 0 : (vol.compteurs || {})[cle] > 0);

// Compteurs affichés sur un vol, dans l'ordre : ceux par défaut de l'avion, ceux ajoutés à ce vol, et TOUJOURS ceux qui ont une
// valeur (> 0) sur ce vol (même masqués, même inconnus ici). Un compteur masqué n'est plus proposé.
// vol : { feux, compteurs, compteursAjoutes }
export function compteursDuVol({ avion, vol, liste, parType, ancien }) {
  const defaut = new Set(compteursParDefaut(avion, parType, ancien)), ajoutes = new Set((vol && vol.compteursAjoutes) || []);
  const l = liste.filter(c => aUneValeur(vol, c.cle) || (!c.masque && (defaut.has(c.cle) || ajoutes.has(c.cle))));
  const connus = new Set(liste.map(c => c.cle));
  for (const [cle, n] of Object.entries((vol && vol.compteurs) || {})) {
    if (n > 0 && !connus.has(cle)) l.push({ cle, nom: cle, court: cle, totaux: true, masque: false, cree: true, inconnu: true });
  }
  return l;
}

// Coche / décoche dans la saisie. portee : 'vol' | 'avion' | 'type'. Renvoie ce qui change :
// { ajoutes (du vol), propres (de l'avion, si changé), typeListe (du type, si changé) }. Aucune valeur ne bouge.
export function changerChoix({ cocher, portee, cle, avion, ajoutes = [], parType, ancien }) {
  const avec = (l, k) => (l.includes(k) ? [...l] : [...l, k]), sans = (l, k) => l.filter(x => x !== k);
  const r = { ajoutes: cocher ? (portee === 'vol' ? avec(ajoutes, cle) : [...ajoutes]) : sans(ajoutes, cle) };
  if (portee === 'avion' && avion) r.propres = (cocher ? avec : sans)(compteursParDefaut(avion, parType, ancien), cle);
  if (portee === 'type' && avion) {
    r.typeListe = (cocher ? avec : sans)(compteursDuType(codeType(avion), avion, parType, ancien), cle);
    if (!avionCommeLeType(avion)) r.propres = (cocher ? avec : sans)(avion.compteursPropres, cle); // cet avion suit aussi
  }
  if (cocher && portee !== 'vol') r.ajoutes = avec(r.ajoutes, cle); // ajouté à ce vol en même temps
  return r;
}

// Nombre de vols où ce compteur a une valeur (> 0) : 0 = jamais utilisé (suppression possible)
export const volsAvecCompteur = (vols, cle) => vols.reduce((n, v) => n + (aUneValeur(v, cle) ? 1 : 0), 0);

// Nouveau compteur : clé unique (jamais réutilisée)
export function nouvelleCle(fiches = {}, maintenant = Date.now(), alea = Math.random) {
  let cle;
  do cle = 'c' + maintenant.toString(36) + Math.floor(alea() * 1296).toString(36).padStart(2, '0');
  while (estBase(cle) || (fiches || {})[cle]);
  return cle;
}
// Nom refusé : vide, ou déjà pris par un autre compteur (majuscules / accents ignorés)
const pli = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
export function problemeNom(nom, cle, liste) {
  if (!String(nom || '').trim()) return 'Donne un nom au compteur.';
  if (liste.some(c => c.cle !== cle && pli(c.nom) === pli(nom))) return `« ${String(nom).trim()} » existe déjà.`;
  return '';
}
