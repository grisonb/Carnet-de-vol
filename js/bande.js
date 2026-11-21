// Bande d'heures de l'accueil (sous 3 / 7 / 30 jours) : valeurs choisies par le pilote.
// Les valeurs viennent de calculerTotaux (les mêmes calculs que l'écran Totaux).

import { hm } from './temps.js';
import { familleAvion, FAMILLES_PAR_CODE } from './modele.js';

export const BANDE_GENERAL = [
  { cle: 'tempsTotal', lib: 'Temps bloc' },
  { cle: 'simTemps', lib: 'Simulateur' },
  { cle: 'tempsCdB', lib: 'CdB' },
  { cle: 'tempsCopi', lib: 'Copi' },
  { cle: 'tempsDC', lib: 'DC' },
  { cle: 'tempsInst', lib: 'Instructeur' },
  { cle: 'tempsIFR', lib: 'IFR' },
  { cle: 'tempsNuit', lib: 'Nuit' },
  { cle: 'vols', lib: 'Vols', nombre: true },
  { cle: 'atterrissages', lib: 'Atterrissages', nombre: true },
  { cle: 'feux', lib: 'Feux', nombre: true },
  { cle: 'largCdbDash', lib: 'Largages CdB Dash', nombre: true },
];

export const BANDE_DEFAUT = ['tempsCdB', 'tempsCopi', 'tempsDC', 'tempsInst', 'tempsIFR', 'tempsNuit'];

// Types ayant trois choix (total, CdB, Copi) au lieu d'un seul (anciennes clés « type:DH8D », toujours lues)
export const TYPES_DETAILLES = ['DH8D'];
// v0.46 (R120) : familles ayant trois choix : « Dash 8 Q400 » (le total, sans le mot « total »), « … CdB », « … Copi »
export const FAMILLES_DETAILLEES = ['Dash 8 Q400'];
// v0.52 (R127) : nom AFFICHÉ d'une famille (l'identifiant interne ne change pas : les choix déjà faits restent cochés)
export const NOMS_AFFICHES = { 'Dash 8 Q400': 'Dash 8' };
export const nomAffiche = f => NOMS_AFFICHES[f] || f;

// v0.46 (R120) : choix « par type d'appareil » = un par NOM DE MODÈLE (familleAvion : DH8D -> « Dash 8 Q400 », CL2T ->
// « CL-415 », sinon le modèle de la fiche) de mes avions (pas les simulateurs), du plus d'heures au moins.
// Clés « famille:<nom> », « familleCdB:<nom> », « familleCopi:<nom> » (le nom peut contenir « : »).
export function choixParType(t, avions = []) {
  const par = t.parFamille || {};
  const familles = new Set(Object.keys(par));
  for (const a of avions) { const f = familleAvion(a); if (f) familles.add(f); }
  familles.delete('?');
  const out = [];
  for (const f of [...familles].sort((x, y) => (par[y] || 0) - (par[x] || 0) || x.localeCompare(y, 'fr'))) {
    const n = nomAffiche(f);
    out.push({ cle: `famille:${f}`, lib: n });
    if (FAMILLES_DETAILLEES.includes(f)) {
      out.push({ cle: `familleCdB:${f}`, lib: `${n} CdB` }, { cle: `familleCopi:${f}`, lib: `${n} Copi` },
        { cle: `familleAnnee:${f}`, lib: `${n} Année` }); // v0.52 (R128) : heures de l'année civile en cours
    }
  }
  return out;
}

// v0.46 (R120) : les anciens choix (codes OACI) deviennent tout seuls les nouveaux, dans le même ordre, sans doublon :
// type:DH8D -> famille:Dash 8 Q400, typeCdB:DH8D -> familleCdB:Dash 8 Q400, type:CL2T -> famille:CL-415 ; un autre
// code -> une case par nom de modèle de mes fiches pour ce code (aucun avion de ce code : l'ancien choix est gardé tel quel).
// Fait à l'affichage (rien n'est réécrit tant que le pilote ne change pas ses choix : pas de conflit de synchro).
export function normaliserBande(liste = [], avions = []) {
  const out = [];
  const ajouter = c => { if (!out.includes(c)) out.push(c); };
  for (const cle of liste) {
    const i = cle.indexOf(':'), genre = i < 0 ? cle : cle.slice(0, i), code = i < 0 ? '' : cle.slice(i + 1);
    if (!['type', 'typeCdB', 'typeCopi'].includes(genre)) { ajouter(cle); continue; }
    const nouveau = genre.replace('type', 'famille');
    const familles = FAMILLES_PAR_CODE[code] ? [FAMILLES_PAR_CODE[code]]
      : [...new Set(avions.filter(a => !a.sim && String(a.typeOACI || '').trim().toUpperCase() === code).map(familleAvion).filter(Boolean))];
    if (!familles.length || (genre !== 'type' && !familles.every(f => FAMILLES_DETAILLEES.includes(f)))) { ajouter(cle); continue; }
    for (const f of familles) ajouter(`${nouveau}:${f}`);
  }
  return out;
}

// Valeur d'un choix : { lib, texte } (heures « 2 696h38 », nombres « 4 070 »)
export function valeurBande(cle, t) {
  const g = BANDE_GENERAL.find(x => x.cle === cle);
  if (g) return { lib: g.lib, texte: g.nombre ? (t[cle] || 0).toLocaleString('fr-FR') : hm(t[cle] || 0) };
  const i = cle.indexOf(':'), genre = cle.slice(0, i), ty = cle.slice(i + 1);
  if (i < 0) return null;
  if (genre === 'famille') return { lib: nomAffiche(ty), texte: hm((t.parFamille || {})[ty] || 0) };
  if (genre === 'familleCdB') return { lib: `${nomAffiche(ty)} CdB`, texte: hm((t.parFamilleCdB || {})[ty] || 0) };
  if (genre === 'familleCopi') return { lib: `${nomAffiche(ty)} Copi`, texte: hm((t.parFamilleCopi || {})[ty] || 0) };
  if (genre === 'familleAnnee') return { lib: `${nomAffiche(ty)} Année`, texte: hm((t.parFamilleAnnee || {})[ty] || 0) };
  if (genre === 'type') return { lib: TYPES_DETAILLES.includes(ty) ? `${ty} total` : ty, texte: hm(t.parType[ty] || 0) };
  if (genre === 'typeCdB') return { lib: `${ty} CdB`, texte: hm(t.parTypeCdB[ty] || 0) };
  if (genre === 'typeCopi') return { lib: `${ty} Copi`, texte: hm(t.parTypeCopi[ty] || 0) };
  return null;
}

// Cocher / décocher : une valeur nouvellement cochée s'ajoute à la fin
export function basculerChoix(liste, cle) {
  return liste.includes(cle) ? liste.filter(x => x !== cle) : [...liste, cle];
}

// Flèches ↑ (sens -1) / ↓ (sens +1) : échange avec la voisine ; rien aux bornes
export function deplacerChoix(liste, i, sens) {
  const j = i + sens;
  if (i < 0 || i >= liste.length || j < 0 || j >= liste.length) return [...liste];
  const l = [...liste];
  [l[i], l[j]] = [l[j], l[i]];
  return l;
}
