// v0.57 : R147 « Amerrissages SEP » n'est plus coché d'office sur les monomoteurs piston. Données INVENTÉES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { departDuType, compteursParDefaut, compteursDuVol, listeCompteurs, changerChoix } from '../../js/compteurs.js';
import { COMPTEURS_DEFAUT } from '../../js/modele.js';
import { TYPES } from '../../js/types-avion.js';

const SEP = { equipage: 'SP', moteurs: 'SE', moteur: 'P' };
const liste = listeCompteurs({}, COMPTEURS_DEFAUT);
const aff = (avion, vol = {}, parType = {}) => compteursDuVol({ avion, vol, liste, parType, ancien: COMPTEURS_DEFAUT }).map(c => c.cle);

test('R147 : aucun type ne coche « Amerrissages SEP » de départ ; Dash 8 et CL-415 comme en v0.56', () => {
  for (const t of TYPES) assert.ok(!departDuType(t.code, t, COMPTEURS_DEFAUT).includes('amerrSEP'), t.code);
  for (const code of ['DR40', 'C172', 'CP10']) assert.deepEqual(aff({ id: code, typeOACI: code, ...SEP }), [], code);
  assert.deepEqual(departDuType('DH8D', {}, COMPTEURS_DEFAUT), ['feux', 'largCdbDash', 'largInstrCdbDash']);
  assert.deepEqual(departDuType('CL2T', {}, COMPTEURS_DEFAUT), ['feux', 'ecopages', 'amerrCL', 'largCopiCL']);
});

test('R147 : une valeur reste affichée ; mes réglages (type, avion) gardés ; cocher « Pour le type » marche', () => {
  const dr = { id: 'd', typeOACI: 'DR40', ...SEP };
  assert.deepEqual(aff(dr, { compteurs: { amerrSEP: 2 } }), ['amerrSEP']);
  assert.deepEqual(aff(dr, {}, { DR40: ['amerrSEP'] }), ['amerrSEP'], 'type réglé à la main');
  assert.deepEqual(compteursParDefaut({ ...dr, compteursPropres: ['amerrSEP'] }, {}, COMPTEURS_DEFAUT), ['amerrSEP'], 'avion réglé à la main');
  const r = changerChoix({ cocher: true, portee: 'type', cle: 'amerrSEP', avion: dr, ajoutes: [], parType: {}, ancien: COMPTEURS_DEFAUT });
  assert.deepEqual(r.typeListe, ['amerrSEP']);
});
