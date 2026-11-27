// v0.66 : R162 ligne « À reporter sur le carnet » supprimée (pas de trou à sa place) ; le rond « reporté » reste (coche / décoche sans
// ouvrir le vol) ; bouton jaune « N vols à vérifier » : filtre et retour à tous ; 360 / 393 px ; PDF, CSV, totaux inchangés.
// Carnet INVENTÉ, aucun serveur extérieur. Usage : node tests/navigateur/v066.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-10-01T08:00:00Z';
const AVION = { id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400 MR', constructeur: 'ESSAI', nom: '', indicatif: '', equipage: 'MP', moteurs: 'ME', moteur: 'T',
  surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', hexAdsb: '', creeLe: H, modifieLe: H };
const C0 = { largCdbDash: 0, largInstrCdbDash: 0, largCopiDash: 0, largCopiCL: 0, ecopages: 0, amerrCL: 0, amerrSEP: 0, largPara: 0 };
const vol = (k, champs = {}) => ({ id: `v${k}`, date: `2026-10-${String(1 + k).padStart(2, '0')}`, hDep: '10:00', hArr: '11:30', mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId: 'a1',
  tempsTotal: 90, tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: 90, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '',
  missions: [], remarques: '', feux: 0, compteurs: { ...C0 }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie',
  ordre: Date.parse(`2026-10-${String(1 + k).padStart(2, '0')}T10:00Z`), creeLe: H, modifieLe: H, ...champs });
// 12 vols : 4 à reporter (dont un avec « ! »), un autre avec « ! » (temps CdB faux)
const VOLS = Array.from({ length: 12 }, (_, k) => vol(k, { ...(k % 3 === 0 ? { aReporter: true } : {}), ...(k === 3 || k === 7 ? { tempsCdB: 60 } : {}) }));

const srv = await serveur();
const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
const p = await ctx.newPage();
p.on('pageerror', e => erreurs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/i.test(m.text())) erreurs.push(m.text()); });
const etatVols = () => p.evaluate(async () => (await import('./js/etat.js')).etat.vols.map(v => [v.id, v.aReporter === true, v.modifieLe]));
const ronds = () => p.$$eval('#list .fl-rep', l => Object.fromEntries(l.map(r => [r.dataset.rep, r.getAttribute('aria-checked') === 'true'])));
const affiches = () => p.$$eval('#list .flight', l => l.map(c => c.dataset.id));
const carnet = () => p.evaluate(async () => { const e = await import('./js/etat.js'), t = await import('./js/totaux.js'), s = await import('./js/sauvegarde.js'), d = await import('./js/pdf.js');
  const v = e.etat.vols; return JSON.stringify([t.calculerTotaux(v, e.etat.avions, '2026-12-31'), s.texteTableur([...v].reverse(), e.etat.avions, e.listeDesCompteurs()), d.totauxPDF([...v].reverse(), e.etat.avions)]); });
// haut de l'accueil : position de chaque élément jusqu'au premier vol (aucun trou là où était la ligne)
const haut = () => p.evaluate(() => { scrollTo(0, 0); const ids = ['an-btn', 'list'];
  const r = Object.fromEntries(ids.map(id => [id, Math.round(document.getElementById(id).getBoundingClientRect().top * 10) / 10]));
  r.premier = Math.round(document.querySelector('#list .flight').getBoundingClientRect().top * 10) / 10;
  let prec = document.getElementById('list').previousElementSibling; while (prec && (prec.hidden || !prec.getBoundingClientRect().height)) prec = prec.previousElementSibling;
  r.avant = prec ? prec.id || prec.className : '';
  r.ecart = Math.round((document.getElementById('list').getBoundingClientRect().top - prec.getBoundingClientRect().bottom) * 10) / 10;
  r.deborde = document.documentElement.scrollWidth > innerWidth; return r; });

