// v0.59 : R151 profil altitude / vitesse sol (calcul pur) et altitude gardée dans les traces importées / ADS-B. Traces INVENTÉES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profilDeTrace, valeursA, echelle, PAS_ALTITUDE, PAS_VITESSE, texteAltitude, graduationsTemps, distance } from '../../js/profil.js';
import { encoderPoints, decoderPoints, traceImportee, lireTraceFichier } from '../../js/trace-import.js';
import { decouper } from '../../js/traces.js';

const T0 = Date.UTC(2026, 10, 10, 10, 0, 0);
// route plein est à 43,66° N, vitesse constante v kt, un point toutes les dt s, altitude a(s)
function trace(n, dt, v, a = () => 5000) {
  const mpdeg = 111320 * Math.cos(43.66 * Math.PI / 180), l = [];
  let lon = 7;
  for (let k = 0; k < n; k++) { if (k) lon += v / 1.943844 * dt / mpdeg; l.push([T0 + k * dt * 1000, 43.66, lon, a(k * dt)]); }
  return l;
}

test('vitesse sol calculée avec les positions et les heures (pas fournie par le serveur)', () => {
  const pr = profilDeTrace(trace(200, 5, 180));
  assert.ok(pr.aAlt && pr.aGs);
  const g = pr.gs.filter(x => x !== null);
  assert.ok(g.every(x => Math.abs(x - 180) <= 1), `toutes à 180 kt : ${Math.min(...g)} … ${Math.max(...g)}`);
  assert.equal(valeursA(pr, T0 + 300000).alt, 5000);
});

test('vitesse fournie (5e valeur) : utilisée telle quelle', () => {
  const pts = trace(50, 10, 180).map(p => [...p, 150]);
  const pr = profilDeTrace(pts);
  assert.ok(pr.gs.every(x => x === 150));
});

test('points trop espacés (10 min) : altitude seule ; sans altitude ni vitesse : pas de profil ; sans heure : pas de profil', () => {
  const pr = profilDeTrace(trace(10, 600, 200));
  assert.ok(pr.aAlt && !pr.aGs && pr.gs === null);
  assert.equal(profilDeTrace(trace(10, 600, 200, () => null)), null);
  assert.equal(profilDeTrace(trace(10, 5, 200).map(p => [null, p[1], p[2], p[3]])), null);
  assert.equal(profilDeTrace([]), null);
});

test('au sol = 0 ft (et altitude négative montrée à 0) ; points aberrants isolés ignorés', () => {
  const pts = trace(120, 10, 200, s => (s < 100 ? 0 : 8000));
  pts[3][3] = -75;
  pts[60][3] = 40000;                  // saut d'altitude isolé
  pts[80] = [pts[80][0], pts[80][1] + 0.5, pts[80][2], pts[80][3]]; // saut de position isolé
  const pr = profilDeTrace(pts);
  assert.equal(pr.alt[3], 0);
  assert.equal(pr.alt[60], null, 'saut d\'altitude ignoré');
  assert.equal(pr.ok[80], false, 'position aberrante ignorée');
  assert.ok(pr.gs.filter(x => x !== null).every(x => x < 260), `aucune vitesse impossible : max ${Math.max(...pr.gs.filter(x => x !== null))} kt`);
  assert.equal(echelle(Math.max(...pr.alt.filter(x => x !== null)), PAS_ALTITUDE).max, 8000, 'échelle sur 8 000 ft, pas 40 000');
  // une vraie montée rapide (plusieurs points) n'est PAS ignorée
  const montee = profilDeTrace(trace(60, 10, 200, s => Math.min(10000, s * 30)));
  assert.ok(montee.alt.every(x => x !== null));
});

test('échelles « rondes » (4 intervalles) et heures de l\'axe', () => {
  assert.deepEqual(echelle(16000, PAS_ALTITUDE), { pas: 5000, max: 20000 });
  assert.deepEqual(echelle(236, PAS_VITESSE), { pas: 75, max: 300 });
  assert.deepEqual(echelle(1500, PAS_ALTITUDE), { pas: 500, max: 2000 });
  assert.equal(texteAltitude(15000), '15k'); assert.equal(texteAltitude(1500), '1,5k'); assert.equal(texteAltitude(500), '500');
  const g = graduationsTemps(T0 - 600000, T0 + 100 * 60000);
  assert.deepEqual(g.map(t => new Date(t).toISOString().slice(11, 16)), ['10:00', '10:30', '11:00', '11:30']);
  assert.ok(Math.abs(distance([0, 0, 0], [0, 1, 0]) - 111195) < 10);
});

test('traces ADS-B : l\'altitude (et une vitesse future) sont gardées par la découpe', () => {
  const f = { jour: '2026-11-10', points: [[36000, 43.6, 7, 0], [36010, 43.6, 7.01, 1200, 140]] };
  const p = decouper([f], { date: '2026-11-10', hDep: '10:00', hArr: '11:00' });
  assert.deepEqual(p.map(x => x.slice(3)), [[0], [1200, 140]]);
});

