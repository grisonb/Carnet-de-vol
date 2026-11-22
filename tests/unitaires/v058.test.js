// v0.58 : R149 vols groupés (réglage par avion puis par type ; le temps tapé compte partout : totaux, PDF, CSV, sauvegarde)
// et R150 alerte « Temps de vol modifié ». Vols et avions INVENTÉS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { volsGroupesAvion, volsGroupesDuType, alerteTemps, tempsDuVol } from '../../js/vols-groupes.js';
import { calculerTotaux } from '../../js/totaux.js';
import { paginer, dessinerPDF } from '../../js/pdf.js';
import { texteTableur, creerSauvegarde, lireSauvegarde, REGLAGES_PRIVES } from '../../js/sauvegarde.js';
import { REGLAGES_PARTAGES } from '../../js/synchro.js';
import { volVide } from '../../js/modele.js';
import { chargerJsPDF, enregistreur } from '../outils/pdf-noeud.js';

const avion = (id, immat, typeOACI, champs = {}) => ({ id, immat, typeOACI, modele: typeOACI, equipage: 'SP', moteurs: 'SE', moteur: 'P', sim: false, ...champs });
const vol = (id, champs) => ({ ...volVide(), id, date: '2026-11-10', mode: 'utc', dep: 'LFTW', arr: 'LFTW', avionId: 'w1', fonction: 'cdb', nomCdB: 'SELF', attJour: 1, ...champs });

test('R149 : priorité avion, puis type ; éteint par défaut', () => {
  const parType = { PA25: true };
  assert.equal(volsGroupesAvion(avion('w1', 'F-XZZW', 'DR40'), parType), false, 'type jamais réglé : éteint');
  assert.equal(volsGroupesAvion(avion('w2', 'F-XZZV', 'PA25'), parType), true, 'type allumé : tous ses avions');
  assert.equal(volsGroupesAvion(avion('w3', 'F-XZZU', 'PA25', { volsGroupes: false }), parType), false, 'avion éteint, type allumé : éteint');
  assert.equal(volsGroupesAvion(avion('w4', 'F-XZZT', 'DR40', { volsGroupes: true }), parType), true, 'avion allumé seul');
  assert.equal(volsGroupesAvion(avion('w5', 'F-XZZS', 'PA25', { volsGroupes: null }), parType), true, 'null = comme le type');
  assert.equal(volsGroupesDuType('pa25', parType), true);
  assert.equal(volsGroupesAvion(null, parType), false);
  assert.ok(REGLAGES_PARTAGES.includes('volsGroupesTypes') && !REGLAGES_PRIVES.includes('volsGroupesTypes'), 'réglage des types : voyage (synchro, sauvegarde)');
});

const AVIONS = new Map([['w1', avion('w1', 'F-XZZW', 'PA25')]]);
const GROUPE = vol('g1', { hDep: '09:00', hArr: '12:30', tempsTotal: 105, tempsCdB: 105, volsGroupes: true, attJour: 6 });
const NORMAL = vol('n1', { date: '2026-11-09', hDep: '09:00', hArr: '10:30', tempsTotal: 90, tempsCdB: 90 });

test('R149 : le temps tapé compte dans les totaux et les fonctions (pas fin − début)', () => {
  const t = calculerTotaux([GROUPE, NORMAL], AVIONS, '2026-11-21');
  assert.equal(t.tempsTotal, 195); assert.equal(t.tempsCdB, 195);
  assert.equal(calculerTotaux([NORMAL], AVIONS, '2026-11-21').tempsTotal, 90, 'vol normal inchangé');
});

test('R149 : PDF : temps total = temps tapé, heures bloc gardées ; vol normal inchangé', async () => {
  const J = chargerJsPDF();
  const textes = async vols => { const e = enregistreur(J); await dessinerPDF(e.jsPDF, paginer(vols, AVIONS), AVIONS, { titulaire: 'PILOTE TEST' }); return e.traces.filter(x => x.type === 'texte').map(x => x.texte); };
  const g = await textes([GROUPE]);
  assert.ok(g.includes('09:00') && g.includes('12:30'), 'heures bloc 09:00 / 12:30 dans le PDF');
  assert.ok(g.includes('1:45') && !g.includes('3:30'), 'temps total 1:45 (pas 3:30)');
  const n1 = await textes([NORMAL]), n2 = await textes([structuredClone(NORMAL)]);
  assert.deepEqual(n1, n2); assert.ok(n1.includes('1:30'));
});

test('R149 : CSV et sauvegarde gardent le vol groupé', () => {
  const csv = texteTableur([GROUPE], AVIONS).replace(/^﻿/, '').trim().split(/\r?\n/);
  const cols = csv[0].split(';'), l = csv[1].split(';');
  assert.equal(l[cols.indexOf('Temps total')], '1:45');
  assert.equal(l[cols.indexOf('Heure départ bloc (UTC)')], '09:00'); assert.equal(l[cols.indexOf('Heure arrivée bloc (UTC)')], '12:30');
  const s = lireSauvegarde(JSON.stringify(creerSauvegarde({ vols: [GROUPE], avions: [{ ...AVIONS.get('w1'), volsGroupes: false }], personnes: [],
    reglages: [{ cle: 'volsGroupesTypes', valeur: { PA25: true } }] }))).donnees;
  assert.equal(s.vols[0].volsGroupes, true); assert.equal(s.vols[0].tempsTotal, 105);
  assert.equal(s.avions[0].volsGroupes, false);
  assert.deepEqual(s.reglages.find(r => r.cle === 'volsGroupesTypes').valeur, { PA25: true });
});

test('R150 : alerte seulement si le temps de vol change ; ancien et nouveau total HdV', () => {
  const avant = vol('a', { hDep: '09:00', hArr: '10:30', tempsTotal: 90 }), autre = vol('b', { tempsTotal: 600 });
  const al = alerteTemps([avant, autre], avant, { ...avant, hArr: '10:45', tempsTotal: 105 });
  assert.equal(al.texte, 'Temps de vol modifié : 1h30 → 1h45 (+0h15). Ton total HdV passe de 11h30 à 11h45.');
  assert.equal(alerteTemps([avant, autre], avant, { ...avant, missions: ['ENT. ESSAI'], nomCopi: 'XYZ' }), null, 'mission / copi seuls : pas d\'alerte');
  assert.equal(alerteTemps([avant], null, avant), null, 'nouveau vol : pas d\'alerte');
  assert.match(alerteTemps([avant], avant, { ...avant, tempsTotal: 60 }).texte, /\(−0h30\)\. Ton total HdV passe de 1h30 à 1h00\.$/);
  assert.equal(tempsDuVol({ simTemps: 40 }), 40);
});
