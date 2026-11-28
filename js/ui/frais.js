// v0.68 (R166) : frais d'escale : zone de la fiche du vol (v0.70 : VOL JOURNÉE / DÉTACHEMENT / J.1 / J.2), fenêtre « Détachement »,
// Plus › Frais d'escale (une ligne par année ; barème de l'année, liste, total, PDF). Calcul : js/frais.js.
// Ce n'est pas une donnée du carnet EASA : cocher une case n'écrit que vol.frais (sans changer « Modifié le », sans alerte R150,
// sans ligne « Anomalies traitées »).
import { $, esc, toast, ouvrirOutil, proposerFichier, enchainerDates } from './commun.js';
import { etat, reglage, enregistrerReglage, enregistrerVolsFrais, enConsultation } from '../etat.js';
import { lignesFrais, anneeFrais, anneesFrais, baremeDe, euros, lireMontant, detachementDe, detachementsActifs, nuitsDe, cleBareme, cleDetachement,
  PREFIXE_DETACHEMENT, PREFIXE_BAREME, titreLigne, typeLigne, lieuLigne, montantLigne, paysDuBareme, paysAuto, nomBareme, nomAuto, nuitsAilleurs, changerCase, typeDuVol } from '../frais.js';
import { estSimulation as estSimulationFrais } from '../modele.js';
import { terrain } from '../terrains.js';
import { nomPays } from '../pays.js';
import { ajouterJours, dateFr, heureH, dureeAffichee, aujourdhui } from '../temps.js';
const norm = t => String(t || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
import { dixiemesAvion } from '../vols-groupes.js';
import { remarqueCarnet } from '../missions.js';
import { nomFichier } from '../sauvegarde.js';
import { nouvelId } from '../modele.js';

// ---------- Données ----------
export function donneesFrais() {
  const detachements = [], baremes = new Map();
  for (const [k, v] of Object.entries(etat.reglages)) {
    if (!v) continue;
    if (k.startsWith(PREFIXE_DETACHEMENT)) detachements.push(v);
    else if (k.startsWith(PREFIXE_BAREME)) baremes.set(k.slice(PREFIXE_BAREME.length), v);
  }
  return { vols: etat.vols, detachements, baremes, paysDe };
}
// v0.70 (R178) : code OACI -> nom du pays (même correspondance que les drapeaux ; outre-mer à part)
export const paysDe = code => nomPays((terrain(code) || {}).pays);
let cache = { cle: null, lignes: [] };
export function lignesActuelles() {
  const cle = `${etat.revision}|${etat.vols.length}`;
  if (cache.cle !== cle || cache.vols !== etat.vols) cache = { cle, vols: etat.vols, lignes: lignesFrais(donneesFrais()) };
  return cache.lignes;
}
// v0.69 (R170) : détachements (pour le cercle noir de l'accueil), recalculés seulement quand le carnet change
let cacheDet = { cle: null, dets: [] };
export function detachementsActuels() {
  if (cacheDet.cle !== etat.revision) cacheDet = { cle: etat.revision, dets: donneesFrais().detachements };
  return cacheDet.dets;
}
// v0.71 (R180) : le vol a des frais (sa propre case, ou sa date dans un détachement) : cercle noir de l'accueil
export const aDesFrais = v => !estSimulationFrais(v) && !!typeDuVol(v, detachementsActuels());

// ---------- Zone de la fiche du vol ----------
// ctx : { id (vol enregistré) | null, date: () => 'AAAA-MM-JJ', change: () => void } ; vol nouveau : sa case est gardée ici
// (fraisNouveau) et enregistrée avec le vol. v0.71 (R183) : les changements faits dans la fiche (cases, pays de la nuit) restent
// EN ATTENTE (attente : id -> vol avec sa nouvelle case) jusqu'à « Valider » (validerFrais) ; « Fermer » les abandonne.
const NOUVEAU = '__nouveau-vol__';
let ctx = null, fraisNouveau = null, attente = new Map();
export function afficherFrais(c) { ctx = c; fraisNouveau = null; attente = new Map(); rendreFrais(); }
export const fraisPourNouveauVol = () => fraisNouveau;
export const fraisEnAttente = () => attente.size > 0;
// Case en attente pour ce vol (undefined : rien en attente)
export const fraisAttenduPour = id => (attente.has(id) ? attente.get(id).frais : undefined);
export function abandonnerFrais() { attente = new Map(); fraisNouveau = null; }
// Enregistre les cases en attente (sauf celle du vol `sauf`, enregistrée avec lui), « Modifié le » gardé
export async function validerFrais({ sauf = null } = {}) {
  const liste = [...attente.values()].filter(x => x.id !== sauf).map(x => { const v = etat.vols.find(y => y.id === x.id); return v ? { ...v, frais: x.frais } : null; }).filter(Boolean);
  attente = new Map();
  if (liste.length && await enregistrerVolsFrais(liste) === false) return false;
  return true;
}
const volsVus = () => (attente.size ? etat.vols.map(v => attente.get(v.id) || v) : etat.vols);
const lignesVues = () => (attente.size ? lignesFrais({ ...donneesFrais(), vols: volsVus() }) : lignesActuelles());
const volEnregistre = () => (ctx && ctx.id ? etat.vols.find(v => v.id === ctx.id) || null : null);
const dateCourante = () => { const v = volEnregistre(); return v ? v.date : (ctx && ctx.date()) || ''; };
const volsDuJour = date => volsVus().filter(v => v.date === date && !estSimulationFrais(v));
// v0.71 (R180) : la case de CE vol (en attente d'abord)
const fraisCourant = () => {
  const v = volEnregistre();
  if (!v) return fraisNouveau;
  const a = fraisAttenduPour(v.id);
  return a !== undefined ? a : v.frais || null;
};
// v0.69 (R169) : choix du pays = champ avec la liste des pays du barème de l'année (recherche en tapant les premières lettres)
function listePays(annee) {
  const id = `pays-${annee}`;
  let dl = document.getElementById(id);
  if (!dl) { dl = document.createElement('datalist'); dl.id = id; document.body.append(dl); }
  dl.innerHTML = baremeDe(donneesFrais().baremes, annee).pays.map(p => `<option value="${esc(p.nom)}"></option>`).join('');
  return id;
}
function poserPays(el, annee, valeur) { el.setAttribute('list', listePays(annee)); el.value = valeur || ''; el.dataset.avant = el.value; el.dataset.annee = annee; }
// Valeur tapée -> nom du barème (accents et majuscules ignorés) ; inconnu : message, l'ancienne valeur revient ; null si refusé
function lirePays(el) {
  const p = paysDuBareme(baremeDe(donneesFrais().baremes, el.dataset.annee), el.value);
  if (p) { el.value = p.nom; el.dataset.avant = p.nom; return p.nom; }
  if (el.value.trim()) toast(`« ${el.value.trim()} » n'est pas dans le barème ${el.dataset.annee} : ajoute-le dans Plus › Frais d'escale`, 3500);
  el.value = el.dataset.avant || '';
  return null;
}
// v0.70 (R178) : pays de la nuit du J.1 : choisi à la main (gardé) ; sinon celui du dernier atterrissage du jour ; inconnu : vide
function paysJ1(date, f) {
  const a = date.slice(0, 4), b = donneesFrais().baremes;
  if (f && f.paysManuel && f.pays) return { pays: nomBareme(b, a, f.pays), manuel: true };
  const auto = paysAuto(volsDuJour(date), date, paysDe);
  return { pays: auto ? nomAuto(b, a, auto.pays) : null, manuel: false, code: auto ? auto.code : '' };
}
// Ligne de frais de ce vol (pour un vol nouveau : celle de sa date et de sa case)
function ligneDuVol(date, type) {
  const l = lignesVues().filter(x => x.type !== 'detachement');
  if (ctx && ctx.id) { const x = l.find(y => y.vols.some(v => v.id === ctx.id)); if (x) return x; }
  if (type === 'journee') return l.find(x => x.id === `journee|${date}`) || null;
  if (type === 'j1') return l.find(x => (x.sorte === 'paire' || x.sorte === 'j1') && x.du === date) || null;
  return l.find(x => (x.sorte === 'paire' && x.au === date) || (x.sorte === 'j2' && x.du === date)) || null;
}
export function rendreFrais() {
  if (!ctx) return;
  const date = dateCourante(), d = donneesFrais(), det = date ? detachementDe(d.detachements, date) : null, f = fraisCourant();
  const type = det ? 'detachement' : (f && f.type) || null;
  document.querySelectorAll('#fe-zone [data-fe]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.fe === type)));
  $('#fe-pays-z').hidden = type !== 'j1';
  if (type === 'j1') {
    const p = paysJ1(date, f), el = $('#fe-pays');
    poserPays(el, date.slice(0, 4), p.pays);
    el.placeholder = 'Pays à choisir';
    el.classList.toggle('manque', !p.pays);
    $('#fe-pays-z').classList.toggle('manuel', p.manuel);
  }
  $('#fe-voir').hidden = !det;
  let info = '';
  const b = baremeDe(d.baremes, (date || aujourdhui()).slice(0, 4)), n = date && type ? volsDuJour(date).filter(v => (v.frais && v.frais.type) === type).length : 0;
  const tous = n > 1 ? ` (${n} vols cochés ce jour)` : '';
  const l = date && type && !det ? ligneDuVol(date, type) : null;
  if (det) info = `Fait partie du détachement du ${dateFr(det.du)} au ${dateFr(det.au)}`;
  else if (type === 'journee') info = (b.journee === null || b.journee === undefined ? `Vol journée : montant à saisir (Plus › Frais d'escale › ${b.annee})` : `Vol journée${tous} : ½ indemnité zone euro = ${euros(b.journee)}`);
  else if (type === 'j1' || type === 'j2') {
    if (!l || l.incomplet) info = type === 'j1' ? 'J.1 incomplet : coche aussi le J.2 du lendemain' : 'J.2 incomplet : coche aussi le J.1 de la veille';
    else if (l.manquant && !l.pays) info = 'Pays de la nuit à choisir sur le J.1';
    else info = `${type === 'j1' ? `Avec le J.2 du ${dateFr(l.au).slice(0, 5)}` : `Avec le J.1 du ${dateFr(l.du).slice(0, 5)}`} : 2 jours, nuit ${l.pays}, ${l.detail.replace(' indemnité', '')} = ${montantLigne(l)}`;
  }
  $('#fe-info').textContent = info;
  $('#fe-info').hidden = !info;
}
// v0.71 (R180 / R181 / R183) : changements mis en attente (vol nouveau : sa case gardée ici) ; le bouton Valider s'allume
function mettreEnAttente(changes) {
  for (const x of changes) { if (x.id === NOUVEAU) fraisNouveau = x.frais; else attente.set(x.id, x); }
  rendreFrais();
  if (ctx && ctx.change) ctx.change();
}
// Vols vus + le vol nouveau (pas encore enregistré) à sa date
function volsAvecNouveau() {
  const l = volsVus(), date = dateCourante();
  return volEnregistre() || !date ? l : [...l, { id: NOUVEAU, date, hDep: '', frais: fraisNouveau }];
}
function choisirCase(t) {
  if (!ctx || enConsultation()) return;
  const date = dateCourante(), d = donneesFrais(), det = date ? detachementDe(d.detachements, date) : null;
  if (det) { ouvrirDetachement(det); return; } // le vol fait partie d'un détachement : on le modifie (ou le supprime) là
  if (t === 'detachement') {
    if (!date) { toast('Choisis d\'abord la date du vol.'); return; }
    ouvrirDetachement(null, { du: date });
    return;
  }
  if (!date) { toast('Choisis d\'abord la date du vol.'); return; }
  mettreEnAttente(changerCase(volsAvecNouveau(), ctx.id || NOUVEAU, t));
}

// ---------- Fenêtre « Détachement » ----------
let dt = null, dtApres = null;
export function ouvrirDetachement(det, { du, apres } = {}) {
  if (enConsultation()) return;
  dt = det ? { ...det, nuits: { ...(det.nuits || {}) } } : { id: nouvelId(), du, au: ajouterJours(du, 1), pays: 'France', nuits: {}, nouveau: true };
  dtApres = apres || null;
  $('#dt-du').value = dt.du; $('#dt-au').value = dt.au;
  $('#dt-del').hidden = !!dt.nouveau;
  $('#dt-err').textContent = '';
  rendreDetachement();
  $('#dt-modal').hidden = false;
}
function rendreDetachement() {
  const annee = (dt.du || aujourdhui()).slice(0, 4);
  poserPays($('#dt-pays'), annee, dt.pays);
  // v0.71 : au plus un an (une date en cours de frappe, ex. année 0020, ne fait plus calculer des siècles de nuits)
  const valide = dt.du && dt.au && dt.du <= dt.au && dt.du >= '1900' && (Date.parse(dt.au) - Date.parse(dt.du)) / 864e5 <= 366;
  const d0 = donneesFrais(), n = valide ? nuitsDe(dt, { vols: etat.vols.filter(v => v.date >= dt.du && v.date <= dt.au && !estSimulationFrais(v)), paysDe: c => nomAuto(d0.baremes, annee, paysDe(c)) }) : [];
  // v0.70 (R178) : nuit = pays du dernier atterrissage du jour (code affiché) ; choisie à la main : gardée, en jaune
  $('#dt-nuits').innerHTML = n.map(x => `<div class="dt-nuit${x.manuel ? ' modifie' : ''}"><span>Nuit du ${dateFr(x.date).slice(0, 5)}${x.code ? ` <small class="dt-code">${esc(x.code)}</small>` : ''}</span><input class="pays-in" data-nuit="${x.date}" autocomplete="off" aria-label="Nuit du ${dateFr(x.date)}"></div>`).join('')
    || '<p class="hint">Aucune nuit (un seul jour).</p>';
  for (const el of document.querySelectorAll('#dt-nuits [data-nuit]')) { const p = n.find(x => x.date === el.dataset.nuit).pays; poserPays(el, el.dataset.nuit.slice(0, 4), p); el.dataset.avantNuit = p || ''; } // barème de l'année de la nuit
  const d = donneesFrais(), autres = d.detachements.filter(x => x.id !== dt.id);
  const ls = valide ? lignesFrais({ vols: etat.vols, detachements: [...autres, dt], baremes: d.baremes, paysDe }).filter(x => x.detachementId === dt.id) : [];
  const l = ls.length > 1 ? { ...ls[0], montant: ls.reduce((s2, x) => s2 + x.montant, 0), manquant: ls.some(x => x.manquant), vols: ls.flatMap(x => x.vols), detail: ls.map(x => x.detail).join(' + ') } : ls[0] || null;
  const vols = l ? l.vols : [];
  $('#dt-vols').textContent = vols.length ? `Vols de la période : ${vols.map(v => dateFr(v.date).slice(0, 5)).join(', ')} (cochés « Détachement » tout seuls)` : 'Aucun vol à ces dates (les jours sans vol comptent aussi).';
  $('#dt-calc').textContent = l ? `${l.zone === 'monde' ? 'Zone Monde' : 'Zone euro'}, ${l.jours} jour${l.jours > 1 ? 's' : ''} : ${l.detail}` : '';
  $('#dt-montant').textContent = l ? montantLigne(l) : '—';
}
function erreurDetachement() {
  if (!dt.du || !dt.au) return 'Choisis les dates du détachement.';
  if (dt.du > dt.au) return 'La date « Au » doit être après la date « Du ».';
  if ((Date.parse(dt.au) - Date.parse(dt.du)) / 864e5 > 366) return 'Un détachement dure au plus un an.';
  const autre = detachementsActifs(donneesFrais().detachements).find(x => x.id !== dt.id && x.du <= dt.au && x.au >= dt.du);
  if (autre) return `Ces dates chevauchent le détachement du ${dateFr(autre.du)} au ${dateFr(autre.au)}.`;
  return '';
}
async function enregistrerDetachement() {
  const err = erreurDetachement();
  if (err) { $('#dt-err').textContent = err; return; }
  const nuits = Object.fromEntries(Object.entries(dt.nuits).filter(([d, p]) => d >= dt.du && d < dt.au && p)); // v0.70 : un choix à la main est toujours gardé
  const { nouveau, ...val } = dt;
  if (await enregistrerReglage(cleDetachement(dt.id), { ...val, nuits, le: new Date().toISOString() }) === false) return;
  $('#dt-modal').hidden = true;
  const f = dtApres; dt = null; dtApres = null;
  if (f) await f();
  rendreFrais(); rafraichirEcran();
}
async function supprimerDetachement() {
  if (!dt || dt.nouveau) return;
  if (await enregistrerReglage(cleDetachement(dt.id), { id: dt.id, supprime: true, le: new Date().toISOString() }) === false) return;
  $('#dt-modal').hidden = true; dt = null;
  toast('Détachement supprimé');
  rendreFrais(); rafraichirEcran();
}

// ---------- Plus › Frais d'escale ----------
let anneeOuverte = null;
const rafraichirEcran = () => { if (!$('#outil').hidden && anneeOuverte && $('#fa-l')) ecranAnneeFrais(anneeOuverte); else if (!$('#outil').hidden && $('#fr-l')) ecranFrais(); };
export function ecranFrais() {
  anneeOuverte = null;
  const lignes = lignesActuelles(), annees = anneesFrais(lignes);
  const c = ouvrirOutil('Frais d\'escale', `
    <p class="hint" style="font-size:15px">Indemnités journalières (frais réels) : coche « Vol journée », « Détachement », « J.1 » ou « J.2 » dans la fiche d'un vol (la case vaut pour toute la journée). Une ligne par année.</p>
    <div class="flist" id="fr-l">${annees.map(a => `<button type="button" class="pitem fr-an" data-an="${a}"><b>${a}</b><span>${euros(anneeFrais(lignes, a).total)} ›</span></button>`).join('')
      || '<p class="hint">Aucun vol coché pour l\'instant.</p>'}</div>`);
  c.querySelector('#fr-l').addEventListener('click', e => { const b = e.target.closest('[data-an]'); if (b) ecranAnneeFrais(b.dataset.an); });
}
// v0.69 (R169) : lignes du barème : « bulletin » (barème officiel intégré), « modifié » (saisi à la main, passe avant), « ajouté »
const TAGS = { bulletin: 'bulletin', modifie: 'modifié', ajoute: 'ajouté' };
const montantTexte = c => (c === null || c === undefined ? '' : euros(c).replace(' €', ''));
function htmlBareme(b) {
  const ligne = (p, i) => {
    const off = p.officiel, france = p.nom.toUpperCase() === 'FRANCE', fixe = !!off || france;
    const per = (off && p.source === 'bulletin' ? off.periodes : []).map(x => `${x.du === '01-01' ? '' : `dès le ${x.du.slice(3)}/${x.du.slice(0, 2)}`}${x.au !== '12-31' ? `${x.du === '01-01' ? 'jusqu\'au' : ' au'} ${x.au.slice(3)}/${x.au.slice(0, 2)}` : ''} : ${euros(x.montant)}`);
    const info = [...per, off && p.note ? p.note : '', p.source === 'modifie' && off ? `bulletin : ${off.montant === null ? 'montant daté' : euros(off.montant)} (${off.zone === 'monde' ? 'Monde' : 'Euro-Europe'})` : ''].filter(Boolean).join(' · ');
    // ligne du bulletin : compacte (nom, montant ; zone et marque dessous) ; la zone suit le bulletin (modifiable : pays ajouté)
    if (off) return `<div class="fb-row fb-off fb-${p.source}" data-i="${i}" data-off="${off.montant ?? ''}" data-offz="${off.zone}">
      <input class="fb-nom" value="${esc(p.nom)}" aria-label="Pays" readonly>
      <input class="fb-m" value="${montantTexte(p.montant)}" inputmode="decimal" placeholder="${off.montant !== null ? montantTexte(off.montant) : 'Montant'}" aria-label="Montant ${esc(p.nom)}">
      <input type="hidden" class="fb-z" value="${p.zone}">
      <small class="fb-info"><span class="fb-tag fb-t-${p.source}">${TAGS[p.source]}</span>${p.zone === 'monde' ? 'Monde' : 'Euro-Europe'}${info ? ` · ${esc(info)}` : ''}</small></div>`;
    return `<div class="fb-row${b.officiel ? ` fb-${p.source}` : ''}" data-i="${i}">
      <input class="fb-nom" value="${esc(p.nom)}" placeholder="Pays" autocapitalize="words" aria-label="Pays" ${fixe ? 'readonly' : ''}>
      <input class="fb-m" value="${montantTexte(p.montant)}" inputmode="decimal" placeholder="${off && off.montant !== null ? montantTexte(off.montant) : 'Montant'}" aria-label="Montant ${esc(p.nom)}">
      <select class="fb-z" aria-label="Zone ${esc(p.nom)}"><option value="euro"${p.zone !== 'monde' ? ' selected' : ''}>Euro-Europe</option><option value="monde"${p.zone === 'monde' ? ' selected' : ''}>Monde</option></select>
      ${fixe ? '<span></span>' : '<button type="button" class="xbtn fb-x" aria-label="Retirer ce pays"><svg class="ix" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button>'}
      ${b.officiel || info ? `<small class="fb-info">${b.officiel ? `<span class="fb-tag fb-t-${p.source}">${TAGS[p.source]}</span>` : ''}${esc(info)}</small>` : ''}</div>`;
  };
  const pays = [...b.pays].sort((x, y) => (x.nom.toUpperCase() === 'FRANCE' ? -1 : y.nom.toUpperCase() === 'FRANCE' ? 1 : 0));
  const nm = nbModifies(b);
  return `<div class="sec fb"><h3>Barème ${esc(b.annee)}</h3>
      ${b.officiel ? `<p class="hint fb-src">Barème du bulletin intégré (${esc(b.source)}). Un montant saisi passe avant ; laissé vide : celui du bulletin.</p>` : ''}
      <div class="fb-j"><label for="fb-j">Vol journée${b.officiel ? ` <span class="fb-tag fb-t-${b.journeeModifiee ? 'modifie' : 'bulletin'}">${b.journeeModifiee ? 'modifié' : 'bulletin'}</span>` : ''}</label>
        <input id="fb-j" inputmode="decimal" placeholder="${b.journeeOfficielle !== null ? montantTexte(b.journeeOfficielle) : 'Montant'}" value="${montantTexte(b.journee)}"></div>
      <button type="button" class="fb-plier" id="fb-plier" aria-expanded="false" aria-controls="fb-plie"><span><b>Pays (${pays.length})</b>${nm ? `<small class="fb-nm">${nm} modifié${nm > 1 ? 's' : ''} par toi</small>` : ''}</span><span class="fb-fl" id="fb-fl">▼ Afficher</span></button>
      <div id="fb-plie" hidden>
      ${pays.length > 8 ? '<input class="search fb-q" id="fb-q" placeholder="Rechercher un pays" autocomplete="off" aria-label="Rechercher un pays">' : ''}
      <div id="fb-pays">${pays.map(ligne).join('')}</div>
      <button type="button" class="bigbtn second" id="fb-add">+ Pays</button>
      </div>
      <p class="apname bad" id="fb-err"></p>
      <button type="button" class="bigbtn" id="fb-ok">Enregistrer le barème</button></div>`;
}
// v0.70 (R171) : nombre de lignes modifiées par toi (bulletin : modifiées ou ajoutées ; année sans bulletin : pays avec un montant)
export const nbModifies = b => b.pays.filter(p => (b.officiel ? p.source === 'modifie' || p.source === 'ajoute' : p.montant !== null && p.montant !== undefined)).length;
// Ce qui est gardé : seulement ce qui diffère du bulletin (montant ou zone), et les pays ajoutés
function lireBareme(annee) {
  const b0 = baremeDe(donneesFrais().baremes, annee);
  const j = lireMontant($('#fb-j').value);
  if (Number.isNaN(j)) return { err: 'Vol journée : montant invalide (ex. 87,00)' };
  const pays = [], vus = new Set();
  for (const r of document.querySelectorAll('#fb-pays .fb-row')) {
    const nom = r.querySelector('.fb-nom').value.trim().replace(/\s+/g, ' '), m = lireMontant(r.querySelector('.fb-m').value), zone = r.querySelector('.fb-z').value;
    if (!nom) continue;
    if (Number.isNaN(m)) return { err: `${nom} : montant invalide (ex. 174,00)` };
    if (vus.has(nom.toUpperCase())) return { err: `${nom} : pays en double` };
    vus.add(nom.toUpperCase());
    if ('off' in r.dataset) {
      const off = r.dataset.off === '' ? null : Number(r.dataset.off);
      if ((m !== null && m !== off) || zone !== r.dataset.offz) pays.push({ nom, montant: m, zone });
    } else pays.push({ nom, montant: m, zone });
  }
  const journee = b0.officiel && j === b0.journeeOfficielle ? null : j;
  return { b: { annee: String(annee), journee, pays } };
}
export function ecranAnneeFrais(annee) {
  anneeOuverte = String(annee);
  const d = donneesFrais(), b = baremeDe(d.baremes, annee), a = anneeFrais(lignesActuelles(), annee);
  // v0.70 (R175 / R176 / R174) : en tête « date · type » et le montant ; trajet dans une bande ; J.1 + J.2 : deux lignes ; détachement :
  // son pays et les nuits passées ailleurs ; calcul en bas
  const ligne = x => { const b = blocsLigne(x); return `<div class="lv fr-l${x.incomplet ? ' incomplet' : ''}" role="button" tabindex="0" data-ligne="${esc(x.id)}">
      ${b.jours.map((j, i) => `${i ? `<div class="lv-h fr-j2"><span>${esc(j.titre)}</span></div>` : `<div class="lv-h"><span>${esc(j.titre)}</span><span class="fr-m${x.manquant ? ' manquant' : ''}">${esc(b.montant)}</span></div>`}
      ${j.etapes ? `<div class="traj">${esc(j.etapes)}</div>` : ''}`).join('')}
      ${b.pastilles.length ? `<div class="fr-nus">${b.pastilles.map(t => `<span class="nu">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="lv-q">${esc(b.bas)}</div></div>`; };
  const c = ouvrirOutil(`Frais d'escale ${anneeOuverte}`, `${htmlBareme(b)}
    <div id="fa-l">${a.lignes.map(ligne).join('') || '<p class="hint">Aucune ligne cette année.</p>'}</div>
    <div class="tline fr-tot"><span>Total ${anneeOuverte}</span><b id="fa-tot">${euros(a.total)}</b></div>
    <button type="button" class="bigbtn" id="fa-pdf">Exporter ${anneeOuverte} en PDF</button>
    <button type="button" class="bigbtn second" id="fa-ret">Toutes les années</button>`);
  // v0.70 (R171) : liste des pays repliée ; un appui la déplie (recherche comprise), un autre la replie
  const plier = ouvert => { $('#fb-plie').hidden = !ouvert; $('#fb-plier').setAttribute('aria-expanded', String(ouvert)); $('#fb-fl').textContent = ouvert ? '▲ Masquer' : '▼ Afficher'; };
  c.querySelector('#fb-plier').addEventListener('click', () => plier($('#fb-plie').hidden));
  c.querySelector('#fb-add').addEventListener('click', () => {
    const div = document.createElement('div'); div.innerHTML = htmlBareme({ annee, journee: null, pays: [{ nom: '', montant: null, zone: 'euro' }, { nom: '', montant: null, zone: 'euro' }] });
    const r = div.querySelectorAll('.fb-row')[1]; r.dataset.i = String(document.querySelectorAll('#fb-pays .fb-row').length);
    $('#fb-pays').append(r); r.querySelector('.fb-nom').focus();
  });
  c.querySelector('#fb-pays').addEventListener('click', e => { const x = e.target.closest('.fb-x'); if (x) x.closest('.fb-row').remove(); });
  const q = c.querySelector('#fb-q');
  if (q) q.addEventListener('input', () => { const t = norm(q.value); for (const r of document.querySelectorAll('#fb-pays .fb-row')) r.hidden = !!t && !norm(r.querySelector('.fb-nom').value).includes(t); });
  c.querySelector('#fb-ok').addEventListener('click', async () => {
    const r = lireBareme(annee);
    if (r.err) { $('#fb-err').textContent = r.err; return; }
    if (await enregistrerReglage(cleBareme(annee), { ...r.b, le: new Date().toISOString() }) === false) return;
    toast(`Barème ${annee} enregistré`);
    ecranAnneeFrais(annee);
  });
  c.querySelector('#fa-l').addEventListener('click', e => {
    const el = e.target.closest('[data-ligne]'); if (!el) return;
    const x = a.lignes.find(l => l.id === el.dataset.ligne); if (!x) return;
    if (x.detachementId) { ouvrirDetachement(d.detachements.find(t => t.id === x.detachementId)); return; }
    if (x.vols[0]) document.dispatchEvent(new CustomEvent('ouvrir-vol-retour', { detail: { id: x.vols[0].id, retour: () => ecranAnneeFrais(annee) } }));
  });
  c.querySelector('#fa-l').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-ligne]')) { e.preventDefault(); e.target.click(); } });
  c.querySelector('#fa-pdf').addEventListener('click', () => exporterPdf(annee));
  c.querySelector('#fa-ret').addEventListener('click', ecranFrais);
}

// ---------- PDF de l'année ----------
const FONCTIONS = { cdb: 'CdB', copi: 'Copi', dc: 'DC', inst: 'Inst' };
// Texte pour les polices du PDF (Latin-1 + « € »)
const pdfTexte = s => String(s ?? '').replace(/→/g, '->').replace(/[–—−]/g, '-').replace(/[‘’ʼ]/g, "'").replace(/[«»“”]/g, '"').replace(/[  ]/g, ' ')
  .replace(/[^\x00-\xFF€]/g, '?');
// Modèle du PDF (sans dessin : testé à part). Renvoie { titre, bareme, resume: [[libellé, nombre, montant]], lignes: [{ titre, montant, detail, vols: [[cellules]] }] }
export function modelePdf(annee, donnees = donneesFrais()) {
  const a = anneeFrais(lignesFrais(donnees), annee), b = baremeDe(donnees.baremes, annee);
  const r = a.resume;
  const bareme = [`vol journée ${b.journee === null || b.journee === undefined ? 'montant manquant' : euros(b.journee)}`,
    ...b.pays.map(p => `${p.nom} ${p.montant === null || p.montant === undefined ? 'montant manquant' : euros(p.montant)} (${p.zone === 'monde' ? 'Monde' : 'Euro-Europe'})`)].join(' · ');
  const vol = v => {
    const av = etat.avions.get(v.avionId), dx = dixiemesAvion(av, reglage('dixiemesTypes'));
    return [dateFr(v.date).slice(0, 6) + v.date.slice(2, 4), v.dep || '', heureH(v.hDep || ''), v.arr || '', heureH(v.hArr || ''), (av && (av.typeOACI || av.modele)) || '',
      (av && av.immat) || '', dureeAffichee(v.tempsTotal || v.simTemps || 0, dx), FONCTIONS[v.fonction] || v.fonction || '', remarqueCarnet(v) || ''];
  };
  const chrono = [...a.lignes].reverse();
  return {
    titre: `Frais d'escale ${a.annee}`, bareme: `Barème ${a.annee} utilisé : ${bareme}`,
    resume: [['Vols journée', String(r.journee.n), euros(r.journee.montant)], ['J.1 / J.2', String(r.j2.n), euros(r.j2.montant)],
      ['Détachements', r.detachement.n ? `${r.detachement.n} (${r.detachement.jours} jours, ${r.detachement.nuits} nuits)` : '0', euros(r.detachement.montant)],
      [`Total ${a.annee}`, '', euros(a.total)]],
    // v0.69 (R168) : toutes les étapes ; (R167) partie d'un détachement à cheval sur deux années : « début » / « suite »
    etapes: chrono.map(x => [titreLigne(x), x.jourVols && x.jourVols.length > 1 ? x.jourVols.map(j => j.etapes).join(' / ') : x.etapes || '', montantLigne(x)]),
    // v0.70 (R175 / R176) : même présentation que la liste ; les vols du carnet restent sous chaque ligne
    lignes: chrono.map(x => {
      const b = blocsLigne(x);
      return { titre: b.jours[0].titre, montant: b.montant, jours: b.jours, pastilles: b.pastilles, partie: b.partie,
        detail: [x.type === 'detachement' && x.nuits.length ? `Nuits : ${x.nuits.map(n => `${dateFr(n.date).slice(0, 5)} ${n.pays}`).join(' · ')}` : '', b.bas].filter(Boolean).join(' — '),
        vols: x.vols.map(vol) };
    }),
  };
}
// Blocs d'une ligne (liste et PDF) : jours [{ titre, etapes }], montant, pastilles, texte du bas
export function blocsLigne(x) {
  const montant = montantLigne(x), pastilles = nuitsAilleurs(x);
  const partie = x.partie ? `${x.partie === 'debut' ? 'Début' : 'Suite'} du détachement du ${dateFr(x.detachementDu)} au ${dateFr(x.detachementAu)}` : '';
  const bas = [lieuLigne(x), x.detail].filter(Boolean).join(' · ');
  if (x.type === 'detachement') return { jours: [{ titre: titreLigne(x), etapes: x.pays || '' }], montant, pastilles, partie, bas: partie ? `${partie} · ${bas}` : bas };
  if (x.sorte === 'paire') return { jours: x.jourVols.map((j, i) => ({ titre: `${dateFr(j.date)} · ${i ? 'J.2' : 'J.1'}`, etapes: j.etapes })), montant, pastilles, partie, bas };
  return { jours: [{ titre: titreLigne(x), etapes: x.etapes || '' }], montant, pastilles, partie, bas };
}
const COLS = [['Date', 17], ['Dép.', 13], ['Heure', 12], ['Arr.', 13], ['Heure', 12], ['Type', 13], ['Immat.', 17], ['Tps vol', 13], ['Fonction', 15], ['Remarque', 0]];
export function dessinerPdf(jsPDF, m) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }), G = 12, L = 210 - 2 * G;
  let y = 16;
  const page = h => { if (y + h > 285) { doc.addPage(); y = 14; } };
  const txt = (t, x, yy, o) => doc.text(pdfTexte(t), x, yy, o);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); txt(m.titre, G, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80);
  for (const l of doc.splitTextToSize(pdfTexte(m.bareme), L)) { txt(l, G, y); y += 4; }
  doc.setTextColor(0); y += 3;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); txt('RÉSUMÉ', G, y); y += 2;
  doc.setFontSize(9.5);
  for (const [lib, n, mt] of m.resume) {
    doc.setFont('helvetica', lib.startsWith('Total') ? 'bold' : 'normal');
    doc.rect(G, y, L, 6); txt(lib, G + 2, y + 4.2); txt(n, G + L - 45, y + 4.2, { align: 'right' }); txt(mt, G + L - 2, y + 4.2, { align: 'right' }); y += 6;
  }
  // v0.69 (R168) : chaque ligne avec toutes ses étapes
  doc.setFontSize(8);
  for (const [t, et, mt] of m.etapes || []) {
    const lignes = doc.splitTextToSize(pdfTexte(et), L - 95), h = Math.max(1, lignes.length) * 3.6 + 1.8;
    page(h); doc.setFont('helvetica', 'normal'); doc.rect(G, y, L, h);
    txt(doc.splitTextToSize(pdfTexte(t), 62)[0], G + 2, y + 3.6); lignes.forEach((l, i) => txt(l, G + 66, y + 3.6 + i * 3.6)); txt(mt, G + L - 2, y + 3.6, { align: 'right' }); y += h;
  }
  y += 4;
  const largeurs = COLS.map(c => c[1]), reste = L - largeurs.reduce((s, x) => s + x, 0);
  for (const l of m.lignes) {
    page(22);
    doc.setDrawColor(27, 36, 51); doc.setLineWidth(0.5); doc.line(G, y, G + L, y); doc.setLineWidth(0.2); doc.setDrawColor(150);
    y += 5; doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); txt(l.montant, G + L, y, { align: 'right' });
    // v0.70 (R175 / R176) : « date · type », puis le trajet en gras dans une bande bleu clair avec un trait à gauche
    (l.jours || [{ titre: l.titre, etapes: l.etapes }]).forEach((j, i) => {
      if (i) { page(6); y += 1.5; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
      for (const t of doc.splitTextToSize(pdfTexte(j.titre), L - 40)) { txt(t, G, y); y += 4.5; }
      if (!j.etapes) return;
      doc.setFontSize(9); const tl = doc.splitTextToSize(pdfTexte(j.etapes), L - 6), h = tl.length * 4 + 2.4;
      page(h); doc.setFillColor(232, 241, 251); doc.rect(G, y - 1.2, L, h, 'F'); doc.setFillColor(43, 108, 176); doc.rect(G, y - 1.2, 1.2, h, 'F');
      doc.setTextColor(27, 36, 51); tl.forEach((t, k) => txt(t, G + 4, y + 2.6 + k * 4)); doc.setTextColor(0); y += h + 1.2;
    });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    if (l.pastilles && l.pastilles.length) { page(5); txt(l.pastilles.join('   '), G, y + 1); y += 5; }
    doc.setTextColor(80);
    for (const d of doc.splitTextToSize(pdfTexte(l.detail), L)) { page(5); txt(d, G, y); y += 4; }
    doc.setTextColor(0);
    if (!l.vols.length) { y += 2; continue; }
    page(12);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    let x = G;
    COLS.forEach(([t], i) => { const w = largeurs[i] || reste; doc.setFillColor(238, 242, 247); doc.rect(x, y, w, 5, 'FD'); txt(t, x + w / 2, y + 3.5, { align: 'center' }); x += w; });
    y += 5; doc.setFont('helvetica', 'normal');
    for (const row of l.vols) {
      page(5); x = G;
      row.forEach((cel, i) => {
        const w = largeurs[i] || reste, t = doc.splitTextToSize(pdfTexte(cel), w - 1.5)[0] || '';
        doc.rect(x, y, w, 5); txt(t, i === COLS.length - 1 ? x + 1 : x + w / 2, y + 3.5, i === COLS.length - 1 ? undefined : { align: 'center' }); x += w;
      });
      y += 5;
    }
    y += 3;
  }
  return doc;
}
function exporterPdf(annee) {
  if (!window.jspdf) { toast('Module PDF pas encore chargé, réessaie.'); return; }
  const doc = dessinerPdf(window.jspdf.jsPDF, modelePdf(annee));
  proposerFichier(doc.output('blob'), nomFichier(`frais-escale-${annee}`, 'pdf'));
}

