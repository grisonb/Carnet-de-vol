// v0.50 (R124) : case OPS = colonne « Vol OPS avant le » (dates INVENTÉES)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireReponseSocle, echeance, SOCLE_COLONNES } from '../../js/socle.js';

const AUJ = '2026-11-17';
const COLONNES = [{ titre: 'Dernier vol', valeur: '16/11/2026' }, { titre: 'Vol OPS a partir du', valeur: '24/11/2026' }, // J+7 : à ne pas confondre
  { titre: 'Vol OPS avant le', valeur: '03/12/2026' }, { titre: 'Entrainement avant le', valeur: '18/12/2026' }, { titre: 'vol IFR avant le', valeur: '08/12/2026' }];

test('OPS = « Vol OPS avant le » (ni « a partir du », ni « Entrainement ») : J-15, veille du 03/12', () => {
  assert.equal(SOCLE_COLONNES.ops, 'Vol OPS avant le');
  const s = lireReponseSocle({ ok: true, colonnes: COLONNES });
  assert.deepEqual(s.ops, { avantLe: '2026-12-03', dernier: '2026-12-02' });
  const e = echeance(s.ops.dernier, AUJ);
  assert.deepEqual([e.texte, e.date, e.couleur], ['J-15', '02/12', 'vert']);
  assert.deepEqual(s.ifr, { avantLe: '2026-12-08', dernier: '2026-12-07' }, 'IFR inchangé');
});

test('colonne « Vol OPS avant le » absente : message clair, pas de plantage', () => {
  const r = lireReponseSocle({ ok: true, colonnes: COLONNES.filter(c => c.titre !== 'Vol OPS avant le') });
  assert.deepEqual(r, { ok: false, erreur: 'Colonne « Vol OPS avant le » introuvable dans la feuille.' });
});
