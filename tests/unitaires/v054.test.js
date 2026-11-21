// v0.54 : R133 bulle Feu, R134 répartition des atterrissages, R135 « Dash 8 / … » (données INVENTÉES)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repartitionAtterrissages } from '../../js/nuit.js';
import { pastilleFeu } from '../../js/missions.js';
import { choixParType, valeurBande, normaliserBande } from '../../js/bande.js';
import { calculerTotaux } from '../../js/totaux.js';

test('R134 : jour 3 -> 3 J / 0 N ; jour puis nuit 5 -> 4 / 1, 1 -> 0 / 1 ; tout de nuit 2 -> 0 / 2 ; nuit puis jour -> de jour', () => {
  assert.deepEqual(repartitionAtterrissages(3, false, false), { jour: 3, nuit: 0 });
  assert.deepEqual(repartitionAtterrissages(5, false, true), { jour: 4, nuit: 1 });
  assert.deepEqual(repartitionAtterrissages(1, false, true), { jour: 0, nuit: 1 });
  assert.deepEqual(repartitionAtterrissages(2, true, true), { jour: 0, nuit: 2 });
  assert.deepEqual(repartitionAtterrissages(2, true, false), { jour: 2, nuit: 0 });
  assert.deepEqual(repartitionAtterrissages(0, false, true), { jour: 0, nuit: 0 });
});

test('R133 : toujours en rouge plein ; « Feu n°7 », « Feu n°41, 42 », « Feu » sans numéro', () => {
  assert.deepEqual(pastilleFeu({ missions: ['FEU n°7 ESSAI'], feux: 1 }), { texte: 'Feu n°7', plein: true });
  assert.deepEqual(pastilleFeu({ missions: ['FEU n°41 ESSAI', 'FEU n°42 ESSAI'], feux: 2 }), { texte: 'Feu n°41, 42', plein: true });
  assert.deepEqual(pastilleFeu({ missions: ['FEU ESSAI'], feux: 0 }), { texte: 'Feu', plein: true });
  assert.deepEqual(pastilleFeu({ missions: [], feux: 1 }), { texte: 'Feu', plein: true });
  assert.equal(pastilleFeu({ missions: ['TRANSPORT ESSAI'], feux: 0 }), null);
});

test('R135 : « Dash 8 / CdB », « Dash 8 / Copi », « Dash 8 / Année » ; « Dash 8 » et « CL-415 » inchangés ; mêmes identifiants', () => {
  const A = (id, typeOACI, modele) => ({ id, typeOACI, modele, sim: false, equipage: 'MP', moteurs: 'ME', moteur: 'T' });
  const avions = [A('a', 'DH8D', 'Dash 8 Q400 MR'), A('c', 'CL2T', 'CL-415')];
  const t = calculerTotaux([{ id: 'v', avionId: 'a', date: '2026-02-01', tempsTotal: 60, tempsCdB: 60, etiquettes: [], compteurs: {} }], new Map(avions.map(a => [a.id, a])), '2026-11-21');
  assert.deepEqual(choixParType(t, avions).map(c => `${c.cle} = ${c.lib}`), ['famille:Dash 8 Q400 = Dash 8', 'familleCdB:Dash 8 Q400 = Dash 8 / CdB',
    'familleCopi:Dash 8 Q400 = Dash 8 / Copi', 'familleAnnee:Dash 8 Q400 = Dash 8 / Année', 'famille:CL-415 = CL-415']);
  assert.equal(valeurBande('familleAnnee:Dash 8 Q400', t).lib, 'Dash 8 / Année');
  assert.deepEqual(normaliserBande(['famille:CL-415', 'familleCdB:Dash 8 Q400'], avions), ['famille:CL-415', 'familleCdB:Dash 8 Q400'], 'choix gardés');
});
