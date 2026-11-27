// v0.69 : R169 barèmes officiels 2022 à 2025 (montants datés, villes, saisie qui passe avant) ; R167 détachement à cheval sur deux
// années ; R168 étapes. Vols INVENTÉS ; barèmes : données publiques intégrées + montants inventés pour 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAREMES_OFFICIELS, baremeOfficiel } from '../../js/baremes-officiels.js';
import { baremeDe, paysDuBareme, montantA, lignesFrais, anneeFrais, etapesDe, titreLigne, euros } from '../../js/frais.js';
import { volVide } from '../../js/modele.js';

const M = (annee, nom, date, baremes = new Map()) => montantA(paysDuBareme(baremeDe(baremes, annee), nom), date || `${annee}-06-15`);
const vol = (id, date, frais, champs = {}) => ({ ...volVide(), id, date, hDep: '09:00', hArr: '10:24', dep: 'LFTW', arr: 'LFTW', avionId: 'a1', tempsTotal: 84, ...(frais ? { frais } : {}), ...champs });

test('R169 : barèmes 2022 à 2025 intégrés (vol journée, pays, zones) ; 2026 et avant 2022 : vides comme avant', () => {
  assert.deepEqual([...BAREMES_OFFICIELS.keys()], ['2022', '2023', '2024', '2025']);
  const b = baremeDe(new Map(), 2025);
  assert.equal(b.journee, 8700); assert.ok(b.officiel);
  const f = n => { const p = paysDuBareme(b, n); return p && [p.montant, p.zone, p.source]; };
  assert.deepEqual(f('France'), [17400, 'euro', 'bulletin']);
  assert.deepEqual(f('Tunisie'), [12500, 'euro', 'bulletin']);
  assert.deepEqual(f('Japon'), [14754, 'monde', 'bulletin']);
  assert.deepEqual(f('Japon – Tokyo'), [17355, 'monde', 'bulletin']);
  assert.ok(paysDuBareme(b, 'etats-unis – new york'), 'accents et majuscules ignorés');
  for (const a of [2021, 2026]) { const v = baremeDe(new Map(), a); assert.equal(v.journee, null); assert.deepEqual(v.pays.map(p => p.nom), ['France']); assert.ok(!v.officiel); }
  assert.equal(baremeOfficiel(2023).journee, 8450);
});

test('R169 : montants datés (période, sans « au » : jusqu\'au 31/12) et villes', () => {
  assert.equal(M(2023, 'Norvège', '2023-05-10'), 13301); assert.equal(M(2023, 'Norvège', '2023-05-20'), 24514);
  assert.equal(M(2024, 'États-Unis – New York', '2024-08-31'), 29553); assert.equal(M(2024, 'États-Unis – New York', '2024-09-01'), 45253);
  assert.equal(M(2022, 'Afrique du Sud', '2022-03-01'), 18500); assert.equal(M(2022, 'Afrique du Sud', '2022-06-01'), 13800); assert.equal(M(2022, 'Afrique du Sud', '2022-12-05'), 18500);
  assert.equal(M(2024, 'Canada', '2024-07-01'), 17946); assert.equal(M(2024, 'Canada – Toronto', '2024-07-08'), 37464);
  assert.equal(M(2024, 'Norvège', '2024-03-01'), null, 'Norvège 2024 : montant seulement à partir du 16/05');
  assert.equal(M(2025, 'Nigeria – Lagos, Port-Harcourt'), 23000);
});

test('R169 : Croatie : 2023 Euro 169,00 ; 2024 Moyen (Euro-Europe) 142,00 ; 2025 Monde 142,00 (Chypre 2025 : Monde 190,00)', () => {
  const z = (a, n) => { const p = paysDuBareme(baremeDe(new Map(), a), n); return [p.montant, p.zone]; };
  assert.deepEqual(z(2023, 'Croatie'), [16900, 'euro']); assert.deepEqual(z(2024, 'Croatie'), [14200, 'euro']); assert.deepEqual(z(2025, 'Croatie'), [14200, 'monde']);
  assert.deepEqual(z(2025, 'Chypre'), [19000, 'monde']); assert.deepEqual(z(2024, 'Chypre'), [17300, 'euro']);
});

