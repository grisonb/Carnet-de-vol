// v0.48 (R122) : socle OPS et IFR sur l'accueil (cases sous la bande des heures) et réglage Plus › Socle OPS / IFR.
// Adresse de la web app Google : réglage PARTAGÉ « socleAdresse » (synchro NAS, sauvegarde, copie NAS : elle revient seule
// sur un nouvel appareil) ; jamais dans le code ni les tests. Dernière lecture réussie : réglage PRIVÉ « socleLu »
// (cet appareil seulement). Lecture : au lancement, au retour au premier plan, au bouton d'actualisation, quand l'adresse
// change (saisie, synchro, restauration) ; 20 s au plus ; une seule à la fois. Sans adresse : aucune case, aucun appel.

import { $, esc, toast, ouvrirOutil, fermerOutil } from './commun.js';
import { reglage, enregistrerReglage, ecrireReglageDiscret, surChangement } from '../etat.js';
import { aujourdhui } from '../temps.js';
import { lireReponseSocle, echeance } from '../socle.js';

const DELAI = 20000;
const enLigne = () => navigator.onLine !== false;
const adresse = () => String(reglage('socleAdresse') || '').trim();

// Une demande à la web app : { statut: 'ok', socle } ou { statut: <échec>, erreur (texte clair) }
async function demander(url) {
  if (!url) return { statut: 'inactif', erreur: 'Adresse pas réglée.' };
  if (!/^https?:\/\/\S+$/i.test(url)) return { statut: 'adresse', erreur: 'Adresse invalide (elle commence par https://).' };
  if (!enLigne()) return { statut: 'horsLigne', erreur: 'Pas de réseau.' };
  const arret = new AbortController(), minuterie = setTimeout(() => arret.abort(), DELAI);
  try {
    const r = await fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'follow', signal: arret.signal });
    if (!r.ok) return { statut: 'http', erreur: `La feuille ne répond pas (HTTP ${r.status}).` };
    let j = null;
    try { j = await r.json(); } catch { return { statut: 'illisible', erreur: 'Réponse illisible (ce n\'est pas l\'adresse de la web app ?).' }; }
    const s = lireReponseSocle(j);
    return s.ok ? { statut: 'ok', socle: s } : { statut: 'feuille', erreur: s.erreur };
  } catch (e) {
    return { statut: 'injoignable', erreur: arret.signal.aborted ? 'Pas de réponse en 20 s.' : 'Feuille injoignable (réseau ?).' };
  } finally { clearTimeout(minuterie); }
}

let lecture = null;
// Lecture de l'adresse réglée ; une seule à la fois (un 2e appel reçoit la même)
export function lireSocle() {
  const url = adresse();
  if (!url) { afficherSocle(); return Promise.resolve({ statut: 'inactif' }); }
  if (lecture) return lecture;
  lecture = (async () => {
    const r = await demander(url);
    if (r.statut === 'ok' && adresse() === url) {
      await ecrireReglageDiscret('socleLu', { le: aujourdhui(), ops: r.socle.ops, ifr: r.socle.ifr });
    }
    afficherSocle();
    return r;
  })().catch(() => ({ statut: 'injoignable' })).finally(() => { lecture = null; });
  return lecture;
}

// Les deux cases (grises si la dernière lecture réussie n'est pas d'aujourd'hui)
export function afficherSocle() {
  const z = $('#h-socle');
  if (!z) return;
  const lu = reglage('socleLu');
  if (!adresse() || !lu || !lu.ops || !lu.ifr) { z.hidden = true; z.innerHTML = ''; return; }
  const auj = aujourdhui(), vieux = lu.le !== auj;
  z.innerHTML = [['OPS', lu.ops], ['IFR', lu.ifr]].map(([titre, x]) => {
    const e = echeance(x.dernier, auj);
    return `<div class="sc sc-${vieux ? 'gris' : e.couleur}" data-socle="${titre.toLowerCase()}" aria-label="${titre} : ${esc(e.texte)}, dernier jour le ${esc(e.date)}">`
      + `<span class="sc-l"><span class="sc-t">${titre}</span><span class="sc-j num">${esc(e.texte)}</span><span class="sc-d num">${esc(e.date)}</span></span></div>`;
  }).join('');
  z.hidden = false;
}

// ---------- Plus › Socle OPS / IFR ----------
export const resumeSocle = () => (adresse() ? (reglage('socleLu') ? `Lu le ${reglage('socleLu').le.split('-').reverse().join('/')}` : 'Adresse réglée') : 'Adresse de la feuille Google à régler');
function ecranSocle() {
  const c = ouvrirOutil('Socle OPS / IFR', `<div class="sec">
      <p class="hint" style="font-size:15px">Les cases OPS et IFR de l'accueil viennent de ta feuille Google « Socle / Hdv » (web app en lecture seule).</p>
      <div class="field"><label for="so-adr">Adresse du socle (Google)</label><input id="so-adr" type="url" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(adresse())}"></div>
      <div class="row2"><button type="button" class="ghost" id="so-test">Tester</button><button type="button" class="ghost primary" id="so-ok">Enregistrer</button></div>
      <p id="so-res" class="hint" role="status"></p>
      <p class="hint">L'adresse est gardée avec ton carnet (synchro NAS, sauvegarde de secours) : elle revient seule sur un nouvel appareil. Vide = pas de cases sur l'accueil.</p>
    </div>`);
  const res = c.querySelector('#so-res');
  c.querySelector('#so-test').addEventListener('click', async () => {
    res.textContent = 'Test en cours…'; res.className = 'hint';
    const r = await demander(c.querySelector('#so-adr').value.trim());
    res.textContent = r.statut === 'ok' ? 'OK · OPS et IFR lus' : r.erreur;
    res.className = r.statut === 'ok' ? 'okc' : 'koc';
  });
  c.querySelector('#so-ok').addEventListener('click', async () => {
    const v = c.querySelector('#so-adr').value.trim();
    if (v && !/^https?:\/\/\S+$/i.test(v)) { res.textContent = 'Adresse invalide (elle commence par https://).'; res.className = 'koc'; return; }
    if (await enregistrerReglage('socleAdresse', v) === false) return; // consultation : refusé (message de l'app)
    toast(v ? 'Adresse du socle enregistrée' : 'Socle retiré de l\'accueil');
    fermerOutil();
  });
}

export function initSocle() {
  $('#pl-socle').addEventListener('click', ecranSocle);
  let connue = adresse();
  // adresse changée (saisie ici, reçue par la synchro, restaurée) : lecture tout de suite ; sinon on redessine
  surChangement(() => {
    const a = adresse();
    if (a !== connue) { connue = a; if (!a) ecrireReglageDiscret('socleLu', null).then(afficherSocle); else lireSocle(); }
    else afficherSocle();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(lireSocle, 2000); });
  afficherSocle();
  setTimeout(lireSocle, 1500); // au lancement
}
