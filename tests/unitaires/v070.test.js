// v0.70 : R172 / R177 (J.1 / J.2), R173 (la case vaut pour toute la journée), R174 (détachement), R178 (pays de la nuit automatique).
// Vols INVENTÉS ; barème 2025 = barème officiel intégré (public) ; table des terrains publique (ressources/terrains.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lignesFrais, anneeFrais, reprendreJ2, typeDuVol, titreLigne, typeLigne, lieuLigne, montantLigne, nuitsAilleurs, fraisDuJour, fixerFraisParVol, paysAuto, nuitsDe, LIBELLES } from '../../js/frais.js';
import { definirTerrains, terrain } from '../../js/terrains.js';
import { nomPays } from '../../js/pays.js';
import { volVide } from '../../js/modele.js';
import { calculerTotaux } from '../../js/totaux.js';
import { texteTableur } from '../../js/sauvegarde.js';

definirTerrains(JSON.parse(readFileSync(new URL('../../ressources/terrains.json', import.meta.url))));
const paysDe = code => nomPays((terrain(code) || {}).pays);
let n = 0;
const vol = (date, dep, arr, frais, h = '08:00') => ({ ...volVide(), id: `v${++n}`, date, hDep: h, hArr: h.replace(/^(\d\d)/, (_, x) => String(+x + 1).padStart(2, '0')), dep, arr,
  avionId: 'a1', tempsTotal: 60, tempsCdB: 60, modifieLe: '2025-10-01T08:00:00Z', ...(frais ? { frais: { le: '2025-11-20T10:00:00Z', ...frais } } : {}) });
const L = (vols, detachements = []) => lignesFrais({ vols, detachements, baremes: new Map(), paysDe });

test('R172 : quatre cases, dans l\'ordre VOL JOURNÉE, DÉTACHEMENT, J.1, J.2', () => {
  assert.deepEqual(Object.values(LIBELLES), ['Vol journée', 'J.1', 'J.2', 'Détachement']);
});

test('R177 : J.1 le 17 (2 vols) + J.2 le 18 (4 vols), nuit en France (2025) : une ligne, deux journées, 261,00 €', () => {
  const vols = [vol('2025-11-17', 'LFTW', 'LFTH', { type: 'j1' }, '07:00'), vol('2025-11-17', 'LFTH', 'LFPB', { type: 'j1' }, '10:00'),
    vol('2025-11-18', 'LFPB', 'LFRN', { type: 'j2' }, '07:00'), vol('2025-11-18', 'LFRN', 'LEMD', { type: 'j2' }, '09:00'),
    vol('2025-11-18', 'LEMD', 'LFPB', { type: 'j2' }, '12:00'), vol('2025-11-18', 'LFPB', 'LFTW', { type: 'j2' }, '15:00')];
  const l = L(vols);
  assert.equal(l.length, 1);
  const x = l[0];
  assert.equal(titreLigne(x), '17/11/2025 · J.1'); assert.equal(x.pays, 'France'); assert.equal(montantLigne(x).replace(/ /g, ' '), '261,00 €');
  assert.deepEqual(x.jourVols.map(j => [j.date, j.vols.length, j.etapes]), [['2025-11-17', 2, 'LFTW → LFTH → LFPB'], ['2025-11-18', 4, 'LFPB → LFRN → LEMD → LFPB → LFTW']]);
  assert.equal(x.detail, '1,5 indemnité × 174,00 €'); assert.equal(lieuLigne(x), 'Nuit France · 6 vols');
  assert.equal(anneeFrais(l, 2025).total, 26100); assert.equal(anneeFrais(l, 2025).resume.j2.n, 1);
});

