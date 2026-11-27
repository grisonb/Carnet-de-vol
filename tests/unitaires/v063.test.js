// v0.63 : R157 toutes les modifications des vols dans « Anomalies traitées » (suivi par vol, cartes, rattrapage). Vols INVENTÉS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textesDuVol, majSuivi, lignesSuivi, cleSuivi, estCleSuivi, suiviDepuisFlyLog } from '../../js/suivi.js';
import { cartesTraitees, rattrapage, rattrapageSuivis, ajouterCorrigees, nombreDeVols3, OCTETS_CORRIGEES } from '../../js/anomalies-traitees.js';
import { analyserRecus, cleElement, empreinteTexte, estReglagePartage, elementsDuCarnet, REGLAGES_PARTAGES } from '../../js/synchro.js';
import { creerSauvegarde, REGLAGES_PRIVES } from '../../js/sauvegarde.js';
import { basculerReport } from '../../js/report.js';
import { ignorer } from '../../js/anomalies.js';
import { analyserFlyLog } from '../../js/flylog.js';
import { volVide } from '../../js/modele.js';
import { fauxFlyLog } from '../outils/faux-flylog.js';

const opts = { immatDe: () => 'F-XZZX' };
const vol = (id, champs = {}) => ({ ...volVide(), id, date: '2026-06-13', hDep: '10:00', hArr: '11:00', mode: 'utc', dep: 'LFTW', arr: 'LFTW', avionId: 'a1',
  tempsTotal: 60, tempsCdB: 60, fonction: 'cdb', nomCdB: 'SELF', attJour: 1, modifieLe: '2026-06-13T12:00:00Z', ...champs });

test('suivi : champs changés, origine gardée, deux modifications = une seule origine, retour à l\'origine = ligne retirée', () => {
  const v0 = vol('v1');
  const v1 = { ...v0, approches: 2, remarques: 'Entraînement' };
  let s = majSuivi(null, v0, v1, opts, '2026-11-27T08:00:00Z');
  assert.deepEqual(s, { o: { approches: '0', remarques: '(vide)' }, le: '2026-11-27T08:00:00Z' });
  assert.deepEqual(lignesSuivi(s, v1, opts).map(l => [l.avant, l.apres]), [['Approches : 0', 'Approches : 2'], ['Remarque : (vide)', 'Remarque : «\u00a0Entraînement\u00a0»']]);
  const v2 = { ...v1, approches: 3 };
  s = majSuivi(s, v1, v2, opts, '2026-11-28T08:00:00Z');
  assert.equal(s.o.approches, '0', 'origine inchangée');
  assert.deepEqual(lignesSuivi(s, v2, opts)[0], { k: 'approches', origine: '0', origineAffichee: '0', avant: 'Approches : 0', apres: 'Approches : 3' }); // v0.64 : + origine (bouton « Remettre »)
  const v3 = { ...v2, approches: 0 };
  s = majSuivi(s, v2, v3, opts);
  assert.deepEqual(lignesSuivi(s, v3, opts).map(l => l.k), ['remarques'], 'approches revenues à l\'origine : ligne retirée');
  assert.equal(lignesSuivi(s, { ...v3, remarques: '' }, opts).length, 0, 'tout revenu : plus rien');
});

test('pas suivis : rond « reporté », « ignoré », trace, « Modifié le », champs techniques', () => {
  const v = vol('v1', { escales: [{ code: 'LFML', attJour: 0 }] });
  for (const w of [basculerReport(v), ignorer(v), { ...v, traceImportee: { n: 3 } }, { ...v, modifieLe: '2027-01-01T00:00:00Z' }, { ...v, mode: 'loc', ordre: 5, feuxPositions: [{}], compteursAjoutes: ['x'] }]) {
    assert.equal(majSuivi(null, v, w, opts), null);
  }
  const t = textesDuVol({ ...v, escales: [{ code: 'LFML', attJour: 1 }], compteurs: { ecopages: 4 } }, opts);
  assert.equal(t['att:LFML'], '1 att.'); assert.equal(t['cpt:ecopages'], '4');
  const s = majSuivi(null, v, { ...v, escales: [{ code: 'LFML', attJour: 1, attNuit: 0 }] }, opts);
  assert.deepEqual(lignesSuivi(s, { ...v, escales: [{ code: 'LFML', attJour: 1 }] }, opts).map(l => [l.avant, l.apres]), [['LFML : 0 att.', 'LFML : 1 att.']]);
});

