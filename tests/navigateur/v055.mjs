// v0.55 : R136 fiche personne modifiable (correction sur tous les vols, règle d'affichage, synchro) ; R137 « Trace » ;
// R138 mot de passe des traces partagé (synchro, sauvegarde, pas dans le CSV) ; R139 import de trace (GPX, KML, KMZ, IGC,
// GeoJSON, CSV, fichier invalide, 50 000 points simplifiés, croix -> trace ADS-B, synchro, restauration) ; R140 Sauvegarde en
// 3 lignes (restaurer fichier / version NAS, copie automatique, alerte) ; R141 / R142 outils retirés ; R143 Totaux repliables +
// « Trigrammes ». Vols, personnes, trigrammes, traces et mots de passe INVENTÉS ; FAUX NAS v5 local ; toute adresse non locale
// est BLOQUÉE. Captures : tests/navigateur/captures/v055-*.png. Usage : node tests/navigateur/v055.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { gunzipSync, deflateRawSync } from 'node:zlib';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-11-01T08:00:00Z';
const MDP_TRACES = 'mot-de-passe-traces-essai-55';
const avion = (id, champs) => ({ id, immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400 MR', constructeur: 'ESSAI', nom: 'M91', indicatif: '', equipage: 'MP', moteurs: 'ME',
  moteur: 'T', surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', hexAdsb: 'abc123', creeLe: H, modifieLe: H, ...champs });
const AVIONS = [avion('a1'), avion('s1', { immat: 'SIM-ESSAI', typeOACI: 'SIM', modele: 'Simulateur', nom: '', sim: true, fstd: 'FFS', equipage: 'MP', hexAdsb: '' })];
const vol = (id, date, hDep, hArr, minutes, champs = {}) => ({ id, date, hDep, hArr, mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId: 'a1', tempsTotal: minutes,
  tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: minutes, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '', missions: [],
  remarques: '', feux: 0, compteurs: {}, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie',
  ordre: Date.parse(`${date}T${hDep}Z`), creeLe: H, modifieLe: H, ...champs });
const VOLS = [
  vol('v1', '2026-11-10', '10:00', '11:00', 60, { nomCopi: 'ABC' }),
  vol('v2', '2026-11-12', '09:00', '11:00', 120, { fonction: 'copi', nomCdB: 'ABC', tempsCdB: 0, tempsCopi: 120 }),
  vol('v3', '2026-11-05', '08:00', '09:30', 90, { nomCopi: 'ZZD', nomInstructeur: 'ABC' }),
  vol('v4', '2026-11-06', '08:00', '09:00', 60, { nomCopi: 'Beta SANSTRI' }),
  vol('v5', '2026-11-07', '08:00', '10:00', 0, { avionId: 's1', nomCopi: 'ABC', simTemps: 120, tempsCdB: 0 }),   // simulateur : exclu des Trigrammes
  vol('v6', '2026-11-08', '08:00', '08:45', 45, { nomCopi: 'GAMMA' })];
const P = (id, tri, nom, prenom) => ({ id, tri, nom, prenom, creeLe: H, modifieLe: H });
const PERSONNES = [P('p-abc', 'ABC', 'ESSAI', 'Alpha'), P('p-sans', '', 'SANSTRI', 'Beta'), P('p-pre', '', '', 'GAMMA'), P('p-zzd', 'ZZD', 'AUTRE', '')];

// ---------- Fichiers de trace inventés (autour de Nîmes, 15/11/2026) ----------
const T0 = Date.UTC(2026, 10, 10, 10, 0, 0);
const pts = n => Array.from({ length: n }, (_, i) => [T0 + i * (3600000 / n), 43.75 + Math.sin(i / (n / 6)) * 0.2, 4.40 + (i / n) * 0.8, 300 + i % 50]);
const iso = ms => new Date(ms).toISOString().replace('.000Z', 'Z');
const GPX = l => `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="essai"><trk><name>ESSAI</name><trkseg>${l.map(p => `<trkpt lat="${p[1].toFixed(6)}" lon="${p[2].toFixed(6)}"><ele>${p[3]}</ele><time>${iso(p[0])}</time></trkpt>`).join('')}</trkseg></trk></gpx>`;
const KML = l => `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Document><Placemark><gx:Track>${l.map(p => `<when>${iso(p[0])}</when>`).join('')}${l.map(p => `<gx:coord>${p[2]} ${p[1]} ${p[3]}</gx:coord>`).join('')}</gx:Track></Placemark></Document></kml>`;
const deg = (v, n, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60000); return String(d).padStart(n, '0') + String(m).padStart(5, '0') + (v >= 0 ? pos : neg); };
const IGC = l => `AXXXESSAI\nHFDTE101126\n${l.map(p => { const d = new Date(p[0]); return `B${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}${deg(p[1], 2, 'N', 'S')}${deg(p[2], 3, 'E', 'W')}A${String(p[3]).padStart(5, '0')}${String(p[3]).padStart(5, '0')}`; }).join('\n')}\n`;
const GEOJSON = l => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { coordTimes: l.map(p => iso(p[0])) }, geometry: { type: 'LineString', coordinates: l.map(p => [p[2], p[1], p[3]]) } }] });
const CSV = l => 'latitude;longitude;heure\n' + l.map(p => `${p[1].toFixed(6).replace('.', ',')};${p[2].toFixed(6).replace('.', ',')};${iso(p[0])}`).join('\n') + '\n';
function zip(nom, texte) { // KMZ : un seul fichier « doc.kml » compressé (deflate)
  const donnees = Buffer.from(texte), comp = deflateRawSync(donnees), n = Buffer.from(nom);
  const crc = (() => { let c, t = []; for (let i = 0; i < 256; i++) { c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } let x = 0xffffffff; for (const b of donnees) x = t[(x ^ b) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; })();
  const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(8, 8); loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(donnees.length, 22); loc.writeUInt16LE(n.length, 26);
  const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(donnees.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(0, 42);
  const debutCen = 30 + n.length + comp.length;
  const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(1, 8); fin.writeUInt16LE(1, 10); fin.writeUInt32LE(46 + n.length, 12); fin.writeUInt32LE(debutCen, 16);
  return Buffer.concat([loc, n, comp, cen, n, fin]);
}
const FICHIERS = {
  gpx: ['trace-essai.gpx', GPX(pts(300))], kml: ['trace-essai.kml', KML(pts(200))], kmz: ['trace-essai.kmz', zip('doc.kml', KML(pts(250)))],
  igc: ['trace-essai.igc', IGC(pts(180))], geojson: ['trace-essai.geojson', GEOJSON(pts(220))], csv: ['trace-essai.csv', CSV(pts(160))],
  invalide: ['pas-une-trace.gpx', '<gpx><trk><trkseg></trkseg></trk></gpx>'], inconnu: ['note.txt', 'bonjour'], gros: ['gros-essai.gpx', GPX(pts(50000))],
};
const chemin = k => { const f = join(CAPT, 'v055-' + FICHIERS[k][0]); writeFileSync(f, FICHIERS[k][1]); return f; };

// ---------- Faux NAS v5 : synchro + copies (versions gardées) ----------
const srv = await serveur();
const nas = { mdp: 'mot-de-passe-essai-55', rev: 0, el: new Map(), copies: [], refuserCopie: false, plusGrosEnvoi: 0 };
const faux = createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), action = u.searchParams.get('action');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Carnet-Cle, X-Carnet-Empreinte', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const morceaux = [];
  req.on('data', m => morceaux.push(m));
  req.on('end', () => {
    const corps = Buffer.concat(morceaux);
    const json = (o, code = 200) => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(code === 200 ? o : { ...o, code })); };
    if (req.headers['x-carnet-cle'] !== nas.mdp) return json({ erreur: 'mot-de-passe' }, 401);
    if (action === 'test') return json({ ok: true, copies: nas.copies.length, cle: 'carnet', version: 5 });
    if (action === 'envoyer') {
      if (nas.refuserCopie) return json({ erreur: 'stockage' }, 500);
      const d = JSON.parse(gunzipSync(corps).toString());
      nas.copies.push({ id: `c${nas.copies.length + 1}`, date: new Date().toISOString(), vols: d.vols.length, corps, d });
      return json({ ok: true, id: 'x', vols: d.vols.length, taille: corps.length, verification: 'empreinte' });
    }
    if (action === 'liste') return json({ copies: nas.copies.map(c => ({ id: c.id, date: c.date, vols: c.vols, taille: c.corps.length })).reverse() });
    if (action === 'lire') { const c = nas.copies.find(x => x.id === u.searchParams.get('id')); res.writeHead(200, { ...cors, 'Content-Type': 'application/gzip' }); return res.end(c.corps); }
    if (action === 'vols-liste') return json({ vols: [] });
    if (action === 'synchro-etat') return json({ ok: true, rev: nas.rev, nombres: {} });
    if (action === 'synchro-recevoir') {
      const depuis = Number(u.searchParams.get('depuis')), limite = Number(u.searchParams.get('limite'));
      const tous = [...nas.el.entries()].filter(([, e]) => e.rev > depuis).sort((a, b) => a[1].rev - b[1].rev);
      const page = tous.slice(0, limite).map(([cle, e]) => ({ magasin: cle.split('/')[0], id: cle.slice(cle.indexOf('/') + 1), ...e }));
      const suite = tous.length > limite;
      return json({ ok: true, rev: nas.rev, elements: page, suite, jusqua: suite ? page.at(-1).rev : nas.rev });
    }
    if (action === 'synchro-envoyer') { // comme carnet.php v5 : envoi ≤ 4 Mo, élément ≤ 64 Ko
      if (corps.length > 4 * 1024 * 1024) return json({ erreur: 'trop-gros' }, 413);
      nas.plusGrosEnvoi = Math.max(nas.plusGrosEnvoi, corps.length);
      const b = JSON.parse(corps.toString());
      const acceptees = [], deja = [], conflits = [];
      for (const m of b.modifications) if (m.donnees && JSON.stringify(m.donnees).length > 65536) return json({ erreur: 'trop-gros', id: m.id }, 413);
      for (const m of b.modifications) {
        const cle = `${m.magasin}/${m.id}`, a = nas.el.get(cle), revA = a ? a.rev : 0, donnees = m.supprime ? null : m.donnees;
        if (a && !!a.supprime === !!m.supprime && JSON.stringify(a.donnees) === JSON.stringify(donnees)) { deja.push({ magasin: m.magasin, id: m.id, rev: revA }); continue; }
        if (m.base !== revA) { conflits.push({ magasin: m.magasin, id: m.id, rev: revA }); continue; }
        nas.rev++; nas.el.set(cle, { rev: nas.rev, supprime: !!m.supprime, donnees, appareil: b.appareil, le: new Date().toISOString() });
        acceptees.push({ magasin: m.magasin, id: m.id, rev: nas.rev });
      }
      return json({ ok: true, rev: nas.rev, acceptees, deja, conflits });
    }
    return json({ erreur: 'action' }, 400);
  });
});
await new Promise(ok => faux.listen(0, '127.0.0.1', ok));
const ADRESSE_NAS = `http://127.0.0.1:${faux.address().port}/carnet-api/`;