test('traces importées : altitude gardée (pieds, à 10 ft près) ; anciennes traces sans altitude toujours lues', async () => {
  const pts = [[T0, 44, 4.5, 0], [T0 + 60000, 44.01, 4.51, 304.8], [T0 + 120000, 44.02, 4.52, 609.6]];
  const e = encoderPoints(pts);
  assert.deepEqual(decoderPoints(e).map(p => p[3]), [0, 1000, 2000]);
  assert.deepEqual(decoderPoints({ t0: e.t0, pts: e.pts }).map(p => p[3]), [null, null, null], 'trace d\'avant la v0.59');
  assert.ok(!('a' in encoderPoints(pts.map(p => [p[0], p[1], p[2], null]))), 'pas d\'altitude dans le fichier : pas de clé « a »');
  const gpx = `<gpx><trk><trkseg>${Array.from({ length: 3000 }, (_, k) => `<trkpt lat="${(44 + k * 1e-4).toFixed(5)}" lon="${(4.5 + Math.sin(k / 50) * 0.01).toFixed(5)}"><ele>${(k * 0.5).toFixed(1)}</ele><time>${new Date(T0 + k * 1000).toISOString()}</time></trkpt>`).join('')}</trkseg></trk></gpx>`;
  const r = await lireTraceFichier('essai.gpx', new TextEncoder().encode(gpx));
  const t = traceImportee(r.points, { nom: 'essai.gpx', format: r.format }, { id: 'x' });
  const d = decoderPoints(t);
  assert.ok(t.n <= 1500 && typeof t.a === 'string');
  assert.ok(Math.abs(Math.max(...d.map(p => p[3])) - 1499.5 * 3.28084) <= 10);
  const csv = 'latitude;longitude;heure;altitude (ft)\n44;4.5;2026-11-10T10:00:00Z;0\n44.01;4.51;2026-11-10T10:01:00Z;1000\n44.02;4.52;2026-11-10T10:02:00Z;2000\n';
  const rc = await lireTraceFichier('essai.csv', new TextEncoder().encode(csv));
  assert.deepEqual(decoderPoints(encoderPoints(rc.points)).map(p => p[3]), [0, 1000, 2000], 'CSV : colonne « altitude (ft) »');
});

test('GPX myTracks : vitesse <mytracks:speed> en km/h -> kt, altitude <ele> en m -> ft ; le profil utilise la vitesse MESURÉE', async () => {
  // fichier INVENTÉ au format myTracks : 300 points à 1 s ; vitesse annoncée 370,4 km/h (= 200 kt) alors que les positions
  // ne bougent presque pas : le profil doit montrer 200 kt (mesurée), pas la vitesse calculée
  const pts = Array.from({ length: 300 }, (_, k) => `<trkpt lat="${(44 + k * 1e-6).toFixed(6)}" lon="4.5"><ele>${(k * 5).toFixed(1)}</ele><time>${new Date(T0 + k * 1000).toISOString()}</time><extensions><mytracks:speed>${k < 10 ? 0 : 370.4}</mytracks:speed><mytracks:gradient>0</mytracks:gradient></extensions></trkpt>`).join('');
  const gpx = `<?xml version="1.0"?><gpx xmlns:mytracks="http://mytracks.stichling.info/myTracksGPX/1/0" creator="myTracks" version="1.1"><trk><trkseg>${pts}</trkseg></trk></gpx>`;
  const r = await lireTraceFichier('essai.gpx', new TextEncoder().encode(gpx));
  assert.equal(r.points.length, 300);
  assert.ok(Math.abs(r.points[100][4] - 200) < 0.01, `370,4 km/h = 200 kt : ${r.points[100][4]}`);
  const t = traceImportee(r.points, { nom: 'essai.gpx', format: r.format }, { id: 'x' });
  assert.ok(typeof t.v === 'string' && typeof t.a === 'string');
  const d = decoderPoints(t), pr = profilDeTrace(d);
  assert.equal(Math.max(...pr.gs.filter(x => x !== null)), 200, 'vitesse mesurée');
  assert.equal(Math.max(...pr.alt.filter(x => x !== null)), Math.round(299 * 5 * 3.28084 / 10) * 10, 'altitude en pieds');
  // GPX 1.0 / Garmin : <speed> en m/s
  const g10 = `<gpx><trk><trkseg>${[0, 1].map(k => `<trkpt lat="44" lon="${4.5 + k * 0.001}"><time>${new Date(T0 + k * 1000).toISOString()}</time><speed>51.4444</speed></trkpt>`).join('')}</trkseg></trk></gpx>`;
  const r10 = await lireTraceFichier('essai.gpx', new TextEncoder().encode(g10));
  assert.ok(Math.abs(r10.points[0][4] - 100) < 0.01, '51,44 m/s = 100 kt');
});
