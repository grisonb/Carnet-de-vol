// v0.63 (R157) : suivi des modifications des vols (logique pure, testée sous Node). Ce n'est PAS une donnée du carnet : ni PDF,
// ni CSV, ni totaux ; un vol n'est jamais réécrit pour cela (ni ses données, ni « Modifié le »).
//
// Pour chaque vol modifié : réglage PARTAGÉ « suivi-<id du vol> » = { o: { champ: texte d'origine }, le } (un petit élément par vol :
// il voyage avec la synchro et la sauvegarde, bien sous la limite de 64 Ko du NAS). Origine = la valeur FlyLog (rattrapage) ou la
// valeur avant la première modification dans l'app. Seuls les champs qui ont changé un jour y sont gardés ; un champ revenu à son
// origine ne s'affiche plus.
// Suivis : tous les champs du carnet. PAS suivis : rond « reporté », « ignoré », trace, « Modifié le », champs techniques (id,
// ordre, source, mode d'affichage LOC / UTC, vol NPF, positions des feux, choix des compteurs affichés…).
import { hm, hmFixe, lireDuree, dateFr } from './temps.js';

export const PREFIXE_SUIVI = 'suivi-';
// Colonnes FlyLog ajoutées par le décodage (absentes d'un export FlyLog brut) -> champ suivi
export const COLONNES_DECODEES = { FEU: 'feux', LARGAGES_CDB_DASH: 'cpt:largCdbDash', LARGAGES_INSTRUCTION_CDB_DASH: 'cpt:largInstrCdbDash' };
export const champsAbsents = entetes => Object.entries(COLONNES_DECODEES).filter(([c]) => !entetes.includes(c)).map(([, k]) => k);
export const cleSuivi = id => PREFIXE_SUIVI + id;
export const estCleSuivi = c => typeof c === 'string' && c.startsWith(PREFIXE_SUIVI);
export const volDuSuivi = c => c.slice(PREFIXE_SUIVI.length);

const VIDE = '(vide)';
const n = x => Number(x) || 0;
const code = e => String((e && (e.code || e.nom)) || '').trim().toUpperCase();
const texte = x => (x === null || x === undefined || String(x).trim() === '' ? VIDE : String(x).trim());
const cite = x => (texte(x) === VIDE ? VIDE : `«\u00a0${String(x).trim()}\u00a0»`); // guillemets jamais seuls en bout de ligne
const heure = h => (h ? `${h} UTC` : VIDE);
// v0.67 (R164) : textes gardés TOUJOURS en heures et minutes (« 0h12 ») quel que soit le format affiché ; convertis à l'affichage
const duree = x => hmFixe(n(x));
const colonne = x => (x === null || x === undefined ? 'auto' : hmFixe(n(x)));
const DUREES = new Set(['tempsTotal', 'simTemps', 'tempsCdB', 'tempsCopi', 'tempsDC', 'tempsPICUS', 'tempsInst', 'tempsExam', 'tempsSE', 'tempsME',
  'tempsMP', 'tempsNuit', 'tempsIFR', 'tempsXC']);
const affiche = (k, txt) => { if (!DUREES.has(k)) return txt; const m = lireDuree(txt); return m === null || Number.isNaN(m) ? txt : hm(m); };
const FONCTIONS = { cdb: 'CdB', copi: 'Copi', dc: 'DC', inst: 'Inst', picus: 'PICUS', exam: 'Exam' };

// Champs suivis, dans l'ordre d'affichage : [clé, libellé, texte(vol, opts)]
const CHAMPS = [
  ['date', 'Date', v => (v.date ? dateFr(v.date) : VIDE)],
  ['dep', 'Départ', v => texte(v.dep)],
  ['hDep', 'Bloc départ', v => heure(v.hDep)],
  ['escales', 'Intermédiaires', v => (v.escales || []).map(code).filter(Boolean).join(', ') || '(aucun)'],
  ['arr', 'Arrivée', v => texte(v.arr)],
  ['hArr', 'Bloc arrivée', v => heure(v.hArr)],
  ['avionId', 'Avion', (v, o) => texte(o.immatDe(v) || v.avionId)],
  ['fonction', 'Fonction', v => FONCTIONS[v.fonction] || texte(v.fonction)],
  ['tempsTotal', 'Temps de vol', v => duree(v.tempsTotal)],
  ['simTemps', 'Simulateur', v => duree(v.simTemps)],
  ['volsGroupes', 'Vols groupés', v => (v.volsGroupes ? 'Oui' : 'Non')],
  ['tempsCdB', 'Temps CdB', v => duree(v.tempsCdB)],
  ['tempsCopi', 'Temps Copi', v => duree(v.tempsCopi)],
  ['tempsDC', 'Temps DC', v => duree(v.tempsDC)],
  ['tempsPICUS', 'Temps PICUS', v => duree(v.tempsPICUS)],
  ['tempsInst', 'Temps instructeur', v => duree(v.tempsInst)],
  ['tempsExam', 'Temps examinateur', v => duree(v.tempsExam)],
  ['tempsSE', 'Colonne SE', v => colonne(v.tempsSE)],
  ['tempsME', 'Colonne ME', v => colonne(v.tempsME)],
  ['tempsMP', 'Colonne multipilote', v => colonne(v.tempsMP)],
  ['tempsNuit', 'Nuit', v => duree(v.tempsNuit)],
  ['tempsIFR', 'IFR', v => duree(v.tempsIFR)],
  ['tempsXC', 'Navigation', v => duree(v.tempsXC)],
  ['regleIFR', 'Règles', v => (v.regleIFR ? 'IFR' : 'VFR')],
  ['approches', 'Approches', v => String(n(v.approches))],
  ['approcheType', 'Type d\'approche', v => texte(v.approcheType)],
  ['attJour', 'Att. jour', v => String(n(v.attJour))],
  ['attNuit', 'Att. nuit', v => String(n(v.attNuit))],
  ['decJour', 'Déc. jour', v => String(n(v.decJour))],
  ['decNuit', 'Déc. nuit', v => String(n(v.decNuit))],
  ['nomCdB', 'CdB', v => texte(v.nomCdB)],
  ['nomCopi', 'Copilote', v => texte(v.nomCopi)],
  ['nomEleve', 'Élève', v => texte(v.nomEleve)],
  ['nomInstructeur', 'Instructeur', v => texte(v.nomInstructeur)],
  ['nomExaminateur', 'Examinateur', v => texte(v.nomExaminateur)],
  ['indicatif', 'Indicatif', v => texte(v.indicatif)],
  ['missions', 'Mission', v => cite((v.missions || []).filter(Boolean).join(' / '))],
  ['feux', 'Feux', v => String(n(v.feux))],
  ['etiquettes', 'Étiquettes', v => (v.etiquettes || []).join(', ') || VIDE],
  ['simType', 'Type de simulateur', v => texte(v.simType)],
  ['remarques', 'Remarque', v => cite(v.remarques)],
  ['notePerso', 'Note perso', v => cite(v.notePerso)],
];
const ORDRE = new Map(CHAMPS.map(([k], i) => [k, i]));
const LIB = new Map(CHAMPS.map(([k, l]) => [k, l]));
// Valeur d'un champ absent : atterrissages d'un terrain intermédiaire absent, compteur jamais rempli
const defaut = k => (k.startsWith('cpt:') ? '0' : k.startsWith('att:') ? '—' : VIDE);

