// v0.56 : R144 compteurs gérables (liste, ordre, compteurs de départ par type, avion puis type, choix dans la saisie,
// CSV, totaux) ; R146 (voir test navigateur). Données INVENTÉES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listeCompteurs, deplacer, departDuType, compteursDuType, compteursParDefaut, compteursDuVol, changerChoix, volsAvecCompteur, nouvelleCle, problemeNom, codeType } from '../../js/compteurs.js';
import { COMPTEURS_DEFAUT, volVide } from '../../js/modele.js';
import { texteTableur, colonnesTableur, COLONNES_TABLEUR, REGLAGES_PRIVES } from '../../js/sauvegarde.js';
import { calculerTotaux, valeurCompteur } from '../../js/totaux.js';
import { REGLAGES_PARTAGES } from '../../js/synchro.js';

const NEUF = ['feux', 'largCdbDash', 'largInstrCdbDash', 'largCopiDash', 'largCopiCL', 'ecopages', 'amerrCL', 'amerrSEP', 'largPara'];
const FICHES = { cT1: { nom: 'Treuillages', cree: true, totaux: true, creeLe: '2026-11-20T10:00:00Z' } };

test('R144 : point de départ : les 9 compteurs, leurs noms, Feux en premier ; un compteur créé à la fin', () => {
  const l = listeCompteurs({}, COMPTEURS_DEFAUT);
  assert.deepEqual(l.map(c => c.cle), NEUF);
  assert.deepEqual(l.map(c => c.nom), ['Feux', 'Largages CdB Dash', 'Largages instruction CdB Dash', 'Largages copi Dash', 'Largages copi CL', 'Écopages', 'Amerrissages CL', 'Amerrissages SEP', 'Largages para']);
  assert.ok(l.every(c => c.totaux && !c.masque));
  const l2 = listeCompteurs({ ...FICHES, ecopages: { nom: 'Écopes' }, largPara: { supprime: true }, amerrCL: { masque: true, totaux: false } }, COMPTEURS_DEFAUT);
  assert.equal(l2.at(-1).nom, 'Treuillages');
  assert.equal(l2.find(c => c.cle === 'ecopages').nom, 'Écopes');
  assert.ok(!l2.some(c => c.cle === 'largPara'), 'supprimé');
  assert.deepEqual([l2.find(c => c.cle === 'amerrCL').masque, l2.find(c => c.cle === 'amerrCL').totaux], [true, false]);
  assert.ok(listeCompteurs({ feux: { supprime: true } }).some(c => c.cle === 'feux'), 'Feux jamais supprimé');
});

test('R144 : ordre (flèches) : vaut pour tous, garde l\'ancien « on » ; un compteur créé se range aussi', () => {
  const l = listeCompteurs(FICHES, COMPTEURS_DEFAUT);
  const o = deplacer(COMPTEURS_DEFAUT, l, l.length - 1, -1);
  const l2 = listeCompteurs(FICHES, o);
  assert.deepEqual(l2.map(c => c.cle).slice(-2), ['cT1', 'largPara']);
  assert.ok(o.find(x => x.cle === 'largCdbDash').on && !o.find(x => x.cle === 'largPara').on, 'anciens « on » gardés');
  assert.deepEqual(deplacer(o, l2, 0, 1).slice(0, 2).map(x => x.cle), ['largCdbDash', 'feux']);
});

test('R144 : compteurs de départ par type (ce que l\'app affichait, sinon la proposition)', () => {
  const SEP = { equipage: 'SP', moteurs: 'SE', moteur: 'P' };
  assert.deepEqual(departDuType('DH8D', {}, COMPTEURS_DEFAUT), ['feux', 'largCdbDash', 'largInstrCdbDash'], 'Dash : Feux + compteurs allumés (réglage d\'usine)');
  const regleUtilisateur = COMPTEURS_DEFAUT.map(c => ({ ...c, on: ['largCdbDash', 'largInstrCdbDash', 'largCopiDash'].includes(c.cle) }));
  assert.deepEqual(departDuType('DH8D', {}, regleUtilisateur), ['feux', 'largCdbDash', 'largInstrCdbDash', 'largCopiDash']);
  assert.deepEqual(departDuType('CL2T', {}, COMPTEURS_DEFAUT), ['feux', 'ecopages', 'amerrCL', 'largCopiCL']);
  assert.deepEqual(departDuType('DR40', SEP, COMPTEURS_DEFAUT), [], 'v0.57 (R147) : plus d\'Amerrissages SEP d\'office');
  assert.deepEqual(departDuType('BE58', { equipage: 'SP', moteurs: 'ME', moteur: 'P' }, COMPTEURS_DEFAUT), []);
  assert.deepEqual(departDuType('SIM', SEP, COMPTEURS_DEFAUT), []);
  assert.ok(!['DH8D', 'CL2T', 'DR40'].some(t => departDuType(t, SEP, COMPTEURS_DEFAUT).includes('largPara')), 'Largages para : aucun type');
  assert.deepEqual(compteursDuType('CL2T', {}, { CL2T: ['ecopages'] }, COMPTEURS_DEFAUT), ['ecopages'], 'choix du type enregistré : prioritaire');
});

