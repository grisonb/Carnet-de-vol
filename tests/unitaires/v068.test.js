// v0.68 : R166 frais d'escale (calcul, lignes, années, synchro). Barème INVENTÉ : vol journée 87,00 ; France, Espagne, Portugal
// 174,00 Euro-Europe ; Canada 203,75 Monde ; Maroc sans montant. Vols INVENTÉS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lignesFrais, anneeFrais, anneesFrais, euros, lireMontant, calculer, baremeDe, detachementDe, typeDuVol, nuitsDe, estCleFrais,
  cleBareme, cleDetachement, montantLigne, titreLigne } from '../../js/frais.js';
import { estReglagePartage, analyserRecus, cleElement, empreinteTexte } from '../../js/synchro.js';
import { seulReportDiffere, fusionnerEtats } from '../../js/report.js';
import { creerSauvegarde, texteTableur } from '../../js/sauvegarde.js';
import { calculerTotaux } from '../../js/totaux.js';
import { volVide } from '../../js/modele.js';

const B26 = { annee: '2026', journee: 8700, pays: [{ nom: 'France', montant: 17400, zone: 'euro' }, { nom: 'Espagne', montant: 17400, zone: 'euro' },
  { nom: 'Portugal', montant: 17400, zone: 'euro' }, { nom: 'Canada', montant: 20375, zone: 'monde' }, { nom: 'Maroc', montant: null, zone: 'monde' }] };
const baremes = new Map([['2026', B26]]);
const vol = (id, date, frais, champs = {}) => ({ ...volVide(), id, date, hDep: '09:00', hArr: '10:24', dep: 'LFTW', arr: 'LFTW', avionId: 'a1', tempsTotal: 84, tempsCdB: 84,
  modifieLe: '2026-10-01T08:00:00Z', ...(frais ? { frais } : {}), ...champs });
const L = (vols, detachements = []) => lignesFrais({ vols, detachements, baremes });

test('montants en centimes, écrits à la française', () => {
  assert.deepEqual(['87', '174,00', '203,75', '1 234,5 €', '', 'abc'].map(lireMontant), [8700, 17400, 20375, 123450, null, NaN]);
  assert.equal(euros(234900).replace(/ /g, ' '), '2 349,00 €'); assert.equal(euros(61125), '611,25 €');
});

test('vol journée : 87,00 € ; deux vols le même jour : une seule ligne ; barème absent : « Montant manquant »', () => {
  let l = L([vol('a', '2026-06-14', { type: 'journee' }), vol('b', '2026-06-14', { type: 'journee' }, { hDep: '14:00' })]);
  assert.equal(l.length, 1); assert.equal(l[0].montant, 8700); assert.equal(l[0].vols.length, 2);
  l = lignesFrais({ vols: [vol('a', '2025-06-14', { type: 'journee' })], baremes });
  assert.equal(montantLigne(l[0]), 'Montant manquant'); assert.equal(anneeFrais(l, 2025).total, 0);
});

test('J+2 : deux jours qui se suivent = une ligne (1,5 × 174 = 261) ; seul : incomplet, 0 € ; Monde : 2 indemnités', () => {
  let l = L([vol('a', '2026-06-02', { type: 'j2', pays: 'France' }), vol('b', '2026-06-03', { type: 'j2' }), vol('c', '2026-06-20', { type: 'j2' })]);
  const p = l.find(x => x.id === 'j2|2026-06-02'), i = l.find(x => x.incomplet);
  assert.equal(p.montant, 26100); assert.equal(p.detail, '1,5 indemnité × 174,00 €'); assert.equal(p.nuits.length, 1);
  assert.equal(titreLigne(i), 'J+2 incomplet'); assert.equal(anneeFrais(l, 2026).total, 26100);
  l = L([vol('a', '2026-06-02', { type: 'j2', pays: 'Canada' }), vol('b', '2026-06-03', { type: 'j2' })]);
  assert.equal(l[0].montant, 40750);
});

test('détachement Euro : 1 + 1 + 1,5 (nuits modifiables) ; les vols de ses dates n\'y comptent qu\'une fois, jamais ailleurs', () => {
  const d = { id: 'x', du: '2026-07-06', au: '2026-07-09', pays: 'Espagne', nuits: { '2026-07-07': 'Portugal' } };
  const vols = [vol('a', '2026-07-06', { type: 'journee' }), vol('b', '2026-07-09'), vol('c', '2026-07-10', { type: 'journee' })];
  const l = L(vols, [d]);
  const det = l.find(x => x.type === 'detachement');
  assert.equal(det.montant, 60900); assert.equal(det.detail, '1 + 1 + 1,5 indemnité × 174,00 €');
  assert.deepEqual(nuitsDe(d).map(n => n.pays), ['Espagne', 'Portugal', 'Espagne']);
  assert.deepEqual(det.vols.map(v => v.id), ['a', 'b']);
  assert.equal(l.filter(x => x.type === 'journee').length, 1, 'seul le vol du 10 compte en vol journée');
  assert.equal(typeDuVol(vols[0], [d]), 'detachement'); assert.equal(typeDuVol(vols[2], [d]), 'journee');
  assert.equal(detachementDe([{ ...d, supprime: true }], '2026-07-07'), null, 'détachement supprimé : plus rien');
});

