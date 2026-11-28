// v0.60 : R152 profil dans la carte en plein écran (bouton « Profil », graphique en bas, doigt -> point jaune, choix retenu ;
// portrait / paysage 393 px, iPad WebKit, PC : rien de caché ; fluidité) et synchro d'une trace réimportée (vol regardé ou
// ouvert pendant la synchro). FAUX serveur de traces (traces INVENTÉES), FAUX NAS v5, fausses tuiles ; jamais le vrai VPS,
// le vrai NAS ni Google.
// Usage : node tests/navigateur/v060.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const MDP_TRACES = 'mot-de-passe-traces-60';
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
const FICHIER_GPX = join(CAPT, 'v060-essai.gpx'); writeFileSync(FICHIER_GPX, gpx);
const FICHIER_KML = join(CAPT, 'v060-sans-heure.kml');
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
const nas = { mdp: 'mot-de-passe-essai-60', rev: 0, el: new Map(), plusGrosVol: 0 };
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
const { chromium, webkit } = playwright();
const nav = await chromium.launch();
const navSafari = await webkit.launch();
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';
const bloquees = [], erreurs = [];
async function appareil(nom, { remplir = true, navigateur = nav, contexte = {} } = {}) {
  const ctx = await navigateur.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', acceptDownloads: true, ...contexte });
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

// ---------- Plein écran : outils ----------
const valeurPlein = p => p.evaluate(() => { const v = document.querySelector('#cp-profil .pf-val'); return (v.children.length ? [...v.children].map(e => e.textContent).join(' ') : v.textContent).replace(/\u202f|\u00a0/g, ' '); });
const axes = (p, zone) => p.evaluate(z => { const s = document.querySelector(z + ' .pf-svg'); return { g: [...s.querySelectorAll('.pf-axa')].map(e => e.textContent), d: [...s.querySelectorAll('.pf-axg')].map(e => e.textContent),
  h: [...s.querySelectorAll('.pf-ax:not(.pf-axa):not(.pf-axg)')].map(e => e.textContent), leg: document.querySelector(z + ' .pf-leg').textContent }; }, zone);
async function ouvrirPlein(p) { await p.locator('#carte-mini').scrollIntoViewIfNeeded(); await p.click('#carte-mini'); await p.waitForSelector('#carte-plein:not([hidden])'); await p.waitForSelector('#carte-grande .leaflet-control-zoom'); await p.waitForTimeout(500); }
const fermerPlein = async p => { await p.click('#cp-x'); await p.waitForTimeout(150); };
const ouvertPlein = p => p.evaluate(() => !document.getElementById('cp-profil').hidden && document.getElementById('cp-pf').getAttribute('aria-pressed') === 'true');
async function poserPlein(p, t, { souris = false } = {}) {
  const c = await p.evaluate(t => { const P = window.__plein(), r = document.querySelector('#cp-profil .pf-svg').getBoundingClientRect(); return { x: r.left + P.x(t) * r.width / P.W, y: r.top + r.height / 2 }; }, t);
  if (souris) await p.mouse.move(c.x, c.y);
  else {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x - 30, y: c.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x, y: c.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
  await p.waitForTimeout(150);
  return p.evaluate(() => window.__plein().tCur);
}
// Rien de caché : chaque bouton / texte de la carte en plein écran est hors du graphique et visible à son centre
async function rienDeCache(p, nom) {
  const r = await p.evaluate(() => {
    const pf = document.getElementById('cp-profil').getBoundingClientRect(), g = document.getElementById('carte-grande').getBoundingClientRect();
    const cibles = [['fermer', '#cp-x'], ['Plan / Photo', '#cp-fond'], ['Profil', '#cp-pf'], ['zoom', '#carte-grande .leaflet-control-zoom'], ['crédit de la carte', '#carte-grande .leaflet-control-attribution'],
      ['source', '#carte-plein .cp-bas .carte-source'], ['Google Earth', '#cp-ge']];
    const pb = [];
    for (const [n, sel] of cibles) {
      const e = document.querySelector(sel);
      if (!e || e.hidden || !e.getClientRects().length) continue;
      const b = e.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const croise = b.bottom > pf.top + 0.5 && b.top < pf.bottom - 0.5;
      const dessus = document.elementFromPoint(cx, cy);
      if (croise || !dessus || !(e === dessus || e.contains(dessus))) pb.push(n);
    }
    return { pb, carte: g.height, recouvre: g.bottom > pf.top + 0.5, hPf: pf.height, hEcran: innerHeight };
  });
  verifier(!r.pb.length && !r.recouvre && r.carte >= 80, `${nom} : graphique ${Math.round(r.hPf)} px sur ${r.hEcran} ; carte ${Math.round(r.carte)} px au-dessus, rien de caché${r.pb.length ? ' (caché : ' + r.pb.join(', ') + ')' : ''}`);
}
// La carte reste manipulable au-dessus : glisser (déplace le centre) et zoomer (bouton +)
async function carteManipulable(p, nom) {
  const avant = await p.evaluate(() => { const c = document.getElementById('carte-grande')._carte; return { c: c.getCenter(), z: c.getZoom() }; });
  const g = await p.locator('#carte-grande').boundingBox();
  await p.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await p.mouse.down(); await p.mouse.move(g.x + g.width / 2 + 60, g.y + g.height / 2 + 20, { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(300);
  await p.click('#carte-grande .leaflet-control-zoom-in'); await p.waitForTimeout(500);
  const apres = await p.evaluate(() => { const c = document.getElementById('carte-grande')._carte; return { c: c.getCenter(), z: c.getZoom() }; });
  verifier(Math.abs(apres.c.lng - avant.c.lng) > 1e-5 && apres.z === avant.z + 1, `${nom} : carte déplacée et zoomée au-dessus du graphique (zoom ${avant.z} → ${apres.z})`);
}

try {
  const A = await appareil('A');
  await A.p.evaluate(async () => { const m = await import('./js/ui/profil.js'); window.__profil = m._profilAffiche; window.__plein = m._profilPlein; });
  const version = await A.p.evaluate(async () => (await import('./js/version.js')).VERSION);
  verifier(Number(version.split('.')[1]) >= 60, `version ${version} (0.60 ou suivante)`);
  const t0 = await totaux(A.p), vols0 = await A.p.evaluate(async () => JSON.stringify((await import('./js/etat.js')).etat.vols));

  console.log('R152 : bouton « Profil » de la carte en plein écran');
  await ouvrirVol(A.p, 'v3'); await ouvrirPlein(A.p);
  verifier(await A.p.isHidden('#cp-pf') && await A.p.isHidden('#cp-profil'), 'vol sans graphique (ni altitude ni vitesse) : pas de bouton « Profil »');
  await fermerPlein(A.p); await fermerVol(A.p);
  await ouvrirVol(A.p, 'v1'); const mini = await axes(A.p, '#profil'); await ouvrirPlein(A.p);
  verifier(await A.p.isVisible('#cp-pf') && await A.p.textContent('#cp-pf') === 'Profil' && await A.p.getAttribute('#cp-pf', 'aria-pressed') === 'false' && await A.p.isHidden('#cp-profil'),
    'vol avec graphique : bouton « Profil » visible, graphique fermé au départ');
  const style = await A.p.evaluate(() => { const a = getComputedStyle(document.getElementById('cp-pf')), b = getComputedStyle(document.querySelector('#cp-fond button[aria-pressed="false"]')); return a.minHeight === b.minHeight && a.fontWeight === b.fontWeight && a.fontSize === b.fontSize && a.backgroundColor === b.backgroundColor; });
  verifier(style, 'même style que les boutons Plan / Photo (hauteur, police, couleur)');
  const hCarte0 = (await A.p.locator('#carte-grande').boundingBox()).height;
  await A.p.click('#cp-pf'); await A.p.waitForTimeout(400);
  const pl = await axes(A.p, '#cp-profil');
  const fond = await A.p.evaluate(() => getComputedStyle(document.getElementById('cp-profil')).backgroundColor);
  verifier(await ouvertPlein(A.p) && JSON.stringify([pl.g, pl.d, pl.leg]) === JSON.stringify([mini.g, mini.d, mini.leg]) && /^rgb\(/.test(fond),
    `appui : graphique en bas, fond opaque (${fond}), mêmes échelles (${pl.g.join(' ')} / ${pl.d.join(' ')}) et légende que sous la petite carte`);
  verifier(pl.h.length >= 3 && pl.h.every(h => /^\d\d:\d\d$/.test(h)) && pl.h[0] === mini.h[0], `heures en bas (UTC) : ${pl.h.join(' ')}`);
  const dims = await A.p.evaluate(() => ({ pf: document.getElementById('cp-profil').getBoundingClientRect().height, h: innerHeight }));
  verifier(dims.pf / dims.h >= 0.25 && dims.pf / dims.h <= 0.36, `environ le tiers bas de l'écran : ${Math.round(dims.pf)} px sur ${dims.h}`);
  verifier((await A.p.locator('#carte-grande').boundingBox()).height < hCarte0, 'la carte s\'arrête au-dessus du graphique');
  await rienDeCache(A.p, 'téléphone portrait 393 × 852');
  await carteManipulable(A.p, 'téléphone portrait');

  console.log('Doigt sur le graphique : valeurs et point jaune sur la carte en plein écran');
  const t1034 = Date.UTC(2026, 10, 10, 10, 34, 20), tA = await poserPlein(A.p, t1034), vA = position(tA);
  const valA = await valeurPlein(A.p);
  verifier(/^10:34 16 000 ft 23[3-9] kt$/.test(valA), `doigt : « ${valA} » (vrai : ${Math.round(vA[3])} ft, ${Math.round(vA[4])} kt)`);
  const jaune = async (p, attendu) => p.evaluate(([la, lo]) => {
    const pt = document.querySelector('#carte-grande path.pf-point'), carte = document.getElementById('carte-grande')._carte;
    if (!pt) return null;
    const r = pt.getBoundingClientRect(), c = document.getElementById('carte-grande').getBoundingClientRect(), e = carte.latLngToContainerPoint([la, lo]);
    return Math.hypot(r.left + r.width / 2 - (c.left + e.x), r.top + r.height / 2 - (c.top + e.y));
  }, [attendu[1], attendu[2]]);
  const ecart = await jaune(A.p, vA);
  verifier(ecart !== null && ecart <= 3, `point jaune sur la carte en plein écran au même instant (écart ${ecart && ecart.toFixed(1)} px)`);
  const tB = await poserPlein(A.p, Date.UTC(2026, 10, 10, 11, 10, 0), { souris: true }), vB = position(tB);
  const valB = await valeurPlein(A.p), nB = valB.match(/ (\d{1,3}(?: \d{3})*) ft (\d+) kt$/);
  verifier(nB && Math.abs(Number(nB[1].replace(/ /g, '')) - vB[3]) <= 100 && Math.abs(Number(nB[2]) - vB[4]) <= 4 && (await jaune(A.p, vB)) <= 3, `souris : « ${valB} », point jaune suivi`);
  await A.p.screenshot({ path: join(CAPT, 'v060-plein-portrait.png') });

  console.log('Fluidité du glissé en plein écran (393 px, processeur ralenti ×4)');
  const cdp = await A.ctx.newCDPSession(A.p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const fl = await A.p.evaluate(() => new Promise(ok => {
    const s = document.querySelector('#cp-profil .pf-svg'), r = s.getBoundingClientRect(), debut = performance.now(); let n = 0, pire = 0, avant = debut, maj = 0;
    const obs = new MutationObserver(() => maj++); obs.observe(document.querySelector('#cp-profil .pf-val'), { childList: true, subtree: true, characterData: true });
    const pas = now => {
      pire = Math.max(pire, now - avant); avant = now; n++;
      s.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 40 + ((n * 7) % (r.width - 80)), clientY: r.top + r.height / 2, pointerType: 'touch', bubbles: true }));
      if (now - debut < 2000) requestAnimationFrame(pas); else { obs.disconnect(); ok({ ips: n / ((now - debut) / 1000), pire, maj }); }
    };
    requestAnimationFrame(pas);
  }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
  verifier(fl.ips >= 40 && fl.maj >= fl.ips, `glissé (point jaune compris) : ${fl.ips.toFixed(0)} images par seconde, image la plus longue ${fl.pire.toFixed(0)} ms`);

  console.log('Nouvel appui : caché ; choix retenu sur cet appareil');
  await A.p.click('#cp-pf'); await A.p.waitForTimeout(300);
  verifier(!(await ouvertPlein(A.p)) && await A.p.getAttribute('#cp-pf', 'aria-pressed') === 'false' && Math.abs((await A.p.locator('#carte-grande').boundingBox()).height - hCarte0) < 1,
    'nouvel appui : graphique caché, la carte reprend toute la place');
  await fermerPlein(A.p); await ouvrirPlein(A.p);
  verifier(!(await ouvertPlein(A.p)), 'laissé fermé : fermé à la prochaine carte en plein écran');
  await A.p.click('#cp-pf'); await A.p.waitForTimeout(300); await fermerPlein(A.p); await fermerVol(A.p);
  await A.p.reload(); await A.p.waitForSelector('body[data-pret="1"]');
  await A.p.evaluate(async () => { const m = await import('./js/ui/profil.js'); window.__profil = m._profilAffiche; window.__plein = m._profilPlein; });
  await ouvrirVol(A.p, 'v1'); await ouvrirPlein(A.p);
  verifier(await ouvertPlein(A.p) && await A.p.evaluate(async () => (await import('./js/etat.js')).reglage('profilPlein')) === true
    && await A.p.evaluate(async () => (await import('./js/sauvegarde.js')).REGLAGES_PRIVES.includes('profilPlein')),
  'laissé ouvert : ouvert à la prochaine carte en plein écran, même après relance (réglage de cet appareil, hors synchro)');
  // LOC dans la saisie : heures du graphique en plein écran en LOC
  await fermerPlein(A.p); await A.p.click('#tz-loc'); await A.p.waitForTimeout(150); await ouvrirPlein(A.p);
  const loc = await axes(A.p, '#cp-profil');
  verifier(loc.h[0] === `${String(Number(mini.h[0].slice(0, 2)) + 1).padStart(2, '0')}:${mini.h[0].slice(3)}`, `LOC : heures du graphique en plein écran ${loc.h.join(' ')} (UTC+1)`);
  await fermerPlein(A.p); await A.p.click('#tz-utc'); await fermerVol(A.p);

  console.log('Paysage 852 × 393, PC 1280 × 800');
  for (const [nom, vp] of [['téléphone paysage 852 × 393', { width: 852, height: 393 }], ['PC 1280 × 800', { width: 1280, height: 800 }]]) {
    await A.p.setViewportSize(vp); await ouvrirVol(A.p, 'v1'); await ouvrirPlein(A.p);
    if (!(await ouvertPlein(A.p))) await A.p.click('#cp-pf');
    await A.p.waitForTimeout(300);
    await rienDeCache(A.p, nom); await carteManipulable(A.p, nom);
    await poserPlein(A.p, t1034, { souris: nom.startsWith('PC') });
    verifier(/^10:34 16 000 ft/.test(await valeurPlein(A.p)) && (await jaune(A.p, position(await A.p.evaluate(() => window.__plein().tCur)))) <= 3, `${nom} : doigt / souris et point jaune justes`);
    await A.p.screenshot({ path: join(CAPT, `v060-plein-${vp.width}.png`) });
    await fermerPlein(A.p); await fermerVol(A.p);
  }
  await A.p.setViewportSize({ width: 393, height: 852 });

  console.log('iPad (moteur Safari) paysage et portrait');
  // une session par orientation (le simulateur WebKit dézoome la page quand on la tourne : pas le cas d'un vrai iPad)
  for (const vp of [{ width: 1080, height: 810 }, { width: 810, height: 1080 }]) {
    const I = await appareil('iPad', { navigateur: navSafari, contexte: { viewport: vp, userAgent: UA_IPAD } });
    await I.p.evaluate(async () => { const m = await import('./js/ui/profil.js'); window.__plein = m._profilPlein; });
    await ouvrirVol(I.p, 'v1'); await ouvrirPlein(I.p);
    if (!(await ouvertPlein(I.p))) await I.p.click('#cp-pf');
    await I.p.waitForTimeout(400);
    await rienDeCache(I.p, `iPad ${vp.width} × ${vp.height}`);
    const c = await I.p.evaluate(t => { const P = window.__plein(), r = document.querySelector('#cp-profil .pf-svg').getBoundingClientRect(); return { x: r.left + P.x(t) * r.width / P.W, y: r.top + r.height / 2 }; }, t1034);
    await I.p.touchscreen.tap(c.x, c.y); await I.p.waitForTimeout(200);
    verifier(/^10:34 16 000 ft 23[3-9] kt$/.test(await valeurPlein(I.p)), `iPad ${vp.width} × ${vp.height} : toucher → « ${await valeurPlein(I.p)} »`);
    await I.p.screenshot({ path: join(CAPT, `v060-plein-ipad-${vp.width}.png`) });
    await fermerPlein(I.p); await fermerVol(I.p); await I.ctx.close();
  }

  console.log('Affichage seulement');
  verifier(await totaux(A.p) === t0 && await A.p.evaluate(async () => JSON.stringify((await import('./js/etat.js')).etat.vols)) === vols0, 'aucune heure, aucun vol, aucun total ne change');

  console.log('Synchro : trace réimportée sur l\'iPad (modification), vue sur le téléphone (référence)');
  await rejoindre(A.p, 'ref');
  const T = await appareil('iPad-synchro', { remplir: false }); await rejoindre(T.p, 'mod');
  const gpxSans = FICHIER_GPX.replace('.gpx', '-sans-altitude.gpx'); writeFileSync(gpxSans, gpx.replace(/<ele>[^<]*<\/ele>/g, ''));
  const importer = async (X, f) => { await ouvrirVol(X.p, 'v4'); await X.p.locator('#tr-imp').scrollIntoViewIfNeeded();
    const [c] = await Promise.all([X.p.waitForEvent('filechooser'), X.p.click('#tr-imp')]); await c.setFiles(f);
    await X.p.waitForFunction(() => !document.getElementById('tr-info').hidden, null, { timeout: 20000 }); await X.p.waitForTimeout(600); await fermerVol(X.p); };
  const actualiser = async X => { await onglet(X.p, 'carnet'); await X.p.click('#rafraichir'); await X.p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 }); await X.p.waitForTimeout(400); };
  const synchroEnFond = X => X.p.evaluate(async () => { await (await import('./js/ui/synchro.js')).synchroniser(); });
  const traceDe = async (X, id) => { const v = await volDe(X.p, id); return v && v.traceImportee ? ('a' in v.traceImportee ? 'altitude' : 'sans altitude') : 'aucune'; };
  const conflitsDe = X => X.p.evaluate(async () => ((await import('./js/etat.js')).reglage('synchroEtat')?.conflits || []).length);
  await importer(T, gpxSans); await actualiser(T); await actualiser(A);
  verifier(await traceDe(A, 'v4') === 'sans altitude', 'import sans altitude sur l\'iPad : reçu par le téléphone');
  await ouvrirVol(A.p, 'v4'); // le téléphone REGARDE le vol (lecture) pendant la synchro
  verifier((await profil(A.p)).leg === 'Vitesse sol', 'téléphone : vitesse seule (trace sans altitude)');
  await importer(T, FICHIER_GPX); await actualiser(T);
  await synchroEnFond(A); await A.p.waitForTimeout(800);
  const vu = await profil(A.p);
  verifier(await traceDe(A, 'v4') === 'altitude' && vu.visible && /Altitude/.test(vu.leg) && /Vitesse sol/.test(vu.leg) && await conflitsDe(A) === 0,
    `réimport avec altitude sur l'iPad, synchro pendant que le téléphone regarde le vol : reçue, fiche rafraîchie (« ${vu.leg} »), aucun conflit`);
  await fermerVol(A.p);
  // vol ouvert en MODIFICATION (crayon) sans rien changer pendant la synchro : gardé, puis appliqué dès la fermeture
  await ouvrirVol(A.p, 'v4'); await A.p.click('#f-edit');
  await importer(T, gpxSans); await actualiser(T);
  await synchroEnFond(A); await A.p.waitForTimeout(500);
  verifier(await traceDe(A, 'v4') === 'altitude', 'vol en modification sur le téléphone pendant la synchro : pas changé sous les doigts');
  await fermerVol(A.p); await actualiser(A);
  verifier(await traceDe(A, 'v4') === 'sans altitude' && await conflitsDe(A) === 0, 'fermé sans modification : la version reçue s\'applique à la synchro suivante, aucun conflit à choisir');
  // vraie modification des deux côtés : le conflit reste à choisir (rien n'est écrasé)
  await A.ctx.setOffline(true);
  await ouvrirVol(A.p, 'v2'); await A.p.click('#f-edit'); await A.p.fill('#f-rem', 'REMARQUE TELEPHONE'); await A.p.click('#f-ok'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(300);
  await ouvrirVol(T.p, 'v2'); await T.p.click('#f-edit'); await T.p.fill('#f-rem', 'REMARQUE IPAD'); await T.p.click('#f-ok'); await T.p.waitForSelector('#v-carnet:not([hidden])'); await actualiser(T);
  await A.ctx.setOffline(false); await actualiser(A);
  verifier((await volDe(A.p, 'v2')).remarques === 'REMARQUE TELEPHONE' && await conflitsDe(A) === 1, 'vraie modification des deux côtés : rien n\'est écrasé, le conflit reste à choisir (inchangé)');

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur (ni vrai VPS, ni vrai NAS, ni Google)' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.60 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); await navSafari.close(); fauxTraces.closeAllConnections?.(); fauxTraces.close(); fauxNas.closeAllConnections?.(); fauxNas.close(); srv.fermer();
}
