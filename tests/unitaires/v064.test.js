// v0.64 : R160 / R161 arrondi au dixième d'heure. Valeurs inventées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrondiDixieme, enDixiemesPoint } from '../../js/temps.js';

test('R160 : nuit arrondie à 6 min (reste 0-2 : en dessous, 3-5 : au-dessus)', () => {
  assert.deepEqual([14, 15, 20, 21, 2, 0, 3, 6, 59, 60].map(arrondiDixieme), [12, 18, 18, 24, 0, 0, 6, 6, 60, 60]);
});
// v0.67 (R164) : le petit temps « 1,4 » (virgule) de R161 est remplacé par le format « dixième » (point) : enDixiemesPoint
test('R161 -> R164 : temps de vol en dixièmes', () => {
  assert.deepEqual([84, 70, 32, 86, 87, 0, 600].map(enDixiemesPoint), ['1.4', '1.2', '0.5', '1.4', '1.5', '0.0', '10.0']);
});
