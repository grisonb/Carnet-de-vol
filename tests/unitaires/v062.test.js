// v0.62 : R156 « Anomalies traitées » (corrigées, ignorées, rattrapage depuis un faux fichier FlyLog). Vols INVENTÉS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correctionALaSaisie, ajouterCorrigees, corrigeesAffichees, ignoreesAffichees, nombreDeVols, avantApres, libelleAnomalie,
  rattrapage, MAX_CORRIGEES, SUR_L_AUTRE } from '../../js/anomalies-traitees.js';
import { anomaliesDuCarnet, ignorer, nePlusIgnorer, estIgnore } from '../../js/anomalies.js';
import { analyserRecus, cleElement, empreinteTexte, fusionReglage, REGLAGES_PARTAGES, elementsDuCarnet } from '../../js/synchro.js';
import { creerSauvegarde, REGLAGES_PRIVES, texteTableur } from '../../js/sauvegarde.js';
import { calculerTotaux } from '../../js/totaux.js';
import { analyserFlyLog } from '../../js/flylog.js';
import { volVide } from '../../js/modele.js';
import { fauxFlyLog } from '../outils/faux-flylog.js';

const avions = new Map([['a1', { id: 'a1', immat: 'F-XZZX', typeOACI: 'DH8D' }]]);
const immat = v => (avions.get(v.avionId) || {}).immat || '';
const vol = (id, champs = {}) => ({ ...volVide(), id, date: '2026-06-13', hDep: '10:00', hArr: '11:00', mode: 'utc', dep: 'LFTW', arr: 'LFTW', avionId: 'a1',
  tempsTotal: 60, tempsCdB: 60, fonction: 'cdb', nomCdB: 'SELF', attJour: 1, modifieLe: '2026-06-13T12:00:00Z', ...champs });
const an = (vols, opts) => anomaliesDuCarnet(vols, avions, () => null, opts);

test('vol avec « ! » corrigé : ligne avec avant -> après et date ; anomalie restée ou vol sans « ! » : aucune ligne', () => {
  const v = vol('v1', { escales: [{ code: 'LFML', attJour: 0, attNuit: 0 }] });
  const avant = an([v]).get('v1');
  assert.equal(avant[0].cle, 'a|LFML');
  const w = { ...v, escales: [{ code: 'LFML', attJour: 1, attNuit: 0 }] }, copie = JSON.stringify(w);
  const e = correctionALaSaisie(avant, an([w], { avecIgnorees: true }).get('v1') || [], v, w, immat, '2026-11-27T08:00:00Z');
  assert.equal(JSON.stringify(w), copie, 'le vol ne change pas');
  assert.deepEqual(e.l, [{ cle: 'a|LFML', avant: ['LFML : 0 att.'], apres: ['LFML : 1 att.'] }]);
  assert.equal(e.volId, 'v1'); assert.equal(e.le, '2026-11-27T08:00:00Z'); assert.equal(e.origine, 'saisie');
  assert.equal(libelleAnomalie('a|LFML'), 'Terrain intermédiaire, 0 att.');
  // anomalie toujours là (remarque changée seulement)
  const x = { ...v, remarques: 'TEST' };
  assert.equal(correctionALaSaisie(avant, an([x], { avecIgnorees: true }).get('v1'), v, x, immat), null);
  // vol sans « ! » modifié
  assert.equal(correctionALaSaisie([], [], vol('v2'), vol('v2', { remarques: 'X' }), immat), null);
  // escale retirée
  const r = avantApres('a|LFML', v, { ...v, escales: [] });
  assert.deepEqual(r, { avant: ['LFML : 0 att.'], apres: ['LFML : retiré'] });
});

