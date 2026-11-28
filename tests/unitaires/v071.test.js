// v0.71 : R180 (décocher un vol seul), R181 (J.1 coche J.2 le lendemain). Vols INVENTÉS ; barème 2025 = barème officiel intégré (public).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lignesFrais, changerCase, typeDuVol, montantLigne } from '../../js/frais.js';
import { volVide } from '../../js/modele.js';

let n = 0;
const vol = (id, date, h, frais) => ({ ...volVide(), id, date, hDep: h, hArr: h, dep: 'LFTW', arr: 'LFTW', avionId: 'a1', tempsTotal: 60, modifieLe: '2025-10-01T08:00:00Z', ordre: ++n,
  ...(frais ? { frais: { le: '2025-11-01T08:00:00Z', ...frais } } : {}) });
// applique les changements renvoyés par changerCase
const appliquer = (vols, ch) => { const m = new Map(ch.map(v => [v.id, v])); return vols.map(v => m.get(v.id) || v); };
const appui = (vols, id, t) => appliquer(vols, changerCase(vols, id, t, `2025-12-0${++n % 9 + 1}T10:00:00Z`));
const types = vols => Object.fromEntries(vols.map(v => [v.id, (v.frais && v.frais.type) || null]));
const L = vols => lignesFrais({ vols, baremes: new Map(), paysDe: () => 'France' });

test('R180 : cocher VOL JOURNÉE sur un vol coche les trois ; décocher le 2e laisse les deux autres ; plus aucun : plus de ligne', () => {
  let v = [vol('a', '2025-12-03', '07:00'), vol('b', '2025-12-03', '10:00'), vol('c', '2025-12-03', '14:00')];
  v = appui(v, 'a', 'journee');
  assert.deepEqual(types(v), { a: 'journee', b: 'journee', c: 'journee' });
  v = appui(v, 'b', 'journee');
  assert.deepEqual(types(v), { a: 'journee', b: null, c: 'journee' }, 'décocher : ce vol seulement');
  assert.ok(v.find(x => x.id === 'b').frais.decoche, 'marqué « décoché à la main »');
  let l = L(v);
  assert.equal(l.length, 1); assert.deepEqual(l[0].vols.map(x => x.id), ['a', 'c'], 'la ligne n\'a que les deux vols cochés');
  assert.equal(montantLigne(l[0]).replace(/ /g, ' '), '87,00 €');
  // recocher sur un autre vol : le vol décoché à la main n'est pas recoché tout seul
  v = appui(v, 'c', 'journee'); v = appui(v, 'c', 'journee');
  assert.equal(types(v).c, 'journee');
  v = appui(v, 'a', 'journee'); v = appui(v, 'c', 'journee');
  assert.deepEqual(types(v), { a: null, b: null, c: null });
  assert.equal(L(v).length, 0, 'plus aucun vol coché : la ligne disparaît');
  v = appui(v, 'a', 'journee');
  assert.deepEqual(types(v), { a: 'journee', b: null, c: null }, 'vols décochés à la main : jamais recochés tout seuls');
  v = appui(v, 'b', 'journee');
  assert.equal(types(v).b, 'journee', 'cochés à la main : oui');
});

test('R180 : changer de case sur un vol change les vols du jour qui avaient la même case ; une autre case reste', () => {
  let v = [vol('a', '2025-12-03', '07:00', { type: 'journee' }), vol('b', '2025-12-03', '10:00', { type: 'journee' }), vol('c', '2025-12-03', '14:00', { type: 'j2' })];
  v = appui(v, 'a', 'j1');
  assert.deepEqual(types(v), { a: 'j1', b: 'j1', c: 'j2' });
  assert.equal(typeDuVol(v[2], []), 'j2');
});

test('R181 : J.1 le 17 -> J.2 tout seul sur les vols du 18, sauf celui en VOL JOURNÉE ; décocher un J.2 seul ; décocher le J.1 retire les J.2 automatiques', () => {
  let v = [vol('a1', '2025-11-17', '07:00'), vol('a2', '2025-11-17', '10:00'),
    vol('b1', '2025-11-18', '07:00'), vol('b2', '2025-11-18', '09:00', { type: 'journee' }), vol('b3', '2025-11-18', '12:00'), vol('b4', '2025-11-18', '15:00')];
  v = appui(v, 'a1', 'j1');
  assert.deepEqual(types(v), { a1: 'j1', a2: 'j1', b1: 'j2', b2: 'journee', b3: 'j2', b4: 'j2' });
  assert.ok(v.find(x => x.id === 'b1').frais.auto, 'J.2 marqué « mis tout seul »');
  let p = L(v).find(x => x.sorte === 'paire');
  assert.deepEqual(p.vols.map(x => x.id), ['a1', 'a2', 'b1', 'b3', 'b4']); assert.equal(p.montant, 26100);
  assert.equal(L(v).filter(x => x.type === 'journee').length, 1, 'le vol du 18 en VOL JOURNÉE reste VOL JOURNÉE');
  v = appui(v, 'b3', 'j2');
  assert.deepEqual(types(v), { a1: 'j1', a2: 'j1', b1: 'j2', b2: 'journee', b3: null, b4: 'j2' }, 'décocher un J.2 seul');
  // un J.2 coché à la main reste quand le J.1 est retiré
  v = appui(v, 'b3', 'j2');
  assert.equal(types(v).b3, 'j2'); assert.ok(!v.find(x => x.id === 'b3').frais.auto);
  v = appui(v, 'a1', 'j1');
  assert.deepEqual(types(v), { a1: null, a2: 'j1', b1: 'j2', b2: 'journee', b3: 'j2', b4: 'j2' }, 'il reste un J.1 ce jour-là : rien ne bouge le lendemain');
  v = appui(v, 'a2', 'j1');
  assert.deepEqual(types(v), { a1: null, a2: null, b1: null, b2: 'journee', b3: 'j2', b4: null }, 'plus de J.1 : les J.2 automatiques retirés, pas celui coché à la main');
  assert.ok(!v.find(x => x.id === 'b1').frais.decoche, 'retirés tout seuls : pas « décochés à la main »');
});

test('R181 : le J.2 automatique ne touche pas un vol du lendemain décoché à la main', () => {
  let v = [vol('a', '2025-11-17', '07:00'), vol('b', '2025-11-18', '07:00', { type: null, decoche: true }), vol('c', '2025-11-18', '09:00')];
  v = appui(v, 'a', 'j1');
  assert.deepEqual(types(v), { a: 'j1', b: null, c: 'j2' });
});