test('R177 : J.1 seul et J.2 seul : « incomplet », 0 €, hors total', () => {
  let l = L([vol('2025-11-20', 'LFTW', 'LFML', { type: 'j1' })]);
  assert.equal(typeLigne(l[0]), 'J.1 incomplet'); assert.equal(montantLigne(l[0]), '0,00 €'); assert.equal(l[0].detail, 'Coche aussi le J.2 du lendemain');
  l = L([vol('2025-11-22', 'LFML', 'LFTW', { type: 'j2' })]);
  assert.equal(typeLigne(l[0]), 'J.2 incomplet'); assert.equal(montantLigne(l[0]), '0,00 €'); assert.equal(l[0].detail, 'Coche aussi le J.1 de la veille');
  assert.equal(anneeFrais(l, 2025).total, 0); assert.equal(anneeFrais(l, 2025).resume.j2.n, 0);
  // J.2 la veille et J.1 le lendemain : pas une paire
  l = L([vol('2025-11-24', 'LFTW', 'LFML', { type: 'j2' }), vol('2025-11-25', 'LFML', 'LFTW', { type: 'j1' })]);
  assert.equal(l.filter(x => x.incomplet).length, 2);
});

// v0.71 (R180) : chaque vol a sa case ; les données de la v0.70 (case de la journée) sont reprises par fixerFraisParVol
test('R173 (repris en v0.71) : une journée cochée = tous ses vols cochés ; la ligne prend tous les vols cochés du jour', () => {
  const a = vol('2025-12-03', 'LFTW', 'LFTH', { type: 'journee', le: '2025-12-03T18:00:00Z' }, '07:00'), b = vol('2025-12-03', 'LFTH', 'LFPB', null, '10:00'),
    c = vol('2025-12-03', 'LFPB', 'LFTW', { type: null, le: '2025-12-01T10:00:00Z' }, '14:00');
  const ch = fixerFraisParVol([a, b, c]), par = new Map(ch.map(v => [v.id, v])), apres = [a, b, c].map(v => par.get(v.id) || v);
  assert.deepEqual(ch.map(v => v.id).sort(), [b.id, c.id].sort(), 'v0.70 -> v0.71 : les vols sans la case du jour la reçoivent');
  const l = L(apres);
  assert.equal(l.length, 1); assert.equal(titreLigne(l[0]), '03/12/2025 · Vol journée'); assert.equal(l[0].vols.length, 3);
  assert.equal(l[0].etapes, 'LFTW → LFTH → LFPB → LFTW'); assert.equal(montantLigne(l[0]).replace(/\u202f/g, ' '), '87,00 €');
  assert.equal(typeDuVol(apres[1], []), 'journee');
  assert.equal(fixerFraisParVol(apres).length, 0, 'déjà repris : rien ne change');
  assert.equal(fraisDuJour([a, b, c], '2025-12-03').type, 'journee');
  // un vol journée d'un vol « LFTW → LFTW » garde ses deux terrains
  assert.equal(L([vol('2025-12-05', 'LFTW', 'LFTW', { type: 'journee' })])[0].etapes, 'LFTW → LFTW');
});

test('migration : deux J+2 qui se suivent -> J.1 (le pays passe sur le J.1) puis J.2 ; J+2 seul -> J.2', () => {
  const x1 = vol('2025-06-02', 'LFTW', 'LEMD', { type: 'j2', pays: 'Espagne' }), x2 = vol('2025-06-02', 'LEMD', 'LEBL', { type: 'j2', pays: 'Espagne' }),
    y = vol('2025-06-03', 'LEBL', 'LFTW', { type: 'j2' }), z = vol('2025-06-20', 'LFTW', 'LFML', { type: 'j2', pays: 'Portugal' }), w = vol('2025-06-21', 'LFML', 'LFTW', { type: 'journee' });
  const ch = reprendreJ2([x1, x2, y, z, w]), par = new Map(ch.map(v => [v.id, v]));
  assert.deepEqual([x1, x2].map(v => [par.get(v.id).frais.type, par.get(v.id).frais.pays, par.get(v.id).frais.paysManuel]), [['j1', 'Espagne', true], ['j1', 'Espagne', true]]);
  assert.equal(par.get(y.id).frais.type, 'j2'); assert.equal(par.get(y.id).frais.pays, undefined);
  assert.ok(!par.has(z.id), 'J+2 seul : reste « j2 » = J.2'); assert.ok(!par.has(w.id));
  assert.equal(par.get(x1.id).frais.le, x1.frais.le, 'heure de la case gardée : même résultat sur les deux appareils');
  assert.equal(par.get(x1.id).modifieLe, x1.modifieLe, '« Modifié le » inchangé');
  const l = L([...ch, z, w]);
  assert.equal(l.find(x => x.sorte === 'paire').pays, 'Espagne'); assert.equal(typeLigne(l.find(x => x.du === '2025-06-20')), 'J.2 incomplet');
  assert.equal(reprendreJ2([...ch, z, w]).length, 0, 'déjà repris : rien ne change');
});

