// État de l'app en mémoire + enregistrement dans IndexedDB.
// Les 4000+ vols sont gardés en mémoire (quelques Mo) : recherche et totaux restent rapides.

import * as db from './db.js';
import { comparerRecentDabord, horodater, COMPTEURS_DEFAUT, nomPersonne, migrerAvionsV04 } from './modele.js';
import { definirTerrainsPerso } from './terrains.js';
import { BANDE_DEFAUT } from './bande.js';
import { REGLES_DEFAUT, missionsConnues } from './missions.js';
import { REGLAGES_PRIVES } from './sauvegarde.js';
import { indexPersonnes, nomAffiche, personneDuTexte } from './personnes.js';
import { REGLAGES_PARTAGES } from './synchro.js';
import { listeCompteurs } from './compteurs.js';

export const etat = {
  vols: [],            // du plus récent au plus ancien
  avions: new Map(),   // id -> avion
  personnes: [],
  reglages: {},
  ecouteurs: new Set(),
  revision: 0,         // augmente à chaque changement (sert à ne recalculer les totaux que si besoin)
};

export const ETIQUETTES_DEFAUT = ['BOMBING', 'TRANSPORT', 'TAILWHEEL'];

export function reglage(cle) {
  const defauts = {
    compteurs: COMPTEURS_DEFAUT, regles: REGLES_DEFAUT, etiquettes: ETIQUETTES_DEFAUT,
    missionsAjoutees: [], titulaire: '', derniereSauvegarde: null, reference: null, terrainsPerso: {}, missionsMasquees: [], bandeHeures: BANDE_DEFAUT,
    compteursFiches: {}, compteursTypes: {}, // v0.56 (R144)
    volsGroupesTypes: {}, // v0.58 (R149)
  };
  return etat.reglages[cle] ?? defauts[cle];
}

// v0.56 (R144) : tous les compteurs (nom choisi, compté dans les Totaux, masqué), dans l'ordre choisi
export const listeDesCompteurs = () => listeCompteurs(reglage('compteursFiches'), reglage('compteurs'));

export async function charger() {
  const [vols, avions, personnes, reglages] = await Promise.all([
    db.tout('vols'), db.tout('avions'), db.tout('personnes'), db.lireReglages()]);
  etat.vols = vols.sort(comparerRecentDabord);
  etat.avions = new Map(avions.map(a => [a.id, a]));
  etat.personnes = personnes;
  etat.reglages = reglages;
  etat.revision++;
  definirTerrainsPerso(reglage('terrainsPerso'));
  await migrer();
}

// Mises à jour des données enregistrées par une version précédente (une seule fois, rien n'est perdu)
async function migrer() {
  if (!etat.reglages.migrationV04) {
    const modifies = migrerAvionsV04([...etat.avions.values()]);
    if (modifies.length) await db.enregistrer({ avions: modifies });
    etat.reglages.migrationV04 = new Date().toISOString();
    await db.ecrireReglage('migrationV04', etat.reglages.migrationV04);
  }
}

// Terrain ajouté à la main par le pilote (enregistré dans ses données, pas dans le code)
export async function enregistrerTerrainPerso(code, t) {
  if (refuseEnConsultation()) return false;
  const liste = { ...reglage('terrainsPerso'), [code.toUpperCase()]: t };
  definirTerrainsPerso(liste);
  await enregistrerReglage('terrainsPerso', liste);
}

// v0.23 : appareil en CONSULTATION (PC qui reçoit le carnet du téléphone) : rien ne se modifie ici.
// Garde-fou au niveau des données (en plus des boutons cachés) : toute écriture du carnet est refusée et signalée.
export const enConsultation = () => etat.reglages.synchroRole === 'consultation';
function refuseEnConsultation() {
  if (!enConsultation()) return false;
  document.dispatchEvent(new CustomEvent('consultation-refus'));
  return true;
}