test('cartes : corrigée avec tous les champs changés, modifiée sans anomalie, un vol dans un seul onglet, vol supprimé ou créé absent', () => {
  const a = vol('a', { escales: [{ code: 'LFML', attJour: 0 }] }), a2 = { ...a, escales: [{ code: 'LFML', attJour: 1 }], approches: 2, remarques: 'Entraînement' };
  const b = vol('b'), b2 = { ...b, approches: 2, modifieLe: '2026-11-25T10:00:00Z' };
  const c = vol('c'), c2 = { ...c, approches: 1 };
  const suivis = new Map([['a', majSuivi(null, a, a2, opts)], ['b', majSuivi(null, b, b2, opts)], ['c', majSuivi(null, c, c2, opts)]]);
  const corrigees = [{ id: 's|a', volId: 'a', le: '2026-11-26T10:00:00Z', l: [{ cle: 'a|LFML', avant: [], apres: [] }] }, { id: 's|c', volId: 'c', le: '2026-11-20T10:00:00Z', l: [{ cle: 'b', avant: [], apres: [] }] }];
  const { corrigees: C, modifies: M } = cartesTraitees({ vols: [a2, b2, vol('d')], corrigees, suivis, opts });
  assert.equal(C.length, 1); assert.equal(C[0].volId, 'a');
  assert.deepEqual(C[0].lignes.map(l => `${l.avant} -> ${l.apres}`), ['LFML : 0 att. -> LFML : 1 att.', 'Approches : 0 -> Approches : 2', 'Remarque : (vide) -> Remarque : «\u00a0Entraînement\u00a0»'], 'les 3 champs');
  assert.deepEqual(M.map(x => [x.volId, x.le]), [['b', '2026-11-25T10:00:00Z']], 'c supprimé : rien ; d (créé, jamais modifié) : rien');
  assert.equal(nombreDeVols3(C, M, [{ id: 'a' }, { id: 'z' }]), 3);
});

test('cartes d\'avant la v0.63 (sans suivi) : gardées telles quelles, une seule carte par vol', () => {
  const v = vol('v');
  const corrigees = [{ id: 'fl|v|a|LFML', volId: 'v', le: '2026-11-20T10:00:00Z', origine: 'flylog', l: [{ cle: 'a|LFML', avant: ['LFML : 0 att.'], apres: ['LFML : 1 att.'] }] },
    { id: 's|v|x', volId: 'v', le: '2026-11-26T10:00:00Z', origine: 'saisie', l: [{ cle: 'b', avant: ['Att. nuit : 0'], apres: ['Att. nuit : 1'] }] }];
  const { corrigees: C } = cartesTraitees({ vols: [v], corrigees, opts });
  assert.equal(C.length, 1); assert.equal(C[0].le, '2026-11-26T10:00:00Z'); assert.equal(C[0].lignes, null); assert.equal(C[0].anomalies.length, 2);
});

const ORIGINE = fauxFlyLog([
  { DATE: '2025-06-13', DEPARTURE_AIRPORT: 'LFTW', ARRIVAL_AIRPORT: 'LFTW', ROUTE: 'LFTW|LFML|LFTW', AIRCRAFT_TYPE: 'DH8D', AIRCRAFT_REGISTRATION: 'FXZZX',
    DURATION_BLOCK: '1:00', LDGS_DAY: '2', TIME_BLOCK_START: '10:00', TIME_BLOCK_END: '11:00', DURATION_PIC: '1:00', DURATION_MULTI_PILOT: '1:00', NAME_PIC: 'SELF' },
  { DATE: '2025-08-01', DEPARTURE_AIRPORT: 'LFTW', ARRIVAL_AIRPORT: 'LFTW', AIRCRAFT_TYPE: 'DH8D', AIRCRAFT_REGISTRATION: 'FXZZX',
    DURATION_BLOCK: '1:00', LDGS_DAY: '1', TIME_BLOCK_START: '10:00', TIME_BLOCK_END: '11:00', DURATION_PIC: '1:00', DURATION_MULTI_PILOT: '1:00', NAME_PIC: 'SELF', APPROACH_NR: '1' },
  { DATE: '2025-09-09', DEPARTURE_AIRPORT: 'LFTW', ARRIVAL_AIRPORT: 'LFTW', AIRCRAFT_TYPE: 'DH8D', AIRCRAFT_REGISTRATION: 'FXZZX',
    DURATION_BLOCK: '1:00', LDGS_DAY: '1', TIME_BLOCK_START: '10:00', TIME_BLOCK_END: '11:00', DURATION_PIC: '1:00', DURATION_MULTI_PILOT: '1:00', NAME_PIC: 'SELF' },
]);

