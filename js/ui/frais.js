// v0.68 (R166) : frais d'escale : zone de la fiche du vol (VOL JOURNÉE / J+2 / DÉTACHEMENT), fenêtre « Détachement »,
// Plus › Frais d'escale (une ligne par année ; barème de l'année, liste, total, PDF). Calcul : js/frais.js.
// Ce n'est pas une donnée du carnet EASA : cocher une case n'écrit que vol.frais (sans changer « Modifié le », sans alerte R150,
// sans ligne « Anomalies traitées »).
import { $, esc, toast, ouvrirOutil, proposerFichier } from './commun.js';
import { etat, reglage, enregistrerReglage, enregistrerVol, enConsultation } from '../etat.js';
import { lignesFrais, anneeFrais, anneesFrais, baremeDe, euros, lireMontant, detachementDe, detachementsActifs, nuitsDe, cleBareme, cleDetachement,
  PREFIXE_DETACHEMENT, PREFIXE_BAREME, titreLigne, datesLigne, lieuLigne, montantLigne, paysDuBareme } from '../frais.js';
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
  return { vols: etat.vols, detachements, baremes };
}
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
const ligneDuVol = id => lignesActuelles().find(x => x.vols.some(v => v.id === id)) || null;

// ---------- Zone de la fiche du vol ----------
// ctx : { id (vol enregistré) | null, date: () => 'AAAA-MM-JJ' } ; vol nouveau : la case est gardée ici et enregistrée avec le vol
let ctx = null, fraisNouveau = null;
export function afficherFrais(c) { ctx = c; fraisNouveau = null; rendreFrais(); }
export const fraisPourNouveauVol = () => fraisNouveau;
const volEnregistre = () => (ctx && ctx.id ? etat.vols.find(v => v.id === ctx.id) || null : null);
const fraisCourant = () => { const v = volEnregistre(); return v ? v.frais || null : fraisNouveau; };
const dateCourante = () => { const v = volEnregistre(); return v ? v.date : (ctx && ctx.date()) || ''; };
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
export function rendreFrais() {
  if (!ctx) return;
  const date = dateCourante(), d = donneesFrais(), det = date ? detachementDe(d.detachements, date) : null, f = fraisCourant();
  const type = det ? 'detachement' : (f && f.type) || null;
  document.querySelectorAll('#fe-zone [data-fe]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.fe === type)));
  $('#fe-pays-z').hidden = type !== 'j2';
  if (type === 'j2') poserPays($('#fe-pays'), date.slice(0, 4), (f && f.pays) || 'France');
  $('#fe-voir').hidden = !det;
  let info = '';
  const b = baremeDe(d.baremes, (date || aujourdhui()).slice(0, 4));
  if (det) info = `Fait partie du détachement du ${dateFr(det.du)} au ${dateFr(det.au)}`;
  else if (type === 'journee') info = b.journee === null || b.journee === undefined ? `Vol journée : montant à saisir (Plus › Frais d'escale › ${b.annee})` : `Vol journée : ½ indemnité zone euro = ${euros(b.journee)}`;
  else if (type === 'j2') {
    const l = volEnregistre() ? ligneDuVol(ctx.id) : null;
    if (!volEnregistre()) info = 'J+2 : regroupé avec le vol J+2 de la veille ou du lendemain une fois enregistré';
    else if (!l || l.incomplet) info = 'J+2 incomplet : coche aussi le vol de la veille ou du lendemain';
    else {
      const autre = l.vols.find(v => v.date !== date) || l.vols[0];
      info = `Regroupé avec le vol J+2 du ${dateFr(autre.date).slice(0, 5)} : 2 jours, ${l.detail.replace(' indemnité', '')} = ${montantLigne(l)}`;
    }
  }
  $('#fe-info').textContent = info;
  $('#fe-info').hidden = !info;
}
async function ecrireFrais(frais) {
  const v = volEnregistre();
  if (!v) { fraisNouveau = frais; rendreFrais(); return; }
  if (await enregistrerVol({ ...v, frais }, { garderDate: true }) === false) return;
  rendreFrais();
}
async function choisirCase(t) {
  if (!ctx || enConsultation()) return;
  const date = dateCourante(), d = donneesFrais(), det = date ? detachementDe(d.detachements, date) : null;
  if (det) { ouvrirDetachement(det); return; } // le vol fait partie d'un détachement : on le modifie (ou le supprime) là
  if (t === 'detachement') {
    if (!date) { toast('Choisis d\'abord la date du vol.'); return; }
    ouvrirDetachement(null, { du: date, apres: () => ecrireFrais({ type: null, le: new Date().toISOString() }) });
    return;
  }
  const f = fraisCourant(), le = new Date().toISOString();
  await ecrireFrais(f && f.type === t ? { type: null, le } : { type: t, ...(t === 'j2' ? { pays: (f && f.pays) || 'France' } : {}), le });
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
  const valide = dt.du && dt.au && dt.du <= dt.au;
  const n = valide ? nuitsDe(dt) : [];
  $('#dt-nuits').innerHTML = n.map(x => `<div class="dt-nuit${dt.nuits[x.date] ? ' modifie' : ''}"><span>Nuit du ${dateFr(x.date).slice(0, 5)}</span><input class="pays-in" data-nuit="${x.date}" autocomplete="off" aria-label="Nuit du ${dateFr(x.date)}"></div>`).join('')
    || '<p class="hint">Aucune nuit (un seul jour).</p>';
  for (const el of document.querySelectorAll('#dt-nuits [data-nuit]')) poserPays(el, el.dataset.nuit.slice(0, 4), n.find(x => x.date === el.dataset.nuit).pays); // barème de l'année de la nuit
  const d = donneesFrais(), autres = d.detachements.filter(x => x.id !== dt.id);
  const l = valide ? lignesFrais({ vols: etat.vols, detachements: [...autres, dt], baremes: d.baremes }).find(x => x.detachementId === dt.id) : null;
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
  const nuits = Object.fromEntries(Object.entries(dt.nuits).filter(([d, p]) => d >= dt.du && d < dt.au && p && p !== dt.pays));
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
    <p class="hint" style="font-size:15px">Indemnités journalières (frais réels) : coche « Vol journée », « J+2 » ou « Détachement » dans la fiche d'un vol. Une ligne par année.</p>
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
  return `<div class="sec fb"><h3>Barème ${esc(b.annee)}</h3>
      ${b.officiel ? `<p class="hint fb-src">Barème du bulletin intégré (${esc(b.source)}). Un montant saisi passe avant ; laissé vide : celui du bulletin.</p>` : ''}
      <div class="fb-j"><label for="fb-j">Vol journée${b.officiel ? ` <span class="fb-tag fb-t-${b.journeeModifiee ? 'modifie' : 'bulletin'}">${b.journeeModifiee ? 'modifié' : 'bulletin'}</span>` : ''}</label>
        <input id="fb-j" inputmode="decimal" placeholder="${b.journeeOfficielle !== null ? montantTexte(b.journeeOfficielle) : 'Montant'}" value="${montantTexte(b.journee)}"></div>
      ${pays.length > 8 ? '<input class="search fb-q" id="fb-q" placeholder="Rechercher un pays" autocomplete="off" aria-label="Rechercher un pays">' : ''}
      <div id="fb-pays">${pays.map(ligne).join('')}</div>
      <button type="button" class="bigbtn second" id="fb-add">+ Pays</button>
      <p class="apname bad" id="fb-err"></p>
      <button type="button" class="bigbtn" id="fb-ok">Enregistrer le barème</button></div>`;
}
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
  const ligne = x => `<div class="lv fr-l${x.incomplet ? ' incomplet' : ''}" role="button" tabindex="0" data-ligne="${esc(x.id)}">
      <div class="lv-h"><span>${esc(titreLigne(x))}</span><span class="fr-m${x.manquant ? ' manquant' : ''}">${esc(montantLigne(x))}</span></div>
      <div class="lv-tr">${esc(datesLigne(x))}</div>${x.type !== 'journee' && x.etapes ? `<div class="lv-tr fr-et">${esc(x.etapes)}</div>` : ''}<div class="lv-q">${esc(lieuLigne(x))}</div>${x.detail && !x.incomplet ? `<div class="lv-q">${esc(x.detail)}</div>` : x.incomplet ? `<div class="lv-q">${esc(x.detail)}</div>` : ''}</div>`;
  const c = ouvrirOutil(`Frais d'escale ${anneeOuverte}`, `${htmlBareme(b)}
    <div id="fa-l">${a.lignes.map(ligne).join('') || '<p class="hint">Aucune ligne cette année.</p>'}</div>
    <div class="tline fr-tot"><span>Total ${anneeOuverte}</span><b id="fa-tot">${euros(a.total)}</b></div>
    <button type="button" class="bigbtn" id="fa-pdf">Exporter ${anneeOuverte} en PDF</button>
    <button type="button" class="bigbtn second" id="fa-ret">Toutes les années</button>`);
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
    resume: [['Vols journée', String(r.journee.n), euros(r.journee.montant)], ['J+2', String(r.j2.n), euros(r.j2.montant)],
      ['Détachements', r.detachement.n ? `${r.detachement.n} (${r.detachement.jours} jours, ${r.detachement.nuits} nuits)` : '0', euros(r.detachement.montant)],
      [`Total ${a.annee}`, '', euros(a.total)]],
    // v0.69 (R168) : toutes les étapes ; (R167) partie d'un détachement à cheval sur deux années : « début » / « suite »
    etapes: chrono.map(x => [`${titreLigne(x)} · ${datesLigne(x)}`, x.etapes || '', montantLigne(x)]),
    lignes: chrono.map(x => ({
      titre: `${titreLigne(x)}${x.partie ? ` — ${x.partie === 'debut' ? 'début' : 'suite'} (détachement du ${dateFr(x.detachementDu)} au ${dateFr(x.detachementAu)})` : ''} · ${datesLigne(x)}`, montant: montantLigne(x),
      etapes: x.etapes || '',
      detail: [x.nuits.length ? `Nuit${x.nuits.length > 1 ? 's' : ''} : ${x.nuits.map(n => `${x.nuits.length > 1 ? dateFr(n.date).slice(0, 2) + ' ' : ''}${n.pays}`).join(' · ')}` : '',
        x.detail ? `calcul : ${x.detail}` : ''].filter(Boolean).join(' — '),
      vols: x.vols.map(vol),
    })),
  };
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
    for (const t of doc.splitTextToSize(pdfTexte(l.titre), L - 40)) { txt(t, G, y); y += 4.5; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    if (l.etapes) for (const t of doc.splitTextToSize(pdfTexte(`Étapes : ${l.etapes}`), L)) { page(5); txt(t, G, y); y += 4; }
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
  $('#fe-pays').addEventListener('change', async () => { const f = fraisCourant(), p = lirePays($('#fe-pays')); if (p && f && f.type === 'j2' && p !== f.pays) await ecrireFrais({ ...f, pays: p, le: new Date().toISOString() }); });
  $('#fe-voir').addEventListener('click', () => { const det = detachementDe(donneesFrais().detachements, dateCourante()); if (det) ouvrirDetachement(det); });
  $('#dt-no').addEventListener('click', () => { $('#dt-modal').hidden = true; dt = null; dtApres = null; });
  $('#dt-ok').addEventListener('click', enregistrerDetachement);
  $('#dt-del').addEventListener('click', supprimerDetachement);
  for (const k of ['du', 'au']) $(`#dt-${k}`).addEventListener('change', () => { if (!dt) return; dt[k] = $(`#dt-${k}`).value; $('#dt-err').textContent = ''; rendreDetachement(); });
  // (rien n'est redessiné si le pays ne change pas : sinon la nuit qu'on vient de toucher serait remplacée)
  $('#dt-pays').addEventListener('change', () => { if (!dt) return; const p = lirePays($('#dt-pays')); if (!p || p === dt.pays) return; dt.pays = p; for (const [d, x] of Object.entries(dt.nuits)) if (x === dt.pays) delete dt.nuits[d]; rendreDetachement(); });
  $('#dt-nuits').addEventListener('change', e => {
    const s = e.target.closest('[data-nuit]'); if (!s || !dt) return;
    const p = lirePays(s); if (!p || p === (dt.nuits[s.dataset.nuit] || dt.pays)) return;
    if (p === dt.pays) delete dt.nuits[s.dataset.nuit]; else dt.nuits[s.dataset.nuit] = p;
    rendreDetachement();
  });
}
// réglages reçus (synchro) : la zone se met à jour
export const paysConnu = (annee, nom) => !!paysDuBareme(baremeDe(donneesFrais().baremes, annee), nom);
