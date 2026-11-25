// v0.59 : R151 profil altitude / vitesse sol sous la trace du vol. FAUX serveur de traces (traces INVENTÉES), FAUX NAS v5,
// fausses tuiles ; jamais le vrai VPS, le vrai NAS ni Google. Écran 393 px.
// Usage : node tests/navigateur/v059.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const MDP_TRACES = 'mot-de-passe-traces-59';
const TUILE = readFileSync(join(RACINE, 'icones/icon-192.png'));

// ---------- Vol inventé (10:00 -> 11:30 UTC le 10/11/2026, au départ de Nice), un point toutes les 10 s ----------
// sol 0 ft jusqu'à 10:05, montée jusqu'à 16 000 ft à 10:25, croisière, descente 11:05 -> 11:25, sol ensuite.
// Vitesse sol : 15 kt au roulage, 236 kt en croisière ; route plein est. Un saut d'altitude isolé (10:40, 40 000 ft) et un
// saut de position isolé (10:50) : aberrants, ignorés.
const T0 = Date.UTC(2026, 10, 10, 10, 0, 0), MIN = 60000;
const vitesse = m => (m < 5 ? 15 : m < 12 ? 15 + (236 - 15) * (m - 5) / 7 : m < 65 ? 236 : m < 85 ? 236 - (236 - 120) * (m - 65) / 20 : 15);
const altitude = m => (m < 5 ? 0 : m < 25 ? 16000 * (m - 5) / 20 : m < 65 ? 16000 : m < 85 ? 16000 * (85 - m) / 20 : 0);
const LAT = 43.66, LON0 = 7.0, MPDEG = 111320 * Math.cos(LAT * Math.PI / 180);
const VRAI = []; // [ms, lat, lon, alt ft, vitesse kt]
{ let lon = LON0; for (let s = 0; s <= 90 * 60; s += 10) { const m = s / 60; if (s) lon += vitesse(m) / 1.943844 * 10 / MPDEG; VRAI.push([T0 + s * 1000, LAT, lon, Math.round(altitude(m)), vitesse(m)]); } }
const fichierAdsb = (hex, pts) => ({ hex, immat: 'F-XZZB', jour: '2026-11-10', source: 'Données © adsb.lol, ODbL',
  points: pts.map(p => [(p[0] - Date.UTC(2026, 10, 10)) / 1000, +p[1].toFixed(5), +p[2].toFixed(5), p[3]]) });
const AVEC_ABERRANTS = VRAI.map(p => (p[0] === T0 + 40 * MIN ? [p[0], p[1], p[2], 40000] : p[0] === T0 + 50 * MIN ? [p[0], p[1] + 0.5, p[2], p[3]] : p));
const ESPACES = VRAI.filter(p => (p[0] - T0) % (10 * MIN) === 0);                       // un point toutes les 10 min : altitude seule
const SANS = ESPACES.map(p => [p[0], p[1], p[2], null]);                                 // ni altitude, ni vitesse possible
const FICHIERS = { abc591: fichierAdsb('abc591', AVEC_ABERRANTS), abc592: fichierAdsb('abc592', ESPACES), abc593: fichierAdsb('abc593', SANS) };
const INDEX = { maj: '2026-11-11T04:20:00Z', derniereArchive: '2026-11-10', avions: {}, traces: { abc591: ['2026-11-10'], abc592: ['2026-11-10'], abc593: ['2026-11-10'] }, source: 'Données © adsb.lol, ODbL' };
const position = t => { const i = VRAI.findIndex(p => p[0] >= t); if (i <= 0) return VRAI[Math.max(0, i)]; const a = VRAI[i - 1], b = VRAI[i], f = (t - a[0]) / (b[0] - a[0]); return [t, a[1], a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f, a[4] + (b[4] - a[4]) * f]; };

