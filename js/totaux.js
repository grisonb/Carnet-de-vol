// Totaux : accueil (TOTAL HdV, 3/7/30 jours), écran Totaux, Contrôle import.

import { colonnesAvion, COMPTEURS, estSimulation, familleAvion } from './modele.js';
import { ajouterJours, aujourdhui as aujourdhuiLocal } from './temps.js';

export const RUBRIQUES = [
  { cle: 'vols', titre: 'Vols', genre: 'nombre', groupe: 'heures' },
  { cle: 'sessionsSim', titre: 'dont simulateur', genre: 'nombre', groupe: 'heures' },
  { cle: 'atterrissages', titre: 'Atterrissages', genre: 'nombre', groupe: 'heures' },
  { cle: 'tempsTotal', titre: 'Temps bloc (total)', genre: 'duree', groupe: 'heures' },
  { cle: 'simTemps', titre: 'Simulateur', genre: 'duree', groupe: 'heures' },
  { cle: 'tempsCdB', titre: 'Commandant de bord', genre: 'duree', groupe: 'heures' },
  { cle: 'tempsCopi', titre: 'Copilote', genre: 'duree', groupe: 'heures' },
  { cle: 'tempsDC', titre: 'Double commande', genre: 'duree', groupe: 'heures' },
  { cle: 'tempsInst', titre: 'Instructeur', genre: 'duree', groupe: 'heures' },
  { cle: 'tempsNuit', titre: 'Nuit', genre: 'duree', groupe: 'heures' },
  { cle: 'tempsIFR', titre: 'IFR', genre: 'duree', groupe: 'heures' },
  { cle: 'tempsXC', titre: 'Cross-country', genre: 'duree', groupe: 'heures' },
  { cle: 'mp', titre: 'Multipilote', genre: 'duree', groupe: 'heures' },
  { cle: 'se', titre: 'Monopilote SE', genre: 'duree', groupe: 'heures' },
  { cle: 'me', titre: 'Monopilote ME', genre: 'duree', groupe: 'heures' },
  { cle: 'piston', titre: 'Piston', genre: 'duree', groupe: 'categories' },
  { cle: 'turbo', titre: 'Turbopropulseur', genre: 'duree', groupe: 'categories' },
  { cle: 'reacteur', titre: 'Réacteur', genre: 'duree', groupe: 'categories' },
  { cle: 'multiTurbine', titre: 'Multimoteur turbine', genre: 'duree', groupe: 'categories' },
  { cle: 'amphibie', titre: 'Amphibie', genre: 'duree', groupe: 'categories' },
  { cle: 'hydravion', titre: 'Hydravion', genre: 'duree', groupe: 'categories' },
  { cle: 'trainClassique', titre: 'Train classique', genre: 'duree', groupe: 'categories' },
  { cle: 'feux', titre: 'Feux', genre: 'nombre', groupe: 'metier' },
  ...COMPTEURS.map(c => ({ cle: c.cle, titre: c.nom, genre: 'nombre', groupe: 'metier' })),
];

const BASE = new Set(COMPTEURS.map(c => c.cle));
// v0.56 (R144) : valeur d'un compteur dans des totaux (Feux, compteurs d'origine ou créés)
export const valeurCompteur = (t, cle) => (cle === 'feux' || BASE.has(cle) ? t[cle] || 0 : (t.parCompteur || {})[cle] || 0);

const SOMMES = ['tempsTotal', 'simTemps', 'tempsCdB', 'tempsCopi', 'tempsDC', 'tempsInst', 'tempsNuit',
  'tempsIFR', 'tempsXC', 'feux'];

export function totauxVides() {
  const t = Object.fromEntries(RUBRIQUES.map(r => [r.cle, 0]));
  t.parCompteur = {}; // v0.56 (R144) : compteurs créés
  t.parEtiquette = {}; t.parAvion = {}; t.parType = {}; t.parTypeCdB = {}; t.parTypeCopi = {};
  t.parFamille = {}; t.parFamilleCdB = {}; t.parFamilleCopi = {}; // v0.46 (R120) : par nom de modèle (bande d'heures)
  t.parFamilleAnnee = {}; // v0.52 (R128) : par nom de modèle, année civile en cours (1er janvier -> aujourd'hui)
  return t;
}

