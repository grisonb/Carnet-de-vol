// v0.48 (R122) : socle OPS / IFR (dates INVENTÉES, aucune adresse réelle)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireReponseSocle, echeance, normaliserTitre, dateDeTexte } from '../../js/socle.js';
import { ajouterJours } from '../../js/temps.js';
import { REGLAGES_PARTAGES } from '../../js/synchro.js';
import { REGLAGES_PRIVES, creerSauvegarde } from '../../js/sauvegarde.js';

const AUJ = '2026-11-17';
const fr = iso => iso.split('-').reverse().join('/');
const reponse = (ops, ifr) => ({ ok: true, version: 1, aujourdhui: fr(AUJ), lu: '2026-11-17T17:50:00.000Z', colonnes: [
  { titre: 'Dernier vol', valeur: '16/11/2026' }, { titre: 'vol IFR avant le', valeur: fr(ifr) }, { titre: 'Vol OPS avant le', valeur: fr(ops) }] });

test('titres comparés sans majuscules, accents ni espaces', () => {
  assert.equal(normaliserTitre(' Entraînement  AVANT le '), normaliserTitre('Entrainement avant le'));
  const r = lireReponseSocle({ ok: true, colonnes: [{ titre: 'VÔL  OPS AVANT LE', valeur: '18/12/2026' }, { titre: 'Vol IFR avant  le', valeur: '02/12/2026' }] }); // v0.50 : colonne OPS
  assert.deepEqual(r, { ok: true, ops: { avantLe: '2026-12-18', dernier: '2026-12-17' }, ifr: { avantLe: '2026-12-02', dernier: '2026-12-01' } });
});

test('« avant le » : dernier jour = la veille ; J-10 vert, J-4 / J-0 orange, J+1 / J+4 rouge ; date courte', () => {
  const cas = [[11, 'J-10', 'vert'], [6, 'J-5', 'orange'], [5, 'J-4', 'orange'], [1, 'J-0', 'orange'], [0, 'J+1', 'rouge'], [-3, 'J+4', 'rouge']];
  for (const [dans, texte, couleur] of cas) {
    const s = lireReponseSocle(reponse(ajouterJours(AUJ, dans), ajouterJours(AUJ, dans)));
    const e = echeance(s.ops.dernier, AUJ), veille = ajouterJours(AUJ, dans - 1);
    assert.deepEqual([e.texte, e.couleur, e.date], [texte, couleur, `${veille.slice(8)}/${veille.slice(5, 7)}`], `avant le J${dans >= 0 ? '+' : ''}${dans}`);
  }
  assert.equal(echeance('2026-11-23', AUJ).couleur, 'vert', '6 jours restants : vert');
});

test('réponses en erreur : pas de plantage, message clair', () => {
  assert.match(lireReponseSocle({ ok: false, erreur: 'feuille introuvable' }).erreur, /feuille introuvable/);
  assert.match(lireReponseSocle({ ok: true, colonnes: [{ titre: 'vol IFR avant le', valeur: '02/12/2026' }] }).erreur, /Vol OPS avant le.*introuvable/);
  assert.match(lireReponseSocle({ ok: true, colonnes: [{ titre: 'Vol OPS avant le', valeur: '' }, { titre: 'vol IFR avant le', valeur: '02/12/2026' }] }).erreur, /date illisible/);
  assert.equal(lireReponseSocle(null).ok, false);
  assert.equal(lireReponseSocle('texte').ok, false);
  assert.equal(dateDeTexte('31/02/2026'), null);
  assert.equal(dateDeTexte('1/2/2026'), '2026-02-01');
});

test('l\'adresse voyage (synchro, sauvegarde) ; la dernière lecture reste sur l\'appareil', () => {
  assert.ok(REGLAGES_PARTAGES.includes('socleAdresse') && !REGLAGES_PRIVES.includes('socleAdresse'));
  assert.ok(REGLAGES_PRIVES.includes('socleLu') && !REGLAGES_PARTAGES.includes('socleLu'));
  const s = creerSauvegarde({ vols: [], avions: [], personnes: [], reglages: [{ cle: 'socleAdresse', valeur: 'http://127.0.0.1:9/exec' }, { cle: 'socleLu', valeur: { le: AUJ } }] });
  const cles = s.reglages.map(r => r.cle);
  assert.ok(cles.includes('socleAdresse') && !cles.includes('socleLu'));
});