try {
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([a, vs]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols'], 'readwrite'); t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVION, VOLS]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  verifier(Number((await p.evaluate(async () => (await import('./js/version.js')).VERSION)).split('.')[1]) >= 66, 'version 0.66 ou suivante');
  const carnet0 = await carnet();

  console.log('Plus de ligne « À reporter sur le carnet »');
  verifier(await p.evaluate(() => !document.getElementById('rep-ligne') && !/reporter sur le carnet/i.test(document.getElementById('v-carnet').innerText)), 'aucune ligne « À reporter » (4 vols à reporter dans le carnet)');
  let r = await ronds();
  verifier(Object.keys(r).length === 12 && Object.values(r).filter(x => !x).length === 4 && ['v0', 'v3', 'v6', 'v9'].every(id => r[id] === false), 'ronds : 4 vides (à reporter), 8 verts');

  console.log('Rond : coche / décoche sans ouvrir le vol');
  const m0 = (await etatVols()).find(x => x[0] === 'v0')[2];
  await p.locator('.flight[data-id="v0"] .fl-rep').click(); await p.waitForTimeout(300);
  verifier(await p.isHidden('#v-saisie') && (await ronds()).v0 === true && (await etatVols()).find(x => x[0] === 'v0')[1] === false, 'appui : rond vert, vol reporté, le vol ne s\'ouvre pas');
  await p.locator('.flight[data-id="v0"] .fl-rep').click(); await p.waitForTimeout(300);
  verifier((await ronds()).v0 === false && (await etatVols()).find(x => x[0] === 'v0')[1] === true && (await etatVols()).find(x => x[0] === 'v0')[2] === m0, 'nouvel appui : de nouveau à reporter (« Modifié le » inchangé)');

  console.log('Bouton jaune « N vols à vérifier »');
  verifier((await p.textContent('#an-n')) === '2 vols à vérifier', `« ${await p.textContent('#an-n')} »`);
  await p.click('#an-btn'); await p.waitForTimeout(300);
  verifier(JSON.stringify((await affiches()).sort()) === '["v3","v7"]' && await p.getAttribute('#an-btn', 'aria-pressed') === 'true', 'appui : seulement les 2 vols avec « ! »');
  await p.click('#an-btn'); await p.waitForTimeout(300);
  verifier((await affiches()).length === 12 && await p.getAttribute('#an-btn', 'aria-pressed') === 'false', 'nouvel appui : retour à tous les vols');

  console.log('360 et 393 px : haut de l\'accueil sans trou');
  for (const largeur of [360, 393]) {
    await p.setViewportSize({ width: largeur, height: 852 }); await p.waitForTimeout(250);
    const avec = await haut();
    // tous les vols reportés : la mise en page ne doit pas bouger (avant, la ligne disparaissait et tout remontait)
    await p.evaluate(async () => { const e = await import('./js/etat.js'); for (const v of e.etat.vols.filter(x => x.aReporter)) { const { aReporter, ...w } = v; await e.enregistrerVol(w, { garderDate: true }); } });
    await p.waitForTimeout(300);
    const sans = await haut();
    verifier(JSON.stringify(avec) === JSON.stringify(sans) && avec.ecart >= 0 && avec.ecart <= 14 && !avec.deborde,
      `${largeur} px : liste à ${avec.ecart} px sous « ${avec.avant} », positions identiques avec ou sans vol à reporter, rien ne déborde`);
    await p.screenshot({ path: join(CAPT, `v066-accueil-${largeur}.png`) });
    await p.evaluate(async () => { const e = await import('./js/etat.js'); for (const id of ['v0', 'v3', 'v6', 'v9']) await e.enregistrerVol({ ...e.etat.vols.find(v => v.id === id), aReporter: true }, { garderDate: true }); });
    await p.waitForTimeout(300);
  }
  verifier(await carnet() === carnet0, 'PDF, CSV et totaux inchangés');
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.66 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); srv.fermer();
}