// avions : Map id -> avion
export function ajouterVol(t, v, avions) {
  const a = avions.get(v.avionId);
  t.vols++;
  if ((a && a.sim) || v.simTemps > 0) t.sessionsSim++;
  for (const k of SOMMES) t[k] += v[k] || 0;
  for (const c of COMPTEURS) t[c.cle] += (v.compteurs && v.compteurs[c.cle]) || 0;
  // v0.56 (R144) : compteurs créés (clés à part, jamais mélangées aux rubriques ci-dessus)
  for (const [k, n] of Object.entries(v.compteurs || {})) if (n > 0 && !BASE.has(k)) t.parCompteur[k] = (t.parCompteur[k] || 0) + n;
  t.atterrissages += (v.attJour || 0) + (v.attNuit || 0);
  const col = colonnesAvion(v, a);
  t.se += col.se; t.me += col.me; t.mp += col.mp;
  const total = v.tempsTotal || 0;
  if (a && !a.sim) {
    if (a.moteur === 'P') t.piston += total;
    if (a.moteur === 'T') t.turbo += total;
    if (a.moteur === 'J') t.reacteur += total;
    if (a.moteurs === 'ME' && (a.moteur === 'T' || a.moteur === 'J')) t.multiTurbine += total;
    if (a.surface === 'A') t.amphibie += total;
    if (a.surface === 'H') t.hydravion += total;
    if (a.train === 'classique') t.trainClassique += total;
  }
  const temps = total || v.simTemps || 0;
  for (const e of v.etiquettes || []) t.parEtiquette[e] = (t.parEtiquette[e] || 0) + temps;
  if (a) {
    const pa = t.parAvion[a.id] || (t.parAvion[a.id] = { minutes: 0, vols: 0, dernier: '' });
    pa.minutes += temps; pa.vols++;
    if (v.date > pa.dernier) pa.dernier = v.date;
    const ty = a.sim ? 'SIMULATEURS' : (a.typeOACI || '?');
    t.parType[ty] = (t.parType[ty] || 0) + temps;
    t.parTypeCdB[ty] = (t.parTypeCdB[ty] || 0) + (v.tempsCdB || 0);
    t.parTypeCopi[ty] = (t.parTypeCopi[ty] || 0) + (v.tempsCopi || 0);
    const fa = familleAvion(a);
    if (fa) {
      t.parFamille[fa] = (t.parFamille[fa] || 0) + temps;
      t.parFamilleCdB[fa] = (t.parFamilleCdB[fa] || 0) + (v.tempsCdB || 0);
      t.parFamilleCopi[fa] = (t.parFamilleCopi[fa] || 0) + (v.tempsCopi || 0);
    }
  }
  return t;
}

export function calculerTotaux(vols, avions, aujourdhui = aujourdhuiLocal()) {
  const t = totauxVides();
  for (const v of vols) if (!estSimulation(v)) ajouterVol(t, v, avions); // v0.35 (R85) : simulation jamais comptée
  // v0.52 (R128) : heures de l'année civile en cours par famille (toutes fonctions ; simulateurs et simulations exclus) ;
  // repart à zéro le 1er janvier (date du téléphone ; date du vol = celle du carnet, UTC)
  const debut = `${aujourdhui.slice(0, 4)}-01-01`;
  for (const v of vols) {
    if (estSimulation(v) || !v.date || v.date < debut || v.date > aujourdhui) continue;
    const fa = familleAvion(avions.get(v.avionId));
    if (fa) t.parFamilleAnnee[fa] = (t.parFamilleAnnee[fa] || 0) + (v.tempsTotal || 0);
  }
  return t;
}

// Heures de vol (bloc) des n derniers jours, aujourd'hui inclus (comme « socle hdv »)
export function heuresDerniersJours(vols, n, aujourdhui) {
  const debut = ajouterJours(aujourdhui, -(n - 1));
  let m = 0;
  for (const v of vols) if (!estSimulation(v) && v.date >= debut && v.date <= aujourdhui) m += v.tempsTotal || 0;
  return m;
}

export const totalHdV = vols => vols.reduce((s, v) => s + (estSimulation(v) ? 0 : v.tempsTotal || 0), 0);

// Période : { genre: 'tout' } | { genre: 'annee', annee } | { genre: '12m' } | { genre: 'dates', du, au }
export function bornesPeriode(p, aujourdhui) {
  if (!p || p.genre === 'tout') return { du: null, au: null };
  if (p.genre === 'annee') return { du: `${p.annee}-01-01`, au: `${p.annee}-12-31` };
  if (p.genre === '12m') {
    const [y, m, j] = aujourdhui.split('-');
    return { du: ajouterJours(`${Number(y) - 1}-${m}-${j}`, 1), au: aujourdhui };
  }
  return { du: p.du || null, au: p.au || null };
}

export function filtrerPeriode(vols, p, aujourdhui) {
  const { du, au } = bornesPeriode(p, aujourdhui);
  return vols.filter(v => (!du || v.date >= du) && (!au || v.date <= au));
}