test('rattrapage (faux FlyLog) : cartes « Corrigées » complétées sans doublon, « Modifiés » rempli, relance sans doublon, carnet intact', () => {
  const r0 = analyserFlyLog(ORIGINE, {}, undefined, '2026-11-04T10:00:00Z'), av = new Map(r0.avions.map(a => [a.id, a]));
  const [v1, v2, v3] = r0.aCreer;
  v1.escales[0].attJour = 1; v1.approches = 2; v1.modifieLe = '2026-11-20T08:00:00Z'; // anomalie corrigée + approches
  v2.approches = 3; v2.modifieLe = '2026-11-21T08:00:00Z';                         // modifié sans anomalie
  const vols = [v1, v2, v3], avant = JSON.stringify(vols);
  const o = analyserFlyLog(ORIGINE, { avions: [...av.values()] });
  const r = rattrapage({ flVols: o.aCreer, flAvions: av, vols, avions: av });
  const existantes = ajouterCorrigees([], r.nouvelles); // la carte « Corrigées » de la v0.62
  const su = rattrapageSuivis({ paires: r.paires, suivis: new Map(), immatFl: r.immatFl, immatIci: r.immatIci });
  assert.equal(su.modifies, 2); assert.equal(su.suivis.length, 2);
  const suivis = new Map(su.suivis);
  const { corrigees: C, modifies: M } = cartesTraitees({ vols, corrigees: existantes, suivis, opts: { immatDe: () => 'F-XZZX' } });
  assert.equal(C.length, 1); assert.equal(C[0].anomalies.length, 1, 'aucune anomalie en double');
  assert.deepEqual(C[0].lignes.map(l => `${l.avant} -> ${l.apres}`), ['LFML : 0 att. -> LFML : 1 att.', 'Approches : 0 -> Approches : 2']);
  assert.deepEqual(M.map(x => [x.volId, x.lignes.map(l => l.apres)]), [[v2.id, ['Approches : 3']]]);
  // relance : rien de nouveau
  const r2 = rattrapage({ flVols: o.aCreer, flAvions: av, vols, avions: av, existantes });
  assert.equal(r2.nouvelles.length, 0);
  assert.equal(rattrapageSuivis({ paires: r2.paires, suivis, immatFl: r2.immatFl, immatIci: r2.immatIci }).suivis.length, 0);
  assert.equal(JSON.stringify(vols), avant, 'aucun vol modifié');
  // origine FlyLog prioritaire sur une origine notée dans l'app
  const s = suiviDepuisFlyLog({ o: { approches: '2' }, le: 'x' }, o.aCreer[0], v1, opts);
  assert.equal(s.o.approches, '0'); assert.equal(s.le, 'x');
});

test('synchro et sauvegarde : un réglage par vol, partagé, petit ; le plus récent gagne ; question privée', () => {
  assert.ok(estCleSuivi(cleSuivi('abc')) && estReglagePartage(cleSuivi('abc')) && !estReglagePartage('questionModifications'));
  assert.ok(REGLAGES_PARTAGES.includes('rattrapageModifications') && REGLAGES_PRIVES.includes('questionModifications'));
  const s = majSuivi(null, vol('v'), { ...vol('v'), remarques: 'x'.repeat(5000), missions: ['M'.repeat(3000)] }, opts);
  const reglages = [{ cle: cleSuivi('v'), valeur: s }, { cle: 'questionModifications', valeur: 'posee' }];
  const el = elementsDuCarnet({ reglages });
  assert.deepEqual(el.map(e => e.id), [cleSuivi('v')]); assert.ok(JSON.stringify(el[0].donnees).length < 60000);
  assert.deepEqual(creerSauvegarde({ vols: [], avions: [], personnes: [], reglages }).reglages.map(r => r.cle), [cleSuivi('v')]);
  const cle = cleElement('reglages', cleSuivi('v')), h = d => empreinteTexte(JSON.stringify(d));
  const ici = { cle: cleSuivi('v'), valeur: { o: { approches: '0' }, le: 'a' }, modifieLe: '2026-11-27T10:00:00Z' };
  const nas = { cle: cleSuivi('v'), valeur: { o: { approches: '1' }, le: 'b' }, modifieLe: '2026-11-27T11:00:00Z' };
  const r = analyserRecus([{ magasin: 'reglages', id: cleSuivi('v'), rev: 4, donnees: nas }], new Map([[cle, { magasin: 'reglages', id: cleSuivi('v'), donnees: ici, h: h(ici) }]]), { [cle]: [1, 'zz'] });
  assert.equal(r.conflits.length, 0); assert.equal(r.appliquer[0].donnees.valeur.le, 'b', 'le plus récent (NAS) gagne');
  // liste « Corrigées » bornée en taille
  const beaucoup = Array.from({ length: 290 }, (_, i) => ({ id: 'k' + i, volId: 'v' + i, le: new Date(Date.UTC(2026, 0, 1) + i * 6e4).toISOString(), l: [{ cle: 'a|LFML', avant: ['LFML : 0 att.'.repeat(4)], apres: ['LFML : 1 att.'.repeat(4)] }] }));
  assert.ok(JSON.stringify(ajouterCorrigees([], beaucoup)).length <= OCTETS_CORRIGEES);
});

test('rattrapage avec l\'export FlyLog brut (sans FEU ni largages décodés) : ces colonnes ne comptent pas comme modifiées', async () => {
  const { champsAbsents } = await import('../../js/suivi.js');
  assert.deepEqual(champsAbsents(['DATE', 'FEU']), ['cpt:largCdbDash', 'cpt:largInstrCdbDash']);
  const v = vol('v', { feux: 1, compteurs: { largCdbDash: 3 } }), f = vol('f', { feux: 0, compteurs: {} });
  assert.ok(suiviDepuisFlyLog(null, f, v, opts));
  assert.equal(suiviDepuisFlyLog(null, f, v, { ...opts, sauf: champsAbsents(['DATE']) }), null);
  assert.deepEqual(Object.keys(suiviDepuisFlyLog(null, f, { ...v, approches: 1 }, { ...opts, sauf: champsAbsents(['DATE']) }).o), ['approches']);
});
