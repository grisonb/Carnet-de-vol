// v0.54 : R132 bulle « Mission » ; R133 bulles feu en rouge plein (« Feu n°7 », « Feu n°41, 42 », « Feu ») ; R134 répartition
// automatique des atterrissages jour / nuit (saisie, correction à la main gardée, import NPF depuis un FAUX NAS, ancien vol
// inchangé). Vols, trigrammes, numéros de feux et immatriculations INVENTÉS ; toute adresse non locale est BLOQUÉE.
// Captures : tests/navigateur/captures/v054-*.png. Usage : node tests/navigateur/v054.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-11-15T08:00:00Z';
const AVION = { id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400 MR', constructeur: 'ESSAI', nom: 'M91', indicatif: '', equipage: 'MP', moteurs: 'ME',
  moteur: 'T', surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', creeLe: H, modifieLe: H };
// Le 15/11/2026 à LFTW, le soleil se couche vers 16h05 UTC : 10h-11h = de jour, 14h-18h = jour puis nuit, 19h-20h = de nuit
const vol = (id, hDep, hArr, champs = {}) => ({ id, date: '2026-11-15', hDep, hArr, mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId: 'a1', tempsTotal: 60,
  tempsMP: 60, tempsSE: null, tempsME: null, tempsCdB: 60, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: 'ZZA', nomInstructeur: '', nomExaminateur: '', missions: [],
  remarques: '', feux: 0, compteurs: {}, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie',
  ordre: Date.parse(`2026-11-15T${hDep}Z`), creeLe: H, modifieLe: H, ...champs });
const VOLS = [
  vol('v-j', '09:00', '10:00'), vol('v-jn', '09:30', '10:30'), vol('v-n', '08:00', '09:00'), vol('v-man', '08:30', '09:30'),
  vol('v-old', '14:00', '18:00', { tempsTotal: 240, tempsMP: 240, tempsCdB: 240, tempsNuit: 85, attJour: 1, attNuit: 0 }), // ancien vol : 1 J / 0 N enregistré
  vol('v-mis', '07:00', '08:00', { missions: ['MISSION ESSAI'] }),
  vol('v-f7', '06:00', '07:00', { missions: ['FEU n°7 ESSAI'], feux: 1 }),
  vol('v-f2', '05:00', '06:00', { missions: ['FEU n°41 ESSAI', 'FEU n°42 ESSAI'], feux: 2 }),
  vol('v-f0', '04:00', '05:00', { missions: ['FEU ESSAI'], feux: 0 })];
const REGLES = [{ debut: 'ENT.', pastille: 'Entraînement' }, { debut: 'GAAR', pastille: 'GAAR' }, { debut: 'MISSION', pastille: 'MISSION' }];

// ---------- Faux NAS : un vol NPF-Q400 inventé, fini de nuit ----------
const srv = await serveur();
const MDP = 'mot-de-passe-essai-54';
const NPF = { format: 'carnet-vol-npf', version: 2, id: 'npf-54', exporteLe: '2026-11-15T19:00:00Z', date: '2026-11-15', blocDepart: '14:00', blocArrivee: '18:00',
  nomAvion: 'M91', depart: 'LFTW', arrivee: 'LFTW', copilote: 'ZZA' };
const fauxNas = createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), action = u.searchParams.get('action');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Carnet-Cle, X-Carnet-Empreinte', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const json = d => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); };
  req.on('data', () => {});
  req.on('end', () => {
    if (req.headers['x-carnet-cle'] !== MDP) return json({ erreur: 'mot-de-passe', code: 401 });
    if (action === 'vols-liste') return json({ vols: [NPF] });
    if (action === 'vol-retirer') return json({ ok: true, retire: true });
    if (action === 'envoyer') return json({ ok: true, vols: 0, taille: 0 });
    json({ erreur: 'action', code: 400 });
  });
});
await new Promise(ok => fauxNas.listen(0, '127.0.0.1', ok));
const ADRESSE_NAS = `http://127.0.0.1:${fauxNas.address().port}/carnet-api/`;

const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
const p = await ctx.newPage();
p.on('pageerror', e => erreurs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|Access-Control|access control/i.test(m.text())) erreurs.push(m.text()); });

