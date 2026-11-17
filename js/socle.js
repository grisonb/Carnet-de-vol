// v0.48 (R122) : socle OPS et IFR lu dans la feuille Google du pilote (web app Apps Script en lecture seule, sans clé).
// Logique pure (testée sous Node) : lecture de la réponse, échéances, jours restants, couleurs.
// L'ADRESSE de la web app n'est jamais dans le code : elle est tapée par le pilote (réglage partagé « socleAdresse »).
// Réponse : { ok: true, version: 1, aujourdhui, lu, colonnes: [{ titre, valeur: 'JJ/MM/AAAA' }, …] } ou { ok: false, erreur }.
// « avant le JJ/MM/AAAA » : le dernier jour de validité est la VEILLE.

import { ajouterJours } from './temps.js';

// v0.50 (R124) : OPS = « Vol OPS avant le » (pas « Entrainement avant le », ni « Vol OPS a partir du » : titre exact,
// sans tenir compte des majuscules, accents ni espaces)
export const SOCLE_COLONNES = { ops: 'Vol OPS avant le', ifr: 'vol IFR avant le' };
export const SOCLE_ORANGE = 5; // 5 jours ou moins restants (J-5 à J-0) : orange

// Titres comparés sans majuscules, accents ni espaces
export const normaliserTitre = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '').toLowerCase();

// « 18/12/2026 » -> « 2026-12-18 » (null si ce n'est pas une vraie date)
export function dateDeTexte(s) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(String(s || ''));
  if (!m) return null;
  const j = Number(m[1]), mo = Number(m[2]), a = Number(m[3]);
  const d = new Date(Date.UTC(a, mo - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) return null;
  return `${a}-${String(mo).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
}

// Réponse de la web app -> { ok: true, ops: { avantLe, dernier }, ifr: { … } } ou { ok: false, erreur } (texte clair)
export function lireReponseSocle(j) {
  if (!j || typeof j !== 'object') return { ok: false, erreur: 'Réponse illisible.' };
  if (j.ok !== true) return { ok: false, erreur: `La feuille répond : ${String(j.erreur || 'erreur inconnue').slice(0, 160)}` };
  const colonnes = Array.isArray(j.colonnes) ? j.colonnes : [];
  const res = { ok: true };
  for (const [cle, titre] of Object.entries(SOCLE_COLONNES)) {
    const c = colonnes.find(x => x && normaliserTitre(x.titre) === normaliserTitre(titre));
    if (!c) return { ok: false, erreur: `Colonne « ${titre} » introuvable dans la feuille.` };
    const avantLe = dateDeTexte(c.valeur);
    if (!avantLe) return { ok: false, erreur: `Colonne « ${titre} » : date illisible (« ${String(c.valeur ?? '').slice(0, 30)} »).` };
    res[cle] = { avantLe, dernier: ajouterJours(avantLe, -1) };
  }
  return res;
}

const jourUTC = iso => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
// Dernier jour de validité -> { reste (jours, négatif = dépassé), texte « J-10 » / « J-0 » / « J+3 », couleur, date « 27/11 » }
export function echeance(dernier, aujourdhui) {
  const reste = Math.round((jourUTC(dernier) - jourUTC(aujourdhui)) / 86400000);
  const texte = reste >= 0 ? `J-${reste}` : `J+${-reste}`;
  const couleur = reste > SOCLE_ORANGE ? 'vert' : reste >= 0 ? 'orange' : 'rouge';
  return { reste, texte, couleur, date: `${dernier.slice(8, 10)}/${dernier.slice(5, 7)}` };
}
