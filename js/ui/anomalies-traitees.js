// v0.62 (R156) : Plus › « Anomalies traitées » : onglets « Corrigées » et « Ignorées », question et bouton du rattrapage depuis le
// fichier FlyLog d'origine. Affichage seulement : aucune ligne ne modifie un vol (ni ses heures, ni « Modifié le »).
import { $, esc, toast, lireFichierTexte, ouvrirOutil, pause } from './commun.js';
import { etat, reglage, enregistrerReglages, ecrireReglageDiscret, enregistrerVol, enConsultation, surChangement, listeDesCompteurs } from '../etat.js';
import { cleSuivi, estCleSuivi, volDuSuivi, majSuivi, champsAbsents } from '../suivi.js';
import { lireCSVObjets } from '../csv.js';
import { anomaliesDe, anomaliesBrutes, TRIANGLE } from './anomalies.js';
import { nePlusIgnorer } from '../anomalies.js';
import { ignoreesAffichees, libelleAnomalie, correctionALaSaisie, ajouterCorrigees, rattrapage, cartesTraitees, nombreDeVols3, rattrapageSuivis } from '../anomalies-traitees.js';
import { analyserFlyLog } from '../flylog.js';
import { terrain } from '../terrains.js';
import { typesConnus } from './avions.js';
import { dateFr } from '../temps.js';

const immatDe = v => (etat.avions.get(v && v.avionId) || {}).immat || '';
const trajet = v => [v.dep, ...(v.escales || []).map(e => e.code || e.nom), v.arr].filter(Boolean).join(' → ');
const jour = iso => (iso ? dateFr(String(iso).slice(0, 10)) : '');

// v0.63 (R157) : suivis de tous les vols modifiés (réglages « suivi-<id> »)
const suivis = () => new Map(Object.entries(etat.reglages).filter(([k, v]) => estCleSuivi(k) && v).map(([k, v]) => [volDuSuivi(k), v]));
function nomCompteur(cle) { const c = listeDesCompteurs().find(x => x.cle === cle); return c ? c.nom : cle; }
function listes() {
  const { corrigees, modifies } = cartesTraitees({ vols: etat.vols, corrigees: reglage('anomaliesCorrigees'), suivis: suivis(), opts: { immatDe }, nomCompteur });
  const ignorees = ignoreesAffichees(etat.vols, anomaliesBrutes());
  return { corrigees, modifies, ignorees };
}

// Badge jaune de Plus (nombre de vols dans la liste ; caché à 0)
export function majBadgeAnomalies() {
  const b = $('#pl-anom-n');
  if (!b) return;
  $('#pl-anom-i').innerHTML = TRIANGLE;
  const { corrigees, modifies, ignorees } = listes(), nb = nombreDeVols3(corrigees, modifies, ignorees);
  b.textContent = String(nb);
  b.hidden = !nb;
}