// Textes des champs suivis d'un vol : { clé: texte }. opts : { immatDe(vol) }
export function textesDuVol(v, opts = {}) {
  const o = { immatDe: () => '', ...opts }, t = {};
  if (!v) return t;
  for (const [k, , f] of CHAMPS) t[k] = f(v, o);
  for (const e of v.escales || []) { const c = code(e); if (c) t[`att:${c}`] = `${(parseInt(t[`att:${c}`], 10) || 0) + n(e.attJour) + n(e.attNuit)} att.`; }
  for (const [k, x] of Object.entries(v.compteurs || {})) if (n(x)) t[`cpt:${k}`] = String(n(x));
  return t;
}
const rang = k => (ORDRE.has(k) ? ORDRE.get(k) : k.startsWith('att:') ? 3.5 : 1000);
const trier = cles => [...cles].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b));
const valeur = (t, k) => (k in t ? t[k] : defaut(k));
export function libelleChamp(k, nomCompteur = c => c) {
  if (k.startsWith('att:')) return k.slice(4);
  if (k.startsWith('cpt:')) return nomCompteur(k.slice(4));
  return LIB.get(k) || k;
}
// Champs différents entre deux versions d'un vol (textes)
export function champsChanges(ta, tb) {
  return trier(new Set([...Object.keys(ta), ...Object.keys(tb)])).filter(k => valeur(ta, k) !== valeur(tb, k));
}

// Enregistrement d'un vol dans l'app : suivi mis à jour (champs changés pour la première fois : leur valeur d'avant devient
// l'origine) ; null = rien n'a changé dans les champs suivis
export function majSuivi(suivi, ancien, nouveau, opts = {}, maintenant = new Date().toISOString()) {
  const ta = textesDuVol(ancien, opts), tb = textesDuVol(nouveau, opts);
  const ch = champsChanges(ta, tb);
  if (!ch.length) return null;
  const o = { ...((suivi && suivi.o) || {}) };
  for (const k of ch) if (!(k in o)) o[k] = valeur(ta, k);
  return { o, le: maintenant };
}

// Rattrapage : l'origine = la version FlyLog (champs qui diffèrent du vol actuel). null = rien à changer au suivi existant.
// opts.sauf : champs absents du fichier choisi (ex. export FlyLog brut, sans les colonnes FEU / largages décodées) : jamais comparés
export function suiviDepuisFlyLog(suivi, fl, actuel, opts = {}) {
  const tf = textesDuVol(fl, opts), tc = textesDuVol(actuel, opts), sauf = new Set(opts.sauf || []);
  const ch = champsChanges(tf, tc).filter(k => !sauf.has(k));
  if (!ch.length) return null;
  const o = Object.fromEntries(ch.map(k => [k, valeur(tf, k)]));
  if (suivi && JSON.stringify(suivi.o) === JSON.stringify(o)) return null;
  return { o, le: (suivi && suivi.le) || actuel.modifieLe || null };
}

// Lignes « ancienne valeur -> nouvelle » : champs dont l'origine diffère de la valeur actuelle
export function lignesSuivi(suivi, vol, opts = {}, nomCompteur = c => c) {
  if (!suivi || !suivi.o || !vol) return [];
  const t = textesDuVol(vol, opts);
  return trier(Object.keys(suivi.o)).filter(k => valeur(t, k) !== suivi.o[k]).map(k => {
    const l = libelleChamp(k, nomCompteur);
    // format « dixième » : deux durées différentes peuvent s'écrire pareil (0h12 et 0h14 : 0.2) : on les montre alors en minutes
    let av = affiche(k, suivi.o[k]), ap = affiche(k, valeur(t, k));
    if (av === ap) { av = suivi.o[k]; ap = valeur(t, k); }
    return { k, origine: suivi.o[k], origineAffichee: av, avant: `${l} : ${av}`, apres: `${l} : ${ap}` };
  });
}