test('R144 : priorité avion puis type ; affichage d\'un vol ; valeur > 0 toujours affichée ; masqué plus proposé', () => {
  const parType = { CL2T: ['feux', 'ecopages'] }, liste = listeCompteurs({ ...FICHES, amerrCL: { masque: true } }, COMPTEURS_DEFAUT);
  const cl = { id: 'a', typeOACI: 'CL2T' }, zzy = { id: 'b', typeOACI: 'CL2T', compteursPropres: ['feux'] };
  assert.deepEqual(compteursParDefaut(cl, parType, COMPTEURS_DEFAUT), ['feux', 'ecopages']);
  assert.deepEqual(compteursParDefaut(zzy, parType, COMPTEURS_DEFAUT), ['feux'], 'avion réglé : sans Écopages');
  const aff = (avion, vol) => compteursDuVol({ avion, vol, liste, parType, ancien: COMPTEURS_DEFAUT }).map(c => c.cle);
  assert.deepEqual(aff(cl, {}), ['feux', 'ecopages']);
  assert.deepEqual(aff(zzy, {}), ['feux']);
  assert.deepEqual(aff(zzy, { compteurs: { ecopages: 3 } }), ['feux', 'ecopages'], 'valeur : toujours affiché');
  assert.deepEqual(aff(zzy, { compteursAjoutes: ['largPara'] }), ['feux', 'largPara'], 'ajouté à ce vol');
  assert.deepEqual(aff({ id: 'c', typeOACI: 'CL2T', compteursPropres: ['amerrCL'] }, {}), [], 'masqué : plus proposé');
  assert.deepEqual(aff({ id: 'c', typeOACI: 'CL2T', compteursPropres: ['amerrCL'] }, { compteurs: { amerrCL: 1 } }), ['amerrCL'], 'masqué avec une valeur : affiché');
  assert.deepEqual(aff(null, { feux: 2 }), ['feux']);
  assert.equal(codeType({ sim: true }), 'SIM');
});

test('R144 : cocher / décocher (ce vol, cet avion, le type) ; aucune valeur ne bouge', () => {
  const parType = {}, a = { id: 'a', typeOACI: 'DH8D', immat: 'F-XZZA' }, anc = COMPTEURS_DEFAUT;
  assert.deepEqual(changerChoix({ cocher: true, portee: 'vol', cle: 'largPara', avion: a, ajoutes: [], parType, ancien: anc }), { ajoutes: ['largPara'] });
  const av = changerChoix({ cocher: true, portee: 'avion', cle: 'largPara', avion: a, ajoutes: [], parType, ancien: anc });
  assert.deepEqual(av, { ajoutes: ['largPara'], propres: ['feux', 'largCdbDash', 'largInstrCdbDash', 'largPara'] });
  const ty = changerChoix({ cocher: true, portee: 'type', cle: 'largPara', avion: a, ajoutes: [], parType, ancien: anc });
  assert.deepEqual(ty, { ajoutes: ['largPara'], typeListe: ['feux', 'largCdbDash', 'largInstrCdbDash', 'largPara'] });
  const de = changerChoix({ cocher: false, portee: 'type', cle: 'largPara', avion: { ...a, compteursPropres: ['feux', 'largPara'] }, ajoutes: ['largPara'], parType: { DH8D: ty.typeListe }, ancien: anc });
  assert.deepEqual(de, { ajoutes: [], typeListe: ['feux', 'largCdbDash', 'largInstrCdbDash'], propres: ['feux'] });
});

test('R144 : utilisé ou non, clé unique, nom refusé si vide ou déjà pris', () => {
  const vols = [{ feux: 1, compteurs: { cT1: 2 } }, { compteurs: { cT1: 0, ecopages: 1 } }];
  assert.deepEqual([volsAvecCompteur(vols, 'cT1'), volsAvecCompteur(vols, 'feux'), volsAvecCompteur(vols, 'largPara')], [1, 1, 0]);
  const k = nouvelleCle(FICHES, Date.UTC(2026, 10, 22), () => 0.5);
  assert.match(k, /^c[0-9a-z]+$/); assert.ok(!FICHES[k]);
  const l = listeCompteurs(FICHES);
  assert.ok(problemeNom('', null, l)); assert.ok(problemeNom('treuillages', null, l)); assert.ok(problemeNom('ecopages', null, l), 'accents ignorés');
  assert.equal(problemeNom('Treuillages', 'cT1', l), '', 'son propre nom'); assert.equal(problemeNom('Remorquages', null, l), '');
});

