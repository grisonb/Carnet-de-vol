// v0.47 (R121) : les vols envoyés par NPF-Q400 arrivent sans refaire l'export. Téléphone (Chromium 390 px) autour d'un
// FAUX NAS local (synchro v5 + vols NPF : vol-depot imité, vols-liste, vol-retirer ; mode « muet » = ne répond plus).
// Horloge de la page simulée (Playwright clock) : les vraies durées du code (2 min, 1 min, 20 s) sans les attendre.
// - bouton d'actualisation : synchro ET vols NPF, message « À jour · 1 vol NPF à importer » ;
// - sans rien toucher : le bandeau apparaît en 2 min au plus ; app en arrière-plan : aucune recherche ;
// - NAS muet : message clair, UN nouvel essai ~1 min plus tard, réussite quand il répond ;
// - même vol déposé deux fois : un seul vol importé ; jamais deux recherches en même temps.
// Vols et immatriculations INVENTÉS ; toute adresse non locale est BLOQUÉE. Usage : node tests/navigateur/v047.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const npf = (id, change = {}) => ({ format: 'carnet-vol-npf', version: 1, id, exporteLe: '2026-11-17T10:00:00Z', date: '2026-11-16',
  blocDepart: '13:05', blocArrivee: '15:40', immat: 'F-XZZA', depart: 'LFTW', arrivee: 'LFMT', ...change });

// ---------- Faux NAS ----------
const srv = await serveur();
const nas = { mdp: 'mot-de-passe-essai-47', rev: 0, el: new Map(), npf: new Map(), listes: 0, retraits: [], muet: false, pendus: [] };
const depot = v => nas.npf.set(v.id, structuredClone(v)); // comme carnet.php : un 2e dépôt du même id REMPLACE le premier
const faux = createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), action = u.searchParams.get('action');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Carnet-Cle, X-Carnet-Empreinte', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const morceaux = [];
  req.on('data', m => morceaux.push(m));
  req.on('end', () => {
    const json = (o, code = 200) => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(code === 200 ? o : { ...o, code })); };
    if (req.headers['x-carnet-cle'] !== nas.mdp) return json({ erreur: 'mot-de-passe' }, 401);
    if (action === 'test') return json({ ok: true, copies: 0, cle: 'carnet', version: 5 });
    if (action === 'envoyer') return json({ ok: true, id: 'x', vols: 1, taille: 1, verification: 'empreinte' });
    if (action === 'vols-liste') {
      nas.listes++;
      if (nas.muet) { nas.pendus.push(res); return; } // ne répond jamais (le Carnet abandonne après 20 s)
      return json({ vols: [...nas.npf.values()] });
    }
    if (action === 'vol-retirer') { const id = u.searchParams.get('id'); nas.retraits.push(id); return json({ ok: true, retire: nas.npf.delete(id) }); }
    if (action === 'synchro-etat') return json({ ok: true, rev: nas.rev, nombres: {} });
    if (action === 'synchro-recevoir') {
      const depuis = Number(u.searchParams.get('depuis')), limite = Number(u.searchParams.get('limite'));
      const tous = [...nas.el.entries()].filter(([, e]) => e.rev > depuis).sort((a, b) => a[1].rev - b[1].rev);
      const page = tous.slice(0, limite).map(([cle, e]) => ({ magasin: cle.split('/')[0], id: cle.slice(cle.indexOf('/') + 1), ...e }));
      const suite = tous.length > limite;
      return json({ ok: true, rev: nas.rev, elements: page, suite, jusqua: suite ? page.at(-1).rev : nas.rev });
    }
    if (action === 'synchro-envoyer') {
      const b = JSON.parse(Buffer.concat(morceaux).toString());
      const acceptees = [], deja = [], conflits = [];
      for (const m of b.modifications) {
        const cle = `${m.magasin}/${m.id}`, a = nas.el.get(cle), revA = a ? a.rev : 0, donnees = m.supprime ? null : m.donnees;
        if (a && !!a.supprime === !!m.supprime && JSON.stringify(a.donnees) === JSON.stringify(donnees)) { deja.push({ magasin: m.magasin, id: m.id, rev: revA }); continue; }
        if (m.base !== revA) { conflits.push({ magasin: m.magasin, id: m.id, rev: revA }); continue; }
        nas.rev++; nas.el.set(cle, { rev: nas.rev, supprime: !!m.supprime, donnees, appareil: b.appareil, le: '2026-11-17T10:00:00+01:00' });
        acceptees.push({ magasin: m.magasin, id: m.id, rev: nas.rev });
      }
      return json({ ok: true, rev: nas.rev, acceptees, deja, conflits });
    }
    return json({ erreur: 'action' }, 400);
  });
});
await new Promise(ok => faux.listen(0, '127.0.0.1', ok));
const ADRESSE = `http://127.0.0.1:${faux.address().port}/carnet-api/`;