// ---------- Démarrage ----------
export function initFrais() {
  $('#pl-frais').addEventListener('click', ecranFrais);
  $('#fe-zone').addEventListener('click', e => { const b = e.target.closest('[data-fe]'); if (b) choisirCase(b.dataset.fe); });
  // v0.70 (R178) : pays du J.1 changé à la main : gardé (paysManuel), sur tous les vols du jour
  $('#fe-pays').addEventListener('change', async () => {
    const f = fraisCourant(), avant = $('#fe-pays').dataset.avant, p = lirePays($('#fe-pays'));
    if (!p || !f || f.type !== 'j1' || (p === avant && f.paysManuel)) return;
    // v0.70 (R178) : choisi à la main : gardé (paysManuel), sur tous les vols du jour cochés J.1 (en attente, R183)
    const le = new Date().toISOString(), date = dateCourante();
    mettreEnAttente(volsAvecNouveau().filter(v => v.date === date && ((v.id === (ctx.id || NOUVEAU)) || (v.frais && v.frais.type === 'j1'))).map(v => ({ ...v, frais: { ...(v.id === NOUVEAU ? fraisNouveau : v.frais), pays: p, paysManuel: true, le } })));
  });
  $('#fe-voir').addEventListener('click', () => { const det = detachementDe(donneesFrais().detachements, dateCourante()); if (det) ouvrirDetachement(det); });
  $('#dt-no').addEventListener('click', () => { $('#dt-modal').hidden = true; dt = null; dtApres = null; });
  $('#dt-ok').addEventListener('click', enregistrerDetachement);
  $('#dt-del').addEventListener('click', supprimerDetachement);
  enchainerDates($('#dt-du'), $('#dt-au')); // v0.71 (R184)
  for (const k of ['du', 'au']) $(`#dt-${k}`).addEventListener('change', () => { if (!dt) return; dt[k] = $(`#dt-${k}`).value; $('#dt-err').textContent = ''; rendreDetachement(); });
  // (rien n'est redessiné si le pays ne change pas : sinon la nuit qu'on vient de toucher serait remplacée)
  $('#dt-pays').addEventListener('change', () => { if (!dt) return; const p = lirePays($('#dt-pays')); if (!p || p === dt.pays) return; dt.pays = p; rendreDetachement(); });
  $('#dt-nuits').addEventListener('change', e => {
    const s = e.target.closest('[data-nuit]'); if (!s || !dt) return;
    const p = lirePays(s); if (!p || p === s.dataset.avantNuit) return;
    dt.nuits[s.dataset.nuit] = p; // v0.70 (R178) : choisi à la main : gardé, jamais remplacé ensuite
    rendreDetachement();
  });
}
// réglages reçus (synchro) : la zone se met à jour
export const paysConnu = (annee, nom) => !!paysDuBareme(baremeDe(donneesFrais().baremes, annee), nom);