test('R178 : pays de la nuit du J.1 = dernier atterrissage du jour ; outre-mer à part ; choix à la main gardé ; code inconnu : à choisir', () => {
  const paire = (arr, f = {}) => L([vol('2025-03-10', 'LFTW', 'LFPB', { type: 'j1', ...f }, '07:00'), vol('2025-03-10', 'LFPB', arr, { type: 'j1', ...f }, '12:00'),
    vol('2025-03-11', arr, 'LFTW', { type: 'j2' })]).find(x => x.sorte === 'paire');
  assert.equal(paire('LEMD').pays, 'Espagne');
  assert.equal(paire('FMEE').pays, 'La Réunion'); assert.equal(paire('FMEP').pays, 'La Réunion'); assert.equal(paire('FMCZ').pays, 'Mayotte');
  assert.equal(paire('TFFR').pays, 'Guadeloupe'); assert.equal(paire('TFFF').pays, 'Martinique'); assert.equal(paire('SOCA').pays, 'Guyane');
  assert.equal(paire('LEMD', { pays: 'Portugal', paysManuel: true }).pays, 'Portugal', 'choisi à la main : jamais remplacé');
  const x = paire('ZZZZ');
  assert.equal(x.pays, null); assert.ok(x.manquant); assert.equal(x.detail, 'Pays à choisir sur le J.1'); assert.equal(anneeFrais([x], 2025).total, 0);
  assert.deepEqual(paysAuto([vol('2025-03-10', 'LFTW', 'LEMD')], '2025-03-10', paysDe), { pays: 'Espagne', code: 'LEMD' });
});

test('R174 / R178 : détachement La Réunion, deux nuits à FIMP : Maurice pour ces deux nuits, pastilles seulement pour elles', () => {
  const d = { id: 'r', du: '2025-01-05', au: '2025-01-10', pays: 'La Réunion', nuits: {} };
  const vols = [vol('2025-01-05', 'LFPG', 'FMEE'), vol('2025-01-06', 'FMEE', 'FIMP'), vol('2025-01-07', 'FIMP', 'FIMP'), vol('2025-01-08', 'FIMP', 'FMEE'), vol('2025-01-10', 'FMEE', 'FMEP')];
  const l = L(vols, [d]), x = l[0];
  assert.deepEqual(x.nuits.map(n => [n.date.slice(8), n.pays, n.code]), [['05', 'La Réunion', 'FMEE'], ['06', 'Maurice', 'FIMP'], ['07', 'Maurice', 'FIMP'], ['08', 'La Réunion', 'FMEE'], ['09', 'La Réunion', '']]);
  assert.deepEqual(nuitsAilleurs(x), ['Nuit 06/01 : FIMP', 'Nuit 07/01 : FIMP']);
  assert.equal(x.etapes, 'La Réunion', 'pas d\'enchaînement d\'étapes : le pays du détachement');
  assert.equal(x.vols.length, 5, 'les vols du carnet restent sous la ligne');
  // nuit choisie à la main : gardée (même égale au pays du détachement)
  const m = nuitsDe({ ...d, nuits: { '2025-01-06': 'La Réunion' } }, { vols, paysDe });
  assert.deepEqual(m.slice(1, 3).map(n => [n.pays, n.manuel]), [['La Réunion', true], ['Maurice', false]]);
});

test('carnet EASA inchangé : totaux et CSV identiques avec ou sans cases J.1 / J.2', () => {
  const v = vol('2025-03-10', 'LFTW', 'LEMD'), avec = { ...v, frais: { type: 'j1', pays: 'Espagne', paysManuel: true, le: '2025-03-10T20:00:00Z' } };
  const avions = new Map([['a1', { id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', equipage: 'MP', moteurs: 'ME', moteur: 'T' }]]);
  assert.equal(texteTableur([v], avions), texteTableur([avec], avions));
  assert.equal(JSON.stringify(calculerTotaux([v], avions)), JSON.stringify(calculerTotaux([avec], avions)));
});