test('R144 : CSV : une colonne par compteur (créés et masqués compris), noms choisis ; sans liste : comme avant', () => {
  const v = { ...volVide(), id: 'v1', date: '2026-11-20', compteurs: { ...volVide().compteurs, cT1: 4, ecopages: 2 } };
  const liste = listeCompteurs({ ...FICHES, cT1: { ...FICHES.cT1, masque: true } }, COMPTEURS_DEFAUT);
  const [entete, ligne] = texteTableur([v], new Map(), liste).replace(/^﻿/, '').split(/\r?\n/);
  const t = entete.split(';'), val = ligne.split(';');
  assert.equal(val[t.indexOf('Treuillages')], '4');
  assert.equal(val[t.indexOf('Écopages')], '2');
  for (const n of ['Largages CdB Dash', 'Largages instruction CdB Dash', 'Largages copi Dash', 'Largages copi CL', 'Écopages', 'Amerrissages CL', 'Amerrissages SEP', 'Largages para', 'Feux (nouveaux)']) assert.ok(t.includes(n), n);
  assert.equal(colonnesTableur().length, COLONNES_TABLEUR.length);
  assert.equal(colonnesTableur(liste).length, COLONNES_TABLEUR.length + 1);
  assert.equal(texteTableur([v], new Map()), texteTableur([v], new Map(), listeCompteurs({}, COMPTEURS_DEFAUT)), 'sans compteur créé : CSV identique à avant');
});

test('R144 : totaux : compteurs d\'origine identiques ; compteur créé à part', () => {
  const vols = [{ ...volVide(), id: 'a', date: '2026-11-20', tempsTotal: 60, feux: 2, compteurs: { ...volVide().compteurs, largCdbDash: 3, cT1: 5 } },
    { ...volVide(), id: 'b', date: '2026-11-21', tempsTotal: 30, compteurs: { ecopages: 7, cT1: 1, vols: 99 } }];
  const t = calculerTotaux(vols, new Map());
  assert.deepEqual([t.vols, t.tempsTotal, t.feux, t.largCdbDash, t.ecopages], [2, 90, 2, 3, 7], 'une clé bizarre ne touche pas « vols »');
  assert.deepEqual([valeurCompteur(t, 'cT1'), valeurCompteur(t, 'feux'), valeurCompteur(t, 'ecopages')], [6, 2, 7]);
});

test('R144 / R146 : réglages partagés (synchro, sauvegarde) ; date lue sur le NAS : propre à l\'appareil', () => {
  for (const k of ['compteurs', 'compteursFiches', 'compteursTypes']) assert.ok(REGLAGES_PARTAGES.includes(k) && !REGLAGES_PRIVES.includes(k), k);
  assert.ok(REGLAGES_PRIVES.includes('nasDerniereVersion') && !REGLAGES_PARTAGES.includes('nasDerniereVersion'));
});

test('R144 : PDF EASA inchangé (compteurs créés, ajoutés, renommés : mêmes pages)', async () => {
  const { paginer } = await import('../../js/pdf.js');
  const avions = new Map([['a', { id: 'a', immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400 MR', equipage: 'MP', moteurs: 'ME', moteur: 'T' }]]);
  const base = Array.from({ length: 30 }, (_, i) => ({ ...volVide(), id: 'v' + i, date: `2026-10-${String(i + 1).padStart(2, '0')}`, hDep: '10:00', hArr: '11:00', dep: 'LFTW', arr: 'LFTW',
    avionId: 'a', tempsTotal: 60, tempsCdB: 60, fonction: 'cdb', nomCdB: 'SELF', attJour: 1, feux: i % 3, compteurs: { ...volVide().compteurs, largCdbDash: i % 2 } }));
  const avec = base.map(v => ({ ...v, compteurs: { ...v.compteurs, cT1: 3 }, compteursAjoutes: ['largPara', 'cT1'] }));
  const { valeursVol } = await import('../../js/pdf.js'), { remarqueCarnet } = await import('../../js/missions.js');
  const imprime = l => JSON.stringify(paginer(l, avions, 18).map(p => ({ ...p, vols: p.vols.map(v => [valeursVol(v, avions.get('a')), remarqueCarnet(v), v.date, v.dep, v.arr, v.nomCdB]) })));
  assert.equal(imprime(avec), imprime(base));
  assert.ok(!/compteur/i.test((await import('node:fs')).readFileSync(new URL('../../js/pdf.js', import.meta.url), 'utf8')), 'pdf.js ne lit aucun compteur');
});