// ---------- Écran ----------
let onglet = 'corrigees';
const tete = v => `<div class="lv-h"><span>${esc(dateFr(v.date))}</span><span class="lv-av">${esc(immatDe(v))}</span></div><div class="lv-tr">${esc(trajet(v))}</div>`;
const chg = (avant, apres) => `<div class="lv-chg">${avant ? `<span class="lv-av-v">${esc(avant)}</span> → ` : ''}<span class="lv-ap">${esc(apres)}</span></div>`;
// v0.63 (R157) : la ligne grise de chaque anomalie corrigée, puis TOUS les champs changés du vol (sans suivi : l'ancienne valeur liée)
function ligneCorrigee(x) {
  const gris = [...new Set(x.anomalies.map(a => libelleAnomalie(a.cle)))].map(t => `<div class="lv-q">${esc(t)}</div>`).join('');
  const champs = x.lignes ? x.lignes.map(l => chg(l.avant, l.apres)).join('')
    : x.anomalies.map(a => chg((a.avant || []).join(' · '), (a.apres || []).join(' · '))).filter((h, i) => (x.anomalies[i].apres || []).length).join('');
  return `<div class="lv" role="button" tabindex="0" data-vol="${esc(x.volId)}">${tete(x.vol)}${gris}${champs}<div class="lv-q">${x.le ? `Corrigé le ${jour(x.le)}` : 'Corrigé : date inconnue'}</div></div>`;
}
function ligneModifiee(x) {
  return `<div class="lv" role="button" tabindex="0" data-vol="${esc(x.volId)}">${tete(x.vol)}${x.lignes.map(l => chg(l.avant, l.apres)).join('')}<div class="lv-q">${x.le ? `Modifié le ${jour(x.le)}` : 'Modifié : date inconnue'}</div></div>`;
}
function ligneIgnoree(x) {
  const an = [...new Set(x.anomalies.map(a => libelleAnomalie(a.cle)))].map(t => `<div class="lv-q">${esc(t)}</div>`).join('');
  return `<div class="lv" role="button" tabindex="0" data-vol="${esc(x.id)}">${tete(x.vol)}${an}<div class="lv-q">${x.le ? `Ignoré le ${jour(x.le)}` : 'Ignoré'}</div>
    <button type="button" class="lv-btn" data-np="${esc(x.id)}">Ne plus ignorer</button></div>`;
}
export function ecranAnomaliesTraitees() {
  const { corrigees, modifies, ignorees } = listes();
  const fait = reglage('rattrapageModifications');
  const vide = { corrigees: 'Aucun vol corrigé pour l\'instant. Quand tu corriges un vol qui a un « ! », il s\'ajoute ici.',
    modifies: 'Aucun vol modifié pour l\'instant. Chaque vol que tu modifies s\'ajoute ici.', ignorees: 'Aucune anomalie ignorée.' }[onglet];
  const html = { corrigees: () => corrigees.map(ligneCorrigee), modifies: () => modifies.map(ligneModifiee), ignorees: () => ignorees.map(ligneIgnoree) }[onglet]().join('');
  const c = ouvrirOutil('Anomalies traitées', `
    <div class="an-onglets" role="tablist">
      <button type="button" role="tab" id="at-c" aria-selected="${onglet === 'corrigees'}">Corrigées (${corrigees.length})</button>
      <button type="button" role="tab" id="at-m" aria-selected="${onglet === 'modifies'}">Modifiés (${modifies.length})</button>
      <button type="button" role="tab" id="at-i" aria-selected="${onglet === 'ignorees'}">Ignorées (${ignorees.length})</button></div>
    <div id="at-l">${html || `<p class="hint">${vide}</p>`}</div>
    <div class="at-bas" id="at-bas"${enConsultation() ? ' hidden' : ''}>
      <button type="button" class="bigbtn second" id="at-fl">Retrouver les modifications dans FlyLog</button>
      <p class="hint">${fait ? `Déjà fait le ${jour(fait.le)} : le refaire n'ajoute rien en double. ` : ''}Le fichier FlyLog d'origine est lu sur cet appareil ; il n'est ni gardé, ni envoyé au NAS.</p></div>`);
  c.querySelector('#at-c').addEventListener('click', () => { onglet = 'corrigees'; ecranAnomaliesTraitees(); });
  c.querySelector('#at-m').addEventListener('click', () => { onglet = 'modifies'; ecranAnomaliesTraitees(); });
  c.querySelector('#at-i').addEventListener('click', () => { onglet = 'ignorees'; ecranAnomaliesTraitees(); });
  c.querySelector('#at-fl').addEventListener('click', choisirFichier);
  const l = c.querySelector('#at-l');
  l.addEventListener('click', async e => {
    const np = e.target.closest('[data-np]');
    if (np) {
      const v = etat.vols.find(x => x.id === np.dataset.np);
      if (v && await enregistrerVol(nePlusIgnorer(v), { garderDate: true }) !== false) { toast('Le « ! » est revenu sur ce vol'); ecranAnomaliesTraitees(); }
      return;
    }
    const lv = e.target.closest('[data-vol]');
    if (lv) document.dispatchEvent(new CustomEvent('ouvrir-vol-traite', { detail: lv.dataset.vol }));
  });
  l.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-vol]')) { e.preventDefault(); e.target.click(); } });
}

// ---------- Vol enregistré dans la saisie : anomalies disparues -> ligne « Corrigées » ----------
// À appeler AVANT l'enregistrement (anomalies affichées) puis APRÈS (le carnet a changé)
export const anomaliesAvant = id => (id ? anomaliesDe(id) : []);
// v0.63 (R157) : chaque enregistrement qui change un vol met à jour son suivi (valeur d'origine de chaque champ changé) ; une
// anomalie disparue ajoute une ligne « Corrigées » (les champs changés viennent du suivi : la ligne ne garde que l'anomalie)
export async function noterCorrection(avant, ancien, nouveau) {
  if (enConsultation()) return;
  const ecrire = [];
  const s = majSuivi(reglage(cleSuivi(nouveau.id)), ancien, nouveau, { immatDe });
  if (s) ecrire.push({ cle: cleSuivi(nouveau.id), valeur: s });
  const e = avant.length ? correctionALaSaisie(avant, anomaliesBrutes().get(nouveau.id) || [], ancien, nouveau, immatDe) : null;
  if (e) ecrire.push({ cle: 'anomaliesCorrigees', valeur: ajouterCorrigees(reglage('anomaliesCorrigees'), [{ ...e, l: e.l.map(a => ({ cle: a.cle, avant: [], apres: [] })) }]) });
  if (ecrire.length) await enregistrerReglages(ecrire);
}

