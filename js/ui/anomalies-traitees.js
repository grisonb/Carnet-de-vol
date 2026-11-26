// v0.62 (R156) : Plus › « Anomalies traitées » : onglets « Corrigées » et « Ignorées », question et bouton du rattrapage depuis le
// fichier FlyLog d'origine. Affichage seulement : aucune ligne ne modifie un vol (ni ses heures, ni « Modifié le »).
import { $, esc, toast, lireFichierTexte, ouvrirOutil, pause } from './commun.js';
import { etat, reglage, enregistrerReglage, ecrireReglageDiscret, enregistrerVol, enConsultation, surChangement } from '../etat.js';
import { anomaliesDe, anomaliesBrutes, TRIANGLE } from './anomalies.js';
import { nePlusIgnorer } from '../anomalies.js';
import { corrigeesAffichees, ignoreesAffichees, nombreDeVols, libelleAnomalie, correctionALaSaisie, ajouterCorrigees, rattrapage } from '../anomalies-traitees.js';
import { analyserFlyLog } from '../flylog.js';
import { terrain } from '../terrains.js';
import { typesConnus } from './avions.js';
import { dateFr } from '../temps.js';

const immatDe = v => (etat.avions.get(v && v.avionId) || {}).immat || '';
const trajet = v => [v.dep, ...(v.escales || []).map(e => e.code || e.nom), v.arr].filter(Boolean).join(' → ');
const jour = iso => (iso ? dateFr(String(iso).slice(0, 10)) : '');

function listes() {
  const parId = new Map(etat.vols.map(v => [v.id, v]));
  const corrigees = corrigeesAffichees(reglage('anomaliesCorrigees'), parId).map(x => ({ ...x, vol: parId.get(x.volId) }));
  const ignorees = ignoreesAffichees(etat.vols, anomaliesBrutes());
  return { corrigees, ignorees };
}

// Badge jaune de Plus (nombre de vols dans la liste ; caché à 0)
export function majBadgeAnomalies() {
  const b = $('#pl-anom-n');
  if (!b) return;
  $('#pl-anom-i').innerHTML = TRIANGLE;
  const { corrigees, ignorees } = listes(), nb = nombreDeVols(corrigees, ignorees);
  b.textContent = String(nb);
  b.hidden = !nb;
}