const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
async function appareil(nom, { remplir = true } = {}) {
  const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|Access-Control|access control/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  if (remplir) {
    await p.evaluate(async ([avs, vs, ps]) => {
      const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
      const t = db.transaction(['avions', 'vols', 'personnes'], 'readwrite');
      for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v); for (const x of ps) t.objectStore('personnes').put(x);
      await new Promise(ok => { t.oncomplete = ok; }); db.close();
    }, [AVIONS, VOLS, PERSONNES]);
    await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  }
  return { p, ctx };
}
const onglet = (p, v) => p.click(`.tabs button[data-v="${v}"]`);
const bulles = (p, id) => p.$$eval(`.flight[data-id="${id}"] .chips .chip`, l => l.map(c => c.textContent));
const volDe = (p, id) => p.evaluate(async id => (await import('./js/etat.js')).etat.vols.find(v => v.id === id), id);
const reglageDe = (p, k) => p.evaluate(async k => (await import('./js/etat.js')).reglage(k), k);
const totaux = p => p.evaluate(async () => { const t = await import('./js/totaux.js'), e = await import('./js/etat.js'); return JSON.stringify(t.calculerTotaux(e.etat.vols, e.etat.avions, '2026-11-21')); });
const heures = v => JSON.stringify(['tempsTotal', 'tempsCdB', 'tempsCopi', 'tempsNuit', 'tempsIFR', 'hDep', 'hArr', 'date', 'attJour', 'attNuit', 'simTemps'].map(k => v[k]));
const fini = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, sel, { timeout: 60000 });
async function rejoindre(p, role) {
  await onglet(p, 'plus'); await p.click('#pl-sync'); await p.click('#sy-nas'); await p.fill('#nas-adr', ADRESSE_NAS); await p.fill('#nas-mdp', nas.mdp); await p.click('#nas-ok'); await p.waitForTimeout(400); await p.click('#ou-x');
  await p.click('#pl-sync');
  if (role === 'ref') { await p.click('#sy-ref'); await p.click('#sr-ok'); await fini(p, '#sr-res'); } else { await p.click('#sy-mod'); await p.click('#sc-ok'); await fini(p, '#sc-res'); }
  await p.click('#ou-x'); await onglet(p, 'carnet');
}
const actualiser = async p => { await onglet(p, 'carnet'); await p.click('#rafraichir'); await p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 }); await p.waitForTimeout(300); };
async function ouvrirVol(p, id) {
  await onglet(p, 'carnet'); await p.locator(`.flight[data-id="${id}"]`).scrollIntoViewIfNeeded();
  await p.click(`.flight[data-id="${id}"]`); await p.waitForSelector('#v-saisie:not([hidden])');
}
const fermerVol = async p => { await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])'); };
async function importer(p, k) {
  await p.locator('#tr-imp').scrollIntoViewIfNeeded();
  const [choix] = await Promise.all([p.waitForEvent('filechooser'), p.click('#tr-imp')]);
  await choix.setFiles(chemin(k)); await p.waitForTimeout(k === 'gros' ? 2500 : 600);
}
async function telechargerSauvegarde(p, nomFichier) {
  await onglet(p, 'plus'); await p.click('#pl-save');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#sv-dl')]);
  const f = join(CAPT, nomFichier); writeFileSync(f, readFileSync(await dl.path())); await p.click('#ou-x');
  return f;
}

