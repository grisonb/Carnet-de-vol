// v0.55 : R136 personnes, R138 réglage partagé, R139 traces importées, R143 Trigrammes (données INVENTÉES)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afficherPersonne, indexPersonnes, nomAffiche, volsACorriger, totauxTrigrammes, formesPersonne } from '../../js/personnes.js';
import { lireTraceFichier, simplifier, encoderPoints, decoderPoints, traceImportee, POINTS_MAX, TAILLE_VOL_MAX } from '../../js/trace-import.js';
import { lots, REGLAGES_PARTAGES, ELEMENT_MAX, elementsDuCarnet } from '../../js/synchro.js';
import { REGLAGES_PRIVES, texteTableur } from '../../js/sauvegarde.js';

const P = (id, tri, nom, prenom) => ({ id, tri, nom, prenom });
const PERS = [P('a', 'ABC', 'ESSAI', 'Alpha'), P('b', '', 'SANSTRI', 'Beta'), P('c', '', '', 'GAMMA'), P('d', 'ZZD', '', ''), P('e', '', 'DOUBLE', 'Un'), P('f', '', 'DOUBLE', 'Deux')];

test('R136 : affichage = trigramme, sinon nom, sinon prénom ; texte enregistré retrouvé par ses formes', () => {
  assert.deepEqual(PERS.map(afficherPersonne), ['ABC', 'SANSTRI', 'GAMMA', 'ZZD', 'DOUBLE', 'DOUBLE']);
  const ix = indexPersonnes(PERS);
  assert.equal(nomAffiche('Alpha ESSAI', ix), 'ABC');
  assert.equal(nomAffiche('abc', ix), 'ABC');
  assert.equal(nomAffiche('Beta SANSTRI', ix), 'SANSTRI');
  assert.equal(nomAffiche('SANSTRI Beta', ix), 'SANSTRI');
  assert.equal(nomAffiche('DOUBLE', ix), 'DOUBLE', 'nom partagé par deux personnes : texte gardé tel quel');
  assert.equal(nomAffiche('Un DOUBLE', ix), 'DOUBLE');
  assert.equal(nomAffiche('INCONNU', ix), 'INCONNU');
  assert.equal(nomAffiche('SELF', ix), 'SELF');
  assert.deepEqual(formesPersonne(P('x', '', '', 'SOLO')), ['SOLO']);
});

test('R136 : correction ABC -> ABD : seuls les champs de cette personne changent, dans tous ses rôles', () => {
  const vols = [{ id: 1, nomCopi: 'ABC', nomCdB: 'SELF', tempsTotal: 60 }, { id: 2, nomCdB: 'Alpha ESSAI', nomCopi: '' }, { id: 3, nomCopi: 'ZZD', nomInstructeur: 'ABC', nomExaminateur: 'abc' },
    { id: 4, nomCopi: 'Beta SANSTRI' }, { id: 5, nomEleve: 'ABC' }];
  const r = volsACorriger(vols, PERS[0], { ...PERS[0], tri: 'ABD' }, PERS);
  assert.deepEqual(r, [{ id: 1, nomCopi: 'ABD', nomCdB: 'SELF', tempsTotal: 60 }, { id: 2, nomCdB: 'ABD', nomCopi: '' }, { id: 3, nomCopi: 'ZZD', nomInstructeur: 'ABD', nomExaminateur: 'ABD' }, { id: 5, nomEleve: 'ABD' }]);
  assert.deepEqual(vols[0].nomCopi, 'ABC', 'les vols d\'origine ne sont pas modifiés avant l\'enregistrement');
  assert.deepEqual(volsACorriger(vols, PERS[1], { ...PERS[1], tri: 'BSA' }, PERS), [{ id: 4, nomCopi: 'BSA' }], 'sans trigramme -> avec trigramme');
  assert.deepEqual(volsACorriger(vols, PERS[0], { ...PERS[0], tri: '', nom: '', prenom: '' }, PERS), [], 'fiche vide : rien');
});

test('R143 : Trigrammes : vols, heures, dernier vol ; sans trigramme absent ; simulateur exclu ; tri par heures', () => {
  const vols = [{ date: '2026-11-10', nomCopi: 'ABC', tempsTotal: 60 }, { date: '2026-11-12', nomCdB: 'ABC', tempsTotal: 120 }, { date: '2026-11-05', nomCopi: 'ZZD', nomInstructeur: 'ABC', tempsTotal: 90 },
    { date: '2026-11-06', nomCopi: 'Beta SANSTRI', tempsTotal: 60 }, { date: '2026-11-20', nomCopi: 'ABC', tempsTotal: 0, simTemps: 120, sim: true }];
  assert.deepEqual(totauxTrigrammes(vols, PERS, v => !!v.sim).map(l => [l.tri, l.vols, l.minutes, l.dernier]), [['ABC', 3, 270, '2026-11-12'], ['ZZD', 1, 90, '2026-11-05']]);
});