// ---------- Écran ----------
let onglet = 'corrigees';
const tete = v => `<div class="lv-h"><span>${esc(dateFr(v.date))}</span><span class="lv-av">${esc(immatDe(v))}</span></div><div class="lv-tr">${esc(trajet(v))}</div>`;
function ligneCorrigee(x) {
  const chg = x.l.map(a => `<div class="lv-q">${esc(libelleAnomalie(a.cle))}</div><div class="lv-chg">${a.avant.length ? `<span class="lv-av-v">${esc(a.avant.join(' · '))}</span> → ` : ''}<span class="lv-ap">${esc(a.apres.join(' · '))}</span></div>`).join('');
  return `<div class="lv" role="button" tabindex="0" data-vol="${esc(x.volId)}">${tete(x.vol)}${chg}<div class="lv-q">${x.le ? `Corrigé le ${jour(x.le)}` : 'Corrigé : date inconnue'}</div></div>`;
}
function ligneIgnoree(x) {
  const an = [...new Set(x.anomalies.map(a => libelleAnomalie(a.cle)))].map(t => `<div class="lv-q">${esc(t)}</div>`).join('');
  return `<div class="lv" role="button" tabindex="0" data-vol="${esc(x.id)}">${tete(x.vol)}${an}<div class="lv-q">${x.le ? `Ignoré le ${jour(x.le)}` : 'Ignoré'}</div>
    <button type="button" class="lv-btn" data-np="${esc(x.id)}">Ne plus ignorer</button></div>`;
}
export function ecranAnomaliesTraitees() {
  const { corrigees, ignorees } = listes();
  const fait = reglage('rattrapageCorrections');
  const c = ouvrirOutil('Anomalies traitées', `
    <div class="an-onglets" role="tablist">
      <button type="button" role="tab" id="at-c" aria-selected="${onglet === 'corrigees'}">Corrigées (${corrigees.length})</button>
      <button type="button" role="tab" id="at-i" aria-selected="${onglet === 'ignorees'}">Ignorées (${ignorees.length})</button></div>
    <div id="at-l">${onglet === 'corrigees'
    ? (corrigees.map(ligneCorrigee).join('') || '<p class="hint">Aucun vol corrigé pour l\'instant. Quand tu corriges un vol qui a un « ! », il s\'ajoute ici.</p>')
    : (ignorees.map(ligneIgnoree).join('') || '<p class="hint">Aucune anomalie ignorée.</p>')}</div>
    <div class="at-bas" id="at-bas"${enConsultation() ? ' hidden' : ''}>
      <button type="button" class="bigbtn second" id="at-fl">Retrouver les corrections dans FlyLog</button>
      <p class="hint">${fait ? `Déjà fait le ${jour(fait.le)} : le refaire n'ajoute que les corrections pas encore dans la liste. ` : ''}Le fichier FlyLog d'origine est lu sur cet appareil ; il n'est ni gardé, ni envoyé au NAS.</p></div>`);
  c.querySelector('#at-c').addEventListener('click', () => { onglet = 'corrigees'; ecranAnomaliesTraitees(); });
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
export async function noterCorrection(avant, ancien, nouveau) {
  if (!avant.length || enConsultation()) return;
  const e = correctionALaSaisie(avant, anomaliesBrutes().get(nouveau.id) || [], ancien, nouveau, immatDe);
  if (e) await enregistrerReglage('anomaliesCorrigees', ajouterCorrigees(reglage('anomaliesCorrigees'), [e]));
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
  if (res.nouvelles.length) await enregistrerReglage('anomaliesCorrigees', ajouterCorrigees(reglage('anomaliesCorrigees'), res.nouvelles));
  await enregistrerReglage('rattrapageCorrections', { le: new Date().toISOString(), n: res.corrections });
  $('#rq-modal').hidden = true;
  onglet = 'corrigees';
  ecranAnomaliesTraitees();
  toast(`${res.corrections} correction${res.corrections > 1 ? 's' : ''} retrouvée${res.corrections > 1 ? 's' : ''}`, 4000);
  const p = document.createElement('p');
  p.className = 'at-res'; p.id = 'at-res';
  p.textContent = `${res.corrections} correction${res.corrections > 1 ? 's' : ''} retrouvée${res.corrections > 1 ? 's' : ''}` + (res.nonRetrouves ? ` · ${res.nonRetrouves} vol${res.nonRetrouves > 1 ? 's' : ''} du fichier pas retrouvé${res.nonRetrouves > 1 ? 's' : ''} dans le carnet (ignoré${res.nonRetrouves > 1 ? 's' : ''})` : '');
  $('#ou-c').prepend(p);
}

// ---------- Question au premier lancement de la v0.62 ----------
// Réglage PRIVÉ `questionCorrections` : 'a-poser' (carnet avec des vols FlyLog à l'arrivée de cette version), 'non' (carnet vide :
// rien à retrouver), 'posee'. Réglage PARTAGÉ `rattrapageCorrections` : fait sur un appareil -> jamais demandé sur les autres.
const aDemander = () => reglage('questionCorrections') === 'a-poser' && !reglage('rattrapageCorrections') && !enConsultation();
export async function initAnomaliesTraitees() {
  $('#pl-anom').addEventListener('click', ecranAnomaliesTraitees);
  $('#file-rq').addEventListener('change', fichierChoisi);
  $('#rq-non').addEventListener('click', async () => { $('#rq-modal').hidden = true; await ecrireReglageDiscret('questionCorrections', 'posee'); });
  $('#rq-oui').addEventListener('click', async () => { $('#rq-modal').hidden = true; await ecrireReglageDiscret('questionCorrections', 'posee'); choisirFichier(); });
  if (reglage('questionCorrections') === undefined) {
    await ecrireReglageDiscret('questionCorrections', etat.vols.some(v => v.source === 'flylog') ? 'a-poser' : 'non');
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