const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
await ctx.addInitScript(() => {
  globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png';
  // arrière-plan simulé : document.visibilityState piloté par le test (comme un téléphone qui passe l'app en arrière-plan)
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__arrierePlan ? 'hidden' : 'visible') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!window.__arrierePlan });
});
const p = await ctx.newPage();
p.on('pageerror', e => erreurs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|Access-Control|access control/i.test(m.text())) erreurs.push(m.text()); });
await p.clock.install(); // horloge simulée : elle avance normalement, et le test peut la faire sauter en avant
const bandeau = () => p.evaluate(() => { const b = document.getElementById('npf-bandeau'); return b.hidden ? '' : b.textContent; });
const attendreQue = async (cond, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await cond()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const toast = () => p.waitForFunction(() => { const t = document.getElementById('toast'); return t && !t.hidden && t.textContent.trim(); }, null, { timeout: 30000 }).then(() => p.textContent('#toast'));
const calme = async () => { // plus aucune demande en cours (pour compter juste)
  let n = -1; for (let i = 0; i < 30 && n !== nas.listes; i++) { n = nas.listes; await new Promise(r => setTimeout(r, 300)); }
};
const arrierePlan = async oui => p.evaluate(oui => { window.__arrierePlan = oui; document.dispatchEvent(new Event('visibilitychange')); }, oui);
const volsCarnet = () => p.evaluate(async () => (await import('./js/etat.js')).etat.vols.filter(v => v.npfId).map(v => v.npfId));

try {
  console.log('Mise en place : NAS et synchro (téléphone de référence)');
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async () => { // l'avion (inventé) des vols NPF est dans le carnet
    const H = '2026-11-17T08:00:00Z', a = { id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400 MRE', constructeur: 'ESSAI', nom: 'M91', indicatif: '',
      equipage: 'MP', moteurs: 'ME', moteur: 'T', surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', creeLe: H, modifieLe: H };
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction('avions', 'readwrite'); t.objectStore('avions').put(a); await new Promise(ok => { t.oncomplete = ok; }); db.close();
  });
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  await p.click('.tabs button[data-v="plus"]'); await p.click('#pl-sync'); await p.click('#sy-nas');
  await p.fill('#nas-adr', ADRESSE); await p.fill('#nas-mdp', nas.mdp); await p.click('#nas-ok'); await p.waitForTimeout(400); await p.click('#ou-x');
  await p.click('#pl-sync'); await p.click('#sy-ref'); await p.click('#sr-ok');
  await p.waitForFunction(() => { const e = document.querySelector('#sr-res'); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, null, { timeout: 60000 });
  await p.click('#ou-x'); await p.click('.tabs button[data-v="carnet"]');
  await p.clock.runFor(5000); await calme();
  verifier(!(await bandeau()), 'aucun vol NPF en attente : pas de bandeau');

  console.log('1. Carnet ouvert, vol déposé, bouton d\'actualisation');
  depot(npf('npf-1'));
  await p.click('#rafraichir');
  const t1 = await toast();
  verifier(t1 === 'À jour · 1 vol NPF à importer', `message : « ${t1} »`);
  verifier(await bandeau() === '1 vol à importer depuis NPF-Q400 ›', 'bandeau « 1 vol à importer depuis NPF-Q400 › »');
  await p.screenshot({ path: join(CAPT, 'v047-01-bouton.png'), clip: { x: 0, y: 0, width: 390, height: 300 } });

  console.log('2. Sans rien toucher : le bandeau apparaît en 2 min au plus');
  await p.clock.runFor(3000); await calme();
  depot(npf('npf-2', { date: '2026-11-15' }));
  const avant2 = nas.listes;
  await p.clock.runFor(119000); // un peu moins de 2 min de l'horloge de la page
  const vu = await attendreQue(async () => (await bandeau()) === '2 vols à importer depuis NPF-Q400 ›');
  verifier(vu && nas.listes > avant2, `bandeau « 2 vols à importer » apparu tout seul (recherche régulière, ${nas.listes - avant2} demande(s) en 2 min)`);

  console.log('3. App en arrière-plan : aucune recherche');
  await calme(); await arrierePlan(true); await p.clock.runFor(500); await calme();
  const avant3 = nas.listes;
  await p.clock.runFor(10 * 60 * 1000); await calme();
  verifier(nas.listes === avant3, `10 min en arrière-plan : ${nas.listes - avant3} recherche (aucune)`);
  const avant3b = nas.listes;
  await arrierePlan(false); await p.clock.runFor(2500);
  verifier(await attendreQue(() => nas.listes > avant3b), 'retour au premier plan : recherche comme avant (déclencheur existant)');
  await calme();

  console.log('4. NAS qui ne répond pas : message clair, nouvel essai 1 min plus tard');
  nas.muet = true;
  depot(npf('npf-3', { date: '2026-11-14' }));
  const avant4 = nas.listes;
  await p.click('#rafraichir');
  await attendreQue(() => nas.listes > avant4);
  await p.clock.runFor(20500); // le Carnet abandonne après 20 s
  const t4 = await toast();
  verifier(t4 === 'À jour · Vols NPF : NAS injoignable, nouvel essai dans 1 min', `message : « ${t4} »`);
  verifier(await bandeau() === '2 vols à importer depuis NPF-Q400 ›', 'le bandeau garde les vols déjà connus');
  await p.screenshot({ path: join(CAPT, 'v047-02-nas-muet.png'), clip: { x: 0, y: 0, width: 390, height: 300 } });
  nas.muet = false;
  const avant4b = nas.listes;
  await p.clock.runFor(30000); await calme();
  verifier(nas.listes === avant4b, '30 s plus tard : pas encore de nouvel essai');
  await p.clock.runFor(31000);
  verifier(await attendreQue(async () => (await bandeau()) === '3 vols à importer depuis NPF-Q400 ›'), `nouvel essai ~1 min plus tard, sans message : « 3 vols à importer » (${nas.listes - avant4b} demande)`);
  await calme();
  // le nouvel essai n'a lieu qu'UNE fois : NAS de nouveau muet, deux minutes sans clic -> une recherche régulière, puis un seul essai
  nas.muet = true;
  const avant4c = nas.listes;
  await p.clock.runFor(60000); await calme();
  verifier(nas.listes === avant4c, 'pas de recherche supplémentaire tant qu\'il n\'y a eu ni échec ni 2 min');
  nas.muet = false; for (const r of nas.pendus.splice(0)) r.destroy();

  console.log('5. Jamais deux recherches en même temps');
  await p.clock.runFor(70000); await calme();
  nas.muet = true;
  const avant5 = nas.listes;
  await p.evaluate(async () => { const m = await import('./js/ui/npf.js'); m.verifierVolsNpf(); m.verifierVolsNpf(); m.verifierVolsNpf(); });
  await new Promise(r => setTimeout(r, 800));
  verifier(nas.listes === avant5 + 1, `trois demandes pendant qu'une recherche est en cours : ${nas.listes - avant5} seule recherche au NAS`);
  nas.muet = false; for (const r of nas.pendus.splice(0)) r.destroy();
  await p.clock.runFor(21000); await p.clock.runFor(61000); await calme();

  console.log('6. Même vol déposé deux fois : un seul vol importé');
  depot(npf('npf-4', { date: '2026-11-13' })); depot(npf('npf-4', { date: '2026-11-13' }));
  await p.click('#rafraichir'); await toast();
  verifier(await bandeau() === '4 vols à importer depuis NPF-Q400 ›', 'deux dépôts du même vol : 4 vols à importer (pas 5)');
  await p.click('#npf-bandeau'); await p.waitForSelector('#npf-l');
  const lignes = await p.$$eval('#npf-l .npfv', l => l.length);
  verifier(lignes === 4, `liste : ${lignes} vols, chacun une fois`);
  await p.click('#npf-l .npfv >> nth=0'); await p.waitForSelector('#v-saisie:not([hidden])'); await p.waitForTimeout(400);
  await p.click('#save'); await p.waitForSelector('#v-carnet:not([hidden])'); await p.waitForTimeout(500);
  const importe = (await volsCarnet())[0];
  depot(npf(importe, { date: nas.npf.get(importe)?.date || '2026-11-13' }));
  const depot2 = [...nas.npf.keys()].includes(importe);
  await p.click('#rafraichir'); await toast(); await p.waitForTimeout(500);
  const ids = await volsCarnet();
  verifier(depot2 && ids.filter(x => x === importe).length === 1 && await bandeau() === '3 vols à importer depuis NPF-Q400 ›' && !nas.npf.has(importe),
    `vol déjà enregistré puis redéposé à l'identique : toujours UN seul dans le carnet, retiré du NAS, pas proposé de nouveau (${await bandeau()})`);

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.47 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  for (const r of nas.pendus) r.destroy();
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}