// GPX inventé de 50 000 points (une seconde chacun), altitude « ele » en mètres
const gpx = (() => {
  const l = ['<?xml version="1.0"?><gpx version="1.1" creator="essai"><trk><trkseg>'];
  for (let k = 0; k < 50000; k++) {
    const m = k / 60, alt = Math.round(Math.min(1500, k < 600 ? 0 : (k - 600) * 1.5) * (k > 45000 ? (50000 - k) / 5000 : 1)) / 3.28084;
    l.push(`<trkpt lat="${(44 + 0.2 * Math.sin(k / 4000)).toFixed(6)}" lon="${(4.5 + k * 0.00004).toFixed(6)}"><ele>${alt.toFixed(1)}</ele><time>${new Date(Date.UTC(2026, 10, 12, 9, 0, 0) + k * 1000).toISOString()}</time></trkpt>`);
  }
  l.push('</trkseg></trk></gpx>'); return l.join('\n');
})();
const FICHIER_GPX = join(CAPT, 'v059-essai.gpx'); writeFileSync(FICHIER_GPX, gpx);
const FICHIER_KML = join(CAPT, 'v059-sans-heure.kml');
writeFileSync(FICHIER_KML, '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><LineString><coordinates>4.5,44,0 4.6,44.1,0 4.7,44.2,0</coordinates></LineString></Placemark></kml>');

