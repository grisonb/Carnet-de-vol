// v0.61 : R154 « reporté sur le carnet papier » (logique pure + synchro : le rond seul changé des deux côtés -> le plus récent).
// Vols INVENTÉS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estAReporter, nbAReporter, basculerReport, seulReportDiffere, plusRecentReport } from '../../js/report.js';
import { analyserRecus, cleElement, empreinteTexte } from '../../js/synchro.js';
import { texteTableur, COLONNES_TABLEUR } from '../../js/sauvegarde.js';
import { calculerTotaux } from '../../js/totaux.js';
import { volVide } from '../../js/modele.js';

const vol = (id, champs = {}) => ({ ...volVide(), id, date: '2026-11-10', hDep: '10:00', hArr: '11:00', mode: 'utc', dep: 'LFTW', arr: 'LFTW', avionId: 'a1', tempsTotal: 60,
  tempsCdB: 60, fonction: 'cdb', nomCdB: 'SELF', attJour: 1, modifieLe: '2026-11-10T12:00:00Z', ...champs });

test('un vol sans l\'information est reporté ; nouveau vol à reporter ; simulation jamais à reporter', () => {
  assert.equal(estAReporter(vol('a')), false);
  assert.equal(estAReporter(vol('b', { aReporter: true })), true);
  assert.equal(estAReporter(vol('c', { aReporter: true, simulation: true })), false);
  assert.equal(nbAReporter([vol('a'), vol('b', { aReporter: true }), vol('d', { aReporter: true })]), 2);
  assert.ok(!('aReporter' in volVide()), 'un vol vide (import FlyLog…) n\'a pas le champ');
});

test('appui sur le rond : bascule, heure gardée dans reporteLe, vol d\'origine intact', () => {
  const v = vol('a');
  const b = basculerReport(v, '2026-11-20T08:00:00Z');
  assert.equal(b.aReporter, true); assert.equal(b.reporteLe, '2026-11-20T08:00:00Z'); assert.ok(!('aReporter' in v));
  const c = basculerReport(b, '2026-11-20T09:00:00Z');
  assert.ok(!('aReporter' in c)); assert.equal(c.reporteLe, '2026-11-20T09:00:00Z');
  assert.ok(seulReportDiffere(v, b) && seulReportDiffere(b, c));
  assert.ok(!seulReportDiffere(v, { ...b, remarques: 'AUTRE' }));
  assert.equal(plusRecentReport(c, b), 'a'); assert.equal(plusRecentReport(b, c), 'b');
});

test('synchro : rond changé des deux côtés -> le plus récent gagne, sans conflit ; autre changement -> conflit (inchangé)', () => {
  const base = vol('x'), h = d => empreinteTexte(JSON.stringify(d)), cle = cleElement('vols', 'x');
  const carte = { [cle]: [5, h(base)] };
  const ici = basculerReport(base, '2026-11-20T08:00:00Z');                     // ici : à reporter (08:00)
  const nas = basculerReport(basculerReport(base, '2026-11-20T09:00:00Z'), '2026-11-20T09:30:00Z'); // NAS : reporté (09:30)
  const locaux = new Map([[cle, { magasin: 'vols', id: 'x', donnees: ici, h: h(ici) }]]);
  let r = analyserRecus([{ magasin: 'vols', id: 'x', rev: 7, donnees: nas }], locaux, carte);
  assert.equal(r.conflits.length, 0); assert.equal(r.appliquer.length, 1); assert.ok(!('aReporter' in r.appliquer[0].donnees));
  assert.deepEqual(r.carte[cle], [7, h(nas)]);
  // ici plus récent : gardé (il repartira), aucun conflit
  const ici2 = basculerReport(base, '2026-11-20T10:00:00Z');
  r = analyserRecus([{ magasin: 'vols', id: 'x', rev: 7, donnees: nas }], new Map([[cle, { magasin: 'vols', id: 'x', donnees: ici2, h: h(ici2) }]]), carte);
  assert.equal(r.conflits.length, 0); assert.equal(r.appliquer.length, 0); assert.deepEqual(r.carte[cle], [7, h(nas)]);
  // une vraie modification (remarques) des deux côtés : conflit, comme avant
  const autre = { ...nas, remarques: 'MODIFIÉ AILLEURS' };
  r = analyserRecus([{ magasin: 'vols', id: 'x', rev: 7, donnees: autre }], locaux, carte);
  assert.equal(r.conflits.length, 1);
});