test('R169 : ce qui est saisi à la main passe avant (« modifié ») ; pays ajouté ; laissé vide : le bulletin', () => {
  const baremes = new Map([['2025', { annee: '2025', journee: 9000, pays: [{ nom: 'France', montant: 17400, zone: 'euro' }, { nom: 'Japon', montant: 15000, zone: 'monde' },
    { nom: 'Pays inventé', montant: 10000, zone: 'monde' }, { nom: 'Tunisie', montant: null, zone: 'euro' }] }]]);
  const b = baremeDe(baremes, 2025), f = n => { const p = paysDuBareme(b, n); return [p.montant, p.source]; };
  assert.equal(b.journee, 9000); assert.ok(b.journeeModifiee);
  assert.deepEqual(f('France'), [17400, 'bulletin'], 'même montant que le bulletin : pas modifié');
  assert.deepEqual(f('Japon'), [15000, 'modifie']); assert.deepEqual(f('Pays inventé'), [10000, 'ajoute']); assert.deepEqual(f('Tunisie'), [12500, 'bulletin']);
  const n = baremeDe(new Map([['2023', { journee: null, pays: [{ nom: 'Norvège', montant: 20000, zone: 'euro' }] }]]), 2023);
  assert.equal(montantA(paysDuBareme(n, 'Norvège'), '2023-05-20'), 20000, 'montant saisi : le même toute l\'année');
});

test('R167 : détachement du 30/12/2025 au 02/01/2026 coupé en deux lignes (Euro : 348,00 + 270,00 ; Monde : 2 + 2 jours)', () => {
  const baremes = new Map([['2026', { annee: '2026', journee: 9000, pays: [{ nom: 'France', montant: 18000, zone: 'euro' }, { nom: 'Canada', montant: 21000, zone: 'monde' }] }]]);
  const vols = [vol('a', '2025-12-30'), vol('b', '2026-01-02')];
  let l = lignesFrais({ vols, detachements: [{ id: 'x', du: '2025-12-30', au: '2026-01-02', pays: 'France', nuits: {} }], baremes });
  const p25 = l.find(x => x.annee === '2025'), p26 = l.find(x => x.annee === '2026');
  assert.equal(p25.montant, 34800); assert.equal(p25.detail, '1 + 1 indemnité × 174,00 €'); assert.equal(titreLigne(p25), 'Détachement 4 jours (partie 2025)'); assert.equal(p25.partie, 'debut');
  assert.equal(p26.montant, 27000); assert.equal(p26.detail, '1,5 indemnité × 180,00 €'); assert.equal(p26.partie, 'suite');
  assert.deepEqual([p25.vols.map(v => v.id), p26.vols.map(v => v.id)], [['a'], ['b']]);
  assert.equal(p25.detachementId, p26.detachementId);
  assert.equal(anneeFrais(l, 2025).total + anneeFrais(l, 2026).total, 34800 + 27000);
  l = lignesFrais({ vols, detachements: [{ id: 'y', du: '2025-12-30', au: '2026-01-02', pays: 'Canada', nuits: {} }], baremes });
  assert.deepEqual(l.map(x => [x.annee, x.jours, x.montant]).sort(), [['2025', 2, 40750], ['2026', 2, 42000]]);
  assert.equal(euros(l.find(x => x.annee === '2025').montant), '407,50 €');
});

test('R168 : toutes les étapes, dans l\'ordre, sans répéter un terrain à la suite', () => {
  const a = vol('a', '2026-06-02', { type: 'j2' }, { dep: 'LFTW', arr: 'LFQQ', escales: [{ code: 'LFML', attJour: 1 }] });
  const b = vol('b', '2026-06-03', { type: 'j2' }, { dep: 'LFQQ', arr: 'LFTW', escales: [{ code: 'LFML', attJour: 1 }] });
  assert.equal(etapesDe([a, b]), 'LFTW → LFML → LFQQ → LFML → LFTW');
  const l = lignesFrais({ vols: [b, a], baremes: new Map() });
  assert.equal(l[0].etapes, 'LFTW → LFML → LFQQ → LFML → LFTW');
});
