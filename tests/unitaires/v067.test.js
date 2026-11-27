// v0.67 : R163 att. de nuit sans temps de nuit ; R164 (corrigé) « Temps en dixièmes » par TYPE d'avion (DH8D et CL2T d'office),
// affichage seulement : totaux, PDF, CSV en heures et minutes comme en v0.66. Vols INVENTÉS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hm, hmPoints, lireDuree, enDixiemesPoint, dureeAffichee } from '../../js/temps.js';
import { dixiemesDuType, dixiemesAvion, DIXIEMES_DEFAUT, alerteTemps } from '../../js/vols-groupes.js';
import { calculerTotaux } from '../../js/totaux.js';
import { totauxPDF } from '../../js/pdf.js';
import { texteTableur, creerSauvegarde } from '../../js/sauvegarde.js';
import { anomaliesDuCarnet, ignorer } from '../../js/anomalies.js';
import { libelleAnomalie } from '../../js/anomalies-traitees.js';
import { REGLAGES_PARTAGES, elementsDuCarnet, trierRecus } from '../../js/synchro.js';
import { volVide } from '../../js/modele.js';

const avions = new Map([['a1', { id: 'a1', immat: 'F-XZZX', typeOACI: 'DH8D', equipage: 'MP', moteurs: 'ME', moteur: 'T', surface: 'L', train: 'tricycle' }],
  ['a2', { id: 'a2', immat: 'F-XZZY', typeOACI: 'CL2T', equipage: 'MP', moteurs: 'ME', moteur: 'T', surface: 'A', train: 'tricycle' }],
  ['a3', { id: 'a3', immat: 'F-XZZZ', typeOACI: 'DR40', equipage: 'SP', moteurs: 'SE', moteur: 'P', surface: 'L', train: 'tricycle' }],
  ['s1', { id: 's1', immat: 'SIM', typeOACI: 'SIM', sim: true }]]);
const vol = (id, t, champs = {}) => ({ ...volVide(), id, date: '2026-06-13', hDep: '10:00', hArr: '11:00', mode: 'utc', dep: 'LFTW', arr: 'LFTW', avionId: 'a1',
  tempsTotal: t, tempsCdB: t, fonction: 'cdb', nomCdB: 'SELF', attJour: 1, ...champs });

test('R164 : « 1.4 » avec un point, arrondi R160 ; saisie « 0.2 » = 12 min ; tout le reste en heures et minutes', () => {
  assert.deepEqual([84, 86, 87, 14, 128, 0].map(enDixiemesPoint), ['1.4', '1.4', '1.5', '0.2', '2.1', '0.0']);
  assert.equal(dureeAffichee(84, true), '1.4'); assert.equal(dureeAffichee(84, false), '1h24');
  assert.equal(hm(84), '1h24'); assert.equal(hmPoints(84), '1:24');
  assert.deepEqual(['0.2', '1,4', '1.5', '.5', '1h30', '1:30', '90', ''].map(lireDuree), [12, 84, 90, 30, 90, 90, 90, null]);
});

test('R164 : « Temps en dixièmes » par type : DH8D et CL2T allumés d\'office, autres éteints, réglage du type prioritaire, jamais un simulateur', () => {
  assert.deepEqual(DIXIEMES_DEFAUT, ['DH8D', 'CL2T']);
  assert.equal(dixiemesDuType('DH8D'), true); assert.equal(dixiemesDuType('cl2t'), true); assert.equal(dixiemesDuType('DR40'), false);
  assert.equal(dixiemesDuType('DH8D', { DH8D: false }), false); assert.equal(dixiemesDuType('DR40', { DR40: true }), true);
  assert.equal(dixiemesAvion(avions.get('a1'), {}), true); assert.equal(dixiemesAvion(avions.get('a3'), {}), false);
  assert.equal(dixiemesAvion(avions.get('s1'), { SIM: true }), false); assert.equal(dixiemesAvion(null, {}), false);
  assert.ok(REGLAGES_PARTAGES.includes('dixiemesTypes'));
  const reglages = [{ cle: 'dixiemesTypes', valeur: { DH8D: false } }];
  assert.deepEqual(elementsDuCarnet({ reglages }).map(e => e.id), ['dixiemesTypes']);
  assert.deepEqual(creerSauvegarde({ vols: [], avions: [], personnes: [], reglages }).reglages, reglages);
});

test('R165 retiré : « formatTemps » n\'est plus un réglage partagé ; reçu par la synchro : ignoré sans erreur', () => {
  assert.ok(!REGLAGES_PARTAGES.includes('formatTemps'));
  assert.deepEqual(elementsDuCarnet({ reglages: [{ cle: 'formatTemps', valeur: 'dixieme' }] }), []);
  const r = trierRecus([{ magasin: 'reglages', id: 'formatTemps', rev: 3, donnees: { cle: 'formatTemps', valeur: 'dixieme' } }]);
  assert.deepEqual(r.mettre.reglages, []);
});

test('Totaux, PDF, CSV : en heures et minutes, identiques quel que soit le réglage des types (3 × 0h14 = 0h42)', () => {
  const vols = [vol('a', 14, { date: '2026-06-11' }), vol('b', 14, { date: '2026-06-12', avionId: 'a2' }), vol('c', 14, { avionId: 'a3' })];
  const t = calculerTotaux(vols, avions, '2026-06-13');
  assert.equal(t.tempsTotal, 42); assert.equal(hm(t.tempsTotal), '0h42'); assert.equal(totauxPDF(vols, avions).total, 42);
  assert.ok(texteTableur(vols, avions).includes(';0:14;'));
  const al = alerteTemps(vols, vols[0], { ...vols[0], tempsTotal: 18 });
  assert.ok(al.texte.includes('0h14 → 0h18') && al.texte.includes('0h42 à 0h46'), al.texte);
});

test('R163 : att. de nuit sans temps de nuit (« ! ») ; avec 0.2 de nuit : rien ; simulateur non contrôlé ; Ignorer', () => {
  const vols = [vol('x', 60, { attNuit: 1, attJour: 0 }), vol('y', 60, { date: '2026-06-14', attNuit: 1, attJour: 0, tempsNuit: 12 }),
    vol('z', 60, { date: '2026-06-15', escales: [{ code: 'LFML', attJour: 0, attNuit: 1 }], attNuit: 1, attJour: 1 }),
    vol('s', 0, { date: '2026-06-16', avionId: 's1', simTemps: 60, attNuit: 1 })];
  const m = anomaliesDuCarnet(vols, avions);
  assert.deepEqual(m.get('x'), [{ type: 'i', cle: 'i', texte: 'Att. de nuit sans temps de nuit' }]);
  assert.ok(!m.has('y') && !m.has('s')); assert.equal(m.get('z').filter(a => a.type === 'i').length, 1);
  assert.equal(libelleAnomalie('i'), 'Att. de nuit sans temps de nuit');
  assert.ok(!anomaliesDuCarnet([ignorer(vols[0])], avions).has('x'));
});
