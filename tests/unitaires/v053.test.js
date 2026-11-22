// v0.53 (R130 / R131) : instructeur ou examinateur en plus du copi ; rattrapage depuis FlyLog ; « CdB » (données INVENTÉES)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instExamDuVol } from '../../js/inst-exam.js';
import { analyserFlyLog } from '../../js/flylog.js';
import { calculerTotaux } from '../../js/totaux.js';
import { FONCTIONS } from '../../js/modele.js';
import { REGLAGES_PARTAGES } from '../../js/synchro.js';
import { fauxFlyLog } from '../outils/faux-flylog.js';

const L = (date, debut, dep, arr, champs = {}) => ({ DATE: date, DEPARTURE_AIRPORT: dep, ARRIVAL_AIRPORT: arr, AIRCRAFT_TYPE: 'DH8D', AIRCRAFT_REGISTRATION: 'FXZZA',
  DURATION_BLOCK: '1:00', LDGS_DAY: '1', TIME_BLOCK_START: debut, TIME_BLOCK_END: '23:00', DURATION_PIC: '1:00', DURATION_MULTI_PILOT: '1:00', NAME_PIC: 'SELF', ...champs });
const LIGNES = [
  L('2025-03-01', '10:00', 'LFTW', 'LFMT', { NAME_COPILOT: 'ZZA', NAME_INSTRUCTOR: 'ZZB' }),   // A : à compléter (inst)
  L('2025-03-02', '11:00', 'LFTW', 'LFTW', { NAME_COPILOT: 'ZZA', NAME_EXAMINER: 'ZZC' }),     // B : à compléter (exam)
  L('2025-03-03', '12:00', 'LFTW', 'LFKJ', { NAME_COPILOT: 'ZZA', NAME_INSTRUCTOR: 'ZZB' }),   // C : déjà rempli dans le carnet
  L('2025-03-04', '13:00', 'LFTW', 'LFMN', { NAME_COPILOT: 'ZZA', NAME_INSTRUCTOR: 'ZZB' }),   // D : absent du carnet
  L('2025-03-05', '14:00', 'LFTW', 'LFTW', { NAME_INSTRUCTOR: 'ZZB' }),                        // E : sans copi : pas concerné
];
const fichier = fauxFlyLog(LIGNES);
// le carnet : les vols importés, champs instructeur / examinateur VIDES (sauf C, rempli autrement), sans D
const carnet = analyserFlyLog(fichier).aCreer.filter(v => v.date !== '2025-03-04').map((v, i) => ({ ...v, id: 'v' + i, nomInstructeur: v.date === '2025-03-03' ? 'ZZD' : '', nomExaminateur: '' }));

test('bulles « Inst » / « Exam » : vrais noms seulement (ni SELF, ni l\'autre pilote en double commande)', () => {
  assert.deepEqual(instExamDuVol({ fonction: 'cdb', nomInstructeur: 'ZZB', nomExaminateur: '' }), [{ role: 'inst', nom: 'ZZB' }]);
  assert.deepEqual(instExamDuVol({ fonction: 'cdb', nomInstructeur: '', nomExaminateur: 'ZZC' }), [{ role: 'exam', nom: 'ZZC' }]);
  assert.deepEqual(instExamDuVol({ fonction: 'inst', nomInstructeur: 'SELF' }), []);
  assert.deepEqual(instExamDuVol({ fonction: 'dc', nomInstructeur: 'ZZB', nomExaminateur: 'ZZC' }), [{ role: 'exam', nom: 'ZZC' }]);
});

// v0.55 (R142) : le bouton « Compléter instructeur / examinateur depuis FlyLog » est retiré (rattrapage déjà fait).

test('pas une fonction : totaux identiques avec ou sans instructeur / examinateur', () => {
  const avions = new Map();
  const sans = calculerTotaux(carnet.map(v => ({ ...v, nomInstructeur: '', nomExaminateur: '' })), avions, '2026-11-21');
  const avec = calculerTotaux(carnet.map(v => ({ ...v, nomInstructeur: 'ZZB', nomExaminateur: 'ZZC' })), avions, '2026-11-21');
  assert.deepEqual(avec, sans);
});

test('R131 : « CdB » ; bouton à usage unique mémorisé avec les réglages partagés', () => {
  assert.equal(FONCTIONS.cdb.puce, 'CdB');
  assert.ok(REGLAGES_PARTAGES.includes('rattrapageInstExam'));
});