export function prevenir() { etat.revision++; for (const f of etat.ecouteurs) f(); }
export const surChangement = f => etat.ecouteurs.add(f);

// Réglage propre au téléphone (copie NAS…) : enregistré sans prévenir les écrans (ne déclenche pas de copie)
export async function ecrireReglageDiscret(cle, valeur) {
  etat.reglages[cle] = valeur;
  await db.ecrireReglage(cle, valeur);
}

export async function enregistrerReglage(cle, valeur) {
  if (REGLAGES_PARTAGES.includes(cle) && refuseEnConsultation()) return false; // réglage du carnet
  etat.reglages[cle] = valeur;
  // v0.49 (R123) : un réglage partagé garde l'heure de sa modification (elle voyage avec lui : le plus récent gagne)
  if (REGLAGES_PARTAGES.includes(cle)) await db.enregistrer({ reglages: [{ cle, valeur, modifieLe: new Date().toISOString() }] });
  else await db.ecrireReglage(cle, valeur);
  prevenir();
}

// v0.61 (R154) : { garderDate: true } = le rond « reporté sur le carnet papier » : ce n'est pas une modification du vol
// (« Modifié le » du CSV inchangé ; la synchro a sa propre heure, reporteLe)
export async function enregistrerVol(vol, { garderDate = false } = {}) {
  if (refuseEnConsultation()) return false;
  if (!(garderDate && vol.modifieLe)) horodater(vol);
  if (!vol.ordre) vol.ordre = Date.now();
  await db.enregistrer({ vols: [vol] });
  const i = etat.vols.findIndex(v => v.id === vol.id);
  if (i >= 0) etat.vols[i] = vol; else etat.vols.push(vol);
  etat.vols.sort(comparerRecentDabord);
  // nouvelles étiquettes
  const et = reglage('etiquettes');
  const nouvelles = (vol.etiquettes || []).filter(t => !et.includes(t));
  if (nouvelles.length) await enregistrerReglage('etiquettes', [...et, ...nouvelles]);
  prevenir();
}

export async function supprimerVol(id) {
  if (refuseEnConsultation()) return false;
  await db.supprimer('vols', id);
  etat.vols = etat.vols.filter(v => v.id !== id);
  prevenir();
}

// « Annuler » après une suppression : le vol revient exactement à l'identique (même id, mêmes dates)
export async function restaurerVol(vol) {
  if (refuseEnConsultation()) return false;
  await db.remettre('vols', vol);
  if (!etat.vols.some(v => v.id === vol.id)) etat.vols.push(vol);
  etat.vols.sort(comparerRecentDabord);
  prevenir();
}

export async function enregistrerAvion(a) {
  if (refuseEnConsultation()) return false;
  horodater(a);
  await db.enregistrer({ avions: [a] });
  etat.avions.set(a.id, a);
  prevenir();
}

// Plusieurs avions d'un coup (ex. codes ADS-B reçus du serveur), un seul rafraîchissement
export async function enregistrerAvions(liste) {
  if (!liste.length || enConsultation()) return; // (codes ADS-B reçus : sans message)
  for (const a of liste) horodater(a);
  await db.enregistrer({ avions: liste });
  for (const a of liste) etat.avions.set(a.id, a);
  prevenir();
}

// Traces ADS-B stockées (affichage seulement ; hors sauvegarde)
export const lireTrace = id => db.lire('traces', id);
export const ecrireTrace = rec => db.enregistrer({ traces: [rec] });

export async function enregistrerPersonne(p) {
  if (refuseEnConsultation()) return false;
  horodater(p);
  await db.enregistrer({ personnes: [p] });
  const i = etat.personnes.findIndex(x => x.id === p.id);
  if (i >= 0) etat.personnes[i] = p; else etat.personnes.unshift(p);
  prevenir();
}