try {
  const A = await appareil('A');
  const t0 = await totaux(A.p);
  const avantDonnees = await A.p.evaluate(async () => { const e = await import('./js/etat.js'); return JSON.stringify({ v: e.etat.vols.length, a: e.etat.avions.size, p: e.etat.personnes.length }); });

  console.log('R141 / R142 : outils retirés de Plus ; R140 : Sauvegarde en 3 lignes ; R137 : « Traces des vols »');
  await onglet(A.p, 'plus');
  for (const id of ['#pl-fiches', '#pl-import', '#pl-ie', '#file-ie', '#pl-nas', '#pl-nas-rest']) verifier(!(await A.p.$(id)), `Plus : ${id} n'existe plus`);
  const lignesSv = await A.p.$$eval('#v-plus .pcard', l => [...l[0].querySelectorAll('.prow2 b')].map(b => b.textContent));
  verifier(JSON.stringify(lignesSv) === '["Sauvegarde de secours","Synchro du carnet","Restaurer"]', `Sauvegarde : ${lignesSv.join(' · ')}`);
  verifier(await A.p.textContent('#pl-cartes b') === 'Traces des vols', 'Plus : « Traces des vols »');
  await A.p.click('#pl-cartes');
  const ecr = await A.p.evaluate(() => ({ t: document.getElementById('ou-t').textContent, c: document.getElementById('ou-c').innerText }));
  verifier(ecr.t === 'Traces des vols' && ecr.c.includes('Traces ADS-B (archives adsb.lol, récupérées chaque nuit par ton serveur).') && !/carte d'un vol|Gardé seulement|ne change jamais tes heures/i.test(ecr.c),
    'écran « Traces des vols » : texte court seul, plus de « Gardé seulement sur ce téléphone »');
  await A.p.fill('#cv-mdp', MDP_TRACES); await A.p.click('#cv-ok'); await A.p.waitForTimeout(300);
  verifier(await reglageDe(A.p, 'cartesMotDePasse') === MDP_TRACES, 'mot de passe des traces enregistré sur A');
  await A.p.reload(); await A.p.waitForSelector('body[data-pret="1"]');
  verifier(await A.p.evaluate(async () => { const e = await import('./js/etat.js'); return JSON.stringify({ v: e.etat.vols.length, a: e.etat.avions.size, p: e.etat.personnes.length }); }) === avantDonnees,
    'après relance : vols, avions et personnes identiques');

  console.log('R137 : fiche vol « TRACE DU VOL »');
  await ouvrirVol(A.p, 'v1');
  const titre = await A.p.$eval('#carte-zone h3', h => h.innerText);
  verifier(titre === 'TRACE DU VOL', `titre de section « ${titre} »`);
  verifier(!/carte du vol|cartes de vol|carte de vol/i.test(await A.p.evaluate(() => document.body.innerText)), 'plus aucun « Carte du vol / Cartes de vol » à l\'écran');
  await fermerVol(A.p);

  console.log('R136 : règle d\'affichage (trigramme, sinon nom, sinon prénom)');
  verifier((await bulles(A.p, 'v4')).includes('Copi SANSTRI'), `personne sans trigramme : « Copi SANSTRI » (enregistré « Beta SANSTRI ») : ${(await bulles(A.p, 'v4')).join(' | ')}`);
  verifier((await bulles(A.p, 'v6')).includes('Copi GAMMA'), 'prénom seul : « Copi GAMMA »');
  verifier((await volDe(A.p, 'v4')).nomCopi === 'Beta SANSTRI', 'le vol garde son texte (PDF : imprime ce qu\'il imprime aujourd\'hui)');

  console.log('Synchro A (téléphone) et B (PC)');
  await rejoindre(A.p, 'ref');
  const B = await appareil('B', { remplir: false });
  await rejoindre(B.p, 'mod');
  verifier(await reglageDe(B.p, 'cartesMotDePasse') === MDP_TRACES, 'R138 : B a reçu le mot de passe des traces par la synchro');

  console.log('R136 : Plus › Personnes › ABC -> ABD');
  const avantV = { v1: await volDe(A.p, 'v1'), v2: await volDe(A.p, 'v2'), v3: await volDe(A.p, 'v3'), v4: await volDe(A.p, 'v4') };
  await onglet(A.p, 'plus'); await A.p.click('#pl-pers'); await A.p.fill('#pe-q', 'ABC'); await A.p.click('#pe-l [data-pe="p-abc"]');
  await A.p.waitForSelector('#p-modal:not([hidden])');
  const fiche = await A.p.evaluate(() => ({ ordre: [...document.querySelectorAll('#p-modal label')].map(l => l.textContent), nom: document.getElementById('pm-nom').value,
    pre: document.getElementById('pm-pre').value, tri: document.getElementById('pm-tri').value, ok: document.getElementById('pm-ok').textContent, x: document.getElementById('pm-x').textContent }));
  verifier(JSON.stringify(fiche.ordre) === '["Nom","Prénom","Trigramme"]' && fiche.nom === 'ESSAI' && fiche.pre === 'Alpha' && fiche.tri === 'ABC' && fiche.ok === 'Enregistrer' && fiche.x === 'Annuler',
    `fiche : Nom / Prénom / Trigramme (${fiche.nom} / ${fiche.pre} / ${fiche.tri}), Enregistrer / Annuler`);
  await A.p.screenshot({ path: join(CAPT, 'v055-fiche-personne.png') });
  await A.p.fill('#pm-tri', 'ABD'); await A.p.click('#pm-ok'); await A.p.waitForTimeout(400);
  await A.p.click('#ou-x'); await onglet(A.p, 'carnet');
  verifier((await bulles(A.p, 'v1')).includes('Copi ABD') && (await bulles(A.p, 'v2')).includes('CdB ABD') && (await bulles(A.p, 'v3')).includes('Inst ABD'),
    'tous ses vols : « Copi ABD », « CdB ABD » (autre pilote), « Inst ABD »');
  const apres = { v1: await volDe(A.p, 'v1'), v2: await volDe(A.p, 'v2'), v3: await volDe(A.p, 'v3'), v4: await volDe(A.p, 'v4') };
  const sauf = (v, ...k) => { const c = { ...v }; for (const x of ['modifieLe', ...k]) delete c[x]; return JSON.stringify(c); };
  verifier(apres.v1.nomCopi === 'ABD' && sauf(apres.v1, 'nomCopi') === sauf(avantV.v1, 'nomCopi'), 'v1 : seul nomCopi change');
  verifier(apres.v2.nomCdB === 'ABD' && sauf(apres.v2, 'nomCdB') === sauf(avantV.v2, 'nomCdB'), 'v2 : seul nomCdB change (autre pilote)');
  verifier(apres.v3.nomInstructeur === 'ABD' && apres.v3.nomCopi === 'ZZD' && sauf(apres.v3, 'nomInstructeur') === sauf(avantV.v3, 'nomInstructeur'), 'v3 : seul nomInstructeur change (le copi ZZD reste)');
  verifier(JSON.stringify(apres.v4) === JSON.stringify(avantV.v4), 'v4 (autre personne) : pas touché');
  verifier((await volDe(A.p, 'v5')).nomCopi === 'ABD', 'vol simulateur avec ABC : corrigé aussi');
  verifier(await totaux(A.p) === t0, 'totaux identiques');
  await actualiser(A.p); await actualiser(B.p);
  verifier((await bulles(B.p, 'v1')).includes('Copi ABD') && (await B.p.evaluate(async () => (await import('./js/etat.js')).etat.personnes.find(p => p.id === 'p-abc').tri)) === 'ABD',
    'appareil B (faux NAS) : fiche ABD et vols corrigés reçus');

  console.log('R143 : Totaux repliables + « Trigrammes »');
  await onglet(A.p, 'totaux');
  const sections = () => A.p.$$eval('#v-totaux .sec.repli', l => l.map(s => [s.dataset.sec, s.querySelector('.sec-t').getAttribute('aria-expanded'), s.querySelector('.tot').hidden]));
  verifier((await sections()).every(([, e, h]) => e === 'false' && h), 'toutes fermées à l\'ouverture');
  await A.p.click('#v-totaux [data-sec="tri"] .sec-t'); await A.p.click('#v-totaux [data-sec="h"] .sec-t');
  const tri = await A.p.$$eval('#t-tri .tline', l => l.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  verifier(JSON.stringify(tri) === JSON.stringify(['ABD 3 vols · dernier le 12/11/2026 4h30', 'ZZD 1 vol · dernier le 05/11/2026 1h30']),
    `Trigrammes : ${tri.join(' | ')} (simulateur exclu, SANSTRI / GAMMA absents)`);
  await A.p.screenshot({ path: join(CAPT, 'v055-totaux.png'), fullPage: true });
  await A.p.reload(); await A.p.waitForSelector('body[data-pret="1"]'); await onglet(A.p, 'totaux');
  const s2 = Object.fromEntries((await sections()).map(([k, e]) => [k, e]));
  verifier(s2.tri === 'true' && s2.h === 'true' && ['c', 'm', 'e', 't', 'a'].every(k => s2[k] === 'false'), 'après relance : « Trigrammes » et « Heures » toujours ouvertes, les autres fermées');
  await A.p.click('#v-totaux [data-sec="h"] .sec-t');
  verifier((await sections()).find(([k]) => k === 'h')[2] === true, 'Heures refermée d\'un toucher');
  verifier(await totaux(A.p) === t0, 'autres totaux identiques');

  console.log('R139 : importer la trace d\'un vol');
  // trace ADS-B déjà rangée sur A pour v1 (pour vérifier le retour après la croix)
  await A.p.evaluate(async () => {
    const { signatureTrace } = await import('./js/traces.js'), e = await import('./js/etat.js');
    const v = e.etat.vols.find(x => x.id === 'v1'), t = Date.parse('2026-11-10T10:00:00Z');
    await e.ecrireTrace({ id: 'v1', sig: signatureTrace(v, 'abc123'), etat: 'ok', points: [[t, 43.70, 4.30, 900], [t + 1800e3, 43.90, 4.70, 1200], [t + 3600e3, 43.75, 4.42, 0]], majLe: new Date().toISOString() });
  });
  await ouvrirVol(A.p, 'v1');
  verifier(await A.p.isVisible('#tr-imp') && await A.p.isHidden('#tr-info'), 'bouton « Importer » visible (vol en lecture), pas de trace importée');
  await A.p.waitForFunction(() => !document.getElementById('carte-mini').hidden, null, { timeout: 8000 });
  verifier((await A.p.textContent('#carte-source')).includes('adsb.lol'), 'au départ : la trace ADS-B');
  const hv = heures(await volDe(A.p, 'v1'));
  for (const k of ['gpx', 'kml', 'kmz', 'igc', 'geojson', 'csv']) {
    await importer(A.p, k);
    const v = await volDe(A.p, 'v1'), info = await A.p.textContent('#tr-nom');
    verifier(v.traceImportee && v.traceImportee.format === { gpx: 'GPX', kml: 'KML', kmz: 'KMZ', igc: 'IGC', geojson: 'GeoJSON', csv: 'CSV' }[k] && v.traceImportee.n >= 150
      && await A.p.isVisible('#tr-info') && !(await A.p.isHidden('#carte-mini')) && (await A.p.textContent('#carte-source')).startsWith('Trace importée') && heures(v) === hv,
      `${k.toUpperCase()} : trace affichée à la place de la trace ADS-B (${info}), heures inchangées`);
  }
  await A.p.screenshot({ path: join(CAPT, 'v055-trace-importee.png') });
  const avantInvalide = JSON.stringify((await volDe(A.p, 'v1')).traceImportee);
  for (const k of ['invalide', 'inconnu']) {
    await importer(A.p, k);
    const msg = await A.p.textContent('#toast');
    verifier(JSON.stringify((await volDe(A.p, 'v1')).traceImportee) === avantInvalide && /rien n'a changé|Format non reconnu/.test(msg), `fichier ${FICHIERS[k][0]} : message « ${msg} », rien ne change`);
  }
  await A.p.click('#tr-x'); await A.p.waitForTimeout(600);
  verifier(!(await volDe(A.p, 'v1')).traceImportee && await A.p.isHidden('#tr-info'), 'croix : trace importée retirée');
  await A.p.waitForFunction(() => !document.getElementById('carte-mini').hidden, null, { timeout: 8000 });
  verifier((await A.p.textContent('#carte-source')).includes('adsb.lol'), 'la trace ADS-B revient');
  console.log('Gros fichier (50 000 points)');
  await importer(A.p, 'gros');
  const g = await volDe(A.p, 'v1');
  verifier(g.traceImportee && g.traceImportee.nOrigine === 50000 && g.traceImportee.n <= 1500 && JSON.stringify(g).length < 50000 && heures(g) === hv,
    `simplifiée : ${g.traceImportee?.n} points sur 50 000, vol de ${JSON.stringify(g).length} caractères (< 50 000), heures inchangées`);
  await fermerVol(A.p);
  await actualiser(A.p);
  const auNas = nas.el.get('vols/v1')?.donnees;
  verifier(auNas && auNas.traceImportee && auNas.traceImportee.n === g.traceImportee.n && nas.plusGrosEnvoi < 4 * 1024 * 1024, `faux NAS : vol reçu avec sa trace (envoi le plus gros : ${nas.plusGrosEnvoi} octets)`);
  await actualiser(B.p);
  await ouvrirVol(B.p, 'v1');
  verifier((await volDe(B.p, 'v1')).traceImportee?.n === g.traceImportee.n && await B.p.isVisible('#tr-info'), 'appareil B : trace importée reçue et affichée');
  await fermerVol(B.p);
  verifier(await totaux(A.p) === t0, 'traces importées : totaux identiques');

  console.log('Sauvegarde de secours, restauration (C), CSV');
  const fichierSv = await telechargerSauvegarde(A.p, 'v055-sauvegarde.json');
  const sv = readFileSync(fichierSv, 'utf8');
  verifier(sv.includes(MDP_TRACES) && JSON.parse(sv).vols.find(v => v.id === 'v1').traceImportee, 'sauvegarde : mot de passe des traces et trace importée présents');
  await onglet(A.p, 'plus'); await A.p.click('#pl-csv');
  const [dlc] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#cs-dl')]);
  const csv = readFileSync(await dlc.path(), 'utf8'); await A.p.click('#ou-x');
  verifier(!csv.includes(MDP_TRACES) && !csv.includes(g.traceImportee.pts.slice(0, 20)) && !/traceImportee/.test(csv), 'CSV : ni mot de passe, ni trace');
  const C = await appareil('C', { remplir: false });
  await onglet(C.p, 'plus'); await C.p.click('#pl-restore');
  verifier(await C.p.isVisible('#rs-fichier') && await C.p.isVisible('#rs-nas'), '« Restaurer » : « Depuis un fichier » ou « Depuis une version du NAS »');
  const [ch] = await Promise.all([C.p.waitForEvent('filechooser'), C.p.click('#rs-fichier')]);
  await ch.setFiles(fichierSv); await C.p.waitForSelector('#rs-ok'); await C.p.click('#rs-ok'); await C.p.waitForTimeout(800);
  verifier(await reglageDe(C.p, 'cartesMotDePasse') === MDP_TRACES && (await volDe(C.p, 'v1')).traceImportee?.n === g.traceImportee.n,
    'appareil C restauré depuis le fichier : mot de passe des traces et trace importée présents');
  await ouvrirVol(C.p, 'v1');
  verifier(await C.p.isVisible('#tr-info'), 'appareil C : trace importée affichée');
  await fermerVol(C.p);

  console.log('R140 : copie automatique, ligne « Synchro du carnet », restaurer une version du NAS, alerte');
  const copieAvecTrace = () => nas.copies.some(c => c.d.vols.find(v => v.id === 'v1')?.traceImportee?.n === g.traceImportee.n);
  for (let i = 0; i < 60 && !copieAvecTrace(); i++) await A.p.waitForTimeout(500);
  verifier(copieAvecTrace(), `copie automatique toujours faite, trace importée comprise (${nas.copies.length} version(s) sur le faux NAS)`);
  await onglet(A.p, 'carnet'); await onglet(A.p, 'plus'); await A.p.waitForTimeout(300);
  const ligne = await A.p.textContent('#pl-sync-s');
  verifier(/^Synchronisé · version gardée (à l'instant|il y a \d+ min)$/.test(ligne), `sous-titre : « ${ligne} »`);
  verifier(await A.p.evaluate(() => document.getElementById('pl-bk').classList.contains('ok')) && /^Copié sur le NAS/.test(await A.p.textContent('#pl-bk-t')), 'bandeau du haut gardé : « Copié sur le NAS … »');
  await A.p.screenshot({ path: join(CAPT, 'v055-plus.png'), fullPage: true });
  const nVols = (await A.p.evaluate(async () => (await import('./js/etat.js')).etat.vols.length));
  await A.p.click('#pl-restore'); await A.p.click('#rs-nas'); await A.p.waitForSelector('#rn-l .nasv'); await A.p.click('#rn-l .nasv');
  await A.p.click('#rn-ok'); await A.p.waitForSelector('#outil', { state: 'hidden' }); await A.p.waitForTimeout(500);
  verifier((await A.p.evaluate(async () => (await import('./js/etat.js')).etat.vols.length)) === nVols && (await volDe(A.p, 'v1')).traceImportee?.n === g.traceImportee.n,
    'restaurer « Depuis une version du NAS » : carnet remis (trace importée comprise)');
  nas.refuserCopie = true;
  await onglet(A.p, 'plus'); await A.p.click('#pl-sync'); await A.p.click('#sy-nas'); await A.p.click('#nas-go'); await A.p.waitForTimeout(800); await A.p.click('#ou-x');
  await A.p.waitForTimeout(300);
  const al = await A.p.evaluate(() => ({ alerte: document.getElementById('pl-bk').classList.contains('alerte'), t: document.getElementById('pl-bk-t').textContent,
    s: document.getElementById('pl-bk-s').textContent, b: document.getElementById('pl-bk-go').textContent, fond: getComputedStyle(document.getElementById('pl-bk')).backgroundColor }));
  verifier(al.alerte && al.t === 'Copie sur le NAS en échec' && al.b === 'Voir', `copie refusée par le faux NAS : bandeau en ALERTE « ${al.t} · ${al.s} » (fond ${al.fond})`);
  verifier(/copie sur le NAS : En attente/.test(await A.p.textContent('#pl-sync-s')), `sous-titre : « ${await A.p.textContent('#pl-sync-s')} »`);
  await A.p.locator('#pl-bk').screenshot({ path: join(CAPT, 'v055-alerte.png') });
  await A.p.click('#pl-bk-go');
  verifier(await A.p.textContent('#ou-t') === 'Copie sur le NAS', '« Voir » ouvre les réglages du NAS'); await A.p.click('#ou-x');
  nas.refuserCopie = false;

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur (ni vrai NAS, ni VPS, ni Google)' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.55 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}