const volDe = id => p.evaluate(async id => { const v = (await import('./js/etat.js')).etat.vols.find(x => x.id === id); return v && { j: v.attJour, n: v.attNuit, rem: v.remarques, hArr: v.hArr }; }, id);
const att = async () => `${await p.textContent('#s-attJour')}/${await p.textContent('#s-attNuit')}`;
const plus = async (k, fois = 1) => { for (let i = 0; i < fois; i++) await p.click(`[data-s="${k}"][data-d="1"]`); };
async function ouvrir(id) {
  await p.click('.tabs button[data-v="carnet"]'); await p.locator(`.flight[data-id="${id}"]`).scrollIntoViewIfNeeded();
  await p.click(`.flight[data-id="${id}"]`); await p.waitForSelector('#v-saisie:not([hidden])');
  await p.click('#f-edit'); await p.waitForTimeout(150);
}
const heures = async (t0, t1) => { await p.fill('#f-t0', t0); await p.fill('#f-t1', t1); await p.waitForTimeout(100); };
const enregistrer = async () => {
  await p.click('#save');
  // v0.58 (R150) : temps de vol changé -> alerte, « Enregistrer quand même »
  await p.waitForSelector('#v-carnet:not([hidden]), #tv-modal:not([hidden])'); if (await p.isVisible('#tv-modal')) await p.click('#tv-ok');
  await p.waitForSelector('#v-carnet:not([hidden])'); await p.waitForTimeout(250);
};
const bulles = id => p.$$eval(`.flight[data-id="${id}"] .chips .chip`, l => l.map(c => ({ t: c.textContent, classe: c.className, fond: getComputedStyle(c).backgroundColor, encre: getComputedStyle(c).color })));
const totaux = () => p.evaluate(async () => { const t = await import('./js/totaux.js'), e = await import('./js/etat.js'); return JSON.stringify(t.calculerTotaux(e.etat.vols, e.etat.avions, '2026-11-21')); });