test('avant -> après : intermédiaire = départ, arrivée de nuit, fonctions, chevauchement réglé sur l\'autre vol', () => {
  const g = vol('g', { dep: 'LFXC', arr: 'LFXD', escales: [{ code: 'LFXC', attJour: 1 }] });
  assert.deepEqual(avantApres('g|LFXC', g, { ...g, escales: [{ code: 'LFXE', attJour: 1 }] }), { avant: ['Intermédiaire : LFXC'], apres: ['Intermédiaire : LFXE'] });
  const b = vol('b', { attNuit: 0 });
  assert.deepEqual(avantApres('b', b, { ...b, attNuit: 1 }), { avant: ['Att. nuit : 0'], apres: ['Att. nuit : 1'] });
  const d = vol('d', { tempsCdB: 40 });
  assert.deepEqual(avantApres('d-fn', d, { ...d, tempsCdB: 60 }), { avant: ['CdB : 0h40'], apres: ['CdB : 1h00'] });
  assert.deepEqual(avantApres('f', d, d), { avant: [], apres: [SUR_L_AUTRE] });
});

test('liste : sans doublon, plus récentes en haut, date inconnue en bas, vol supprimé caché, taille bornée', () => {
  const a = { id: 'x1', volId: 'v1', le: '2026-11-20T10:00:00Z', l: [] }, b = { id: 'x2', volId: 'v2', le: '2026-11-25T10:00:00Z', l: [] }, c = { id: 'x3', volId: 'v3', le: null, l: [] };
  const l = ajouterCorrigees(ajouterCorrigees([], [a, c]), [b, a]);
  assert.deepEqual(l.map(x => x.id), ['x2', 'x1', 'x3']);
  const parId = new Map([['v1', {}], ['v3', {}]]);
  assert.deepEqual(corrigeesAffichees(l, parId).map(x => x.id), ['x1', 'x3'], 'v2 supprimé : sa ligne disparaît');
  const beaucoup = Array.from({ length: MAX_CORRIGEES + 20 }, (_, i) => ({ id: 'k' + i, volId: 'v', le: new Date(Date.UTC(2026, 0, 1) + i * 6e4).toISOString(), l: [] }));
  const m = ajouterCorrigees([], beaucoup);
  assert.equal(m.length, MAX_CORRIGEES); assert.equal(m[0].id, 'k' + (MAX_CORRIGEES + 19));
});

test('ignorées : vol ignoré dans la liste ; « Ne plus ignorer » : « ! » revenu, ligne retirée ; badge = nombre de vols', () => {
  const v = vol('v1', { escales: [{ code: 'LFML', attJour: 0 }] });
  const i = ignorer(v, '2026-11-26T09:00:00Z');
  let liste = ignoreesAffichees([i, vol('v2')], an([i, vol('v2')], { avecIgnorees: true }));
  assert.equal(liste.length, 1); assert.equal(liste[0].le, '2026-11-26T09:00:00Z');
  assert.equal(an([i]).size, 0, 'pas de « ! »');
  const n = nePlusIgnorer(i, '2026-11-27T09:00:00Z');
  assert.equal(estIgnore(n), false); assert.equal(an([n]).size, 1, '« ! » revenu');
  liste = ignoreesAffichees([n], an([n], { avecIgnorees: true }));
  assert.equal(liste.length, 0);
  assert.equal(nombreDeVols([{ volId: 'v1' }, { volId: 'v3' }], [{ id: 'v1' }, { id: 'v4' }]), 3);
  assert.equal(nombreDeVols([], []), 0);
});

