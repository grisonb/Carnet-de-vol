// v0.56 (R144) : Plus › Mes réglages › Compteurs : liste, « + Nouveau compteur », fiche (nom, compté dans les Totaux,
// Supprimer si jamais utilisé, sinon Masquer / Réafficher). Cases « Compteurs par défaut » des fiches type et avion.
// Les valeurs des vols ne sont jamais touchées : changer un nom change seulement l'affichage.

import { $, esc, toast, ouvrirOutil } from './commun.js';
import { etat, reglage, enregistrerReglage, listeDesCompteurs } from '../etat.js';
import { volsAvecCompteur, nouvelleCle, problemeNom, FEUX } from '../compteurs.js';

const nombre = n => n.toLocaleString('fr-FR');

// Cases à cocher (fiche type, fiche avion) : coches = clés cochées ; les masqués ne sont montrés que s'ils sont cochés
export function htmlCases(coches, { actif = true, attribut = 'data-cc' } = {}) {
  const c = new Set(coches);
  return listeDesCompteurs().filter(x => !x.masque || c.has(x.cle)).map(x =>
    `<button type="button" class="cbox" role="checkbox" aria-checked="${c.has(x.cle)}" ${attribut}="${esc(x.cle)}" ${actif ? '' : 'aria-disabled="true"'}>${esc(x.nom)}${x.masque ? ' <small>(masqué)</small>' : ''}</button>`).join('');
}
export const basculerCase = (coches, cle) => (coches.includes(cle) ? coches.filter(k => k !== cle) : [...coches, cle]);

export function resumeCompteurs() {
  const l = listeDesCompteurs(), m = l.filter(c => c.masque).length;
  return `${l.length} compteur${l.length > 1 ? 's' : ''}${m ? ` · ${m} masqué${m > 1 ? 's' : ''}` : ''} : créer, renommer, masquer`;
}

export function ecranCompteurs() {
  const l = listeDesCompteurs();
  const c = ouvrirOutil('Compteurs', `
    <p class="hint" style="font-size:15px">Tous tes compteurs (Feux, largages…). Touche un compteur pour le renommer ou le masquer. Ceux affichés dans la saisie se choisissent par type d'avion, par avion, ou dans le vol (« Compteurs › »).</p>
    <div class="flist" id="cp-l">${l.map(x => {
      const n = volsAvecCompteur(etat.vols, x.cle);
      return `<button type="button" class="pitem" data-cp="${esc(x.cle)}"><b>${esc(x.nom)}</b><span>${[x.masque ? 'Masqué' : '', x.totaux ? 'Compté dans les Totaux' : 'Pas dans les Totaux', n ? `${nombre(n)} vol${n > 1 ? 's' : ''}` : 'jamais utilisé'].filter(Boolean).join(' · ')}</span></button>`;
    }).join('')}</div>
    <button type="button" class="bigbtn" id="cp-add">+ Nouveau compteur</button>`);
  c.querySelector('#cp-l').addEventListener('click', e => { const b = e.target.closest('[data-cp]'); if (b) ficheCompteur(b.dataset.cp); });
  c.querySelector('#cp-add').addEventListener('click', () => ficheCompteur(null));
}

function ficheCompteur(cle) {
  const l = listeDesCompteurs(), x = cle ? l.find(c => c.cle === cle) : null;
  if (cle && !x) return ecranCompteurs();
  const utilise = x ? volsAvecCompteur(etat.vols, x.cle) : 0;
  let totaux = x ? x.totaux : true;
  // Feux : jamais supprimé (son fonctionnement « FEU n°NN » reste) ; un compteur utilisé : masqué seulement
  const suppr = x && !utilise && x.cle !== FEUX;
  const c = ouvrirOutil(x ? x.nom : 'Nouveau compteur', `<div class="sec">
    <div class="field"><label for="cp-nom">Nom</label><input class="big" id="cp-nom" value="${esc(x ? x.nom : '')}" autocomplete="off" autocapitalize="sentences" placeholder="ex. Treuillages"></div>
    <div class="tline"><span>Compté dans les Totaux</span><button type="button" class="sw" role="switch" id="cp-tot" aria-checked="${totaux}" aria-label="Compté dans les Totaux"><span></span></button></div>
    ${x ? `<p class="hint">${utilise ? `Utilisé sur ${nombre(utilise)} vol${utilise > 1 ? 's' : ''}. ` : 'Jamais utilisé. '}Changer le nom change l'affichage sur tous les vols ; les valeurs ne bougent pas.</p>` : ''}
    <p class="apname bad" id="cp-err"></p></div>
    <button type="button" class="bigbtn" id="cp-ok">Enregistrer</button>
    ${suppr ? '<button type="button" class="bigbtn second" id="cp-del" style="color:var(--feu)">Supprimer</button>' : ''}
    ${x && !suppr ? `<button type="button" class="bigbtn second" id="cp-masq">${x.masque ? 'Réafficher' : 'Masquer'}</button>
      <p class="hint">${x.masque ? 'Masqué : plus proposé dans la saisie.' : 'Masquer : il n\'est plus proposé.'} Ses valeurs restent dans tes vols, tes totaux et le CSV.</p>` : ''}
    <button type="button" class="bigbtn second" id="cp-no">Retour</button>`);
  const fiches = () => ({ ...(reglage('compteursFiches') || {}) });
  c.querySelector('#cp-tot').addEventListener('click', e => { totaux = !totaux; e.currentTarget.setAttribute('aria-checked', String(totaux)); });
  c.querySelector('#cp-no').addEventListener('click', ecranCompteurs);
  c.querySelector('#cp-ok').addEventListener('click', async () => {
    const nom = $('#cp-nom').value.trim().replace(/\s+/g, ' ');
    const err = problemeNom(nom, cle, l);
    if (err) { $('#cp-err').textContent = err; return; }
    const f = fiches(), k = cle || nouvelleCle(f);
    f[k] = { ...(f[k] || {}), nom, totaux, ...(cle ? {} : { cree: true, creeLe: new Date().toISOString() }) };
    await enregistrerReglage('compteursFiches', f);
    toast(cle ? 'Enregistré' : `« ${nom} » créé`);
    ecranCompteurs();
  });
  c.querySelector('#cp-del')?.addEventListener('click', async () => {
    if (volsAvecCompteur(etat.vols, cle)) { toast('Utilisé sur un vol : masque-le plutôt'); return; }
    const f = fiches();
    f[cle] = { ...(f[cle] || {}), supprime: true };
    await enregistrerReglage('compteursFiches', f);
    toast(`« ${x.nom} » supprimé`);
    ecranCompteurs();
  });
  c.querySelector('#cp-masq')?.addEventListener('click', async () => {
    const f = fiches();
    f[cle] = { ...(f[cle] || {}), masque: !x.masque };
    await enregistrerReglage('compteursFiches', f);
    toast(x.masque ? `« ${x.nom} » réaffiché` : `« ${x.nom} » masqué`);
    ecranCompteurs();
  });
}