try {
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([a, vs, regles]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols', 'reglages'], 'readwrite'); t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    t.objectStore('reglages').put({ cle: 'regles', valeur: regles, modifieLe: '2026-11-15T08:00:00Z' });
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVION, VOLS, REGLES]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  const nuitOk = await p.evaluate(async () => { const { estNuit } = await import('./js/nuit.js'); const n = h => estNuit(Date.parse(`2026-11-15T${h}:00Z`), 43.757, 4.416);
    return [n('10:00'), n('11:00'), n('14:00'), n('18:00'), n('19:00'), n('20:00')].join(','); });
  verifier(nuitOk === 'false,false,false,true,true,true', `heures inventées bien choisies à LFTW (nuit à 10h, 11h, 14h, 18h, 19h, 20h UTC : ${nuitOk})`);

  console.log('R132 / R133 : bulles « Mission » et feu');
  const bm = await bulles('v-mis');
  verifier(bm.some(b => b.t === 'Mission') && !bm.some(b => b.t === 'MISSION'), `bulle « Mission » (et non « MISSION ») : ${bm.map(b => b.t).join(' | ')}`);
  const ref = (await bulles('v-f7')).find(b => /^Feu/.test(b.t));
  verifier(ref && ref.t === 'Feu n°7' && ref.fond === 'rgb(211, 47, 47)' && ref.encre === 'rgb(255, 255, 255)', `« Feu n°7 » rouge plein (${ref?.fond} / ${ref?.encre})`);
  for (const [id, texte] of [['v-f2', 'Feu n°41, 42'], ['v-f0', 'Feu']]) {
    const b = (await bulles(id)).find(x => /^Feu/.test(x.t));
    verifier(b && b.t === texte && b.fond === ref.fond && b.encre === ref.encre && !b.classe.includes('feu2'), `« ${texte} » rouge plein comme « Feu n°7 » (${b?.fond})`);
  }
  verifier(await p.$$eval('.chip.feu2', l => l.length) === 0, 'plus aucune bulle feu en contour seul');
  await p.locator('.flight[data-id="v-f2"]').scrollIntoViewIfNeeded();
  await p.screenshot({ path: join(CAPT, 'v054-bulles.png') });
  const t0 = await totaux();

  console.log('R134 : ancien vol jamais rattrapé');
  verifier(JSON.stringify(await volDe('v-old')) === JSON.stringify({ j: 1, n: 0, rem: '', hArr: '18:00' }), 'au chargement : ancien vol fini de nuit toujours 1 J / 0 N');
  await ouvrir('v-old');
  verifier(await att() === '1/0', `ancien vol ouvert en modification : ${await att()} affiché (rien de recalculé)`);
  await p.fill('#f-rem', 'REMARQUE ESSAI'); await enregistrer();
  const old = await volDe('v-old');
  verifier(old.j === 1 && old.n === 0 && old.rem === 'REMARQUE ESSAI', `remarque changée seulement : toujours ${old.j} J / ${old.n} N`);

  console.log('R134 : répartition automatique dans la saisie');
  await ouvrir('v-j'); await heures('10h00', '11h00'); await plus('attJour', 2);
  verifier(await att() === '3/0', `vol fini de jour, 3 atterrissages : ${await att()} (3 J / 0 N)`);
  await enregistrer(); let v = await volDe('v-j');
  verifier(v.j === 3 && v.n === 0, `enregistré : ${v.j} J / ${v.n} N`);

  await ouvrir('v-jn'); await heures('14h00', '18h00');
  verifier(await att() === '0/1', `commencé de jour, fini de nuit, 1 atterrissage : ${await att()} (0 J / 1 N)`);
  await plus('attJour', 4);
  verifier(await att() === '4/1', `même vol, 5 atterrissages : ${await att()} (4 J / 1 N)`);
  await p.evaluate(() => document.getElementById('s-attJour').scrollIntoView({ block: 'center' }));
  await p.screenshot({ path: join(CAPT, 'v054-saisie-4j-1n.png') });
  await enregistrer(); v = await volDe('v-jn');
  verifier(v.j === 4 && v.n === 1, `enregistré : ${v.j} J / ${v.n} N`);

  await ouvrir('v-n'); await heures('19h00', '20h00'); await plus('attJour');
  verifier(await att() === '0/2', `vol entièrement de nuit, 2 atterrissages : ${await att()} (0 J / 2 N)`);
  await enregistrer(); v = await volDe('v-n');
  verifier(v.j === 0 && v.n === 2, `enregistré : ${v.j} J / ${v.n} N`);

  console.log('R134 : correction à la main gardée, puis règle réappliquée');
  await ouvrir('v-man'); await heures('14h00', '18h00'); await plus('attJour', 4);
  verifier(await att() === '4/1', `5 atterrissages : ${await att()}`);
  await plus('attNuit');
  verifier(await att() === '3/2', `correction « Att. Nuit + » : ${await att()} (le total reste 5)`);
  await enregistrer(); v = await volDe('v-man');
  verifier(v.j === 3 && v.n === 2, `enregistré : ${v.j} J / ${v.n} N`);
  await ouvrir('v-man'); await p.fill('#f-rem', 'AUTRE REMARQUE ESSAI'); await enregistrer(); v = await volDe('v-man');
  verifier(v.j === 3 && v.n === 2 && v.rem === 'AUTRE REMARQUE ESSAI', `remarque changée : correction gardée (${v.j} J / ${v.n} N)`);
  await ouvrir('v-man'); await p.fill('#f-t1', '18h10'); await p.waitForTimeout(100);
  verifier(await att() === '4/1', `heure d'arrivée changée : la règle repart (${await att()})`);
  await enregistrer(); v = await volDe('v-man');
  verifier(v.j === 4 && v.n === 1 && v.hArr === '18:10', `enregistré : ${v.j} J / ${v.n} N, arrivée ${v.hArr}`);

  console.log('R134 : vol NPF fini de nuit (faux NAS)');
  await p.evaluate(async ([adr, mdp]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction('reglages', 'readwrite'), g = t.objectStore('reglages');
    g.put({ cle: 'nasAdresse', valeur: adr }); g.put({ cle: 'nasMotDePasse', valeur: mdp }); g.put({ cle: 'nasAuto', valeur: false });
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [ADRESSE_NAS, MDP]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  await p.waitForFunction(() => /^1 vol/.test(document.getElementById('npf-bandeau').textContent), null, { timeout: 15000 });
  await p.click('#npf-bandeau'); await p.waitForSelector('#npf-l'); await p.click('#npf-l [data-npf="npf-54"]'); await p.waitForSelector('#v-saisie:not([hidden])');
  verifier(await att() === '0/1', `brouillon NPF 14h00 → 18h00 UTC : ${await att()} (1 atterrissage de nuit)`);
  await enregistrer();
  const vn = await p.evaluate(async () => { const v = (await import('./js/etat.js')).etat.vols.find(x => x.npfId === 'npf-54'); return v && `${v.attJour}/${v.attNuit}`; });
  verifier(vn === '0/1', `vol NPF enregistré : ${vn}`);

  console.log('Totaux = simple somme ; les vols non touchés ne changent pas');
  const tt = JSON.parse(await totaux()), avant = JSON.parse(t0);
  const somme = await p.evaluate(async () => { const l = (await import('./js/etat.js')).etat.vols; return [l.reduce((s, v) => s + (v.attJour || 0), 0), l.reduce((s, v) => s + (v.attNuit || 0), 0)]; });
  verifier(JSON.stringify(Object.keys(tt).sort()) === JSON.stringify(Object.keys(avant).sort()), 'mêmes rubriques de totaux');
  const autres = await p.evaluate(async () => (await import('./js/etat.js')).etat.vols.filter(v => /^v-(mis|f7|f2|f0)$/.test(v.id)).map(v => `${v.attJour}/${v.attNuit}`).join(','));
  verifier(autres === '1/0,1/0,1/0,1/0', `vols non touchés inchangés (${autres}) ; somme ${somme[0]} J / ${somme[1]} N`);

  verifier(!erreurs.length, 'aucune erreur dans la page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  verifier(bloquees.length === 0, `aucun appel hors de l'ordinateur (ni vrai NAS, ni VPS, ni Google) : ${bloquees.length}`);
  console.log('\nv0.54 : tout est bon.');
} finally {
  await nav.close(); fauxNas.closeAllConnections?.(); fauxNas.close(); srv.fermer();
}
