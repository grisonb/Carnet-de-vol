// v0.52 (R127 / R128) : « Dash 8 » affiché, identifiants inchangés ; « Dash 8 Année » (vols et avions INVENTÉS)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerTotaux } from '../../js/totaux.js';
import { choixParType, valeurBande, normaliserBande } from '../../js/bande.js';

const A = (id, typeOACI, modele, sim = false) => ({ id, typeOACI, modele, sim, immat: 'F-XZZ' + id.toUpperCase(), nom: '', equipage: 'MP', moteurs: 'ME', moteur: 'T' });
const AVIONS = new Map([A('a', 'DH8D', 'Dash 8 Q400 MR'), A('b', 'DH8D', 'Dash 8 Q400 MRE'), A('c', 'CL2T', 'CL-415'), A('s', 'DH8D', 'Simulateur ESSAI', true)].map(a => [a.id, a]));
const V = (id, avionId, date, tempsTotal, champs = {}) => ({ id, avionId, date, tempsTotal, tempsCdB: tempsTotal, tempsCopi: 0, simTemps: avionId === 's' ? tempsTotal : 0, etiquettes: [], compteurs: {}, ...champs });
const VOLS = [
  V('v1', 'a', '2025-12-31', 100),                 // année précédente
  V('v2', 'a', '2026-01-01', 60),                  // 1er janvier
  V('v3', 'b', '2026-11-10', 90, { tempsCdB: 0, tempsCopi: 90 }), // copi : compte aussi (toutes fonctions)
  V('v4', 'c', '2026-11-12', 200),                 // CL-415 : pas un Dash
  V('v5', 's', '2026-11-13', 120),                 // simulateur Dash : exclu
  V('v6', 'a', '2026-11-14', 45, { simulation: true }), // vol de simulation NPF-Q400-RUN : exclu
  V('v7', 'a', '2026-12-01', 30),                  // après aujourd'hui : pas encore
];

test('« Dash 8 Année » : vols Dash 8 réels de l\'année en cours seulement (toutes fonctions)', () => {
  const t = calculerTotaux(VOLS, AVIONS, '2026-11-21');
  assert.equal(t.parFamilleAnnee['Dash 8 Q400'], 60 + 90);
  assert.deepEqual(valeurBande('familleAnnee:Dash 8 Q400', t), { lib: 'Dash 8 / Année', texte: '2h30' });
  assert.equal(t.parFamille['Dash 8 Q400'], 100 + 60 + 90 + 30, 'le total Dash ne change pas');
});

test('au 1er janvier : repart à zéro (seuls les vols du jour comptent)', () => {
  const t = calculerTotaux(VOLS, AVIONS, '2026-01-01');
  assert.equal(t.parFamilleAnnee['Dash 8 Q400'], 60);
  assert.equal(calculerTotaux(VOLS.filter(v => v.id !== 'v2'), AVIONS, '2026-01-01').parFamilleAnnee['Dash 8 Q400'] || 0, 0);
});

test('« Dash 8 » affiché, identifiants internes inchangés : les choix déjà faits restent cochés', () => {
  const t = calculerTotaux(VOLS, AVIONS, '2026-11-21');
  const ch = choixParType(t, [...AVIONS.values()]);
  assert.deepEqual(ch.filter(c => c.cle.endsWith(':Dash 8 Q400')).map(c => `${c.cle} = ${c.lib}`),
    ['famille:Dash 8 Q400 = Dash 8', 'familleCdB:Dash 8 Q400 = Dash 8 / CdB', 'familleCopi:Dash 8 Q400 = Dash 8 / Copi', 'familleAnnee:Dash 8 Q400 = Dash 8 / Année']);
  assert.deepEqual(normaliserBande(['famille:CL-415', 'famille:Dash 8 Q400', 'familleCdB:Dash 8 Q400'], [...AVIONS.values()]), ['famille:CL-415', 'famille:Dash 8 Q400', 'familleCdB:Dash 8 Q400']);
  assert.equal(valeurBande('famille:CL-415', t).lib, 'CL-415');
});
