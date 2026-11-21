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
  ajusterSocle();
}

// v0.51 (R125) : taille des cases d'après leur largeur. Coefficient --sck commun aux deux cases : 1 quand la case a sa
// largeur d'un écran de 360 px (titre 17, J- 26, date 17), proportionnel au-delà, au plus 30 / 26 (J- 30, titre et date
// 19,6) ; jamais moins de 10 px de marge de chaque côté (le contenu le plus large des deux cases décide : « J+12 »…).
const SCK_MAX = 30 / 26, MARGE = 10, ECART = 8;
export function ajusterSocle() {
  const z = $('#h-socle');
  if (!z || z.hidden || !z.clientWidth) return; // caché : refait quand le carnet réapparaît (ajusterEntete)
  const cases = [...z.querySelectorAll('.sc')];
  if (!cases.length) return;
  const largeur = cases[0].clientWidth;
  const largeur360 = (360 - (innerWidth - z.clientWidth) - ECART) / cases.length; // largeur d'une case sur un écran de 360 px
  // tailles arrondies au pixel entier (Chrome arrondit les mesures d'une police fractionnaire : le centrage serait faussé)
  // sans text-box : seulement des tailles VÉRIFIÉES au pixel (titre / J-) : à certaines tailles (titre 18, J- 29…), l'ancien
  // Chrome dessine le texte jusqu'à 0,75 px de travers ; on prend le plus grand couple qui ne dépasse pas la taille voulue
  const verifiees = AVEC_TEXT_BOX() ? null : [[17, 26], [19, 28], [20, 30]];
  const poser = k => {
    const [t, j] = verifiees ? verifiees.filter(([, jj]) => jj <= Math.max(26, Math.round(26 * k))).at(-1) : [Math.round(17 * k), Math.round(26 * k)];
    const kk = verifiees ? Math.min(k, j / 26) : k; // (contenu trop large : on retombe sur un couple plus petit, voir plus bas)
    z.style.setProperty('--sc-j', j + 'px'); z.style.setProperty('--sc-t', t + 'px'); z.style.setProperty('--sc-e', Math.round(7 * kk) + 'px');
  };
  let k = Math.min(SCK_MAX, Math.max(1, largeur / largeur360));
  for (let i = 0; i < 4; i++) {
    poser(k);
    const contenu = Math.max(...cases.map(c => c.querySelector('.sc-l').scrollWidth));
    if (contenu <= largeur - 2 * MARGE) break;
    k *= (largeur - 2 * MARGE) / contenu * 0.98;
  }
  if (!AVEC_TEXT_BOX()) rognerSansTextBox(z);
}
// Navigateurs sans text-box (Chrome avant la v133…) : chaque morceau est rogné à son ENCRE, mesurée ici même (ligne de base
// réelle dans ce navigateur + hauteur de l'encre du texte) : des marges fixes ne suffisent pas, Chrome arrondit ses mesures
// de police différemment selon la taille.
const AVEC_TEXT_BOX = () => !!(window.CSS && CSS.supports && CSS.supports('text-box', 'trim-both cap alphabetic'));
let toile = null;
function rognerSansTextBox(z) {
  toile = toile || document.createElement('canvas').getContext('2d');
  for (const s of z.querySelectorAll('.sc-l>span')) {
    s.style.marginTop = s.style.marginBottom = '0px'; s.style.alignSelf = '';
    const st = getComputedStyle(s), repere = document.createElement('i');
    repere.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    s.append(repere);
    const haut = s.getBoundingClientRect().top, base = repere.getBoundingClientRect().top - haut, h = s.getBoundingClientRect().height;
    repere.remove();
    // encre mesurée sur une police de 1000 px puis ramenée à la taille (Chrome arrondit ces mesures au pixel entier)
    const taille = parseFloat(st.fontSize);
    toile.font = `${st.fontWeight} 1000px ${st.fontFamily}`;
    // hauteur des capitales (« H ») et ligne de base, comme text-box « cap alphabetic » (pas l'encre exacte du texte : la
    // barre « / » et l'arrondi de certains chiffres la font varier d'un texte à l'autre)
    const m = toile.measureText('H'), asc = m.actualBoundingBoxAscent * taille / 1000, desc = 0;
    // v0.52 : posé en haut de la case, ligne de base au centre de l'encre, calée sur un pixel de l'ÉCRAN (coordonnées de la
    // page : l'ancien Chrome y cale le texte ; sinon le centrage dépendait de la position exacte de la case)
    const dpr = devicePixelRatio || 1, caseHaut = s.parentElement.getBoundingClientRect().top;
    const ideale = caseHaut + (s.parentElement.clientHeight - asc - desc) / 2 + asc, calee = Math.round(ideale * dpr) / dpr;
    s.style.alignSelf = 'flex-start';
    s.style.marginTop = `${calee - caseHaut - base}px`;
    s.style.marginBottom = '0px';
    void h;
  }
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