test('synchro : listes partagées ; changées sur deux appareils -> toutes les lignes gardées ; sauvegarde : liste gardée, question privée', () => {
  assert.ok(REGLAGES_PARTAGES.includes('anomaliesCorrigees') && REGLAGES_PARTAGES.includes('rattrapageCorrections'));
  assert.ok(REGLAGES_PRIVES.includes('questionCorrections') && !REGLAGES_PARTAGES.includes('questionCorrections'));
  const A = [{ id: 'a', volId: 'v1', le: '2026-11-20T10:00:00Z', l: [] }], B = [{ id: 'b', volId: 'v2', le: '2026-11-21T10:00:00Z', l: [] }];
  assert.deepEqual(fusionReglage('anomaliesCorrigees', A, B).map(x => x.id), ['b', 'a']);
  const cle = cleElement('reglages', 'anomaliesCorrigees'), h = d => empreinteTexte(JSON.stringify(d));
  const ici = { cle: 'anomaliesCorrigees', valeur: A }, nas = { cle: 'anomaliesCorrigees', valeur: B };
  const r = analyserRecus([{ magasin: 'reglages', id: 'anomaliesCorrigees', rev: 3, donnees: nas }], new Map([[cle, { magasin: 'reglages', id: 'anomaliesCorrigees', donnees: ici, h: h(ici) }]]), { [cle]: [1, h({ cle: 'anomaliesCorrigees', valeur: [] })] });
  assert.equal(r.conflits.length, 0); assert.deepEqual(r.appliquer[0].donnees.valeur.map(x => x.id), ['b', 'a']);
  const reglages = [{ cle: 'anomaliesCorrigees', valeur: A }, { cle: 'rattrapageCorrections', valeur: { le: 'x', n: 1 } }, { cle: 'questionCorrections', valeur: 'posee' }];
  const s = creerSauvegarde({ vols: [], avions: [], personnes: [], reglages });
  assert.deepEqual(s.reglages.map(r => r.cle), ['anomaliesCorrigees', 'rattrapageCorrections']);
  assert.deepEqual(elementsDuCarnet({ reglages }).map(e => e.id), ['anomaliesCorrigees', 'rattrapageCorrections']);
});

// Faux fichier FlyLog d'origine : 4 vols ; le carnet = son import, puis corrigé dans l'app
const ORIGINE = fauxFlyLog([
  { DATE: '2025-06-13', DEPARTURE_AIRPORT: 'LFTW', ARRIVAL_AIRPORT: 'LFTW', ROUTE: 'LFTW|LFML|LFTW', AIRCRAFT_TYPE: 'DH8D', AIRCRAFT_REGISTRATION: 'FXZZX',
    DURATION_BLOCK: '1:00', LDGS_DAY: '2', TIME_BLOCK_START: '10:00', TIME_BLOCK_END: '11:00', DURATION_PIC: '1:00', DURATION_MULTI_PILOT: '1:00', NAME_PIC: 'SELF' },
  { DATE: '2025-07-14', DEPARTURE_AIRPORT: 'LFXC', ARRIVAL_AIRPORT: 'LFXD', ROUTE: 'LFXC|LFXC|LFXD', AIRCRAFT_TYPE: 'DH8D', AIRCRAFT_REGISTRATION: 'FXZZX',
    DURATION_BLOCK: '1:00', LDGS_DAY: '2', TIME_BLOCK_START: '10:00', TIME_BLOCK_END: '11:00', DURATION_PIC: '1:00', DURATION_MULTI_PILOT: '1:00', NAME_PIC: 'SELF' },
  { DATE: '2025-08-01', DEPARTURE_AIRPORT: 'LFTW', ARRIVAL_AIRPORT: 'LFTW', AIRCRAFT_TYPE: 'DH8D', AIRCRAFT_REGISTRATION: 'FXZZX',
    DURATION_BLOCK: '1:00', LDGS_DAY: '1', TIME_BLOCK_START: '10:00', TIME_BLOCK_END: '11:00', DURATION_PIC: '0:40', DURATION_MULTI_PILOT: '1:00', NAME_PIC: 'SELF' },
  { DATE: '2025-09-09', DEPARTURE_AIRPORT: 'LFTW', ARRIVAL_AIRPORT: 'LFTW', AIRCRAFT_TYPE: 'DH8D', AIRCRAFT_REGISTRATION: 'FXZZX',
    DURATION_BLOCK: '1:00', LDGS_DAY: '1', TIME_BLOCK_START: '10:00', TIME_BLOCK_END: '11:00', DURATION_PIC: '1:00', DURATION_MULTI_PILOT: '1:00', NAME_PIC: 'SELF' },
]);
function carnetCorrige() {
  const r = analyserFlyLog(ORIGINE, {}, undefined, '2026-11-04T10:00:00Z');
  const av = new Map(r.avions.map(a => [a.id, a]));
  const [v1, v2, v3, v4] = r.aCreer;
  v1.escales[0].attJour = 1; v1.attJour = 1; v1.modifieLe = '2026-11-20T08:00:00Z';         // a corrigé
  v2.escales = [{ code: 'LFXE', attJour: 1, attNuit: 0 }]; v2.attJour = 1; v2.modifieLe = null; // g et a corrigés, date inconnue
  // v3 : temps des fonctions toujours faux (pas corrigé) ; v4 : supprimé du carnet (vol du fichier non retrouvé)
  return { vols: [v1, v2, v3], avions: av, v4 };
}

