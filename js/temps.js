// Durées et heures. Toutes les durées sont stockées en minutes entières, les heures en "HH:MM" UTC.

// v0.67 (R164, corrigé) : « 1.4 » = dixièmes d'heure avec un POINT, pour l'affichage des vols dont le TYPE a « Temps en dixièmes »
// (accueil, fiche du vol). Les vols gardent toujours des minutes ; totaux, PDF et CSV restent en heures et minutes.
export function enDixiemesPoint(minutes) {
  const d = Math.round(arrondiDixieme(minutes) / 6); // dixièmes entiers
  return `${Math.floor(d / 10).toLocaleString('fr-FR')}.${d % 10}`;
}

// Lecture d'une durée : "1:30", "1h30", "1H30", "90" (minutes) -> 90 ; v0.67 (R164) : "1.4" / "1,4" (dixièmes d'heure) -> 84 ;
// vide -> null ; invalide -> NaN
export function lireDuree(texte) {
  if (texte === null || texte === undefined) return null;
  const s = String(texte).trim().replace(/\s/g, '');
  if (s === '') return null;
  const dix = s.match(/^(\d{0,5})[.,](\d{1,2})$/);
  if (dix) return Math.round(Number(`${dix[1] || 0}.${dix[2]}`) * 60);
  let m = s.match(/^(\d{1,5})[:hH](\d{1,2})?$/);
  if (m) {
    const min = Number(m[2] || 0);
    if (min > 59) return NaN;
    return Number(m[1]) * 60 + min;
  }
  if (/^\d{1,6}$/.test(s)) return Number(s);
  return NaN;
}

// 78 -> "1h18" ; 342168 -> "5 702h48" (espace fine insécable des milliers, comme la maquette)
export function hm(minutes) {
  const m = Math.max(0, Math.round(minutes || 0));
  return Math.floor(m / 60).toLocaleString('fr-FR') + 'h' + String(m % 60).padStart(2, '0');
}
export const hmFixe = hm; // v0.67 : textes gardés (suivi des modifications) : toujours en heures et minutes
// v0.67 (R164) : durée d'un vol affichée en dixièmes (« 1.4 ») ou en heures (« 1h24 ») selon son type
export const dureeAffichee = (minutes, dixiemes) => (dixiemes ? enDixiemesPoint(minutes) : hm(minutes));

// Pour les tableurs et le PDF : "1:18" ; 0 ou null -> ""
export function hmPoints(minutes) {
  if (!minutes) return '';
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

// "0942" ou "09h42" ou "9:42" -> "09:42" ; invalide -> null
export function lireHeure(texte) {
  if (texte === null || texte === undefined) return null;
  const s = String(texte).trim();
  const m = s.match(/^(\d{1,2})[:hH]?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function minutesDuJour(heure) {
  const h = lireHeure(heure);
  return h ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null;
}

// "09:42" -> "09h42"
export const heureH = h => (h ? h.replace(':', 'h') : '');

// Temps bloc entre deux heures : correct par-dessus minuit (arrivée le lendemain).
export function dureeBloc(hDep, hArr) {
  const a = minutesDuJour(hDep), b = minutesDuJour(hArr);
  if (a === null || b === null) return null;
  return (b - a + 1440) % 1440;
}

// L'arrivée est le lendemain si son heure est avant (ou égale à) celle du départ
export function arriveeLendemain(hDep, hArr) {
  const a = minutesDuJour(hDep), b = minutesDuJour(hArr);
  return a !== null && b !== null && b < a;
}

// Date "AAAA-MM-JJ" + heure "HH:MM" UTC -> millisecondes
export function instantUTC(date, heure) {
  const [y, mo, j] = date.split('-').map(Number);
  return Date.UTC(y, mo - 1, j) + (minutesDuJour(heure) || 0) * 60000;
}

export function dateValide(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t || '')) return false;
  const [y, m, j] = t.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, j));
  return d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

export function ajouterJours(date, n) {
  const [y, m, j] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, j + n)).toISOString().slice(0, 10);
}

// "2026-11-04" -> "04/11/2026"
export const dateFr = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

// Date du jour sur le téléphone (heure locale)
export function aujourdhui(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];

// v0.64 (R160 / R161) : arrondi au dixième d'heure (multiple de 6 min), comme le carnet papier : reste de 0 à 2 min -> en dessous,
// de 3 à 5 min -> au-dessus (0h14 -> 0h12, 0h15 -> 0h18, 0h02 -> 0h00)
export function arrondiDixieme(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0)), r = m % 6;
  return m - r + (r >= 3 ? 6 : 0);
}