const enc = s => new TextEncoder().encode(s);
test('R139 : formats GPX, KML (LineString), IGC, GeoJSON, CSV ; fichiers invalides', async () => {
  const gpx = await lireTraceFichier('a.gpx', enc('<gpx><trk><trkseg><trkpt lat="43.75" lon="4.40"><time>2026-11-10T10:00:00Z</time></trkpt><trkpt lat="43.76" lon="4.41"/></trkseg></trk></gpx>'));
  assert.deepEqual([gpx.ok, gpx.format, gpx.points.map(p => [p[1], p[2]])], [true, 'GPX', [[43.75, 4.4], [43.76, 4.41]]]);
  const kml = await lireTraceFichier('b.kml', enc('<kml><LineString><coordinates>4.4,43.75,10 4.41,43.76,20</coordinates></LineString></kml>'));
  assert.equal(kml.format, 'KML'); assert.equal(kml.points.length, 2);
  const igc = await lireTraceFichier('c.igc', enc('AXXX\nHFDTE101126\nB2359594345000N00424000EA0030000300\nB0000304346000N00425000WA0030000310\n'));
  assert.equal(igc.points[1][0] - igc.points[0][0], 31000, 'passage de minuit');
  assert.ok(igc.points[1][2] < 0, 'ouest');
  const gj = await lireTraceFichier('d.json', enc('{"type":"LineString","coordinates":[[4.4,43.75],[4.41,43.76],[4.42,43.77]]}'));
  assert.equal(gj.points.length, 3);
  const csv = await lireTraceFichier('e.csv', enc('Date,Time,Latitude,Longitude\n2026-11-10,10:00:00,43.75,4.40\n2026-11-10,10:01:00,43.76,4.41\n'));
  assert.equal(csv.points[0][0], Date.parse('2026-11-10T10:00:00Z'));
  for (const [n, t] of [['f.gpx', '<gpx></gpx>'], ['g.csv', 'a;b\n1;2\n'], ['h.txt', 'bonjour'], ['i.kmz', 'PK pas un zip'], ['j.json', '{pas du json']]) {
    const r = await lireTraceFichier(n, enc(t));
    assert.equal(r.ok, false, n); assert.ok(r.message.length > 10, n);
  }
});

test('R139 : 50 000 points bruités -> 1 500 au plus, encodage fidèle, vol sous la limite de la synchro', () => {
  let x = 1;
  const alea = () => ((x = (x * 16807) % 2147483647) / 2147483647) - 0.5;
  const pts = Array.from({ length: 50000 }, (_, i) => [Date.UTC(2026, 10, 10, 10) + i * 1000, 43.7 + i * 4e-6 + alea() * 0.01, 4.3 + i * 8e-6 + alea() * 0.01, null]);
  const s = simplifier(pts);
  assert.ok(s.length <= POINTS_MAX && s.length > 100, `${s.length} points`);
  assert.deepEqual(s[0], pts[0]); assert.deepEqual(s.at(-1), pts.at(-1));
  const d = decoderPoints({ ...encoderPoints(s) });
  assert.equal(d.length, s.length);
  assert.ok(d.every((p, i) => Math.abs(p[1] - s[i][1]) < 1e-5 && Math.abs(p[2] - s[i][2]) < 1e-5 && Math.abs(p[0] - s[i][0]) < 1000));
  const vol = { id: 'v', remarques: 'x'.repeat(2000) };
  const t = traceImportee(pts, { nom: 'essai.gpx', format: 'GPX' }, vol);
  const taille = JSON.stringify({ ...vol, traceImportee: t }).length;
  assert.ok(taille <= TAILLE_VOL_MAX && taille < ELEMENT_MAX, `vol ${taille} caractères`);
  assert.equal(t.nOrigine, 50000);
});

test('R139 : la trace voyage avec le vol (synchro) mais pas dans le CSV ; envois découpés sous 3 Mo', () => {
  const v = { id: 'v1', date: '2026-11-10', dep: 'LFTW', arr: 'LFTW', avionId: 'a1', tempsTotal: 60, traceImportee: { format: 'GPX', n: 2, t0: null, pts: '_p~iF~ps|U_ulLnnqC' } };
  assert.ok(elementsDuCarnet({ vols: [v] })[0].donnees.traceImportee);
  assert.ok(!texteTableur([v], new Map()).includes('_p~iF'));
  const gros = Array.from({ length: 200 }, (_, i) => ({ id: i, d: 'x'.repeat(40000) }));
  const l = lots(gros, 500, 3000000);
  assert.ok(l.length >= 3 && l.every(x => JSON.stringify(x).length < 3100000) && l.flat().length === 200);
  assert.deepEqual(lots([1, 2, 3], 2), [[1, 2], [3]], 'sans limite de taille : comme avant');
});

test('R138 : mot de passe des traces partagé (synchro, sauvegarde) ; R143 sections ouvertes : propre à l\'appareil', () => {
  assert.ok(REGLAGES_PARTAGES.includes('cartesMotDePasse') && !REGLAGES_PRIVES.includes('cartesMotDePasse'));
  assert.ok(REGLAGES_PRIVES.includes('totauxOuverts') && !REGLAGES_PARTAGES.includes('totauxOuverts'));
});