// ---------- Données du carnet (inventées) ----------
const H = '2026-11-01T08:00:00Z';
const avion = (id, immat, hexAdsb) => ({ id, immat, typeOACI: 'DH8D', modele: 'Dash 8 Q400 MR', constructeur: 'ESSAI', nom: '', indicatif: '', equipage: 'MP', moteurs: 'ME', moteur: 'T',
  surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', hexAdsb, creeLe: H, modifieLe: H });
const AVIONS = [avion('a1', 'F-XZZB', 'abc591'), avion('a2', 'F-XZZC', 'abc592'), avion('a3', 'F-XZZD', 'abc593'), avion('a4', 'F-XZZE', '')];
const C0 = { largCdbDash: 0, largInstrCdbDash: 0, largCopiDash: 0, largCopiCL: 0, ecopages: 0, amerrCL: 0, amerrSEP: 0, largPara: 0 };
const vol = (id, date, avionId, hDep, hArr, minutes) => ({ id, date, hDep, hArr, mode: 'utc', dep: 'LFMN', arr: 'LFMN', escales: [], avionId, tempsTotal: minutes,
  tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: minutes, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '', missions: [],
  remarques: '', feux: 0, compteurs: { ...C0 }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie',
  ordre: Date.parse(`${date}T${hDep}Z`), creeLe: H, modifieLe: H });
const VOLS = [vol('v1', '2026-11-10', 'a1', '10:00', '11:30', 90), vol('v2', '2026-11-10', 'a2', '10:00', '11:30', 90), vol('v3', '2026-11-10', 'a3', '10:00', '11:30', 90),
  vol('v4', '2026-11-12', 'a4', '09:00', '22:59', 839)];

// ---------- Faux serveur de traces + tuiles ----------
const demandesTraces = [];
const fauxTraces = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (u.pathname.startsWith('/tuiles/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(TUILE); }
  demandesTraces.push(u.pathname);
  if (req.headers.authorization !== 'Basic ' + Buffer.from('carnet:' + MDP_TRACES).toString('base64')) { res.writeHead(401); return res.end('Code refusé'); }
  const json = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/carnet-traces/index.json') return json(INDEX);
  const m = u.pathname.match(/^\/carnet-traces\/traces\/(abc59\d)\/2026-11-10\.json$/);
  if (m && FICHIERS[m[1]]) return json(FICHIERS[m[1]]);
  res.writeHead(404); res.end();
});
await new Promise(ok => fauxTraces.listen(0, '127.0.0.1', ok));
const FAUX_TRACES = `http://127.0.0.1:${fauxTraces.address().port}`;

// ---------- Faux NAS v5 (synchro) ----------
const nas = { mdp: 'mot-de-passe-essai-59', rev: 0, el: new Map(), plusGrosVol: 0 };
const fauxNas = createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), action = u.searchParams.get('action');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Carnet-Cle, X-Carnet-Empreinte', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const morceaux = [];
  req.on('data', m => morceaux.push(m));
  req.on('end', () => {
    const corps = Buffer.concat(morceaux);
    const json = (o, code = 200) => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(code === 200 ? o : { ...o, code })); };
    if (req.headers['x-carnet-cle'] !== nas.mdp) return json({ erreur: 'mot-de-passe' }, 401);
    if (action === 'test') return json({ ok: true, copies: 0, cle: 'carnet', version: 5 });
    if (action === 'envoyer') return json({ ok: true, id: 'x', vols: 0, taille: corps.length, verification: 'empreinte' });
    if (action === 'liste') return json({ copies: [] });
    if (action === 'vols-liste') return json({ vols: [] });
    if (action === 'synchro-etat') return json({ ok: true, rev: nas.rev, nombres: {} });
    if (action === 'synchro-recevoir') {
      const depuis = Number(u.searchParams.get('depuis')), limite = Number(u.searchParams.get('limite'));
      const tous = [...nas.el.entries()].filter(([, e]) => e.rev > depuis).sort((a, b) => a[1].rev - b[1].rev);
      const page = tous.slice(0, limite).map(([cle, e]) => ({ magasin: cle.split('/')[0], id: cle.slice(cle.indexOf('/') + 1), ...e }));
      const suite = tous.length > limite;
      return json({ ok: true, rev: nas.rev, elements: page, suite, jusqua: suite ? page.at(-1).rev : nas.rev });
    }
    if (action === 'synchro-envoyer') {
      if (corps.length > 4 * 1024 * 1024) return json({ erreur: 'trop-gros' }, 413);
      const b = JSON.parse(corps.toString()), acceptees = [], deja = [], conflits = [];
      for (const m of b.modifications) {
        const n = m.donnees ? JSON.stringify(m.donnees).length : 0;
        if (n > 65536) return json({ erreur: 'trop-gros', id: m.id }, 413); // carnet.php v5 : 64 Ko par élément
        if (m.magasin === 'vols') nas.plusGrosVol = Math.max(nas.plusGrosVol, n);
      }
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
await new Promise(ok => fauxNas.listen(0, '127.0.0.1', ok));
const ADRESSE_NAS = `http://127.0.0.1:${fauxNas.address().port}/carnet-api/`;

const srv = await serveur();
const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
async function appareil(nom, { remplir = true } = {}) {
  const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  await ctx.addInitScript(([s, t]) => { window.CARNET_SERVEUR_TRACES = s; window.CARNET_TUILES = t; }, [`${FAUX_TRACES}/carnet-traces/`, `${FAUX_TRACES}/tuiles/{z}/{x}/{y}.png`]);
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|Access-Control|access control/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  if (remplir) {
    await p.evaluate(async ([avs, vs, mdp]) => {
      const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
      const t = db.transaction(['avions', 'vols', 'reglages'], 'readwrite');
      for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
      t.objectStore('reglages').put({ cle: 'cartesMotDePasse', valeur: mdp, modifieLe: '2026-11-01T08:00:00Z' });
      await new Promise(ok => { t.oncomplete = ok; }); db.close();
    }, [AVIONS, VOLS, MDP_TRACES]);
    await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  }
  return { p, ctx };
}
const onglet = (p, v) => p.click(`.tabs button[data-v="${v}"]`);
const volDe = (p, id) => p.evaluate(async id => (await import('./js/etat.js')).etat.vols.find(v => v.id === id), id);
const totaux = p => p.evaluate(async () => { const t = await import('./js/totaux.js'), e = await import('./js/etat.js'); return JSON.stringify(t.calculerTotaux(e.etat.vols, e.etat.avions, '2026-12-31')); });
const fini = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, sel, { timeout: 60000 });
async function rejoindre(p, role) {
  await onglet(p, 'plus'); await p.click('#pl-sync'); await p.click('#sy-nas'); await p.fill('#nas-adr', ADRESSE_NAS); await p.fill('#nas-mdp', nas.mdp); await p.click('#nas-ok'); await p.waitForTimeout(400); await p.click('#ou-x');
  await p.click('#pl-sync');
  if (role === 'ref') { await p.click('#sy-ref'); await p.click('#sr-ok'); await fini(p, '#sr-res'); } else { await p.click('#sy-mod'); await p.click('#sc-ok'); await fini(p, '#sc-res'); }
  await p.click('#ou-x'); await onglet(p, 'carnet');
}
async function ouvrirVol(p, id) {
  await onglet(p, 'carnet'); await p.locator(`.flight[data-id="${id}"]`).scrollIntoViewIfNeeded();
  await p.click(`.flight[data-id="${id}"]`); await p.waitForSelector('#v-saisie:not([hidden])');
  await p.waitForFunction(() => !['Recherche de la trace…'].includes(document.getElementById('carte-txt').textContent), null, { timeout: 15000 });
  await p.waitForTimeout(400);
}
const fermerVol = async p => { for (let i = 0; i < 3 && await p.isVisible('#v-saisie'); i++) { await p.click('#cancel'); await p.waitForTimeout(80); if (await p.isVisible('#ab-yes')) await p.click('#ab-yes'); } await p.waitForSelector('#v-carnet:not([hidden])'); };
// « 10:34  16 000 ft  236 kt » (espaces normales, comme à l'écran)
const valeur = p => p.evaluate(() => { const v = document.getElementById('pf-val'); return (v.children.length ? [...v.children].map(e => e.textContent).join(' ') : v.textContent).replace(/\u202f|\u00a0/g, ' '); });
const profil = p => p.evaluate(() => {
  const z = document.getElementById('profil'), s = document.getElementById('pf-svg');
  return { visible: !z.hidden && z.offsetParent !== null, leg: document.getElementById('pf-leg').textContent, gauche: [...s.querySelectorAll('.pf-axa')].map(e => e.textContent),
    droite: [...s.querySelectorAll('.pf-axg')].map(e => e.textContent), heures: [...s.querySelectorAll('.pf-ax:not(.pf-axa):not(.pf-axg)')].map(e => e.textContent),
    alt: !!s.querySelector('.pf-al'), gs: !!s.querySelector('.pf-gl'), svg: s.innerHTML };
});
// Pose le « doigt » (pointeur tactile, ou souris) sur le graphique à l'instant t
async function poser(p, t, { souris = false } = {}) {
  await p.evaluate(() => document.getElementById('pf-svg').scrollIntoView({ block: 'center' })); await p.waitForTimeout(80);
  const c = await p.evaluate(t => { const P = window.__profil(), r = document.getElementById('pf-svg').getBoundingClientRect(); return { x: r.left + P.x(t) * r.width / P.W, y: r.top + r.height / 2 }; }, t);
  if (souris) await p.mouse.move(c.x, c.y);
  else {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x - 30, y: c.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x - 10, y: c.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x, y: c.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
  await p.waitForTimeout(120);
  return p.evaluate(() => window.__profil().tCur);
}

try {
  const A = await appareil('A');
  await A.p.evaluate(async () => { window.__profil = (await import('./js/ui/profil.js'))._profilAffiche; });
  const version = await A.p.evaluate(async () => (await import('./js/version.js')).VERSION);
  verifier(Number(version.split('.')[1]) >= 59, `version ${version} (0.59 ou suivante)`);
  const t0 = await totaux(A.p), vols0 = JSON.stringify(await A.p.evaluate(async () => (await import('./js/etat.js')).etat.vols));

  console.log('Trace ADS-B inventée (altitude du serveur, vitesse sol calculée) : deux courbes');
  await ouvrirVol(A.p, 'v1');
  let pf = await profil(A.p);
  verifier(pf.visible && pf.alt && pf.gs && /Altitude/.test(pf.leg) && /Vitesse sol/.test(pf.leg), `graphique sous la carte : altitude (aire bleue) et vitesse sol (ligne verte), légende « ${pf.leg} »`);
  verifier(JSON.stringify(pf.gauche) === '["0","5k","10k","15k","20k","ft"]', `échelle des pieds à gauche : ${pf.gauche.join(' ')} (le saut isolé à 40 000 ft est ignoré)`);
  verifier(JSON.stringify(pf.droite) === '["0","75","150","225","300","kt"]', `échelle des nœuds à droite : ${pf.droite.join(' ')}`);
  verifier(JSON.stringify(pf.heures) === '["10:00","10:30","11:00","11:30"]', `heures en bas (UTC) : ${pf.heures.join(' ')}`);
  const pos = await A.p.evaluate(() => { const s = document.getElementById('pf-svg').getBoundingClientRect(), c = document.getElementById('carte-mini').getBoundingClientRect(); return { s, c }; });
  verifier(pos.s.top > pos.c.bottom, 'graphique SOUS la carte');
  await A.p.screenshot({ path: join(CAPT, 'v059-profil-utc.png') });

  console.log('Glisser sur le graphique');
  const t1034 = Date.UTC(2026, 10, 10, 10, 34, 20);
  const tA = await poser(A.p, t1034);
  const val = (await valeur(A.p)).replace(/\s+/g, ' ').trim(), attendu = position(tA);
  verifier(/^10:34 16 000 ft 23[3-9] kt$/.test(val), `doigt à ${new Date(tA).toISOString().slice(11, 19)} : « ${val} » (vrai : ${Math.round(attendu[3])} ft, ${Math.round(attendu[4])} kt)`);
  const jaune = await A.p.evaluate(([la, lo]) => {
    const pt = document.querySelector('#carte-mini path.pf-point'), carte = document.getElementById('carte-mini')._carte;
    if (!pt) return null;
    const r = pt.getBoundingClientRect(), c = document.getElementById('carte-mini').getBoundingClientRect(), e = carte.latLngToContainerPoint([la, lo]);
    return { dx: r.left + r.width / 2 - (c.left + e.x), dy: r.top + r.height / 2 - (c.top + e.y), fond: getComputedStyle(pt).fill };
  }, [attendu[1], attendu[2]]);
  verifier(jaune && Math.hypot(jaune.dx, jaune.dy) <= 3, `point jaune sur la trace au même instant (écart ${jaune && Math.hypot(jaune.dx, jaune.dy).toFixed(1)} px)`);
  const t1110 = Date.UTC(2026, 10, 10, 11, 10, 0), tB = await poser(A.p, t1110, { souris: true });
  const valB = (await valeur(A.p)).replace(/\s+/g, ' ').trim(), vB = position(tB);
  const nB = valB.match(/ (\d{1,3}(?: \d{3})*) ft (\d+) kt$/);
  verifier(nB && Math.abs(Number(nB[1].replace(/ /g, '')) - vB[3]) <= 100 && Math.abs(Number(nB[2]) - vB[4]) <= 4, `souris (PC) en descente : « ${valB} » (vrai : ${Math.round(vB[3])} ft, ${Math.round(vB[4])} kt)`);
  const tC = await poser(A.p, Date.UTC(2026, 10, 10, 10, 40, 0));
  verifier(/16 000 ft/.test((await valeur(A.p)).replace(/ | /g, ' ')), `au saut isolé (10:40) : ${(await valeur(A.p)).replace(/\s+/g, ' ')} (40 000 ft ignoré)`);
  await A.p.screenshot({ path: join(CAPT, 'v059-profil-doigt.png') });

  console.log('LOC : heures dans le fuseau du vol (Nice, UTC+1 en novembre)');
  await A.p.click('#tz-loc'); await A.p.waitForTimeout(150);
  pf = await profil(A.p);
  verifier(JSON.stringify(pf.heures) === '["11:00","11:30","12:00","12:30"]', `heures en bas (LOC) : ${pf.heures.join(' ')}`);
  await poser(A.p, t1034);
  verifier(/^11:34/.test((await valeur(A.p)).trim()), `doigt (LOC) : « ${(await valeur(A.p)).replace(/\s+/g, ' ').trim()} »`);
  await A.p.click('#tz-utc'); await A.p.waitForTimeout(100);

  console.log('Fluidité du glissé (393 px, processeur ralenti ×4)');
  const cdp = await A.ctx.newCDPSession(A.p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const fl = await A.p.evaluate(() => new Promise(ok => {
    const s = document.getElementById('pf-svg'), r = s.getBoundingClientRect(), debut = performance.now(); let n = 0, pire = 0, avant = debut, maj = 0;
    const v = document.getElementById('pf-val'), obs = new MutationObserver(() => maj++); obs.observe(v, { childList: true, subtree: true, characterData: true });
    const pas = now => {
      pire = Math.max(pire, now - avant); avant = now; n++;
      s.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 40 + ((n * 7) % (r.width - 80)), clientY: r.top + 80, pointerType: 'touch', bubbles: true }));
      if (now - debut < 2000) requestAnimationFrame(pas); else { obs.disconnect(); ok({ ips: n / ((now - debut) / 1000), pire, maj }); }
    };
    requestAnimationFrame(pas);
  }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
  verifier(fl.ips >= 40 && fl.maj >= fl.ips, `glissé : ${fl.ips.toFixed(0)} images par seconde, image la plus longue ${fl.pire.toFixed(0)} ms, ${fl.maj} mises à jour`);
  await fermerVol(A.p);

  console.log('Trace avec altitude seule ; trace sans les deux');
  await ouvrirVol(A.p, 'v2'); pf = await profil(A.p);
  verifier(pf.visible && pf.alt && !pf.gs && pf.leg === 'Altitude' && !pf.droite.length, `points espacés de 10 min : altitude seule (légende « ${pf.leg} », pas d'échelle des nœuds)`);
  await poser(A.p, Date.UTC(2026, 10, 10, 10, 40, 0));
  verifier(!/kt/.test(await valeur(A.p)), `doigt : « ${(await valeur(A.p)).replace(/\s+/g, ' ').trim()} » (sans vitesse)`);
  await fermerVol(A.p);
  await ouvrirVol(A.p, 'v3'); pf = await profil(A.p);
  verifier(!pf.visible && await A.p.isVisible('#carte-mini'), 'ni altitude ni vitesse : pas de graphique, la carte reste');
  await fermerVol(A.p);

  console.log('Trace importée : GPX de 50 000 points avec altitude (ele) ; KML sans heure');
  await ouvrirVol(A.p, 'v4');
  verifier(!(await profil(A.p)).visible, 'vol sans trace : pas de graphique');
  await A.p.locator('#tr-imp').scrollIntoViewIfNeeded();
  let [choix] = await Promise.all([A.p.waitForEvent('filechooser'), A.p.click('#tr-imp')]);
  await choix.setFiles(FICHIER_GPX); await A.p.waitForFunction(() => !document.getElementById('tr-info').hidden, null, { timeout: 20000 }); await A.p.waitForTimeout(800);
  const v4 = await volDe(A.p, 'v4'), taille = JSON.stringify(v4).length;
  const altMax = await A.p.evaluate(async id => { const t = await import('./js/trace-import.js'), e = await import('./js/etat.js'); return Math.max(...t.decoderPoints(e.etat.vols.find(v => v.id === id).traceImportee).map(p => p[3])); }, 'v4');
  verifier(v4.traceImportee.n <= 1500 && v4.traceImportee.nOrigine === 50000 && typeof v4.traceImportee.a === 'string' && Math.abs(altMax - 1500) <= 10,
    `simplifié : ${v4.traceImportee.n} points sur 50 000, altitude gardée (max ${altMax} ft)`);
  verifier(taille < 64 * 1024 && taille <= 50000, `vol avec sa trace : ${taille.toLocaleString('fr-FR')} caractères (< 64 Ko du NAS)`);
  pf = await profil(A.p);
  verifier(pf.visible && pf.alt && pf.gs, `GPX : courbe d'altitude (et vitesse sol calculée) ; échelle ${pf.gauche.join(' ')}`);
  await A.p.screenshot({ path: join(CAPT, 'v059-profil-gpx.png') });
  const profilA = { v1: null, v4: pf.svg };
  await fermerVol(A.p);
  await ouvrirVol(A.p, 'v1'); profilA.v1 = (await profil(A.p)).svg; await fermerVol(A.p);
  // KML sans heure (sur un autre vol inventé, puis retiré)
  await ouvrirVol(A.p, 'v3'); await A.p.locator('#tr-imp').scrollIntoViewIfNeeded();
  [choix] = await Promise.all([A.p.waitForEvent('filechooser'), A.p.click('#tr-imp')]);
  await choix.setFiles(FICHIER_KML); await A.p.waitForFunction(() => !document.getElementById('tr-info').hidden, null, { timeout: 20000 }); await A.p.waitForTimeout(600);
  verifier(!(await profil(A.p)).visible && await A.p.isVisible('#carte-mini'), 'KML sans heure ni altitude : trace sur la carte, pas de graphique, pas d\'erreur');
  await A.p.click('#tr-x'); await A.p.waitForTimeout(500); await fermerVol(A.p);

  console.log('Affichage seulement : rien ne change');
  const vols1 = JSON.parse(await A.p.evaluate(async () => JSON.stringify((await import('./js/etat.js')).etat.vols)));
  const sansTrace = l => JSON.stringify(l.map(({ traceImportee, modifieLe, ...v }) => v));
  verifier(await totaux(A.p) === t0 && sansTrace(vols1) === sansTrace(JSON.parse(vols0)), 'aucune heure, aucun total ne change (seule la trace importée est ajoutée au vol)');

  console.log('Synchro A -> B (faux NAS), sauvegarde -> C : graphique identique');
  await rejoindre(A.p, 'ref');
  verifier(nas.plusGrosVol > 0 && nas.plusGrosVol < 65536, `synchro : plus gros vol envoyé ${nas.plusGrosVol.toLocaleString('fr-FR')} caractères (< 64 Ko, carnet.php inchangé)`);
  const B = await appareil('B', { remplir: false });
  await B.p.evaluate(async () => { window.__profil = (await import('./js/ui/profil.js'))._profilAffiche; });
  await rejoindre(B.p, 'mod');
  for (const id of ['v4', 'v1']) {
    await ouvrirVol(B.p, id); await B.p.waitForSelector('#profil:not([hidden])', { timeout: 15000 });
    verifier((await profil(B.p)).svg === profilA[id], `appareil B : graphique du vol ${id === 'v4' ? 'à trace importée' : 'à trace ADS-B'} identique à A`);
    await fermerVol(B.p);
  }
  await onglet(A.p, 'plus'); await A.p.click('#pl-save');
  const [dl] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#sv-dl')]);
  const fichierSv = join(CAPT, 'v059-sauvegarde.json'); writeFileSync(fichierSv, readFileSync(await dl.path())); await A.p.click('#ou-x');
  const C = await appareil('C', { remplir: false });
  await onglet(C.p, 'plus'); await C.p.click('#pl-restore');
  const [ch] = await Promise.all([C.p.waitForEvent('filechooser'), C.p.click('#rs-fichier')]);
  await ch.setFiles(fichierSv); await C.p.waitForSelector('#rs-ok'); await C.p.click('#rs-ok'); await C.p.waitForTimeout(800);
  await ouvrirVol(C.p, 'v4'); await C.p.waitForSelector('#profil:not([hidden])', { timeout: 15000 });
  verifier((await profil(C.p)).svg === profilA.v4, 'appareil C restauré : graphique de la trace importée identique');

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur (ni vrai VPS, ni vrai NAS, ni Google)' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.59 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); fauxTraces.closeAllConnections?.(); fauxTraces.close(); fauxNas.closeAllConnections?.(); fauxNas.close(); srv.fermer();
}