// v0.55 (R136) : fiche personne corrigée : la fiche et les vols où elle apparaît, en une seule écriture
export async function enregistrerPersonneEtVols(p, vols) {
  if (refuseEnConsultation()) return false;
  horodater(p);
  for (const v of vols) horodater(v);
  await db.enregistrer({ personnes: [p], vols });
  const i = etat.personnes.findIndex(x => x.id === p.id);
  if (i >= 0) etat.personnes[i] = p; else etat.personnes.unshift(p);
  for (const v of vols) { const k = etat.vols.findIndex(x => x.id === v.id); if (k >= 0) etat.vols[k] = v; }
  prevenir();
}

// v0.55 (R136) : index « texte enregistré dans un vol -> personne » (refait seulement si le carnet a changé)
let indexCache = null, indexCle = null;
export function indexDesPersonnes() {
  if (!indexCache || indexCle !== etat.revision || indexCache.liste !== etat.personnes || indexCache.n !== etat.personnes.length) {
    indexCache = { index: indexPersonnes(etat.personnes), liste: etat.personnes, n: etat.personnes.length };
    indexCle = etat.revision;
  }
  return indexCache.index;
}
export const nomAfficheVol = texte => nomAffiche(texte, indexDesPersonnes());

export async function supprimerPersonne(id) {
  if (refuseEnConsultation()) return false;
  await db.supprimer('personnes', id);
  etat.personnes = etat.personnes.filter(p => p.id !== id);
  prevenir();
}

// Import FlyLog : tout est écrit en une seule transaction
export async function enregistrerImport(r) {
  if (refuseEnConsultation()) return false;
  await db.enregistrer({ vols: r.aCreer, avions: r.avions, personnes: r.personnes });
  for (const a of r.avions) etat.avions.set(a.id, a);
  etat.personnes.push(...r.personnes);
  etat.vols.push(...r.aCreer);
  etat.vols.sort(comparerRecentDabord);
  const et = reglage('etiquettes');
  const nouvelles = r.etiquettes.filter(t => !et.includes(t));
  if (nouvelles.length) await enregistrerReglage('etiquettes', [...et, ...nouvelles]);
  prevenir();
}

export async function contenuComplet() {
  const [vols, avions, personnes, suppressions, reglages] = await Promise.all(
    ['vols', 'avions', 'personnes', 'suppressions', 'reglages'].map(m => db.tout(m)));
  return { vols, avions, personnes, suppressions, reglages };
}

// Réglages partagés qui étaient privés avant : une sauvegarde sans eux n'efface pas la valeur du téléphone
const GARDES_SI_VIDES = ['cartesMotDePasse'];
export async function restaurer(donnees) {
  // Mots de passe, adresse et état de la copie NAS ne sont pas dans la sauvegarde : on garde ceux du téléphone
  const prives = REGLAGES_PRIVES.filter(k => etat.reglages[k] !== undefined).map(k => [k, etat.reglages[k]]);
  // v0.55 (R138) : réglage devenu partagé, absent (ou vide) d'une sauvegarde plus ancienne : celui du téléphone est gardé
  const fichier = new Map((donnees.reglages || []).map(r => [r.cle, r.valeur]));
  for (const k of GARDES_SI_VIDES) if (etat.reglages[k] && !fichier.get(k)) prives.push([k, etat.reglages[k]]);
  await db.remplacerTout({ ...donnees, reglages: (donnees.reglages || []).filter(r => !REGLAGES_PRIVES.includes(r.cle)) });
  for (const [k, v] of prives) await db.ecrireReglage(k, v);
  await charger();
  prevenir();
}

export const avionDe = vol => etat.avions.get(vol.avionId) || null;
export const listeMissions = () => missionsConnues(etat.vols, reglage('missionsAjoutees'), reglage('missionsMasquees'));
export const trouverPersonne = nom => personneDuTexte(nom, indexDesPersonnes()) || etat.personnes.find(p => nomPersonne(p).toUpperCase() === String(nom).toUpperCase());