test('PDF / CSV / totaux : le rond n\'y est pas', () => {
  const avions = new Map([['a1', { id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', equipage: 'MP', moteurs: 'ME' }]]);
  const a = vol('a'), b = basculerReport(a, '2026-11-20T08:00:00Z');
  assert.equal(JSON.stringify(calculerTotaux([b], avions, '2026-12-31')), JSON.stringify(calculerTotaux([a], avions, '2026-12-31')));
  assert.equal(texteTableur([b], avions), texteTableur([a], avions));
  assert.ok(!COLONNES_TABLEUR.some(c => /report/i.test(c[0])));
});

// ---------- R155 : anomalies ----------
import { anomaliesDuCarnet, anomaliesDuVol, ignorer, estIgnore } from '../../js/anomalies.js';
import { fusionnerEtats } from '../../js/report.js';
const TERRAINS = { LFTW: { lat: 43.757, lon: 4.416 }, LFML: { lat: 43.437, lon: 5.215 }, LFTH: { lat: 43.097, lon: 6.146 } };
const terrainDe = c => TERRAINS[String(c || '').toUpperCase()] || null;
const AV = new Map([['a1', { id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', equipage: 'MP', moteurs: 'ME' }], ['a2', { id: 'a2', immat: 'F-XZZB', typeOACI: 'DH8D' }],
  ['s1', { id: 's1', immat: 'SIM-ESSAI', sim: true }]]);
const jour = (id, champs = {}) => vol(id, { date: '2026-06-15', hDep: '08:00', hArr: '09:30', tempsTotal: 90, tempsCdB: 90, attJour: 1, attNuit: 0, ...champs });
const types = (m, id) => (m.get(id) || []).map(a => a.type).sort().join('');

test('R155 : une anomalie de chaque sorte (a à h)', () => {
  const vols = [
    jour('a', { date: '2026-06-01', dep: 'LFTW', arr: 'LFTW', escales: [{ code: 'LFML', attJour: 0, attNuit: 0 }], attJour: 2 }),
    jour('b', { date: '2026-01-10', hDep: '16:30', hArr: '18:30', tempsTotal: 120, tempsCdB: 120, attJour: 1, attNuit: 0 }), // arrivée 18h30 UTC en janvier : nuit
    jour('c', { date: '2026-06-03', tempsNuit: 100 }),
    jour('d', { date: '2026-06-04', tempsCdB: 60, tempsCopi: 0 }),
    jour('e', { date: '2026-06-05', hDep: '14:00', hArr: '10:00' }),
    jour('f1', { date: '2026-06-16', hDep: '08:00', hArr: '09:30' }), jour('f2', { date: '2026-06-16', hDep: '09:00', hArr: '10:00', avionId: 'a2', tempsTotal: 60, tempsCdB: 60 }),
    jour('g', { date: '2026-06-17', dep: 'LFTH', arr: 'LFTW', escales: [{ code: 'LFTH', attJour: 1, attNuit: 0 }], attJour: 2 }),
    jour('h1', { date: '2026-06-18' }), jour('h2', { date: '2026-06-18' }),
  ];
  const m = anomaliesDuCarnet(vols, AV, terrainDe);
  assert.equal(types(m, 'a'), 'a'); assert.equal(types(m, 'b'), 'b'); assert.equal(types(m, 'c'), 'c'); assert.equal(types(m, 'd'), 'd');
  assert.equal(types(m, 'e'), 'e'); assert.equal(types(m, 'f1'), 'f'); assert.equal(types(m, 'f2'), 'f'); assert.equal(types(m, 'g'), 'g');
  assert.equal(types(m, 'h1'), 'h'); assert.equal(types(m, 'h2'), 'h');
  assert.equal(m.get('a')[0].texte, 'LFML (terrain intermédiaire) : 0 atterrissage');
  assert.match(m.get('e')[0].texte, /^Arrivée \(10h00 UTC\) avant le départ \(14h00 UTC\)/);
  assert.equal(m.size, 10);
});

test('R155 : cas voisins corrects, aucun « ! »', () => {
  const vols = [
    jour('ar', { dep: 'LFTW', arr: 'LFTW' }),                                                       // aller-retour sans intermédiaire
    jour('minuit', { date: '2026-06-20', hDep: '23:00', hArr: '00:30', attJour: 0, attNuit: 1, tempsNuit: 90 }), // passe minuit (UTC), de nuit
    jour('t1', { date: '2026-06-21', hDep: '08:00', hArr: '09:00', tempsTotal: 60, tempsCdB: 60 }), jour('t2', { date: '2026-06-21', hDep: '09:00', hArr: '10:00', tempsTotal: 60, tempsCdB: 60 }), // se touchent
    jour('instFL', { date: '2026-06-22', fonction: 'inst', tempsInst: 90, tempsCdB: 90 }),          // instructeur à la FlyLog (Inst + CdB)
    jour('instApp', { date: '2026-06-23', fonction: 'inst', tempsInst: 90, tempsCdB: 0 }),           // instructeur saisi dans l'app
    jour('copi', { date: '2026-06-24', fonction: 'copi', tempsCdB: 0, tempsCopi: 90 }),
    jour('etapes', { date: '2026-06-25', escales: [{ code: 'LFML', attJour: 1, attNuit: 0 }], attJour: 1 }), // 2 étapes, 1 atterrissage
    { ...jour('sim', { date: '2026-06-26', avionId: 's1', tempsTotal: 0, simTemps: 120, hDep: '08:00', hArr: '07:00' }) }, // simulateur : non contrôlé
    jour('groupe', { date: '2026-06-27', hDep: '08:00', hArr: '12:30', tempsTotal: 105, tempsCdB: 105, volsGroupes: true, tempsNuit: 0 }),
  ];
  const m = anomaliesDuCarnet(vols, AV, terrainDe);
  assert.deepEqual([...m.keys()], []);
});

test('R155 : vol de plus de 10 h ; temps instructeur > temps de vol', () => {
  assert.equal(anomaliesDuVol(jour('x', { hDep: '06:00', hArr: '17:00', tempsTotal: 660, tempsCdB: 660 }), terrainDe)[0].texte, 'Vol de 11h00 (plus de 10 h)');
  assert.ok(anomaliesDuVol(jour('y', { fonction: 'inst', tempsInst: 120, tempsCdB: 90 }), terrainDe).some(a => /Temps instructeur/.test(a.texte)));
});

test('R155 : « Ignorer » enlève le « ! » sans toucher aux données ; il revient si le vol change et qu\'une anomalie est détectée', () => {
  const v = jour('c', { tempsNuit: 100 }), iv = ignorer(v, '2026-11-26T08:00:00Z');
  assert.ok(estIgnore(iv) && !anomaliesDuCarnet([iv], AV, terrainDe).has('c'));
  const { anomaliesIgnorees, ...sansIgnore } = iv;
  assert.deepEqual(sansIgnore, v, 'données du vol identiques');
  const modifie = { ...iv, tempsIFR: 100 };
  assert.ok(!estIgnore(modifie) && anomaliesDuCarnet([modifie], AV, terrainDe).has('c'), 'vol modifié + anomalie : le « ! » revient');
  assert.ok(!anomaliesDuCarnet([{ ...iv, remarques: 'AUTRE TEXTE' }], AV, terrainDe).has('c'), 'remarques seules : reste ignoré');
  assert.ok(!estIgnore(v), 'ancienne sauvegarde (sans l\'information) : rien d\'ignoré');
});

test('R155 : synchro : rond et « ignoré » changés chacun sur un appareil : les deux sont gardés', () => {
  const base = jour('c', { tempsNuit: 100 });
  const ici = basculerReport(base, '2026-11-26T08:00:00Z');                  // rond changé ici
  const nas = ignorer(base, '2026-11-26T09:00:00Z');                         // « ! » ignoré là-bas
  const f = fusionnerEtats(ici, nas);
  assert.equal(f.aReporter, true); assert.ok(estIgnore(f));
  const h = d => empreinteTexte(JSON.stringify(d)), cle = cleElement('vols', 'c');
  const r = analyserRecus([{ magasin: 'vols', id: 'c', rev: 9, donnees: nas }], new Map([[cle, { magasin: 'vols', id: 'c', donnees: ici, h: h(ici) }]]), { [cle]: [4, h(base)] });
  assert.equal(r.conflits.length, 0); assert.equal(r.appliquer.length, 1);
  assert.equal(r.appliquer[0].donnees.aReporter, true); assert.ok(estIgnore(r.appliquer[0].donnees));
});

test('R155 : 4 000 vols : calcul en moins de 300 ms', () => {
  const vols = Array.from({ length: 4000 }, (_, k) => jour(`p${k}`, { date: new Date(Date.UTC(2020, 0, 1) + k * 864e5 / 2).toISOString().slice(0, 10), hDep: k % 2 ? '14:00' : '08:00', hArr: k % 2 ? '15:30' : '09:30',
    dep: 'LFTW', arr: k % 3 ? 'LFML' : 'LFTW', escales: k % 7 ? [] : [{ code: 'LFTH', attJour: 1 }], attJour: 2 }));
  const t = performance.now(); anomaliesDuCarnet(vols, AV, terrainDe); const d = performance.now() - t;
  assert.ok(d < 300, `${d.toFixed(0)} ms`);
});