test('rattrapage (faux FlyLog) : corrections retrouvées, date = « Modifié le », vol non retrouvé ignoré, relance sans doublon, carnet intact', () => {
  const { vols, avions: av } = carnetCorrige();
  const avant = JSON.stringify(vols), totaux = JSON.stringify(calculerTotaux(vols, av)), csv = texteTableur(vols, av);
  const o = analyserFlyLog(ORIGINE, { avions: [...av.values()] });
  assert.equal(o.avions.length, 0, 'mêmes avions');
  const r = rattrapage({ flVols: o.aCreer, flAvions: av, vols, avions: av, existantes: [] });
  assert.equal(r.retrouves, 3); assert.equal(r.nonRetrouves, 1); assert.equal(r.corrections, 3);
  assert.deepEqual(r.parType, { a: 2, g: 1 });
  const par = new Map(r.nouvelles.map(e => [e.volId, e]));
  assert.equal(par.get(vols[0].id).le, '2026-11-20T08:00:00Z');
  assert.deepEqual(par.get(vols[0].id).l, [{ cle: 'a|LFML', avant: ['LFML : 0 att.'], apres: ['LFML : 1 att.'] }]);
  assert.equal(par.get(vols[1].id).le, null, 'date inconnue');
  assert.deepEqual(par.get(vols[1].id).l.map(a => a.cle).sort(), ['a|LFXC', 'g|LFXC']);
  assert.ok(!par.has(vols[2].id), 'anomalie toujours là : pas corrigé');
  const r2 = rattrapage({ flVols: o.aCreer, flAvions: av, vols, avions: av, existantes: ajouterCorrigees([], r.nouvelles) });
  assert.equal(r2.nouvelles.length, 0, 'relance sans doublon');
  assert.equal(JSON.stringify(vols), avant, 'aucun vol modifié');
  assert.equal(JSON.stringify(calculerTotaux(vols, av)), totaux); assert.equal(texteTableur(vols, av), csv);
});

test('rattrapage : un vol corrigé dans une donnée de l\'import (heure de départ) est retrouvé par sa ligne du fichier ; ignoré = pas corrigé', () => {
  const { vols, avions: av } = carnetCorrige();
  vols[2].tempsCdB = 60; vols[2].hDep = '10:05'; vols[2].tempsTotal = 55; vols[2].tempsCdB = 55;
  const o = analyserFlyLog(ORIGINE, { avions: [...av.values()] });
  let r = rattrapage({ flVols: o.aCreer, flAvions: av, vols, avions: av });
  assert.equal(r.parLigne, 1); assert.equal(r.parType.d, 1);
  vols[0] = ignorer({ ...vols[0], escales: [{ code: 'LFML', attJour: 0, attNuit: 0 }] });
  r = rattrapage({ flVols: o.aCreer, flAvions: av, vols, avions: av });
  assert.ok(!r.nouvelles.some(e => e.volId === vols[0].id), 'anomalie ignorée : toujours là');
});