test('détachement Monde : 3 jours × 203,75 = 611,25 ; pays sans montant : « Montant manquant », 0 € ; montants différents : détaillés', () => {
  let l = L([], [{ id: 'y', du: '2026-08-01', au: '2026-08-03', pays: 'Canada', nuits: {} }]);
  assert.equal(l[0].montant, 61125); assert.equal(l[0].detail, '3 indemnités × 203,75 €');
  l = L([], [{ id: 'z', du: '2026-09-01', au: '2026-09-02', pays: 'Maroc', nuits: {} }]);
  assert.equal(montantLigne(l[0]), 'Montant manquant'); assert.equal(anneeFrais(l, 2026).total, 0);
  const b = { ...B26, pays: [...B26.pays, { nom: 'Italie', montant: 18000, zone: 'euro' }] };
  const c = calculer('euro', ['Espagne', 'Italie', 'Espagne'], 4, b);
  assert.equal(c.montant, 17400 + 18000 + 26100); assert.equal(c.detail, '1 × 174,00 € + 1 × 180,00 € + 1,5 × 174,00 €');
});

test('années : une ligne par année (date de début), plus récente en haut ; total ; barème par année, France d\'office', () => {
  const l = L([vol('a', '2026-06-14', { type: 'journee' }), vol('b', '2025-12-20', { type: 'journee' })], [{ id: 'w', du: '2025-12-30', au: '2026-01-02', pays: 'France', nuits: {} }]);
  assert.deepEqual(anneesFrais(l), ['2026', '2025']);
  assert.equal(anneeFrais(l, 2025).lignes.length, 2, 'le détachement du 30/12 au 02/01 compte en 2025');
  assert.equal(anneeFrais(l, 2026).total, 8700);
  assert.deepEqual(baremeDe(new Map(), 2024).pays, [{ nom: 'France', montant: null, zone: 'euro' }]);
  assert.equal(baremeDe(new Map([['2024', { journee: 1, pays: [{ nom: 'Espagne', montant: 1, zone: 'euro' }] }]]), 2024).pays[0].nom, 'France');
});

test('synchro et sauvegarde : détachements et barèmes partagés, case du vol fusionnée (la plus récente), carnet EASA inchangé', () => {
  assert.ok(estCleFrais(cleBareme(2026)) && estCleFrais(cleDetachement('x')) && estReglagePartage(cleBareme(2026)) && estReglagePartage(cleDetachement('x')));
  const reglages = [{ cle: cleBareme(2026), valeur: B26 }, { cle: cleDetachement('x'), valeur: { id: 'x', du: '2026-07-06', au: '2026-07-09', pays: 'Espagne', nuits: {} } }];
  assert.equal(creerSauvegarde({ vols: [], avions: [], personnes: [], reglages }).reglages.length, 2);
  assert.ok(JSON.stringify(reglages[0].valeur).length < 60000);
  const v = vol('a', '2026-06-14', null), ici = { ...v, frais: { type: 'journee', le: '2026-11-27T10:00:00Z' } }, nas = { ...v, frais: { type: 'j2', pays: 'France', le: '2026-11-27T11:00:00Z' } };
  assert.ok(seulReportDiffere(ici, nas));
  assert.equal(fusionnerEtats(ici, nas).frais.type, 'j2'); assert.equal(fusionnerEtats(nas, ici).frais.type, 'j2');
  const cle = cleElement('vols', 'a'), h = d => empreinteTexte(JSON.stringify(d));
  const r = analyserRecus([{ magasin: 'vols', id: 'a', rev: 5, donnees: nas }], new Map([[cle, { magasin: 'vols', id: 'a', donnees: ici, h: h(ici) }]]), { [cle]: [1, h(v)] });
  assert.equal(r.conflits.length, 0); assert.equal(r.appliquer[0].donnees.frais.type, 'j2');
  const avions = new Map([['a1', { id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', equipage: 'MP', moteurs: 'ME', moteur: 'T' }]]);
  assert.equal(texteTableur([v], avions), texteTableur([ici], avions), 'CSV identique');
  assert.equal(JSON.stringify(calculerTotaux([v], avions)), JSON.stringify(calculerTotaux([ici], avions)), 'totaux identiques');
});