// ---------- Rattrapage depuis le fichier FlyLog d'origine ----------
function choisirFichier() { $('#file-rq').value = ''; $('#file-rq').click(); }
async function fichierChoisi() {
  const f = await lireFichierTexte($('#file-rq'));
  $('#file-rq').value = '';
  if (!f || enConsultation()) return;
  const c = ouvrirOutil('Anomalies traitées', '<p class="prog">Lecture du fichier FlyLog…</p>');
  await pause();
  // Le fichier reste en mémoire le temps de la lecture : seules les lignes « Corrigées » sont gardées
  const r = analyserFlyLog(f.texte, { avions: [...etat.avions.values()] }, typesConnus());
  if (!r.ok) { c.innerHTML = `<p class="koc">${esc(r.message)}</p><button type="button" class="bigbtn second" id="at-ret">Retour</button>`; c.querySelector('#at-ret').addEventListener('click', ecranAnomaliesTraitees); return; }
  const flAvions = new Map([...etat.avions, ...r.avions.map(a => [a.id, a])]);
  const res = rattrapage({ flVols: r.aCreer, flAvions, vols: etat.vols, avions: etat.avions, terrainDe: x => terrain(x), existantes: reglage('anomaliesCorrigees') || [] });
  // v0.63 (R157) : en plus des anomalies corrigées, l'origine FlyLog de tous les champs changés depuis l'import
  // colonnes absentes du fichier choisi (export brut sans FEU / largages) : jamais comptées comme modifiées
  const sauf = champsAbsents(lireCSVObjets(f.texte).entetes);
  const su = rattrapageSuivis({ paires: res.paires, suivis: suivis(), immatFl: res.immatFl, immatIci: res.immatIci, sauf });
  const le = new Date().toISOString(), ecrire = su.suivis.map(([id, valeur]) => ({ cle: cleSuivi(id), valeur }));
  if (res.nouvelles.length) ecrire.push({ cle: 'anomaliesCorrigees', valeur: ajouterCorrigees(reglage('anomaliesCorrigees'), res.nouvelles) });
  ecrire.push({ cle: 'rattrapageCorrections', valeur: { le, n: res.corrections } }, { cle: 'rattrapageModifications', valeur: { le, n: su.modifies } });
  await enregistrerReglages(ecrire);
  $('#rq-modal').hidden = true;
  onglet = 'corrigees';
  ecranAnomaliesTraitees();
  const pl = (k, mot) => `${k} ${mot}${k > 1 ? 's' : ''}`;
  const texte = `${pl(su.modifies, 'vol')} modifié${su.modifies > 1 ? 's' : ''} retrouvé${su.modifies > 1 ? 's' : ''}`;
  toast(texte, 4000);
  const p = document.createElement('p');
  p.className = 'at-res'; p.id = 'at-res';
  p.textContent = texte + (res.corrections ? ` · ${pl(res.corrections, 'correction')} d'anomalie ajoutée${res.corrections > 1 ? 's' : ''}` : '')
    + (res.nonRetrouves ? ` · ${pl(res.nonRetrouves, 'vol')} du fichier pas retrouvé${res.nonRetrouves > 1 ? 's' : ''} dans le carnet (ignoré${res.nonRetrouves > 1 ? 's' : ''})` : '');
  $('#ou-c').prepend(p);
}

// ---------- Question au premier lancement de la v0.63 (remplace celle de la v0.62 : le rattrapage fait les deux) ----------
// Réglage PRIVÉ `questionModifications` : 'a-poser' (carnet avec des vols FlyLog à l'arrivée de cette version), 'non' (carnet vide :
// rien à retrouver), 'posee'. Réglage PARTAGÉ `rattrapageModifications` : fait sur un appareil -> jamais demandé sur les autres.
const aDemander = () => reglage('questionModifications') === 'a-poser' && !reglage('rattrapageModifications') && !enConsultation();
export async function initAnomaliesTraitees() {
  $('#pl-anom').addEventListener('click', ecranAnomaliesTraitees);
  $('#file-rq').addEventListener('change', fichierChoisi);
  $('#rq-non').addEventListener('click', async () => { $('#rq-modal').hidden = true; await ecrireReglageDiscret('questionModifications', 'posee'); });
  $('#rq-oui').addEventListener('click', async () => { $('#rq-modal').hidden = true; await ecrireReglageDiscret('questionModifications', 'posee'); choisirFichier(); });
  if (reglage('questionModifications') === undefined) {
    await ecrireReglageDiscret('questionModifications', etat.vols.some(v => v.source === 'flylog') ? 'a-poser' : 'non');
  }
  // fait sur un autre appareil (reçu par la synchro) : la question se referme
  surChangement(() => { if (!$('#rq-modal').hidden && !aDemander()) $('#rq-modal').hidden = true; });
  // un peu après le lancement (la synchro a le temps d'apporter « déjà fait »), et jamais par-dessus une autre fenêtre
  const poser = (essai = 0) => {
    if (!aDemander()) return;
    const occupe = !$('#v-saisie').hidden || document.querySelector('.modal:not([hidden]), .sheet:not([hidden])') || !$('#outil').hidden;
    if (occupe) { if (essai < 20) setTimeout(() => poser(essai + 1), 3000); return; }
    $('#rq-modal').hidden = false;
  };
  setTimeout(poser, 2500);
}
